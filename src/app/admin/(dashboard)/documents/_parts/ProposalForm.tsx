'use client'
/**
 * Proposal form. The draft saves itself in this browser as you type (as it
 * always has), so leaving the page doesn't lose it.
 */
import { ADMIN_FONTS } from '@/lib/admin-theme'
import { STANDARD_DEPOSIT_PCT } from '@/lib/terms'
import { useTheme } from '../../_components/theme'
import type { PendingPreview } from '../../_components/PreviewDialog'
import { PROJECT_TYPES, proposalPreview, type LineItem, type MilestoneDraft, type ProposalForm as Form } from '../../_lib/documents'
import { proposalPDF } from '../../_lib/pdf'
import type { Client } from '../../_lib/types'

export type ProposalFormProps = {
  proposalForm: Form; setProposalForm: (f: Form) => void
  lineItems: LineItem[]; setLineItems: (v: LineItem[]) => void
  proposalMilestones: MilestoneDraft[]; setProposalMilestones: (v: MilestoneDraft[]) => void
  clients: Client[]; error: string | null; sent: boolean; sending: boolean
  onSend: () => void; onClose: () => void; onPreview: (p: PendingPreview) => void
}

export default function ProposalForm({ proposalForm, setProposalForm, lineItems, setLineItems, proposalMilestones, setProposalMilestones, clients, error, sent, sending, onSend, onClose, onPreview }: ProposalFormProps) {
  const { d, inputStyle } = useTheme()
  const generateProposalDoc = () => proposalPDF(proposalForm, lineItems, proposalMilestones)
  const docError = error ? { kind: 'proposal', message: error } : null
  const proposalSent = sent
  const sendingProposal = sending
  const sendProposalEmail = onSend
  return (
    <div className="fill-form-wrap" style={{background:d.surface,borderColor:d.border}}>
      <div className="fill-form-title" style={{color:d.text}}>Project Proposal</div>
      <div className="fill-form-sub" style={{color:d.text3}}>Fill in the details and download a professional proposal PDF to send before the contract.</div>
      <div className="section-mini-label" style={{color:d.text3}}>Client info</div>
      <div className="form-grid">
        <div className="form-group" style={{gridColumn:'1/-1'}}>
          <div className="form-label" style={{color:d.text3}}>Select from discovery clients</div>
          <select style={inputStyle} onChange={e=>{
            const c = clients.find(cl=>cl.id===e.target.value)
            if(c) setProposalForm({...proposalForm,client_name:c.name,client_email:c.email,client_business:c.business||''})
          }} defaultValue="">
            <option value="" disabled>Select a client...</option>
            {clients.filter(c=>c.pipeline_stage==='discovery_call').map(c=>(
              <option key={c.id} value={c.id}>{c.name}{c.business?' — '+c.business:''}</option>
            ))}
          </select>
        </div>
        <div className="form-group"><div className="form-label" style={{color:d.text3}}>Client name</div><input style={inputStyle} value={proposalForm.client_name} onChange={e=>setProposalForm({...proposalForm,client_name:e.target.value})} placeholder="Full name"/></div>
        <div className="form-group"><div className="form-label" style={{color:d.text3}}>Client email</div><input style={inputStyle} value={proposalForm.client_email} onChange={e=>setProposalForm({...proposalForm,client_email:e.target.value})} placeholder="client@email.com"/></div>
        <div className="form-group" style={{gridColumn:'1/-1'}}><div className="form-label" style={{color:d.text3}}>Business name (optional)</div><input style={inputStyle} value={proposalForm.client_business} onChange={e=>setProposalForm({...proposalForm,client_business:e.target.value})} placeholder="Company or LLC name"/></div>
      </div>
      <div className="section-divider" style={{background:d.border}}/>
      <div className="section-mini-label" style={{color:d.text3}}>Project</div>
      <div className="form-grid">
        <div className="form-group"><div className="form-label" style={{color:d.text3}}>Project title</div><input style={inputStyle} value={proposalForm.project_title} onChange={e=>setProposalForm({...proposalForm,project_title:e.target.value})} placeholder="Beyond the Horizon Website"/></div>
        <div className="form-group"><div className="form-label" style={{color:d.text3}}>Project type</div><select style={inputStyle} value={proposalForm.project_type} onChange={e=>setProposalForm({...proposalForm,project_type:e.target.value})}>{PROJECT_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
      </div>
      <div className="section-divider" style={{background:d.border}}/>
      <div className="section-mini-label" style={{color:d.text3}}>Scope</div>
      <div className="form-grid">
        <div className="form-group" style={{gridColumn:'1/-1'}}><div className="form-label" style={{color:d.text3}}>What I understood about the project</div><textarea className="form-input" style={{background:d.white,borderColor:d.border,color:d.text,minHeight:80}} value={proposalForm.understood} onChange={e=>setProposalForm({...proposalForm,understood:e.target.value})} placeholder="Based on our conversation, you are looking for a professional website that..."/></div>
        <div className="form-group" style={{gridColumn:'1/-1'}}><div className="form-label" style={{color:d.text3}}>What is not included (optional)</div><textarea className="form-input" style={{background:d.white,borderColor:d.border,color:d.text}} value={proposalForm.out_of_scope} onChange={e=>setProposalForm({...proposalForm,out_of_scope:e.target.value})} placeholder="Logo design, copywriting, photography, ongoing maintenance..."/></div>
      </div>
      <div className="section-divider" style={{background:d.border}}/>
      <div className="section-mini-label" style={{color:d.text3}}>Investment breakdown</div>
      <div style={{fontSize:12,color:d.text3,marginBottom:10}}>Add each service as a line item with its price. The total and deposit are calculated automatically.</div>
      {lineItems.map((item, idx) => (
        <div key={idx} style={{display:'grid',gridTemplateColumns:'1fr 120px 32px',gap:8,marginBottom:8,alignItems:'center'}}>
          <input style={inputStyle} value={item.description} onChange={e=>{const updated=[...lineItems];updated[idx]={...updated[idx],description:e.target.value};setLineItems(updated)}} placeholder={"Landing page, Scheduling integration..."}/>
          <input style={{...inputStyle,textAlign:'right'}} type="number" value={item.price} onChange={e=>{const updated=[...lineItems];updated[idx]={...updated[idx],price:e.target.value};setLineItems(updated)}} placeholder="0"/>
          <button aria-label="Remove" onClick={()=>setLineItems(lineItems.filter((_,i)=>i!==idx))} style={{background:'none',border:'none',color:d.text3,cursor:'pointer',fontSize:16,padding:'0 4px',lineHeight:1}}>x</button>
        </div>
      ))}
      <button onClick={()=>setLineItems([...lineItems,{description:'',price:''}])} style={{background:d.accentBg,border:'1px solid '+d.border2,color:d.text,fontFamily:ADMIN_FONTS.body,fontSize:13,fontWeight:600,padding:'8px 16px',borderRadius:8,cursor:'pointer',marginBottom:12}}>+ Add line item</button>
      {lineItems.some(i=>i.price) && (
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderTop:'1px solid '+d.border,marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:500,color:d.text}}>Total</div>
          <div style={{fontSize:14,fontWeight:600,color:d.accent}}>${lineItems.reduce((s,i)=>s+(parseFloat(i.price)||0),0).toLocaleString()}</div>
        </div>
      )}
      <div className="section-divider" style={{background:d.border}}/>
      <div className="section-mini-label" style={{color:d.text3}}>Payment and timeline</div>
      <div className="form-grid">
        <div className="form-group" style={{gridColumn:'1/-1'}}><div className="form-label" style={{color:d.text3}}>Payment schedule</div><select style={inputStyle} value={proposalForm.payment_plan} onChange={e=>setProposalForm({...proposalForm,payment_plan:e.target.value})}><option value="standard">Standard website: 50% upfront, 50% at delivery</option><option value="milestones">Custom project: deposit, then milestones in this proposal</option></select></div>
        <div className="form-group"><div className="form-label" style={{color:d.text3}}>Deposit (%)</div><input style={inputStyle} disabled={proposalForm.payment_plan!=='milestones'} value={proposalForm.payment_plan==='milestones'?proposalForm.deposit_pct:String(STANDARD_DEPOSIT_PCT)} onChange={e=>setProposalForm({...proposalForm,deposit_pct:e.target.value})}/></div>
        <div className="form-group"><div className="form-label" style={{color:d.text3}}>Timeline estimate</div><input style={inputStyle} value={proposalForm.timeline} onChange={e=>setProposalForm({...proposalForm,timeline:e.target.value})} placeholder="4 to 6 weeks from deposit"/></div>
        <div className="form-group"><div className="form-label" style={{color:d.text3}}>Start date (est.)</div><input style={inputStyle} type="date" value={proposalForm.start_date} onChange={e=>setProposalForm({...proposalForm,start_date:e.target.value})}/></div>
        <div className="form-group"><div className="form-label" style={{color:d.text3}}>Delivery date (est.)</div><input style={inputStyle} type="date" value={proposalForm.delivery_date} onChange={e=>setProposalForm({...proposalForm,delivery_date:e.target.value})}/></div>
        <div className="form-group"><div className="form-label" style={{color:d.text3}}>Revisions included</div><input style={inputStyle} value={proposalForm.revisions} onChange={e=>setProposalForm({...proposalForm,revisions:e.target.value})}/></div>
        <div className="form-group"><div className="form-label" style={{color:d.text3}}>Hourly rate ($)</div><input style={inputStyle} value={proposalForm.hourly_rate} onChange={e=>setProposalForm({...proposalForm,hourly_rate:e.target.value})}/></div>
      </div>
      <div className="section-divider" style={{background:d.border}}/>
      {proposalForm.payment_plan === 'milestones' ? (<>
      <div className="section-mini-label" style={{color:d.text3}}>Milestone schedule</div>
      <div style={{fontSize:12,color:d.text3,marginBottom:10}}>
        Break the balance into milestones. Each has deliverables, a due date, and a fee.
        {lineItems.some(i=>i.price) && (() => {
          const total = lineItems.reduce((s,i)=>s+(parseFloat(i.price)||0),0)
          const dep = total * (parseFloat(proposalForm.deposit_pct)/100)
          const bal = total - dep
          const mTotal = proposalMilestones.reduce((s,m)=>s+(parseFloat(m.fee)||0),0)
          return <span style={{marginLeft:8,color:Math.round(mTotal)===Math.round(bal)?d.greenText:d.accent}}>Milestone total: ${mTotal.toLocaleString()} / ${bal.toLocaleString()} required (balance after ${dep.toLocaleString()} deposit)</span>
        })()}
      </div>
      {proposalMilestones.map((milestone, idx) => (
        <div key={idx} style={{background:d.white,border:'1px solid '+d.border,borderRadius:8,padding:16,marginBottom:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <input style={{...inputStyle,width:'auto',flex:1,fontWeight:500,fontSize:12}} value={milestone.name} onChange={e=>{const u=[...proposalMilestones];u[idx]={...u[idx],name:e.target.value};setProposalMilestones(u)}} placeholder="Milestone name"/>
            <button aria-label="Remove" onClick={()=>setProposalMilestones(proposalMilestones.filter((_,i)=>i!==idx))} style={{background:'none',border:'none',color:d.text3,cursor:'pointer',fontSize:16,padding:'0 4px 0 12px',lineHeight:1}}>x</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
            <div>
              <div style={{fontSize:12,color:d.text3,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>Due date</div>
              <input style={inputStyle} type="date" value={milestone.dueDate} onChange={e=>{const u=[...proposalMilestones];u[idx]={...u[idx],dueDate:e.target.value};setProposalMilestones(u)}}/>
            </div>
            <div>
              <div style={{fontSize:12,color:d.text3,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>Fee ($)</div>
              <input style={{...inputStyle,textAlign:'right'}} type="number" value={milestone.fee} onChange={e=>{const u=[...proposalMilestones];u[idx]={...u[idx],fee:e.target.value};setProposalMilestones(u)}} placeholder="0"/>
            </div>
          </div>
          <div>
            <div style={{fontSize:12,color:d.text3,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>Deliverables</div>
            <textarea className="form-input" style={{background:d.surface,borderColor:d.border,color:d.text,minHeight:60}} value={milestone.deliverables} onChange={e=>{const u=[...proposalMilestones];u[idx]={...u[idx],deliverables:e.target.value};setProposalMilestones(u)}} placeholder="What will be delivered at this milestone..."/>
          </div>
        </div>
      ))}
      <button onClick={()=>setProposalMilestones([...proposalMilestones,{name:'Milestone '+(proposalMilestones.length+1),deliverables:'',dueDate:'',fee:''}])} style={{background:d.accentBg,border:'1px solid '+d.border2,color:d.text,fontFamily:ADMIN_FONTS.body,fontSize:13,fontWeight:600,padding:'8px 16px',borderRadius:8,cursor:'pointer',marginBottom:12}}>+ Add milestone</button>
      </>) : (
      <div style={{fontSize:12,color:d.text3,marginBottom:10}}>Standard website project: 50% upfront to reserve the project and begin work, remaining 50% due at delivery, before public launch or final handoff. Switch to milestones for larger custom projects.</div>
      )}
      <div className="section-divider" style={{background:d.border}}/>
      <div className="section-mini-label" style={{color:d.text3}}>Next steps</div>
      <div className="form-group" style={{marginBottom:12}}>
        <div className="form-label" style={{color:d.text3}}>Next steps message</div>
        <textarea className="form-input" style={{background:d.white,borderColor:d.border,color:d.text}} value={proposalForm.next_steps} onChange={e=>setProposalForm({...proposalForm,next_steps:e.target.value})}/>
      </div>
      <div className="section-divider" style={{background:d.border}}/>
      <div className="section-mini-label" style={{color:d.text3}}>Personal message (included in email)</div>
      <div className="form-group" style={{marginBottom:16}}>
        <div className="form-label" style={{color:d.text3}}>Your message to the client</div>
        <textarea className="form-input" style={{background:d.white,borderColor:d.border,color:d.text,minHeight:100}} value={proposalForm.message} onChange={e=>setProposalForm({...proposalForm,message:e.target.value})} placeholder={'Hi ' + (proposalForm.client_name.split(' ')[0] || 'there') + ',\n\nGreat speaking with you today. Please find your proposal attached...'}/>
      </div>
      {docError?.kind === 'proposal' && (
        <div role="alert" style={{background:d.red,color:d.redText,border:'1px solid '+d.redText,borderRadius:8,padding:'10px 14px',fontSize:12,marginBottom:12,lineHeight:1.5}}>
          {docError.message}
        </div>
      )}
      {proposalSent && (
        <div style={{background:d.green,color:d.greenText,borderRadius:8,padding:'10px 14px',fontSize:12,marginBottom:12,textAlign:'center'}}>
          Proposal sent to {proposalForm.client_email}
        </div>
      )}
      <div className="form-actions">
        <button className="btn-cancel" style={{borderColor:d.border,color:d.text2}} onClick={onClose}>Cancel</button>
        <button className="btn-save" style={{background:d.surface2,color:d.text}} onClick={()=>onPreview({ doc: proposalPreview(proposalForm, lineItems), action: 'download', onConfirm: generateProposalDoc })}>Preview</button>
        <button className="btn-save" style={{background:d.surface2,color:d.text}} onClick={generateProposalDoc}>Download PDF</button>
        <button className="btn-save" disabled={sendingProposal||!proposalForm.client_email} onClick={sendProposalEmail}>
          {sendingProposal?'Sending...':'Send to Client'}
        </button>
      </div>
    </div>
  )
}
