'use client'
/** Contract form, filled from an accepted proposal. All legal terms are preloaded. */
import { STANDARD_HOURLY_RATE, TERMS_VERSION, formatRate } from '@/lib/terms'
import { useTheme } from '../../_components/theme'
import type { PendingPreview } from '../../_components/PreviewDialog'
import { PROJECT_TYPES, contractFromProposal, contractPreview, contractTermsDoc, type ContractForm as Form } from '../../_lib/documents'
import { contractDoc } from '../../_lib/pdf'
import type { Row } from '../../_lib/types'

export type ContractFormProps = {
  contractForm: Form; setContractForm: (f: Form) => void; proposals: Row[]
  error: string | null; sent: boolean; sending: boolean
  onSend: () => void; onClose: () => void; onPreview: (p: PendingPreview) => void
}

export default function ContractForm({ contractForm, setContractForm, proposals, error, sent, sending, onSend, onClose, onPreview }: ContractFormProps) {
  const { d, inputStyle } = useTheme()
  const generateContractDoc = () => contractDoc(contractForm)
  const docError = error ? { kind: 'contract', message: error } : null
  const contractSent = sent
  const sendingContract = sending
  const sendContractEmail = onSend
  return (
    <div className="fill-form-wrap" style={{background:d.surface,borderColor:d.border}}>
      <div className="fill-form-title" style={{color:d.text}}>Freelance Contract</div>
      <div className="fill-form-sub" style={{color:d.text3}}>Select an accepted SOW to auto-fill. All legal terms are pre-loaded. Client signs with a drawn signature.</div>
      <div className="section-mini-label" style={{color:d.text3}}>Select from accepted proposals</div>
      <div className="form-grid">
        <div className="form-group" style={{gridColumn:'1/-1'}}>
          <select aria-label="Select from accepted proposals" style={inputStyle} onChange={e=>{
            const p = proposals.find(pr=>pr.id===e.target.value)
            if(p) { setContractForm(contractFromProposal(p, contractForm)); return }
          }} defaultValue="">
            <option value="" disabled>Select a client...</option>
            {proposals.filter(p=>p.status==='accepted').map(p=>(
              <option key={p.id} value={p.id}>{p.client_name} — {p.project_title}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="section-divider" style={{background:d.border}}/>
      <div className="section-mini-label" style={{color:d.text3}}>Client and project</div>
      <div className="form-grid">
        <div className="form-group"><div className="form-label" style={{color:d.text3}}>Client name</div><input style={inputStyle} value={contractForm.client_name} onChange={e=>setContractForm({...contractForm,client_name:e.target.value})} placeholder="Full name"/></div>
        <div className="form-group"><div className="form-label" style={{color:d.text3}}>Client email</div><input style={inputStyle} value={contractForm.client_email} onChange={e=>setContractForm({...contractForm,client_email:e.target.value})} placeholder="client@email.com"/></div>
        <div className="form-group" style={{gridColumn:'1/-1'}}><div className="form-label" style={{color:d.text3}}>Business name (optional)</div><input style={inputStyle} value={contractForm.client_business} onChange={e=>setContractForm({...contractForm,client_business:e.target.value})} placeholder="Company or LLC name"/></div>
        <div className="form-group"><div className="form-label" style={{color:d.text3}}>Project title</div><input style={inputStyle} value={contractForm.project_title} onChange={e=>setContractForm({...contractForm,project_title:e.target.value})} placeholder="Project name"/></div>
        <div className="form-group"><div className="form-label" style={{color:d.text3}}>Project type</div><select style={inputStyle} value={contractForm.project_type} onChange={e=>setContractForm({...contractForm,project_type:e.target.value})}>{PROJECT_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
        <div className="form-group"><div className="form-label" style={{color:d.text3}}>Start date</div><input style={inputStyle} type="date" value={contractForm.start_date} onChange={e=>setContractForm({...contractForm,start_date:e.target.value})}/></div>
        <div className="form-group"><div className="form-label" style={{color:d.text3}}>Delivery date</div><input style={inputStyle} type="date" value={contractForm.delivery_date} onChange={e=>setContractForm({...contractForm,delivery_date:e.target.value})}/></div>
      </div>
      <div className="section-divider" style={{background:d.border}}/>
      <div className="section-mini-label" style={{color:d.text3}}>Payment</div>
      <div className="form-grid-3">
        <div className="form-group"><div className="form-label" style={{color:d.text3}}>Total fee ($)</div><input style={inputStyle} type="number" value={contractForm.total_fee} onChange={e=>setContractForm({...contractForm,total_fee:e.target.value})} placeholder="0"/></div>
        <div className="form-group" style={{gridColumn:'1/-1'}}><div className="form-label" style={{color:d.text3}}>Payment schedule</div><select style={inputStyle} value={contractForm.payment_plan} onChange={e=>setContractForm({...contractForm,payment_plan:e.target.value})}><option value="standard">Standard website: 50% upfront, 50% at delivery</option><option value="milestones">Custom project: milestones defined in the proposal</option></select></div>
        <div className="form-group"><div className="form-label" style={{color:d.text3}}>Deposit ($)</div><input style={inputStyle} type="number" disabled={contractForm.payment_plan!=='milestones'} value={contractForm.payment_plan==='milestones'?contractForm.deposit:String(contractTermsDoc(contractForm).deposit)} onChange={e=>setContractForm({...contractForm,deposit:e.target.value})} placeholder="0"/></div>
        <div className="form-group"><div className="form-label" style={{color:d.text3}}>Balance ($)</div><input style={inputStyle} type="number" disabled={contractForm.payment_plan!=='milestones'} value={contractForm.payment_plan==='milestones'?contractForm.balance:String(contractTermsDoc(contractForm).balance)} onChange={e=>setContractForm({...contractForm,balance:e.target.value})} placeholder="0"/></div>
        <div className="form-group"><div className="form-label" style={{color:d.text3}}>Kill fee (%)</div><input style={inputStyle} value={contractForm.kill_fee_pct} onChange={e=>setContractForm({...contractForm,kill_fee_pct:e.target.value})}/></div>
        <div className="form-group" style={{gridColumn:'2/-1'}}><div className="form-label" style={{color:d.text3}}>Payment method</div><input style={inputStyle} value={contractForm.payment_method} onChange={e=>setContractForm({...contractForm,payment_method:e.target.value})}/></div>
      </div>
      <div className="section-divider" style={{background:d.border}}/>
      <div className="section-mini-label" style={{color:d.text3}}>Deposit invoice (sent automatically on signature)</div>
      <div style={{fontSize:12,color:d.text3,marginBottom:10}}>These details go on the deposit invoice that gets sent the moment the client signs the contract.</div>
      <div className="form-grid">
        <div className="form-group"><div className="form-label" style={{color:d.text3}}>Invoice number</div><input style={inputStyle} value={contractForm.invoice_number} onChange={e=>setContractForm({...contractForm,invoice_number:e.target.value})} placeholder="INV-2026-001"/></div>
        <div className="form-group"><div className="form-label" style={{color:d.text3}}>Due date</div><input style={inputStyle} type="date" value={contractForm.invoice_due_date} onChange={e=>setContractForm({...contractForm,invoice_due_date:e.target.value})}/></div>
        <div className="form-group" style={{gridColumn:'1/-1'}}><div className="form-label" style={{color:d.text3}}>Service description</div><input style={inputStyle} value={contractForm.invoice_service_desc} onChange={e=>setContractForm({...contractForm,invoice_service_desc:e.target.value})} placeholder="Project name: deposit to begin"/></div>
      </div>
      <div className="section-divider" style={{background:d.border}}/>
      <div className="section-mini-label" style={{color:d.text3}}>Legal terms included</div>
      <div style={{background:d.white,border:'1px solid '+d.border,borderRadius:8,padding:16,fontSize:12,color:d.text2,lineHeight:1.8}}>
        <div style={{marginBottom:6}}>Same 12 clauses as the contract the client signs online (terms version {TERMS_VERSION}):</div>
        <div style={{marginBottom:6}}>1. Services: scope and change order rate ({formatRate(STANDARD_HOURLY_RATE)}, one hour minimum, estimate approved first)</div>
        <div style={{marginBottom:6}}>2. Payment: {contractForm.payment_plan === 'milestones' ? 'Deposit, then milestones defined in the proposal' : '50% upfront, 50% at delivery before launch or handoff'}, late payment interest (1.5%/month)</div>
        <div style={{marginBottom:6}}>3. Kill fee: {contractForm.kill_fee_pct}% of total if cancelled after work begins</div>
        <div style={{marginBottom:6}}>4. Intellectual property: full ownership transfers on final payment</div>
        <div style={{marginBottom:6}}>5. Revisions: 2 rounds included, additional at {formatRate(STANDARD_HOURLY_RATE)} with an approved estimate</div>
        <div style={{marginBottom:6}}>6. Client responsibilities: content, assets, credentials, and feedback on time</div>
        <div style={{marginBottom:6}}>7. Confidentiality: both parties keep proprietary info confidential</div>
        <div style={{marginBottom:6}}>8. Warranties: original work; defects reported within 30 days of launch are fixed without using care time</div>
        <div style={{marginBottom:6}}>9. Limitation of liability: capped at total amount paid</div>
        <div style={{marginBottom:6}}>10. Dispute resolution: informal first, then arbitration in Maryland</div>
        <div style={{marginBottom:6}}>11. Governing law: State of Maryland</div>
        <div>12. Entire agreement: with the accepted proposal and SOW</div>
      </div>
      {docError?.kind === 'contract' && (
        <div role="alert" style={{background:d.red,color:d.redText,border:'1px solid '+d.redText,borderRadius:8,padding:'10px 14px',fontSize:12,marginTop:12,lineHeight:1.5}}>
          {docError.message}
        </div>
      )}
      {contractSent && (
        <div style={{background:d.green,color:d.greenText,borderRadius:8,padding:'10px 14px',fontSize:12,marginTop:12,textAlign:'center'}}>
          Contract sent to {contractForm.client_email} for signature
        </div>
      )}
      <div className="form-actions" style={{marginTop:16}}>
        <button className="btn-cancel" style={{borderColor:d.border,color:d.text2}} onClick={onClose}>Cancel</button>
        <button className="btn-save" style={{background:d.surface2,color:d.text}} onClick={()=>onPreview({ doc: contractPreview(contractForm), action: 'download', onConfirm: generateContractDoc })}>Preview</button>
        <button className="btn-save" style={{background:d.surface2,color:d.text}} onClick={generateContractDoc}>Download</button>
        <button className="btn-save" disabled={sendingContract||!contractForm.client_email} onClick={sendContractEmail}>
          {sendingContract?'Sending...':'Send for Signature'}
        </button>
      </div>
    </div>
  )
}
