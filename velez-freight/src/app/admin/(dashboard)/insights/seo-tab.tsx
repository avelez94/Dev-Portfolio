import { CircleAlert, CircleCheck, CircleDashed } from "lucide-react";
import type { StaffSession } from "@/lib/auth";
import type { Period } from "@/lib/metrics/period";
import { addDays, dayStartUtc } from "@/lib/metrics/period";
import { site } from "@/config/site";
import { SEO, type PageSeo } from "@/config/seo";
import { gscConfig, loadSearchData, type Row, type SearchData } from "@/lib/search/search-console";
import { Chart } from "@/components/admin/charts/chart";
import { C } from "@/components/admin/charts/types";

const CHANNEL_LABEL: Record<string, string> = { organic_search: "Search engines (unpaid)", paid_search: "Paid search", direct: "Direct or bookmark", referral: "Links from other sites", social: "Social media", email: "Email", unknown: "Not recorded" };
const ENGINE_LABEL: Record<string, string> = { google: "Google", bing: "Bing", duckduckgo: "DuckDuckGo", yahoo: "Yahoo", ecosia: "Ecosia", brave: "Brave", other: "Other search engines" };
const TYPE_LABEL: Record<string, string> = { general: "General", shipper: "Shipper", carrier: "Carrier", launch_notification: "Launch updates", quote: "Freight quote" };

const n = (v: number) => new Intl.NumberFormat("en-US").format(v);
const pctFmt = (v: number | null) => (v === null ? "None yet" : `${(v * 100).toFixed(1)}%`);
const posFmt = (v: number | null) => (v === null ? "None yet" : v.toFixed(1));

function Check({ state, title, detail }: { state: "ok" | "warn" | "off"; title: string; detail: string }) {
  const Icon = state === "ok" ? CircleCheck : state === "warn" ? CircleAlert : CircleDashed;
  const color = state === "ok" ? "text-success" : state === "warn" ? "text-warning" : "text-slate-muted";
  return (
    <li className="flex gap-3 py-2.5">
      <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${color}`} />
      <div><p className="text-sm font-semibold text-navy">{title}<span className="sr-only">{state === "ok" ? " (done)" : " (not done)"}</span></p><p className="text-sm text-charcoal">{detail}</p></div>
    </li>
  );
}

function Metric({ label, value, previous, note }: { label: string; value: string; previous?: string; note?: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <p className="text-xs text-slate-muted">{label}</p>
      <p className="mt-1 font-serif text-2xl font-bold text-navy">{value}</p>
      {previous !== undefined && <p className="mt-0.5 text-xs text-slate-muted">Previous period: {previous}</p>}
      {note && <p className="mt-0.5 text-xs text-slate-muted">{note}</p>}
    </div>
  );
}

function RowTable({ caption, rows, keyLabel, link }: { caption: string; rows: Row[]; keyLabel: string; link?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
      <table className="w-full min-w-[30rem] text-sm">
        <caption className="mb-3 text-left font-sans text-sm font-bold text-navy">{caption}</caption>
        <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-muted"><th scope="col" className="py-2 pr-3">{keyLabel}</th><th scope="col" className="px-2 py-2 text-right">Clicks</th><th scope="col" className="px-2 py-2 text-right">Impressions</th><th scope="col" className="px-2 py-2 text-right">CTR</th><th scope="col" className="px-2 py-2 text-right">Avg position</th></tr></thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => {
            const k = r.keys?.[0] ?? "";
            return (
              <tr key={k}>
                <td className="max-w-[22rem] truncate py-2 pr-3">{link ? <a href={k} target="_blank" rel="noopener noreferrer" className="text-brand-red-dark underline">{k.replace(/^https?:\/\/[^/]+/, "") || "/"}</a> : k}</td>
                <td className="px-2 py-2 text-right">{n(r.clicks)}</td><td className="px-2 py-2 text-right">{n(r.impressions)}</td>
                <td className="px-2 py-2 text-right">{pctFmt(r.ctr)}</td><td className="px-2 py-2 text-right">{r.position.toFixed(1)}</td>
              </tr>
            );
          })}
          {!rows.length && <tr><td colSpan={5} className="py-3 text-slate-muted">No data for this period yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/** Search & SEO: Search Console performance when connected, plus inquiries by how visitors arrived. */
export async function SeoTab({ s, period }: { s: StaffSession; period: Period }) {
  const cfg = gscConfig();
  let search: SearchData | null = null;
  let searchError: string | null = null;
  if (cfg) {
    try {
      search = await loadSearchData(cfg, period);
    } catch (e) {
      searchError = e instanceof Error ? e.message : "Search Console could not be reached.";
    }
  }

  const [{ data: attr }, { data: prevAttr }, { data: first }] = await Promise.all([
    s.db.from("inquiry_attribution").select("inquiry_type, landing_page, traffic_channel, search_engine").gte("created_at", dayStartUtc(period.from)).lt("created_at", dayStartUtc(addDays(period.to, 1))).limit(5000),
    s.db.from("inquiry_attribution").select("traffic_channel").gte("created_at", dayStartUtc(period.prevFrom)).lt("created_at", dayStartUtc(addDays(period.prevTo, 1))).limit(5000),
    s.db.from("inquiry_attribution").select("created_at").order("created_at").limit(1),
  ]);
  const rows = attr ?? [];
  const organic = rows.filter((r) => r.traffic_channel === "organic_search");
  const prevOrganic = (prevAttr ?? []).filter((r) => r.traffic_channel === "organic_search").length;
  const count = <T extends string>(list: { [k: string]: unknown }[], key: string, labels: Record<string, string>) =>
    Object.entries(list.reduce<Record<string, number>>((a, r) => { const k = String(r[key] ?? "unknown"); a[k] = (a[k] ?? 0) + 1; return a; }, {}))
      .map(([k, v]) => ({ name: labels[k] ?? k, count: v } as { name: T | string; count: number })).sort((a, b) => b.count - a.count);
  const landing = count(organic, "landing_page", {});
  const indexable = (Object.values(SEO) as PageSeo[]).filter((p) => p.index).length;
  const temporary = /\.vercel\.app$/.test(new URL(site.url).hostname);

  return (
    <div className="space-y-6">
      <section aria-labelledby="seo-setup" className="rounded-xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
        <h2 id="seo-setup" className="font-sans text-sm font-bold uppercase tracking-wide text-navy">Search visibility setup</h2>
        <ul className="mt-2 divide-y divide-line">
          <Check state={temporary || !site.url.startsWith("https://") ? "warn" : "ok"} title="Canonical website address" detail={temporary ? `Using the temporary address ${site.url}. Search engines should index the business domain once it is connected (Settings, Company Profile records the planned domain).` : `Search engines are pointed to ${site.url}.`} />
          <Check state={temporary ? "warn" : "ok"} title="Open to search engines" detail={temporary ? "The temporary vercel.app address requires a Vercel sign in, so search engines cannot read the site yet. A connected custom domain is public; indexing starts once you approve publishing it." : "Public pages are served on the business domain; admin, preview and email pages stay excluded."} />
          <Check state="ok" title="Sitemap and robots" detail={`${indexable} public pages in ${site.url}/sitemap.xml. Admin, API and unsubscribe pages are excluded and protected by sign in.`} />
          <Check state={cfg ? (searchError ? "warn" : "ok") : "off"} title="Google Search Console" detail={cfg ? (searchError ? `Connected, but the last request failed: ${searchError}` : `Connected to ${cfg.siteUrl}. Figures are final data and lag two to three days.`) : "Not connected. Needed for search queries, impressions, clicks, positions and indexing reports. See docs/SEO_STRATEGY.md for the setup steps."} />
          <Check state="off" title="Website analytics" detail="Not connected. Visitor counts by page need an analytics provider, which requires your approval. Until then, Search Console clicks show visits from Google search." />
          <Check state={first?.length ? "ok" : "warn"} title="Inquiry source recording" detail={first?.length ? `Recording since ${new Date(first[0].created_at).toLocaleDateString("en-US", { dateStyle: "medium" })}. Only the landing page, a broad channel and the search engine name are kept.` : "Ready; no website inquiry has been recorded with a source yet."} />
        </ul>
      </section>

      {search && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Clicks from Google search" value={n(search.current.clicks)} previous={n(search.previous.clicks)} />
            <Metric label="Impressions" value={n(search.current.impressions)} previous={n(search.previous.impressions)} />
            <Metric label="Click through rate" value={pctFmt(search.current.ctr)} previous={pctFmt(search.previous.ctr)} />
            <Metric label="Average position" value={posFmt(search.current.position)} previous={posFmt(search.previous.position)} note="Lower is better" />
          </div>
          <Chart title="Search traffic trend" description="Daily clicks and impressions from Google Search Console." kind="line" xKey="date"
            data={search.byDate.map((r) => ({ date: r.keys?.[0] ?? "", clicks: r.clicks, impressions: r.impressions }))}
            series={[{ key: "impressions", label: "Impressions", color: C.slate }, { key: "clicks", label: "Clicks", color: C.navy }]} />
          <div className="grid gap-6 xl:grid-cols-2">
            <RowTable caption="Top search queries" rows={search.queries} keyLabel="Query" />
            <RowTable caption="Top landing pages from search" rows={search.pages} keyLabel="Page" link />
          </div>
          <section aria-labelledby="seo-index" className="rounded-xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
            <h2 id="seo-index" className="font-sans text-sm font-bold uppercase tracking-wide text-navy">Sitemaps and indexing</h2>
            {search.sitemaps.length ? (
              <ul className="mt-3 divide-y divide-line text-sm">
                {search.sitemaps.map((m) => (
                  <li key={m.path} className="flex flex-wrap gap-x-4 gap-y-1 py-2">
                    <span className="font-medium text-navy">{m.path}</span>
                    <span>Submitted {m.contents?.[0]?.submitted ?? "?"}, indexed {m.contents?.[0]?.indexed ?? "not reported"}</span>
                    <span className={Number(m.errors) ? "font-semibold text-danger" : ""}>{m.errors ?? 0} errors</span>
                    <span>{m.warnings ?? 0} warnings</span>
                    {m.isPending && <span className="text-warning">Processing</span>}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-slate-muted">No sitemap submitted in Search Console yet. Submit {site.url}/sitemap.xml.</p>}
          </section>
        </>
      )}

      <section aria-labelledby="seo-conv" className="space-y-4">
        <h2 id="seo-conv" className="font-sans text-sm font-bold uppercase tracking-wide text-navy">Website inquiries by how visitors arrived</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Inquiries with a recorded source" value={n(rows.length)} />
          <Metric label="From search engines" value={n(organic.length)} previous={n(prevOrganic)} />
          <Metric label="Share from search" value={rows.length ? pctFmt(organic.length / rows.length) : "None yet"} />
          <Metric label="Freight quote requests from search" value={n(organic.filter((r) => r.inquiry_type === "quote").length)} note="Only once operating" />
        </div>
        <div className="grid gap-6 xl:grid-cols-3">
          <Chart title="By channel" description="Where visitors who sent an inquiry first came from." kind="hbar" xKey="name" data={count(rows, "traffic_channel", CHANNEL_LABEL)} series={[{ key: "count", label: "Inquiries", color: C.navy }]} empty="No inquiries with a recorded source in this period." />
          <Chart title="Search inquiries by type" description="Inquiries from visitors who arrived from a search engine." kind="hbar" xKey="name" data={count(organic, "inquiry_type", TYPE_LABEL)} series={[{ key: "count", label: "Inquiries", color: C.sky }]} empty="No inquiries from search in this period." />
          <Chart title="Search engines" description="Which engine sent visitors who later sent an inquiry." kind="hbar" xKey="name" data={count(organic, "search_engine", ENGINE_LABEL)} series={[{ key: "count", label: "Inquiries", color: C.slate }]} empty="No inquiries from search in this period." />
        </div>
        <Chart title="Landing pages that led to inquiries from search" description="The first page these visitors saw on the site." kind="hbar" xKey="name" data={landing} series={[{ key: "count", label: "Inquiries", color: C.navy }]} empty="No inquiries from search in this period." />
        <p className="text-xs text-slate-muted">Counts are real inquiries saved in the database. Visitors who did not send an inquiry are not counted here. No search terms, full referrer addresses, IP addresses or cookies are used.</p>
      </section>
    </div>
  );
}
