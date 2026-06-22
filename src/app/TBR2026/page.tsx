"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

// ─── SUPABASE ─────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── PASSWORD ─────────────────────────────────────────────────────
const APP_PASSWORD = "bloomroom2024";

// ─── THEME ────────────────────────────────────────────────────────
const C = {
  bg:        "#1a1418",
  surface:   "#221c20",
  surfaceHi: "#2a2228",
  border:    "#3a2d35",
  borderHi:  "#4a3a42",
  pink:      "#c9899a",
  pinkDim:   "#3a1f28",
  sage:      "#8aab94",
  sageDim:   "#1e2e22",
  red:       "#c97878",
  redDim:    "#2e1a1a",
  muted:     "#7a6570",
  text:      "#e8dce2",
  textSub:   "#a08890",
};

// ─── HELPERS ──────────────────────────────────────────────────────
const fmt$ = (v: any) => {
  if (v === "" || v == null) return "";
  const n = Number(v);
  return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtK = (v: any) => {
  const n = Number(v);
  if (isNaN(n)) return v;
  if (Math.abs(n) >= 1000000) return "$" + (n / 1000000).toFixed(1) + "M";
  if (Math.abs(n) >= 1000) return "$" + (n / 1000).toFixed(0) + "K";
  return "$" + n.toFixed(0);
};
const calcPnL = (t: any) => {
  if (!t.premium_sold || t.premium_sold === "") return null;
  return (Number(t.premium_sold) - Number(t.premium_paid)) * (Number(t.contracts) || 1) * 100;
};
const calcPct = (t: any) => {
  if (!t.premium_sold || t.premium_sold === "") return null;
  return ((Number(t.premium_sold) - Number(t.premium_paid)) / Number(t.premium_paid)) * 100;
};
const tradeStatus = (t: any) => {
  if (!t.premium_sold || t.premium_sold === "") return "open";
  return (calcPnL(t) ?? 0) >= 0 ? "win" : "loss";
};

// ─── MOCK FLOW ────────────────────────────────────────────────────
const MOCK_FLOW = [
  { id:1, ticker:"NVDA", type:"CALL", strike:"130", expiration:"2025-08-15", premium:1420000, volume:8400,  openInterest:1200, sentiment:"BULLISH", sweepType:"SWEEP", time:"09:31:44" },
  { id:2, ticker:"SPY",  type:"PUT",  strike:"540", expiration:"2025-07-18", premium:890000,  volume:5200,  openInterest:800,  sentiment:"BEARISH", sweepType:"SWEEP", time:"09:44:12" },
  { id:3, ticker:"AAPL", type:"CALL", strike:"210", expiration:"2025-09-19", premium:2100000, volume:12000, openInterest:1100, sentiment:"BULLISH", sweepType:"SWEEP", time:"10:02:33" },
  { id:4, ticker:"TSLA", type:"PUT",  strike:"250", expiration:"2025-07-25", premium:660000,  volume:3100,  openInterest:900,  sentiment:"BEARISH", sweepType:"BLOCK", time:"10:15:09" },
  { id:5, ticker:"META", type:"CALL", strike:"580", expiration:"2025-08-01", premium:3400000, volume:18000, openInterest:2100, sentiment:"BULLISH", sweepType:"SWEEP", time:"10:28:55" },
  { id:6, ticker:"AMZN", type:"CALL", strike:"200", expiration:"2025-09-05", premium:1750000, volume:9200,  openInterest:700,  sentiment:"BULLISH", sweepType:"SWEEP", time:"10:41:20" },
  { id:7, ticker:"MSFT", type:"PUT",  strike:"410", expiration:"2025-07-11", premium:480000,  volume:2200,  openInterest:1800, sentiment:"BEARISH", sweepType:"BLOCK", time:"11:03:44" },
  { id:8, ticker:"GOOGL",type:"CALL", strike:"175", expiration:"2025-08-22", premium:920000,  volume:6700,  openInterest:500,  sentiment:"BULLISH", sweepType:"SWEEP", time:"11:17:31" },
];

// ─── SHARED UI ────────────────────────────────────────────────────
const Pill = ({ label, color }: { label: string; color: string }) => {
  const bg  = color==="sage"?C.sageDim:color==="pink"?C.pinkDim:color==="red"?C.redDim:C.sageDim;
  const clr = color==="sage"?C.sage:color==="pink"?C.pink:color==="red"?C.red:C.sage;
  return <span style={{ background:bg, color:clr, borderRadius:4, padding:"2px 8px", fontSize:11, fontWeight:700, letterSpacing:0.5 }}>{label}</span>;
};

const StatCard = ({ label, value, color }: { label: string; value: any; color?: string }) => (
  <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"13px 15px" }}>
    <div style={{ fontSize:10, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>{label}</div>
    <div style={{ fontSize:18, fontWeight:700, color:color||C.text }}>{value}</div>
  </div>
);

const inputStyle: React.CSSProperties = { width:"100%", background:C.bg, border:`1px solid ${C.border}`, borderRadius:7, padding:"9px 12px", color:C.text, fontSize:13, outline:"none", boxSizing:"border-box" };
const labelStyle: React.CSSProperties = { fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:0.5, display:"block", marginBottom:5 };
const filterBtn  = (active: boolean): React.CSSProperties => ({ background:active?C.pinkDim:C.surface, border:`1px solid ${active?C.pink:C.border}`, borderRadius:6, padding:"7px 12px", color:active?C.pink:C.muted, fontSize:12, cursor:"pointer", fontWeight:active?700:400 });

// ─── TAB BAR ──────────────────────────────────────────────────────
const TABS = [
  { id:"journal",   label:"📓 Trade Journal" },
  { id:"analytics", label:"🌸 Analytics"     },
];
const TabBar = ({ tab, setTab }: { tab: string; setTab: (t: string) => void }) => (
  <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, marginBottom:24 }}>
    {TABS.map(t => (
      <button key={t.id} onClick={()=>setTab(t.id)}
        style={{ padding:"11px 20px", background:"none", border:"none", borderBottom:tab===t.id?`2px solid ${C.pink}`:"2px solid transparent", color:tab===t.id?C.pink:C.muted, fontWeight:tab===t.id?700:400, fontSize:13, cursor:"pointer", marginBottom:-1 }}>
        {t.label}
      </button>
    ))}
  </div>
);

// ─── PASSWORD GATE ────────────────────────────────────────────────
function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = useState("");
  const [shake, setShake] = useState(false);
  const [err, setErr] = useState(false);

  const attempt = () => {
    if (pw === APP_PASSWORD) { onUnlock(); }
    else {
      setShake(true); setErr(true);
      setTimeout(()=>setShake(false), 500);
      setPw("");
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}`}</style>
      <div style={{ background:C.surface, border:`1px solid ${C.borderHi}`, borderRadius:20, padding:"48px 40px", maxWidth:380, width:"100%", textAlign:"center", animation:shake?"shake 0.4s ease":"none" }}>
        <div style={{ fontSize:42, marginBottom:12 }}>🌸</div>
        <div style={{ fontSize:26, fontWeight:800, color:C.text, letterSpacing:-0.5, marginBottom:4 }}>The Bloom Room</div>
        <div style={{ fontSize:13, color:C.muted, marginBottom:32 }}>Your private trading sanctuary</div>
        <input type="password" placeholder="Enter your password" value={pw}
          onChange={e=>{setPw(e.target.value);setErr(false);}}
          onKeyDown={e=>e.key==="Enter"&&attempt()}
          style={{ ...inputStyle, textAlign:"center", fontSize:15, padding:"12px", marginBottom:8, border:`1px solid ${err?C.red:C.border}` }}
          autoFocus />
        {err && <div style={{ fontSize:12, color:C.red, marginBottom:10 }}>Incorrect password. Try again.</div>}
        {!err && <div style={{ marginBottom:18 }} />}
        <button onClick={attempt} style={{ width:"100%", background:C.pink, color:C.bg, border:"none", borderRadius:9, padding:"12px", fontWeight:800, fontSize:15, cursor:"pointer" }}>
          Enter
        </button>
        <div style={{ marginTop:20, fontSize:11, color:C.muted }}>Private access only</div>
      </div>
    </div>
  );
}

// ─── SCREENER TAB ─────────────────────────────────────────────────
function ScreenerTab() {
  const [apiKey, setApiKey] = useState("");
  const [savedKey, setSavedKey] = useState("");
  const [flow, setFlow] = useState<any[]>(MOCK_FLOW);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<string|null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [minPremium, setMinPremium] = useState(500000);
  const [minVolOI, setMinVolOI] = useState(5);
  const [minContracts, setMinContracts] = useState(1000);
  const [sweepOnly, setSweepOnly] = useState(true);
  const [askSideOnly, setAskSideOnly] = useState(true);
  const [above50MA, setAbove50MA] = useState(true);
  const [minDTE, setMinDTE] = useState(21);
  const [maxDTE, setMaxDTE] = useState(90);
  const [usingMock, setUsingMock] = useState(true);
  const intervalRef = useRef<any>(null);

  const fetchFlow = async (key: string) => {
    if (!key) { setFlow(MOCK_FLOW); setUsingMock(true); return; }
    setLoading(true);
    try {
      const res = await fetch("https://api.unusualwhales.com/api/option-trades/flow-alerts", {
        headers: { Authorization:`Bearer ${key}`, Accept:"application/json" }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const mapped = (data.data||[]).map((d: any, i: number) => ({
        id:i, ticker:d.ticker||d.symbol,
        type:(d.option_type||d.type||"").toUpperCase()==="P"?"PUT":"CALL",
        strike:d.strike, expiration:d.expiry||d.expiration_date,
        premium:Number(d.total_premium||d.premium||0),
        volume:Number(d.volume||0), openInterest:Number(d.open_interest||d.oi||1),
        sentiment:(d.sentiment||"").toUpperCase(),
        sweepType:(d.trade_type||d.fill_type||"").toUpperCase().includes("SWEEP")?"SWEEP":"BLOCK",
        time:d.created_at?new Date(d.created_at).toLocaleTimeString():"",
      }));
      setFlow(mapped.length?mapped:MOCK_FLOW); setUsingMock(!mapped.length);
    } catch { setFlow(MOCK_FLOW); setUsingMock(true); }
    setLoading(false); setLastFetch(new Date().toLocaleTimeString());
  };

  useEffect(()=>{
    if (autoRefresh&&savedKey) intervalRef.current=setInterval(()=>fetchFlow(savedKey),30000);
    return ()=>clearInterval(intervalRef.current);
  },[autoRefresh,savedKey]);

  const getDTE = (exp: string) => !exp?999:Math.ceil((new Date(exp).getTime()-Date.now())/86400000);
  const filtered = useMemo(()=>flow.filter(f=>{
    const dte=getDTE(f.expiration);
    if (sweepOnly&&f.sweepType!=="SWEEP") return false;
    if (f.premium<minPremium) return false;
    if (f.volume<minContracts) return false;
    if (f.openInterest>0&&(f.volume/f.openInterest)<minVolOI) return false;
    if (dte<minDTE||dte>maxDTE) return false;
    if (filterType!=="all"&&f.type!==filterType) return false;
    // Ask side = bullish calls, bid side = bearish puts
    if (askSideOnly&&f.type==="CALL"&&f.sentiment==="BEARISH") return false;
    if (askSideOnly&&f.type==="PUT"&&f.sentiment==="BULLISH") return false;
    return true;
  }),[flow,filterType,minPremium,minVolOI,minContracts,sweepOnly,askSideOnly,minDTE,maxDTE]);

  const activeBtn = (active: boolean): React.CSSProperties => ({ background:active?C.pinkDim:C.surface, border:`1px solid ${active?C.pink:C.border}`, color:active?C.pink:C.muted, borderRadius:7, padding:"9px 14px", fontSize:12, cursor:"pointer", fontWeight:active?700:400 });

  return (
    <div>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:11, padding:16, marginBottom:18, display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ flex:1, minWidth:200 }}>
          <label style={labelStyle}>Unusual Whales API Key</label>
          <input type="password" placeholder="Paste your API key..." value={apiKey} onChange={e=>setApiKey(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"flex-end", paddingTop:20 }}>
          <button onClick={()=>{setSavedKey(apiKey);fetchFlow(apiKey);}} style={{ background:C.pink, color:C.bg, border:"none", borderRadius:7, padding:"9px 18px", fontWeight:700, fontSize:13, cursor:"pointer" }}>
            {loading?"Loading...":"Fetch Flow"}
          </button>
          <button onClick={()=>setAutoRefresh((a:boolean)=>!a)} style={activeBtn(autoRefresh)}>{autoRefresh?"Auto ON":"Auto OFF"}</button>
        </div>
        {usingMock&&<div style={{ width:"100%", fontSize:11, color:C.muted }}>Showing demo data. Add your API key to see live flow.</div>}
        {lastFetch&&!usingMock&&<div style={{ fontSize:11, color:C.muted }}>Last updated: {lastFetch}</div>}
      </div>

      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:11, padding:16, marginBottom:18 }}>
        <div style={{ fontSize:11, color:C.muted, marginBottom:12, letterSpacing:1, textTransform:"uppercase" }}>Your Criteria</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(148px,1fr))", gap:12 }}>
          {([
            ["Min Premium",[50000,100000,250000,500000,1000000,2000000],minPremium,(v:string)=>setMinPremium(Number(v)),fmtK],
            ["Min Vol/OI", [5,10,15,20],minVolOI,(v:string)=>setMinVolOI(Number(v)),(v:number)=>v+"x"],
            ["Min Contracts",[500,1000,2000,5000],minContracts,(v:string)=>setMinContracts(Number(v)),(v:number)=>v.toLocaleString()],
            ["Min DTE",    [21,30,45],minDTE,(v:string)=>setMinDTE(Number(v)),(v:number)=>v+" days"],
            ["Max DTE",    [30,45,60,90,120],maxDTE,(v:string)=>setMaxDTE(Number(v)),(v:number)=>v+" days"],
          ] as any[]).map(([label,opts,val,setter,fmtFn])=>(
            <div key={label}>
              <label style={labelStyle}>{label}</label>
              <select value={val} onChange={e=>setter(e.target.value)} style={{ width:"100%", background:C.bg, border:`1px solid ${C.border}`, borderRadius:6, padding:"8px 10px", color:C.text, fontSize:13 }}>
                {opts.map((v: any)=><option key={v} value={v}>{fmtFn(v)}</option>)}
              </select>
            </div>
          ))}
          <div>
            <label style={labelStyle}>Type</label>
            <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{ width:"100%", background:C.bg, border:`1px solid ${C.border}`, borderRadius:6, padding:"8px 10px", color:C.text, fontSize:13 }}>
              <option value="all">All</option><option value="CALL">Calls</option><option value="PUT">Puts</option>
            </select>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <button onClick={()=>setSweepOnly((s:boolean)=>!s)} style={activeBtn(sweepOnly)}>{sweepOnly?"Sweeps Only":"All Orders"}</button>
            <button onClick={()=>setAskSideOnly((s:boolean)=>!s)} style={activeBtn(askSideOnly)}>{askSideOnly?"Ask/Bid Side ON":"Ask/Bid Side OFF"}</button>
            <button onClick={()=>setAbove50MA((s:boolean)=>!s)} style={activeBtn(above50MA)}>{above50MA?"Above 50MA Only":"All Trends"}</button>
          </div>
        </div>
        {above50MA&&<div style={{ marginTop:12, fontSize:11, color:C.muted, background:C.bg, borderRadius:7, padding:"8px 12px", border:`1px solid ${C.border}` }}>
          🌸 Above 50MA filter is ON. Before entering any signal, manually confirm the stock and SPY are both trading above their 50 day moving average.
        </div>}
        {askSideOnly&&<div style={{ marginTop:8, fontSize:11, color:C.muted, background:C.bg, borderRadius:7, padding:"8px 12px", border:`1px solid ${C.border}` }}>
          🌸 Ask/Bid side filter is ON. Bullish calls must be ask side. Bearish puts must be bid side. Mixed sentiment signals are filtered out.
        </div>}
      </div>

      <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>{filtered.length} signal{filtered.length!==1?"s":""} matching your criteria</div>

      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:11, overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                {["Time","Ticker","Type","Strike","Expiry","DTE","Premium","Vol/OI","Order","Sentiment"].map(h=>(
                  <th key={h} style={{ padding:"11px 13px", textAlign:"left", color:C.muted, fontWeight:600, fontSize:11, textTransform:"uppercase", letterSpacing:0.5, whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0&&<tr><td colSpan={10} style={{ textAlign:"center", padding:40, color:C.muted }}>No signals match your criteria.</td></tr>}
              {filtered.map((f,i)=>{
                const dte=getDTE(f.expiration);
                const volOI=f.openInterest>0?(f.volume/f.openInterest).toFixed(1):"N/A";
                return(
                  <tr key={f.id} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?"transparent":C.surfaceHi }}>
                    <td style={{ padding:"11px 13px", color:C.textSub, fontFamily:"monospace", fontSize:11 }}>{f.time}</td>
                    <td style={{ padding:"11px 13px", fontWeight:700, color:C.text, letterSpacing:1 }}>{f.ticker}</td>
                    <td style={{ padding:"11px 13px" }}><Pill label={f.type} color={f.type==="CALL"?"sage":"pink"} /></td>
                    <td style={{ padding:"11px 13px", color:C.text }}>${f.strike}</td>
                    <td style={{ padding:"11px 13px", color:C.textSub }}>{f.expiration}</td>
                    <td style={{ padding:"11px 13px", color:dte<=30?C.red:C.sage, fontWeight:700 }}>{dte}d</td>
                    <td style={{ padding:"11px 13px", color:C.sage, fontWeight:700 }}>{fmtK(f.premium)}</td>
                    <td style={{ padding:"11px 13px", color:Number(volOI)>=5?C.sage:C.textSub, fontWeight:700 }}>{volOI}x</td>
                    <td style={{ padding:"11px 13px" }}><Pill label={f.sweepType} color={f.sweepType==="SWEEP"?"sage":"pink"} /></td>
                    <td style={{ padding:"11px 13px" }}><Pill label={f.sentiment||"NEUTRAL"} color={f.sentiment==="BULLISH"?"sage":"pink"} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── JOURNAL TAB ──────────────────────────────────────────────────
const emptyForm = { ticker:"", type:"CALL", strike:"", expiration:"", date_bought:"", date_sold:"", premium_paid:"", premium_sold:"", contracts:"1", notes:"" };

function JournalTab({ trades, setTrades }: { trades: any[]; setTrades: (t: any) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({...emptyForm});
  const [editId, setEditId] = useState<any>(null);
  const [filters, setFilters] = useState({ status:"all", ticker:"", type:"all" });
  const [sortBy, setSortBy] = useState("date_bought");
  const [sortDir, setSortDir] = useState("desc");
  const [closingId, setClosingId] = useState<any>(null);
  const [closePrice, setClosePrice] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(()=>{
    let r=[...trades];
    if (filters.status!=="all") r=r.filter(t=>tradeStatus(t)===filters.status);
    if (filters.ticker) r=r.filter(t=>t.ticker.toUpperCase().includes(filters.ticker.toUpperCase()));
    if (filters.type!=="all") r=r.filter(t=>t.type===filters.type);
    r.sort((a,b)=>{
      let av:any=a[sortBy]||"",bv:any=b[sortBy]||"";
      if(["premium_paid","premium_sold","contracts"].includes(sortBy)){av=Number(av);bv=Number(bv);}
      return sortDir==="asc"?(av<bv?-1:1):(av>bv?-1:1);
    });
    return r;
  },[trades,filters,sortBy,sortDir]);

  const stats = useMemo(()=>{
    const closed=trades.filter(t=>tradeStatus(t)!=="open");
    const wins=closed.filter(t=>tradeStatus(t)==="win");
    const losses=closed.filter(t=>tradeStatus(t)==="loss");
    const totalPnL=closed.reduce((s,t)=>s+(calcPnL(t)||0),0);
    const winRate=closed.length?(wins.length/closed.length)*100:0;
    const avgWin=wins.length?wins.reduce((s,t)=>s+(calcPct(t)||0),0)/wins.length:0;
    const avgLoss=losses.length?losses.reduce((s,t)=>s+(calcPct(t)||0),0)/losses.length:0;
    return{totalPnL,winRate,openCount:trades.filter(t=>tradeStatus(t)==="open").length,closedCount:closed.length,avgWin,avgLoss};
  },[trades]);

  const handleSubmit = async () => {
    if (!form.ticker||!form.premium_paid||!form.expiration||!form.date_bought) return;
    setSaving(true);
    const record = { ...form, id: editId || Date.now() };
    const { error } = await supabase.from("trades").upsert(record);
    if (!error) {
      if (editId) setTrades((p: any[])=>p.map(t=>t.id===editId?record:t));
      else setTrades((p: any[])=>[...p, record]);
      setEditId(null); setForm({...emptyForm}); setShowForm(false);
    }
    setSaving(false);
  };

  const submitClose = async () => {
    if (!closePrice) return;
    const updated = trades.find(t=>t.id===closingId);
    if (!updated) return;
    const record = { ...updated, premium_sold:closePrice, date_sold:closeDate };
    const { error } = await supabase.from("trades").upsert(record);
    if (!error) setTrades((p: any[])=>p.map(t=>t.id===closingId?record:t));
    setClosingId(null);
  };

  const handleDelete = async (id: any) => {
    await supabase.from("trades").delete().eq("id", id);
    setTrades((p: any[])=>p.filter(t=>t.id!==id));
  };

  const toggleSort=(col: string)=>{ if(sortBy===col) setSortDir(d=>d==="asc"?"desc":"asc"); else{setSortBy(col);setSortDir("desc");} };

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(130px,1fr))", gap:10, marginBottom:18 }}>
        {[
          {label:"Total P&L", value:fmt$(stats.totalPnL), color:stats.totalPnL>=0?C.sage:C.red},
          {label:"Win Rate",  value:stats.closedCount?stats.winRate.toFixed(1)+"%":"N/A", color:stats.winRate>=50?C.sage:C.red},
          {label:"Open",      value:stats.openCount, color:C.pink},
          {label:"Closed",    value:stats.closedCount, color:C.textSub},
          {label:"Avg Win",   value:stats.avgWin?"+"+stats.avgWin.toFixed(1)+"%":"N/A", color:C.sage},
          {label:"Avg Loss",  value:stats.avgLoss?stats.avgLoss.toFixed(1)+"%":"N/A", color:C.red},
        ].map(s=><StatCard key={s.label} {...s} />)}
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
        <input placeholder="Ticker..." value={filters.ticker} onChange={e=>setFilters(f=>({...f,ticker:e.target.value}))}
          style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, padding:"7px 11px", color:C.text, fontSize:13, width:110, outline:"none" }} />
        {["all","open","win","loss"].map(s=>(
          <button key={s} onClick={()=>setFilters(f=>({...f,status:s}))} style={filterBtn(filters.status===s)}>
            {s==="all"?"All":s.charAt(0).toUpperCase()+s.slice(1)}
          </button>
        ))}
        {["all","CALL","PUT"].map(t=>(
          <button key={t} onClick={()=>setFilters(f=>({...f,type:t}))} style={filterBtn(filters.type===t)}>
            {t==="all"?"C+P":t}
          </button>
        ))}
        <button onClick={()=>{setShowForm(true);setEditId(null);setForm({...emptyForm});}}
          style={{ marginLeft:"auto", background:C.pink, color:C.bg, border:"none", borderRadius:7, padding:"8px 16px", fontWeight:700, fontSize:13, cursor:"pointer" }}>
          + New Trade
        </button>
      </div>

      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:11, overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                {([["Ticker","ticker"],["Type","type"],["Strike","strike"],["Expiry","expiration"],["Bought","date_bought"],["Sold","date_sold"],["Paid","premium_paid"],["Sold For","premium_sold"],["Qty","contracts"],["P&L",null],["%",null],["Status",null],["",null]] as [string,string|null][]).map(([label,col],i)=>(
                  <th key={i} onClick={col?()=>toggleSort(col):undefined}
                    style={{ padding:"11px 13px", textAlign:"left", color:C.muted, fontWeight:600, fontSize:11, textTransform:"uppercase", letterSpacing:0.5, cursor:col?"pointer":"default", whiteSpace:"nowrap", userSelect:"none" }}>
                    {label}{col&&<span style={{ marginLeft:3, opacity:sortBy===col?1:0.3, fontSize:9 }}>{sortBy===col?(sortDir==="asc"?"▲":"▼"):"▼"}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0&&<tr><td colSpan={13} style={{ textAlign:"center", padding:40, color:C.muted }}>No trades yet. Add your first trade above.</td></tr>}
              {filtered.map((trade,i)=>{
                const status=tradeStatus(trade),pnl=calcPnL(trade),pct=calcPct(trade);
                return(
                  <tr key={trade.id} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?"transparent":C.surfaceHi }}>
                    <td style={{ padding:"11px 13px", fontWeight:700, color:C.text, letterSpacing:1 }}>{trade.ticker.toUpperCase()}</td>
                    <td style={{ padding:"11px 13px" }}><Pill label={trade.type} color={trade.type==="CALL"?"sage":"pink"} /></td>
                    <td style={{ padding:"11px 13px", color:C.textSub }}>${trade.strike}</td>
                    <td style={{ padding:"11px 13px", color:C.textSub }}>{trade.expiration}</td>
                    <td style={{ padding:"11px 13px", color:C.muted, fontSize:12 }}>{trade.date_bought}</td>
                    <td style={{ padding:"11px 13px", color:C.muted, fontSize:12 }}>{trade.date_sold||<span style={{ color:C.border }}>Open</span>}</td>
                    <td style={{ padding:"11px 13px", color:C.textSub }}>{fmt$(trade.premium_paid)}</td>
                    <td style={{ padding:"11px 13px", color:trade.premium_sold?C.textSub:C.border }}>{trade.premium_sold?fmt$(trade.premium_sold):"—"}</td>
                    <td style={{ padding:"11px 13px", color:C.muted, textAlign:"center" }}>{trade.contracts}</td>
                    <td style={{ padding:"11px 13px", fontWeight:700, color:pnl===null?C.border:pnl>=0?C.sage:C.red }}>{pnl===null?"—":(pnl>=0?"+":"")+fmt$(pnl)}</td>
                    <td style={{ padding:"11px 13px", fontWeight:700, color:pct===null?C.border:pct>=0?C.sage:C.red }}>{pct===null?"—":(pct>=0?"+":"")+pct.toFixed(1)+"%"}</td>
                    <td style={{ padding:"11px 13px" }}><Pill label={status.toUpperCase()} color={status==="open"?"pink":status==="win"?"sage":"red"} /></td>
                    <td style={{ padding:"11px 10px", whiteSpace:"nowrap" }}>
                      {status==="open"&&<button onClick={()=>{setClosingId(trade.id);setClosePrice("");setCloseDate(new Date().toISOString().split("T")[0]);}}
                        style={{ background:C.sageDim, border:`1px solid ${C.sage}`, color:C.sage, borderRadius:5, padding:"3px 9px", fontSize:11, cursor:"pointer", marginRight:5, fontWeight:600 }}>Close</button>}
                      <button onClick={()=>{setForm({...trade});setEditId(trade.id);setShowForm(true);}}
                        style={{ background:C.pinkDim, border:`1px solid ${C.pink}`, color:C.pink, borderRadius:5, padding:"3px 9px", fontSize:11, cursor:"pointer", marginRight:5 }}>Edit</button>
                      <button onClick={()=>handleDelete(trade.id)}
                        style={{ background:C.redDim, border:`1px solid ${C.red}`, color:C.red, borderRadius:5, padding:"3px 9px", fontSize:11, cursor:"pointer" }}>Del</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm&&(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:16 }}>
          <div style={{ background:C.surface, border:`1px solid ${C.borderHi}`, borderRadius:14, padding:26, width:"100%", maxWidth:500, maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ fontSize:17, fontWeight:700, marginBottom:18, color:C.pink }}>{editId?"Edit Trade":"New Trade"}</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              {([["Ticker","ticker","AAPL"],["Strike","strike","150"],["Date Bought","date_bought","date"],["Expiration","expiration","date"],["Premium Paid","premium_paid","2.50"],["Contracts","contracts","1"],["Date Sold","date_sold","date"],["Premium Sold","premium_sold","Leave blank if open"]] as [string,string,string][]).map(([label,key,ph])=>(
                <div key={key}>
                  <label style={labelStyle}>{label}</label>
                  <input type={ph==="date"?"date":"text"} placeholder={ph!=="date"?ph:""} value={(form as any)[key]} onChange={e=>setForm((f:any)=>({...f,[key]:e.target.value}))} style={inputStyle} />
                </div>
              ))}
            </div>
            <div style={{ marginTop:12 }}>
              <label style={labelStyle}>Type</label>
              <div style={{ display:"flex", gap:8, marginTop:5 }}>
                {["CALL","PUT"].map(t=>(
                  <button key={t} onClick={()=>setForm((f:any)=>({...f,type:t}))}
                    style={{ flex:1, padding:9, border:`1px solid ${form.type===t?C.pink:C.border}`, borderRadius:6, background:form.type===t?C.pinkDim:C.bg, color:form.type===t?C.pink:C.muted, fontWeight:700, cursor:"pointer", fontSize:13 }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginTop:12 }}>
              <label style={labelStyle}>Notes</label>
              <textarea value={form.notes} onChange={e=>setForm((f:any)=>({...f,notes:e.target.value}))} placeholder="Signal source, thesis..."
                style={{ ...inputStyle, minHeight:56, resize:"vertical" }} />
            </div>
            <div style={{ display:"flex", gap:8, marginTop:18 }}>
              <button onClick={handleSubmit} style={{ flex:1, background:C.pink, color:C.bg, border:"none", borderRadius:7, padding:11, fontWeight:700, fontSize:14, cursor:"pointer" }}>
                {saving?"Saving...":(editId?"Save":"Add Trade")}
              </button>
              <button onClick={()=>{setShowForm(false);setEditId(null);setForm({...emptyForm});}} style={{ flex:1, background:"transparent", color:C.muted, border:`1px solid ${C.border}`, borderRadius:7, padding:11, fontWeight:600, fontSize:14, cursor:"pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {closingId&&(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:16 }}>
          <div style={{ background:C.surface, border:`1px solid ${C.borderHi}`, borderRadius:14, padding:26, width:"100%", maxWidth:340 }}>
            <div style={{ fontSize:17, fontWeight:700, marginBottom:4, color:C.pink }}>Close Trade</div>
            <div style={{ fontSize:13, color:C.muted, marginBottom:18 }}>Enter the premium you sold for</div>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div>
                <label style={labelStyle}>Premium Sold (per share)</label>
                <input type="text" placeholder="3.75" value={closePrice} onChange={e=>setClosePrice(e.target.value)} style={{ ...inputStyle, marginTop:5 }} />
              </div>
              <div>
                <label style={labelStyle}>Date Sold</label>
                <input type="date" value={closeDate} onChange={e=>setCloseDate(e.target.value)} style={{ ...inputStyle, marginTop:5 }} />
              </div>
            </div>
            <div style={{ display:"flex", gap:8, marginTop:18 }}>
              <button onClick={submitClose} style={{ flex:1, background:C.sage, color:C.bg, border:"none", borderRadius:7, padding:11, fontWeight:700, fontSize:14, cursor:"pointer" }}>Confirm Close</button>
              <button onClick={()=>setClosingId(null)} style={{ flex:1, background:"transparent", color:C.muted, border:`1px solid ${C.border}`, borderRadius:7, padding:11, fontWeight:600, fontSize:14, cursor:"pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CHART TOOLTIPS ───────────────────────────────────────────────
const LineTooltip = ({ active, payload, label }: any) => {
  if (!active||!payload?.length) return null;
  const val=payload[0].value;
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.borderHi}`, borderRadius:8, padding:"10px 14px" }}>
      <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:16, fontWeight:700, color:val>=0?C.sage:C.red }}>{val>=0?"+":""}{fmt$(val)}</div>
    </div>
  );
};
const PieTooltip = ({ active, payload }: any) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.borderHi}`, borderRadius:8, padding:"8px 12px" }}>
      <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{payload[0].name}</div>
      <div style={{ fontSize:13, color:payload[0].payload.color }}>{typeof payload[0].value==="number"&&payload[0].value>100?fmt$(payload[0].value):payload[0].value}</div>
    </div>
  );
};

// ─── ANALYTICS TAB ────────────────────────────────────────────────
function AnalyticsTab({ trades }: { trades: any[] }) {
  const closed=trades.filter(t=>tradeStatus(t)!=="open");
  const wins=closed.filter(t=>tradeStatus(t)==="win");
  const losses=closed.filter(t=>tradeStatus(t)==="loss");

  const totalPnL=closed.reduce((s,t)=>s+(calcPnL(t)||0),0);
  const totalWinAmt=wins.reduce((s,t)=>s+(calcPnL(t)||0),0);
  const totalLossAmt=losses.reduce((s,t)=>s+(calcPnL(t)||0),0);
  const winRate=closed.length?(wins.length/closed.length)*100:0;
  const avgWin=wins.length?wins.reduce((s,t)=>s+(calcPct(t)||0),0)/wins.length:0;
  const avgLoss=losses.length?losses.reduce((s,t)=>s+(calcPct(t)||0),0)/losses.length:0;
  const profitFactor=Math.abs(totalLossAmt)>0?(totalWinAmt/Math.abs(totalLossAmt)).toFixed(2):"∞";
  const largestWin=wins.length?Math.max(...wins.map(t=>calcPnL(t)||0)):0;
  const largestLoss=losses.length?Math.min(...losses.map(t=>calcPnL(t)||0)):0;

  const lineData=useMemo(()=>{
    const sorted=[...closed].sort((a,b)=>new Date(a.date_sold||0).getTime()-new Date(b.date_sold||0).getTime());
    let running=0;
    const pts=[{label:"Start",pnl:0}];
    sorted.forEach((t,i)=>{running+=calcPnL(t)||0;pts.push({label:t.ticker+" #"+(i+1),pnl:Math.round(running*100)/100});});
    return pts;
  },[closed]);

  const wlPie=[
    {name:`Wins (${wins.length})`,    value:wins.length,   color:C.sage},
    {name:`Losses (${losses.length})`,value:losses.length, color:C.pink},
  ].filter(d=>d.value>0);

  const plPie=[
    {name:"Profit", value:Math.round(totalWinAmt*100)/100,           color:C.sage},
    {name:"Loss",   value:Math.round(Math.abs(totalLossAmt)*100)/100, color:C.pink},
  ].filter(d=>d.value>0);

  const lineColor=totalPnL>=0?C.sage:C.red;

  if (closed.length===0) return (
    <div style={{ textAlign:"center", padding:"80px 20px", color:C.muted }}>
      <div style={{ fontSize:36, marginBottom:12 }}>🌸</div>
      <div style={{ fontSize:16, fontWeight:600, color:C.textSub, marginBottom:8 }}>No closed trades yet</div>
      <div style={{ fontSize:13 }}>Close your first trade in the Journal and your analytics will bloom here.</div>
    </div>
  );

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px,1fr))", gap:10, marginBottom:24 }}>
        {[
          {label:"Total P&L",     value:fmt$(totalPnL),                         color:totalPnL>=0?C.sage:C.red},
          {label:"Win Rate",      value:winRate.toFixed(1)+"%",                  color:winRate>=50?C.sage:C.red},
          {label:"Profit Factor", value:profitFactor,                            color:C.pink},
          {label:"Avg Win %",     value:avgWin?"+"+avgWin.toFixed(1)+"%":"N/A", color:C.sage},
          {label:"Avg Loss %",    value:avgLoss?avgLoss.toFixed(1)+"%":"N/A",   color:C.red},
          {label:"Largest Win",   value:fmt$(largestWin),                        color:C.sage},
          {label:"Largest Loss",  value:fmt$(largestLoss),                       color:C.red},
          {label:"Total Trades",  value:closed.length,                           color:C.textSub},
        ].map(s=><StatCard key={s.label} {...s} />)}
      </div>

      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"20px 16px", marginBottom:18 }}>
        <div style={{ fontSize:11, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:16 }}>Cumulative P&L</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={lineData} margin={{ top:4, right:16, bottom:4, left:8 }}>
            <XAxis dataKey="label" tick={{ fill:C.muted, fontSize:10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill:C.muted, fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={(v:number)=>fmtK(v)} />
            <Tooltip content={<LineTooltip />} />
            <Line type="monotone" dataKey="pnl" stroke={lineColor} strokeWidth={2.5} dot={{ fill:lineColor, r:4, strokeWidth:0 }} activeDot={{ r:6, fill:lineColor }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"20px 16px" }}>
          <div style={{ fontSize:11, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:14 }}>Wins vs Losses</div>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={wlPie} cx="50%" cy="50%" innerRadius={48} outerRadius={76} paddingAngle={3} dataKey="value">
                {wlPie.map((e,i)=><Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip content={<PieTooltip />} />
              <Legend iconType="circle" iconSize={9} formatter={(v:string)=><span style={{ color:C.textSub, fontSize:12 }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ textAlign:"center", marginTop:4 }}>
            <span style={{ fontSize:22, fontWeight:800, color:winRate>=50?C.sage:C.red }}>{winRate.toFixed(0)}%</span>
            <span style={{ fontSize:12, color:C.muted, marginLeft:6 }}>win rate</span>
          </div>
        </div>

        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"20px 16px" }}>
          <div style={{ fontSize:11, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:14 }}>Profit vs Loss ($)</div>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={plPie} cx="50%" cy="50%" innerRadius={48} outerRadius={76} paddingAngle={3} dataKey="value">
                {plPie.map((e,i)=><Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip content={<PieTooltip />} />
              <Legend iconType="circle" iconSize={9} formatter={(v:string)=><span style={{ color:C.textSub, fontSize:12 }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ textAlign:"center", marginTop:4 }}>
            <span style={{ fontSize:22, fontWeight:800, color:totalPnL>=0?C.sage:C.red }}>{fmt$(totalPnL)}</span>
            <span style={{ fontSize:12, color:C.muted, marginLeft:6 }}>net</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────
export default function BloomRoom() {
  const [unlocked, setUnlocked] = useState(()=>{
    if (typeof window !== "undefined") return sessionStorage.getItem("tbr_unlocked") === "true";
    return false;
  });
  const [tab, setTab] = useState("journal");
  const [trades, setTrades] = useState<any[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTrades = async () => {
    const { data } = await supabase.from("trades").select("*").order("created_at", { ascending:false });
    if (data) setTrades(data);
    setLoadingTrades(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTrades();
    setRefreshing(false);
  };

  const handleUnlock = () => {
    sessionStorage.setItem("tbr_unlocked", "true");
    setUnlocked(true);
  };

  const handleLock = () => {
    sessionStorage.removeItem("tbr_unlocked");
    setUnlocked(false);
  };

  useEffect(()=>{
    if (!unlocked) return;
    loadTrades();
  },[unlocked]);

  if (!unlocked) return <PasswordGate onUnlock={handleUnlock} />;

  return (
    <div style={{ background:C.bg, minHeight:"100vh", fontFamily:"'Inter','SF Pro Display',system-ui,sans-serif", color:C.text, padding:"20px 16px" }}>
      <div style={{ maxWidth:1100, margin:"0 auto" }}>
        <div style={{ marginBottom:24, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
          <div>
            <div style={{ fontSize:10, letterSpacing:3, color:C.pink, textTransform:"uppercase", marginBottom:3 }}>Your Private Trading Sanctuary</div>
            <div style={{ fontSize:26, fontWeight:800, letterSpacing:-0.5 }}>🌸 The Bloom Room</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={handleRefresh}
              style={{ background:C.sageDim, border:`1px solid ${C.sage}`, color:C.sage, borderRadius:7, padding:"7px 14px", fontSize:12, cursor:"pointer", fontWeight:600 }}>
              {refreshing ? "Refreshing..." : "↻ Refresh"}
            </button>
            <button onClick={handleLock}
              style={{ background:"transparent", border:`1px solid ${C.border}`, color:C.muted, borderRadius:7, padding:"7px 14px", fontSize:12, cursor:"pointer" }}>
              Lock
            </button>
          </div>
        </div>
        <TabBar tab={tab} setTab={setTab} />
        {loadingTrades ? (
          <div style={{ textAlign:"center", padding:60, color:C.muted }}>Loading your trades...</div>
        ) : (
          <>
            {tab==="journal"   && <JournalTab trades={trades} setTrades={setTrades} />}
            {tab==="analytics" && <AnalyticsTab trades={trades} />}
          </>
        )}
      </div>
    </div>
  );
}
