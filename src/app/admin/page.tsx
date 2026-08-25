'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import jsPDF from 'jspdf'

type Submission = {
  id: string; name: string; email: string; business: string | null
  project_type: string; description: string; budget: string | null
  timeline: string | null; heard_from: string; priority: string | null
  notes: string | null; status: string; submitted_at: string
}
type Booking = {
  id: string; intake_id: string; scheduled_at: string
  zoom_join_url: string | null; zoom_host_url: string | null
  status: string; intake_submissions: Submission
}
type Client = {
  id: string; name: string; email: string; business: string | null
  pipeline_stage: string; created_at: string
  intake_id: string | null; booking_id: string | null
  notes: string | null; platform: string | null
}
type Availability = {
  id: string; day_of_week: number; start_time: string; end_time: string; is_active: boolean
}
type BlockedDate = { id: string; blocked_date: string; reason: string | null }
type BlockedSlot = { id: string; blocked_date: string; start_time: string; end_time: string; reason: string | null }
type Project = {
  id: string; client_id: string | null; name: string; type: string
  status: string; value: number; platform: string
  start_date: string | null; end_date: string | null; notes: string | null; created_at: string
}
type Invoice = {
  id: string; project_id: string | null; client_id: string | null
  invoice_number: string; amount: number; status: string
  invoice_type: string; total_fee: number; deposit_amount: number
  deposit_paid_date: string | null; hours: number; hourly_rate: number
  service_desc: string | null
  due_date: string | null; paid_date: string | null; notes: string | null; created_at: string
}
type Pricing = {
  id: string; name: string; price: string; description: string; updated_at: string
}
type Meeting = {
  id: string; client_id: string; scheduled_at: string
  zoom_join_url: string | null; zoom_host_url: string | null
  title: string; status: string; created_at: string
}
type Document = {
  id: string; client_id: string | null; name: string; type: string; storage_path: string; created_at: string
}

// Preview types for document preview modal
type PreviewDoc = {
  title: string
  sections: { label: string; value: string }[]
}

const DAYS_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa']
const DAYS_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const PIPELINE_STAGES = ['discovery_call','proposal_sent','active_project','closed','lost']
const STAGE_LABELS: Record<string,string> = { discovery_call:'Discovery', proposal_sent:'Proposal Sent', active_project:'Active Project', closed:'Closed', lost:'Lost' }
const CARD_COLORS_LIGHT = ['#F5EDE4','#EDE8E0','#E8E4DC','#F0E8DC','#EAE0D8']
const CARD_COLORS_DARK = ['#2C2018','#241E16','#201A14','#281E14','#2A2018']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const PROJECT_TYPES = ['Landing Page','Booking + Payments','Web Application','AI Workflow','Other']
const MY_EMAIL = 'alante@alantevelez.com'

type LineItemType = { description: string; price: string }
type MilestoneType = { name: string; deliverables: string; dueDate: string; fee: string }
type ProposalFormType = {
  client_name: string; client_email: string; client_business: string
  project_title: string; project_type: string; understood: string
  out_of_scope: string; deposit_pct: string; timeline: string
  next_steps: string; message: string; start_date: string
  delivery_date: string; revisions: string; hourly_rate: string
  payment_method: string
}

export default function AdminDashboard() {
  const [view, setView] = useState<'home'|'pipeline'|'revenue'|'docs'|'schedule'>('home')
  const [dark, setDark] = useState(true)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [unbooked, setUnbooked] = useState<Submission[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [availability, setAvailability] = useState<Availability[]>([])
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [showScheduleMeeting, setShowScheduleMeeting] = useState(false)
  const [meetingForm, setMeetingForm] = useState({ title:'Project Check-in', date:'', time:'' })
  const [schedulingMeeting, setSchedulingMeeting] = useState(false)
  const [pricing, setPricing] = useState<Pricing[]>([])
  const [editingPricing, setEditingPricing] = useState<string|null>(null)
  const [pricingEdits, setPricingEdits] = useState<Record<string,{price:string,description:string}>>({})
  const [focused, setFocused] = useState<{type:string,data:any}|null>(null)
  const [selectedDay, setSelectedDay] = useState<string|null>(null)
  const [blockStart, setBlockStart] = useState('')
  const [blockEnd, setBlockEnd] = useState('')
  const [newBlockedDate, setNewBlockedDate] = useState('')
  const [newBlockedReason, setNewBlockedReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [time, setTime] = useState(new Date())
  const [showNewProject, setShowNewProject] = useState(false)
  const [showAddClient, setShowAddClient] = useState(false)
  const [showClientInvoice, setShowClientInvoice] = useState(false)
  const [invoiceType, setInvoiceType] = useState<'project'|'revision'|null>(null)
  const [showActiveProjectPopup, setShowActiveProjectPopup] = useState(false)
  const [pendingAdvanceClient, setPendingAdvanceClient] = useState<Client|null>(null)
  const [activeProjectForm, setActiveProjectForm] = useState({ value:'', end_date:'' })
  const [editingNotes, setEditingNotes] = useState(false)
  const [clientNotes, setClientNotes] = useState('')
  const [activeFillForm, setActiveFillForm] = useState<'proposal'|'sow'|'contract'|null>(null)
  const [viewingInvoice, setViewingInvoice] = useState<Invoice|null>(null)
  const [viewingProject, setViewingProject] = useState<Project|null>(null)
  const [editingProjectNotes, setEditingProjectNotes] = useState(false)
  const [projectNotes, setProjectNotes] = useState('')
  const [sendingInvoice, setSendingInvoice] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailForm, setEmailForm] = useState({ subject:'', message:'' })
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  // Document preview modal
  const [previewDoc, setPreviewDoc] = useState<PreviewDoc|null>(null)
  const [previewOnConfirm, setPreviewOnConfirm] = useState<(() => void)|null>(null)
  const [previewAction, setPreviewAction] = useState<'download'|'send'>('download')

  const [np, setNp] = useState({ name:'', type:'Landing Page', value:'', platform:'direct', status:'active', end_date:'' })
  const [nc, setNc] = useState({ name:'', email:'', business:'', platform:'direct', pipeline_stage:'discovery_call' })
  const [clientInvoiceForm, setClientInvoiceForm] = useState({
    invoice_number:'', total_fee:'', deposit_amount:'', due_date:'', service_desc:'',
    hours:'', hourly_rate:'65'
  })
  const [contractForm, setContractForm] = useState<{
    client_name:string; client_email:string; client_business:string
    project_title:string; project_type:string
    start_date:string; delivery_date:string; total_fee:string
    deposit:string; balance:string; kill_fee_pct:string; payment_method:string
    invoice_number:string; invoice_service_desc:string; invoice_due_date:string
  }>({
    client_name:'', client_email:'', client_business:'',
    project_title:'', project_type:'Landing Page',
    start_date:'', delivery_date:'', total_fee:'',
    deposit:'', balance:'', kill_fee_pct:'25',
    payment_method:'Stripe, PayPal, Zelle, or Wise',
    invoice_number:'', invoice_service_desc:'', invoice_due_date:'',
  })
  const [sowForm, setSowForm] = useState({
    client_name:'', client_email:'', project_title:'', project_type:'Landing Page',
    start_date:'', delivery_date:'', total_fee:'', deposit:'', balance:'',
    description:'', deliverables:'', out_of_scope:'', revisions:'2', hourly_rate:'65',
    payment_method:'Stripe, PayPal, Zelle, or Wise',
  })
  const getSavedProposalForm = (): ProposalFormType => {
    try {
      const saved = localStorage.getItem('proposalForm')
      if (saved) return JSON.parse(saved)
    } catch {}
    return {
      client_name: '', client_email: '', client_business: '',
      project_title: '', project_type: 'Landing Page',
      understood: '', out_of_scope: '',
      deposit_pct: '50', timeline: '',
      next_steps: 'Once you accept this proposal, I will send the contract for your signature. Once signed, your deposit invoice will follow to officially kick things off.',
      message: '', start_date: '', delivery_date: '',
      revisions: '2', hourly_rate: '65',
      payment_method: 'Stripe, PayPal, Zelle, or Wise',
    }
  }
  const getSavedLineItems = (): LineItemType[] => {
    try {
      const saved = localStorage.getItem('proposalLineItems')
      if (saved) return JSON.parse(saved)
    } catch {}
    return [{ description: '', price: '' }]
  }
  const getSavedMilestones = (): MilestoneType[] => {
    try {
      const saved = localStorage.getItem('proposalMilestones')
      if (saved) return JSON.parse(saved)
    } catch {}
    return [{ name: 'Milestone 1', deliverables: '', dueDate: '', fee: '' }]
  }
  const [proposalForm, setProposalFormState] = useState<ProposalFormType>(getSavedProposalForm)
  const setProposalForm = (val: ProposalFormType) => {
    setProposalFormState(val)
    try { localStorage.setItem('proposalForm', JSON.stringify(val)) } catch {}
  }
  const [lineItems, setLineItemsState] = useState<LineItemType[]>(getSavedLineItems)
  const setLineItems = (val: LineItemType[]) => {
    setLineItemsState(val)
    try { localStorage.setItem('proposalLineItems', JSON.stringify(val)) } catch {}
  }
  const [proposalMilestones, setProposalMilestonesState] = useState<MilestoneType[]>(getSavedMilestones)
  const setProposalMilestones = (val: MilestoneType[]) => {
    setProposalMilestonesState(val)
    try { localStorage.setItem('proposalMilestones', JSON.stringify(val)) } catch {}
  }
  const [sendingProposal, setSendingProposal] = useState(false)
  const [proposalSent, setProposalSent] = useState(false)
  const [proposals, setProposals] = useState<any[]>([])
  const [sows, setSows] = useState<any[]>([])
  const [sowMilestones, setSowMilestones] = useState([{ name: 'Milestone 1', deliverables: '', dueDate: '', fee: '' }])
  const [sowProposalTotal, setSowProposalTotal] = useState(0)
  const [sendingSOW, setSendingSOW] = useState(false)
  const [sowSent, setSOWSent] = useState(false)
  const [sendingContract, setSendingContract] = useState(false)
  const [contractSent, setContractSent] = useState(false)

  const clockRef = useRef<ReturnType<typeof setInterval>|null>(null)

  useEffect(() => {
    fetchAll()
    clockRef.current = setInterval(() => setTime(new Date()), 1000)
    return () => { if (clockRef.current) clearInterval(clockRef.current) }
  }, [])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchBookings(),fetchUnbooked(),fetchClients(),fetchAvailability(),fetchBlockedDates(),fetchBlockedSlots(),fetchProjects(),fetchInvoices(),fetchDocuments(),fetchPricing(),fetchMeetings(),fetchProposals(),fetchSows()])
    setLoading(false)
  }
  async function fetchBookings() {
    const { data } = await supabase.from('bookings').select('*, intake_submissions(*)').eq('status','scheduled').order('scheduled_at',{ascending:true})
    const b = data || []; setBookings(b)
    if (b.length > 0 && !focused) setFocused({type:'booking',data:b[0]})
  }
  async function fetchUnbooked() {
    const { data } = await supabase.from('intake_submissions').select('*').eq('status','pending').order('submitted_at',{ascending:false})
    setUnbooked(data || [])
  }
  async function fetchClients() {
    const { data } = await supabase.from('clients').select('*').order('created_at',{ascending:false})
    setClients(data || [])
  }
  async function fetchAvailability() {
    const { data } = await supabase.from('availability').select('*').order('day_of_week')
    setAvailability(data || [])
  }
  async function fetchBlockedDates() {
    const { data } = await supabase.from('blocked_dates').select('*').gte('blocked_date',new Date().toISOString().split('T')[0]).order('blocked_date')
    setBlockedDates(data || [])
  }
  async function fetchBlockedSlots() {
    const { data } = await supabase.from('blocked_slots').select('*').gte('blocked_date',new Date().toISOString().split('T')[0]).order('blocked_date')
    setBlockedSlots(data || [])
  }
  async function fetchProjects() {
    const { data } = await supabase.from('projects').select('*').order('created_at',{ascending:false})
    setProjects(data || [])
  }
  async function fetchInvoices() {
    const { data } = await supabase.from('invoices').select('*').order('created_at',{ascending:false})
    setInvoices(data || [])
  }
  async function fetchDocuments() {
    const { data } = await supabase.from('documents').select('*').order('created_at',{ascending:false})
    setDocuments(data || [])
  }
  async function fetchPricing() {
    const { data } = await supabase.from('pricing').select('*').order('id')
    setPricing(data || [])
  }
  async function fetchMeetings() {
    const { data } = await supabase.from('meetings').select('*').order('scheduled_at',{ascending:false})
    setMeetings(data || [])
  }
  async function fetchProposals() {
    const { data } = await supabase.from('proposals').select('*').order('created_at',{ascending:false})
    setProposals(data || [])
  }
  async function fetchSows() {
    const { data } = await supabase.from('sows').select('*').order('created_at',{ascending:false})
    setSows(data || [])
  }
  async function scheduleMeeting(clientId: string, clientName: string, clientEmail: string) {
    if (!meetingForm.date || !meetingForm.time) return
    setSchedulingMeeting(true)
    const scheduledAt = new Date(meetingForm.date + 'T' + meetingForm.time + ':00-04:00').toISOString()
    try {
      await fetch('/api/meetings/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clientName, clientEmail, scheduledAt, title: meetingForm.title, cc: MY_EMAIL })
      })
      setMeetingForm({ title:'Project Check-in', date:'', time:'' })
      setShowScheduleMeeting(false)
      await fetchMeetings()
    } catch (e) { console.error(e) }
    setSchedulingMeeting(false)
  }

  async function savePricing(id: string) {
    const edits = pricingEdits[id]
    if (!edits) return
    await supabase.from('pricing').update({ price: edits.price, description: edits.description, updated_at: new Date().toISOString() }).eq('id', id)
    setEditingPricing(null)
    await fetchPricing()
  }
  async function handleLogout() {
    await fetch('/api/admin/auth', { method: 'DELETE' })
    window.location.href = '/admin/login'
  }
  async function toggleDay(a: Availability) {
    await supabase.from('availability').update({is_active:!a.is_active}).eq('id',a.id); await fetchAvailability()
  }
  async function updateHours(a: Availability, field: 'start_time'|'end_time', val: string) {
    await supabase.from('availability').update({[field]:val}).eq('id',a.id); await fetchAvailability()
  }
  async function addBlockedDate() {
    if (!newBlockedDate) return
    await supabase.from('blocked_dates').insert({blocked_date:newBlockedDate,reason:newBlockedReason||null})
    setNewBlockedDate(''); setNewBlockedReason(''); await fetchBlockedDates()
  }
  async function removeBlockedDate(id: string) {
    await supabase.from('blocked_dates').delete().eq('id',id); await fetchBlockedDates()
  }
  async function saveBlockedSlot() {
    if (!selectedDay || !blockStart || !blockEnd) return
    await supabase.from('blocked_slots').insert({ blocked_date: selectedDay, start_time: blockStart, end_time: blockEnd })
    setBlockStart(''); setBlockEnd(''); setSelectedDay(null); await fetchBlockedSlots()
  }
  async function removeBlockedSlot(id: string) {
    await supabase.from('blocked_slots').delete().eq('id',id); await fetchBlockedSlots()
  }
  async function moveToNextStage(c: Client) {
    const i = PIPELINE_STAGES.indexOf(c.pipeline_stage)
    if (i === PIPELINE_STAGES.length-1) return
    const nextStage = PIPELINE_STAGES[i+1]
    if (nextStage === 'active_project') {
      setPendingAdvanceClient(c); setShowActiveProjectPopup(true); return
    }
    await supabase.from('clients').update({pipeline_stage:nextStage}).eq('id',c.id)
    await fetchClients()
    if (focused?.type==='client' && focused.data.id===c.id) setFocused({type:'client',data:{...c,pipeline_stage:nextStage}})
  }
  async function markAsLost(c: Client) {
    await supabase.from('clients').update({pipeline_stage:'lost'}).eq('id',c.id)
    await supabase.from('projects').update({status:'lost'}).eq('client_id',c.id)
    await fetchClients(); await fetchProjects()
    if (focused?.type==='client' && focused.data.id===c.id) setFocused({type:'client',data:{...c,pipeline_stage:'lost'}})
  }
  async function confirmActiveProject() {
    if (!pendingAdvanceClient) return
    const c = pendingAdvanceClient
    await supabase.from('clients').update({pipeline_stage:'active_project'}).eq('id',c.id)
    if (activeProjectForm.value) {
      await supabase.from('projects').insert({
        client_id: c.id,
        name: c.name + (c.business ? ' — ' + c.business : ''),
        type: 'Web Application',
        value: parseFloat(activeProjectForm.value),
        platform: c.platform || 'direct',
        status: 'active',
        end_date: activeProjectForm.end_date || null,
      })
    }
    setShowActiveProjectPopup(false); setPendingAdvanceClient(null)
    setActiveProjectForm({ value:'', end_date:'' })
    await fetchClients(); await fetchProjects()
    if (focused?.type==='client' && focused.data.id===c.id) setFocused({type:'client',data:{...c,pipeline_stage:'active_project'}})
  }
  async function createClientFromBooking(b: Booking) {
    const intake = b.intake_submissions
    const { data: ex } = await supabase.from('clients').select('id').eq('intake_id',intake.id).single()
    if (ex) return
    await supabase.from('clients').insert({intake_id:intake.id,booking_id:b.id,name:intake.name,email:intake.email,business:intake.business,pipeline_stage:'discovery_call',notes:null,platform:'direct'})
    await fetchClients()
  }
  async function addClientManually() {
    if (!nc.name || !nc.email) return
    await supabase.from('clients').insert({name:nc.name,email:nc.email,business:nc.business||null,pipeline_stage:nc.pipeline_stage,platform:nc.platform,notes:null})
    setNc({ name:'', email:'', business:'', platform:'direct', pipeline_stage:'discovery_call' })
    setShowAddClient(false); await fetchClients()
  }
  async function saveClientNotes(clientId: string) {
    await supabase.from('clients').update({notes:clientNotes}).eq('id',clientId)
    setEditingNotes(false); await fetchClients()
    if (focused?.type === 'client') setFocused({type:'client',data:{...focused.data,notes:clientNotes}})
  }
  async function addProject() {
    if (!np.name || !np.value) return
    await supabase.from('projects').insert({ name:np.name, type:np.type, value:parseFloat(np.value), platform:np.platform, status:np.status, end_date:np.end_date||null })
    setNp({ name:'', type:'Landing Page', value:'', platform:'direct', status:'active', end_date:'' })
    setShowNewProject(false); await fetchProjects()
  }
  async function addClientInvoice(clientId: string, clientName: string, clientEmail: string, action: 'download'|'send' = 'download') {
    if (!clientInvoiceForm.invoice_number) return
    const isProject = invoiceType === 'project'
    const isRevision = invoiceType === 'revision'
    if (isProject && !clientInvoiceForm.total_fee) return
    if (isRevision && !clientInvoiceForm.hours) return
    const totalFee = isProject
      ? parseFloat(clientInvoiceForm.total_fee)
      : parseFloat(clientInvoiceForm.hours) * parseFloat(clientInvoiceForm.hourly_rate)
    const depositAmount = isProject
      ? parseFloat(clientInvoiceForm.deposit_amount || String(totalFee * 0.5))
      : 0
    const { data: insertedInv } = await supabase.from('invoices').insert({
      client_id: clientId,
      invoice_number: clientInvoiceForm.invoice_number,
      invoice_type: invoiceType || 'project',
      total_fee: totalFee,
      deposit_amount: depositAmount,
      amount: totalFee,
      due_date: clientInvoiceForm.due_date || null,
      service_desc: clientInvoiceForm.service_desc || null,
      hours: isRevision ? parseFloat(clientInvoiceForm.hours) : 0,
      hourly_rate: isRevision ? parseFloat(clientInvoiceForm.hourly_rate) : 65,
      status: isProject ? 'awaiting_deposit' : 'pending',
    }).select().single()
    if (action === 'download') {
      generateClientInvoicePDF(clientName, clientEmail, invoiceType || 'project', totalFee, depositAmount)
    } else if (action === 'send' && insertedInv) {
      await sendInvoiceEmail(clientName, clientEmail, insertedInv)
    }
    setClientInvoiceForm({ invoice_number:'', total_fee:'', deposit_amount:'', due_date:'', service_desc:'', hours:'', hourly_rate:'65' })
    setShowClientInvoice(false); setInvoiceType(null)
    await fetchInvoices()
  }
  async function sendInvoiceEmail(clientName: string, clientEmail: string, inv: Invoice) {
    setSendingInvoice(true)
    try {
      const totalFee = inv.total_fee || inv.amount
      const depositAmount = inv.deposit_amount || totalFee * 0.5
      await fetch('/api/invoices/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail, clientName, cc: MY_EMAIL,
          invoiceNumber: inv.invoice_number,
          invoiceType: inv.invoice_type,
          totalFee, depositAmount,
          dueDate: inv.due_date,
          serviceDesc: inv.service_desc,
          hours: inv.hours,
          hourlyRate: inv.hourly_rate,
        })
      })
    } catch(e) { console.error(e) }
    setSendingInvoice(false)
  }
  async function sendClientEmail(clientName: string, clientEmail: string) {
    if (!emailForm.subject || !emailForm.message) return
    setSendingEmail(true)
    try {
      await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientEmail, clientName, cc: MY_EMAIL, subject: emailForm.subject, message: emailForm.message })
      })
      setEmailSent(true)
      setTimeout(() => { setShowEmailModal(false); setEmailForm({ subject:'', message:'' }); setEmailSent(false) }, 1500)
    } catch(e) { console.error(e) }
    setSendingEmail(false)
  }
  async function saveProjectNotes(projectId: string) {
    await supabase.from('projects').update({notes:projectNotes}).eq('id',projectId)
    setEditingProjectNotes(false); await fetchProjects()
    if (viewingProject) setViewingProject({...viewingProject,notes:projectNotes})
  }
  async function markInvoicePaid(inv: Invoice) {
    const today = new Date().toISOString().split('T')[0]
    if (inv.invoice_type === 'project') {
      if (inv.status === 'awaiting_deposit') {
        await supabase.from('invoices').update({status:'deposit_paid', deposit_paid_date:today}).eq('id',inv.id)
      } else if (inv.status === 'deposit_paid') {
        await supabase.from('invoices').update({status:'paid', paid_date:today}).eq('id',inv.id)
      } else {
        await supabase.from('invoices').update({status:'paid', paid_date:today}).eq('id',inv.id)
      }
    } else {
      await supabase.from('invoices').update({status:'paid', paid_date:today}).eq('id',inv.id)
    }
    await fetchInvoices()
  }
  async function deleteProject(id: string) {
    await supabase.from('projects').delete().eq('id',id); await fetchProjects()
  }
  async function deleteInvoice(id: string) {
    await supabase.from('invoices').delete().eq('id',id); await fetchInvoices()
  }
  async function deleteDocument(id: string, path: string) {
    await supabase.storage.from('freelance-docs').remove([path])
    await supabase.from('documents').delete().eq('id',id); await fetchDocuments()
  }
  async function downloadDoc(path: string, name: string) {
    const { data } = await supabase.storage.from('freelance-docs').download(path)
    if (!data) return
    const url = URL.createObjectURL(data)
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }
  async function uploadTemplate(file: File) {
    const path = 'templates/' + Date.now() + '-' + file.name
    const { error } = await supabase.storage.from('freelance-docs').upload(path, file)
    if (error) return
    await supabase.from('documents').insert({ name: file.name, type: 'other', storage_path: path, client_id: null })
    await fetchDocuments()
  }

  function makePDF() {
    const doc = new jsPDF()
    const lm = 20, rm = 190, lineH = 7
    let y = 20
    const addLine = (text: string, size=11, bold=false, accent=false) => {
      doc.setFontSize(size)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      accent ? doc.setTextColor(196,112,74) : doc.setTextColor(44,36,32)
      const lines = doc.splitTextToSize(text, rm - lm)
      lines.forEach((line: string) => {
        if (y > 270) { doc.addPage(); y = 20 }
        doc.text(line, lm, y); y += lineH
      })
    }
    const addSpace = (n=1) => { y += lineH * n }
    const addDivider = () => {
      doc.setDrawColor(196,112,74); doc.setLineWidth(0.3)
      doc.line(lm, y, rm, y); y += lineH
    }
    return { doc, addLine, addSpace, addDivider, save: (name: string) => doc.save(name) }
  }

  // ─── Preview helpers ────────────────────────────────────────────────────────
  function openPreview(doc: PreviewDoc, action: 'download'|'send', onConfirm: () => void) {
    setPreviewDoc(doc)
    setPreviewAction(action)
    setPreviewOnConfirm(() => onConfirm)
  }

  function buildProposalPreview(): PreviewDoc {
    const f = proposalForm
    const validItems = lineItems.filter(i => i.description && i.price)
    const total = validItems.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0)
    const deposit = total * (parseFloat(f.deposit_pct) / 100)
    const itemsText = validItems.length > 0
      ? validItems.map(i => i.description + '  —  $' + parseFloat(i.price).toLocaleString()).join('\n') + '\n\nTotal: $' + total.toLocaleString()
      : 'No line items added yet.'
    return {
      title: 'Project Proposal — ' + (f.project_title || 'Untitled'),
      sections: [
        { label: 'Prepared for', value: [f.client_name, f.client_email, f.client_business].filter(Boolean).join('\n') },
        { label: 'Project', value: f.project_title + ' (' + f.project_type + ')' },
        { label: 'What I understood', value: f.understood || 'See attached notes.' },
        { label: 'Investment breakdown', value: itemsText },
        { label: 'Deposit required', value: f.deposit_pct + '% ($' + deposit.toLocaleString() + ') upfront to begin' },
        ...(f.out_of_scope ? [{ label: 'What is not included', value: f.out_of_scope }] : []),
        { label: 'Timeline', value: f.timeline || 'To be confirmed in SOW.' },
        { label: 'Next steps', value: f.next_steps },
      ]
    }
  }

  function buildSOWPreview(): PreviewDoc {
    const f = sowForm
    return {
      title: 'Statement of Work — ' + (f.project_title || 'Untitled'),
      sections: [
        { label: 'Client', value: [f.client_name, f.client_email].filter(Boolean).join('\n') },
        { label: 'Project', value: f.project_title + ' (' + f.project_type + ')' },
        { label: 'Dates', value: 'Start: ' + (f.start_date || 'TBD') + '  |  Delivery: ' + (f.delivery_date || 'TBD') },
        { label: 'Overview', value: f.description || 'See attached.' },
        { label: 'Deliverables', value: f.deliverables || 'To be defined.' },
        { label: 'Out of scope', value: f.out_of_scope || 'Anything not listed above.' },
        { label: 'Total fee', value: f.total_fee ? '$' + f.total_fee : 'TBD' },
        { label: 'Deposit', value: f.deposit ? '$' + f.deposit : 'TBD' },
        { label: 'Balance', value: f.balance ? '$' + f.balance : 'TBD' },
        { label: 'Revisions', value: f.revisions + ' rounds included. Additional at $' + f.hourly_rate + '/hr.' },
      ]
    }
  }

  function buildContractPreview(): PreviewDoc {
    const f = contractForm
    return {
      title: 'Freelance Contract — ' + (f.project_title || 'Untitled'),
      sections: [
        { label: 'Client', value: [f.client_name, f.client_email, f.client_business].filter(Boolean).join('\n') },
        { label: 'Project', value: f.project_title + ' (' + f.project_type + ')' },
        { label: 'Dates', value: 'Start: ' + (f.start_date || 'TBD') + '  |  Delivery: ' + (f.delivery_date || 'TBD') },
        { label: 'Total fee', value: f.total_fee ? '$' + f.total_fee : 'TBD' },
        { label: 'Deposit', value: f.deposit ? '$' + f.deposit : 'TBD' },
        { label: 'Balance', value: f.balance ? '$' + f.balance : 'TBD' },
        { label: 'Kill fee', value: f.kill_fee_pct + '% of total fee if cancelled after work begins' },
        { label: 'Payment method', value: f.payment_method },
        { label: 'Revisions', value: '2 rounds included. Additional at $65/hr.' },
        { label: 'Governing law', value: 'State of Indiana' },
      ]
    }
  }

  function buildInvoicePreview(clientName: string, clientEmail: string, type: string, totalFee: number, depositAmount: number): PreviewDoc {
    const f = clientInvoiceForm
    const isProject = type === 'project'
    return {
      title: 'Invoice #' + f.invoice_number + ' — ' + clientName,
      sections: [
        { label: 'Bill to', value: clientName + '\n' + clientEmail },
        { label: 'Service', value: f.service_desc || 'Web development services' },
        { label: 'Invoice type', value: isProject ? 'Project Invoice' : 'Revision Invoice' },
        ...(isProject ? [
          { label: 'Total fee', value: '$' + totalFee.toLocaleString() },
          { label: 'Deposit due now (50%)', value: '$' + depositAmount.toLocaleString() },
          { label: 'Balance due on delivery', value: '$' + (totalFee - depositAmount).toLocaleString() },
        ] : [
          { label: 'Hours', value: f.hours + 'h x $' + f.hourly_rate + '/hr' },
          { label: 'Total due', value: '$' + totalFee.toLocaleString() },
        ]),
        { label: 'Due date', value: f.due_date || 'Upon receipt' },
        { label: 'Payment', value: 'Stripe, PayPal, Zelle, or Wise' },
      ]
    }
  }
  // ─── End preview helpers ────────────────────────────────────────────────────

  function generateProposalDoc() {
    const f = proposalForm
    const validItems = lineItems.filter(i => i.description && i.price)
    const total = validItems.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0)
    const deposit = total * (parseFloat(f.deposit_pct) / 100)
    const { addLine, addSpace, addDivider, save } = makePDF()
    addLine('PROJECT PROPOSAL', 16, true, true)
    addLine('Alante Velez  |  Full Stack Web Developer', 10)
    addLine('alante@alantevelez.com  |  alantevelez.com', 10)
    addLine('Prepared: ' + new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), 10)
    addDivider(); addSpace()
    addLine('PREPARED FOR', 10, true, true); addSpace(0.5)
    addLine(f.client_name); addLine(f.client_email)
    if (f.client_business) addLine(f.client_business)
    addSpace(); addDivider()
    addLine('PROJECT', 10, true, true); addSpace(0.5)
    addLine('Title: ' + f.project_title)
    addLine('Type: ' + f.project_type)
    addSpace(); addDivider()
    addLine('WHAT I UNDERSTOOD', 10, true, true); addSpace(0.5)
    addLine(f.understood || 'See attached notes.')
    addSpace(); addDivider()
    addLine('INVESTMENT', 10, true, true); addSpace(0.5)
    validItems.forEach(item => {
      addLine(item.description + '  —  $' + parseFloat(item.price).toLocaleString())
    })
    addSpace(0.5)
    addLine('TOTAL: $' + total.toLocaleString(), 12, true)
    addSpace(0.5)
    addLine('Deposit (' + f.deposit_pct + '% due to begin): $' + deposit.toLocaleString())
    addLine('Balance due on delivery: $' + (total - deposit).toLocaleString())
    addLine('Change orders and additional revisions billed at $65/hr.')
    addSpace(); addDivider()
    if (f.out_of_scope) {
      addLine('WHAT IS NOT INCLUDED', 10, true, true); addSpace(0.5)
      addLine(f.out_of_scope); addSpace(); addDivider()
    }
    addLine('TIMELINE', 10, true, true); addSpace(0.5)
    addLine(f.timeline || 'Estimated timeline will be confirmed in the Statement of Work once content and scope are finalized.')
    addSpace(); addDivider()
    addLine('NEXT STEPS', 10, true, true); addSpace(0.5)
    addLine(f.next_steps)
    addSpace(); addDivider()
    addLine('SIGNATURES', 10, true, true); addSpace()
    addLine('Freelancer: Alante Velez'); addSpace()
    addLine('Date: ___________'); addSpace()
    addLine('Client: ' + f.client_name); addSpace()
    addLine('Date: ___________')
    save('Proposal_' + f.client_name.replace(/\s+/g,'_') + '_' + f.project_title.replace(/\s+/g,'_') + '.pdf')
  }

  async function sendProposalEmail() {
    const f = proposalForm
    if (!f.client_email || !f.client_name) return
    const validItems = lineItems.filter(i => i.description && i.price)
    const total = validItems.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0)
    const deposit = total * (parseFloat(f.deposit_pct) / 100)
    const balance = total - deposit
    const validMilestones = proposalMilestones.filter(m => m.deliverables && m.fee)
    const milestoneTotal = validMilestones.reduce((s, m) => s + (parseFloat(m.fee) || 0), 0)
    if (validMilestones.length > 0 && balance > 0 && Math.round(milestoneTotal) !== Math.round(balance)) {
      alert(`Milestone total ($${milestoneTotal.toLocaleString()}) must equal the balance after deposit ($${balance.toLocaleString()}).`)
      return
    }
    setSendingProposal(true)
    try {
      await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail: f.client_email,
          clientName: f.client_name,
          clientBusiness: f.client_business,
          projectTitle: f.project_title,
          projectType: f.project_type,
          understood: f.understood,
          lineItems: validItems,
          milestones: validMilestones,
          total,
          outOfScope: f.out_of_scope,
          depositPct: f.deposit_pct,
          timeline: f.timeline,
          startDate: f.start_date,
          deliveryDate: f.delivery_date,
          revisions: f.revisions,
          hourlyRate: parseFloat(f.hourly_rate),
          nextSteps: f.next_steps,
          message: f.message,
          cc: MY_EMAIL,
        })
      })
      setProposalSent(true)
      setTimeout(() => setProposalSent(false), 3000)
    } catch(e) { console.error(e) }
    setSendingProposal(false)
  }

  async function sendSOWEmail() {
    const f = sowForm
    if (!f.client_email || !f.client_name) return
    const validMilestones = sowMilestones.filter(m => m.deliverables && m.fee)
    const milestoneTotal = validMilestones.reduce((s, m) => s + (parseFloat(m.fee) || 0), 0)
    const total = parseFloat(f.total_fee) || sowProposalTotal || 0
    const deposit = parseFloat(f.deposit) || total * 0.5
    const balance = total - deposit
    if (balance > 0 && Math.round(milestoneTotal) !== Math.round(balance)) {
      alert(`Milestone total ($${milestoneTotal.toLocaleString()}) must equal the balance after deposit ($${balance.toLocaleString()}). The deposit of $${deposit.toLocaleString()} is paid upfront and is not part of the milestone schedule.`)
      return
    }
    setSendingSOW(true)
    try {
      const res = await fetch('/api/sows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: f.client_name,
          clientEmail: f.client_email,
          projectTitle: f.project_title,
          projectType: f.project_type,
          understood: f.description,
          outOfScope: f.out_of_scope,
          milestones: validMilestones,
          total,
          deposit,
          balance,
          depositPct: total > 0 ? Math.round((deposit/total)*100) : 50,
          startDate: f.start_date,
          deliveryDate: f.delivery_date,
          revisions: f.revisions,
          hourlyRate: parseFloat(f.hourly_rate),
          paymentMethod: f.payment_method,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSOWSent(true)
      setTimeout(() => setSOWSent(false), 3000)
    } catch(e) { console.error(e) }
    setSendingSOW(false)
  }

  function generateSOWDoc() {
    const f = sowForm
    const { addLine, addSpace, addDivider, save } = makePDF()
    addLine('STATEMENT OF WORK', 16, true, true)
    addLine('Alante Velez | Full Stack Web Developer', 10)
    addDivider(); addSpace()
    addLine('CLIENT INFORMATION', 10, true, true); addSpace(0.5)
    addLine('Client Name: ' + f.client_name)
    addLine('Client Email: ' + f.client_email)
    addLine('Project Title: ' + f.project_title)
    addLine('Project Type: ' + f.project_type)
    addLine('Start Date: ' + f.start_date)
    addLine('Estimated Delivery: ' + f.delivery_date)
    addSpace(); addDivider()
    addLine('PROJECT OVERVIEW', 10, true, true); addSpace(0.5)
    addLine(f.description || 'See attached.'); addSpace(); addDivider()
    addLine('DELIVERABLES', 10, true, true); addSpace(0.5)
    addLine(f.deliverables || 'To be defined.'); addSpace(); addDivider()
    addLine('OUT OF SCOPE', 10, true, true); addSpace(0.5)
    addLine(f.out_of_scope || 'Anything not listed above.'); addSpace(); addDivider()
    addLine('PAYMENT', 10, true, true); addSpace(0.5)
    addLine('Total Project Fee: $' + f.total_fee)
    addLine('Deposit (50% due upfront): $' + f.deposit)
    addLine('Final Payment (50% on delivery): $' + f.balance)
    addLine('Hourly Rate (change orders): $' + f.hourly_rate + '/hr')
    addLine('Payment Method: ' + f.payment_method)
    addLine('Invoice Terms: Due within 7 days')
    addSpace(); addDivider()
    addLine('REVISIONS', 10, true, true); addSpace(0.5)
    addLine('This project includes ' + f.revisions + ' rounds of revisions.')
    addLine('Additional revisions billed at $' + f.hourly_rate + '/hr.')
    addSpace(); addDivider()
    addLine('SIGNATURES', 10, true, true); addSpace()
    addLine('Freelancer: Alante Velez'); addSpace()
    addLine('Date: ___________'); addSpace()
    addLine('Client: ' + f.client_name); addSpace()
    addLine('Date: ___________')
    save('SOW_' + f.client_name.replace(/\s+/g,'_') + '.pdf')
  }

  function generateClientInvoicePDF(clientName: string, clientEmail: string, type: string, totalFee: number, depositAmount: number) {
    const f = clientInvoiceForm
    const { addLine, addSpace, addDivider, save } = makePDF()
    addLine('INVOICE', 16, true, true)
    addLine('Alante Velez | Full Stack Web Developer', 10)
    addDivider(); addSpace()
    addLine('INVOICE #' + f.invoice_number, 12, true); addSpace(0.5)
    addLine('Due Date: ' + (f.due_date || 'Upon receipt'))
    addSpace(); addDivider()
    addLine('BILL TO', 10, true, true); addSpace(0.5)
    addLine(clientName); addLine(clientEmail)
    addSpace(); addDivider()
    addLine('SERVICE', 10, true, true); addSpace(0.5)
    addLine(f.service_desc || 'Web development services')
    addSpace(); addDivider()
    if (type === 'project') {
      addLine('PAYMENT BREAKDOWN', 10, true, true); addSpace(0.5)
      addLine('Total Project Fee: $' + totalFee.toLocaleString()); addSpace(0.5)
      addLine('Deposit Due Now (50%): $' + depositAmount.toLocaleString(), 11, true)
      addLine('Balance Due on Delivery (50%): $' + (totalFee - depositAmount).toLocaleString(), 11, true)
      addSpace(0.5)
      addLine('Note: Final deliverables will be transferred upon receipt of the balance payment.', 10)
    } else {
      addLine('REVISION BILLING', 10, true, true); addSpace(0.5)
      addLine('Hours: ' + f.hours + ' hrs x $' + f.hourly_rate + '/hr')
      addLine('Total Due: $' + totalFee.toLocaleString(), 12, true)
    }
    addSpace(); addDivider()
    addLine('PAYMENT', 10, true, true); addSpace(0.5)
    addLine('Stripe, PayPal, Zelle, or Wise')
    addLine('Reference: Invoice #' + f.invoice_number + ' | ' + clientName)
    save('Invoice_' + f.invoice_number + '_' + clientName.replace(/\s+/g,'_') + '.pdf')
  }

  async function sendContractEmail() {
    const f = contractForm
    if (!f.client_email || !f.client_name) return
    if (!f.invoice_number) {
      alert('Please fill in the invoice number before sending.')
      return
    }
    setSendingContract(true)
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: f.client_name,
          clientEmail: f.client_email,
          clientBusiness: f.client_business,
          projectTitle: f.project_title,
          projectType: f.project_type,
          startDate: f.start_date,
          deliveryDate: f.delivery_date,
          totalFee: parseFloat(f.total_fee) || 0,
          deposit: parseFloat(f.deposit) || 0,
          balance: parseFloat(f.balance) || 0,
          killFeePct: parseFloat(f.kill_fee_pct) || 25,
          paymentMethod: f.payment_method,
          lineItems: [],
          invoiceNumber: f.invoice_number,
          invoiceServiceDesc: f.invoice_service_desc,
          invoiceDueDate: f.invoice_due_date,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setContractSent(true)
      setTimeout(() => setContractSent(false), 3000)
    } catch(e) { console.error(e) }
    setSendingContract(false)
  }

  function generateContractDoc() {
    const f = contractForm
    const { addLine, addSpace, addDivider, save } = makePDF()
    addLine('FREELANCE WEB DEVELOPMENT AGREEMENT', 16, true, true)
    addLine('Alante Velez | Full Stack Web Developer', 10)
    addLine('Effective Date: ' + new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}), 10)
    addDivider(); addSpace()
    addLine('PARTIES', 10, true, true); addSpace(0.5)
    addLine('Freelancer: Alante Velez')
    addLine('Client: ' + f.client_name + (f.client_business ? ' (' + f.client_business + ')' : ''))
    addLine('Client Email: ' + f.client_email)
    addSpace(); addDivider()
    addLine('PROJECT', 10, true, true); addSpace(0.5)
    addLine('Title: ' + f.project_title)
    addLine('Type: ' + f.project_type)
    addLine('Start Date: ' + f.start_date)
    addLine('Estimated Delivery: ' + f.delivery_date)
    addSpace(); addDivider()
    const clauses: [string,string][] = [
      ['1. SERVICES', 'Freelancer agrees to design and develop the project described above. Work outside the agreed scope will be billed at $65/hr with written approval required before proceeding.'],
      ['2. PAYMENT', 'Total Fee: $' + f.total_fee + '  Deposit: $' + f.deposit + '  Balance: $' + f.balance + '  Payment Method: ' + f.payment_method + '  Late payments accrue 1.5% interest per month after 14 days.'],
      ['3. KILL FEE', 'If Client cancels after work has begun, a kill fee of ' + f.kill_fee_pct + '% of the total fee is due immediately, plus payment for all work completed to date.'],
      ['4. INTELLECTUAL PROPERTY', 'Full ownership of all deliverables transfers to Client upon receipt of final payment. Freelancer retains the right to display work in portfolio.'],
      ['5. REVISIONS', 'Project includes 2 rounds of revisions. Additional revisions billed at $65/hr.'],
      ['6. CONFIDENTIALITY', 'Both parties agree to keep proprietary information confidential during and after the project.'],
      ['7. WARRANTIES', 'Freelancer warrants work will be original and free of known defects for 30 days post-delivery.'],
      ['8. LIMITATION OF LIABILITY', 'Freelancer liability is limited to the total amount paid under this agreement.'],
      ['9. GOVERNING LAW', 'This agreement is governed by the laws of the State of Indiana.'],
    ]
    clauses.forEach(([title, body]) => {
      addLine(title, 10, true, true); addSpace(0.3)
      addLine(body); addSpace()
    })
    addDivider()
    addLine('SIGNATURES', 10, true, true); addSpace()
    addLine('Freelancer: Alante Velez'); addSpace()
    addLine('Date: ___________'); addSpace()
    addLine('Client: ' + f.client_name); addSpace()
    addLine('Date: ___________')
    save('Contract_' + f.client_name.replace(/\s+/g,'_') + '.pdf')
  }

  function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}) }
  function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZoneName:'short'}) }
  function fmtShort(iso: string) { return new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric'}) }
  function fmtDayFull(dateStr: string) { return new Date(dateStr+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}) }
  function countdown(iso: string) {
    const diff = new Date(iso).getTime()-Date.now()
    if (diff<0) return 'Now'
    const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000)
    if (h>48) return Math.floor(h/24)+'d'
    if (h>0) return h+'h '+m+'m'
    return m+'m'
  }
  function fmtRelative(iso: string) {
    const d = Math.floor((Date.now()-new Date(iso).getTime())/86400000)
    return d===0?'Today':d===1?'Yesterday':d+'d ago'
  }
  function fmt12(t: string) {
    const [h,m] = t.split(':').map(Number)
    return (h%12||12)+':'+(String(m).padStart(2,'0'))+(h>=12?'pm':'am')
  }
  function fmtMoney(n: number) { return '$'+n.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0}) }

  const totalEarned = invoices.filter(i=>i.status==='paid'||i.status==='deposit_paid').reduce((s,i)=>i.status==='paid'?s+i.total_fee:s+(i.deposit_amount||i.total_fee*0.5),0)
  const totalOutstanding = invoices.filter(i=>i.status==='pending'||i.status==='awaiting_deposit'||i.status==='deposit_paid').reduce((s,i)=>{
    if (i.status==='deposit_paid') return s + ((i.total_fee||0) - (i.deposit_amount||0))
    return s + (i.total_fee || i.amount)
  },0)
  const thisMonth = invoices.filter(i=>(i.status==='paid'||i.status==='deposit_paid')&&(i.paid_date||i.deposit_paid_date)&&new Date((i.paid_date||i.deposit_paid_date) as string).getMonth()===new Date().getMonth()&&new Date((i.paid_date||i.deposit_paid_date) as string).getFullYear()===new Date().getFullYear()).reduce((s,i)=>i.status==='paid'?s+(i.total_fee||i.amount):s+(i.deposit_amount||0),0)
  const avgProject = projects.length>0 ? projects.reduce((s,p)=>s+p.value,0)/projects.length : 0
  const monthlyData = Array.from({length:6},(_,i)=>{
    const dt = new Date(); dt.setMonth(dt.getMonth()-5+i)
    const m = dt.getMonth(), y = dt.getFullYear()
    const total = invoices.filter(inv=>inv.status==='paid'&&inv.paid_date&&new Date(inv.paid_date).getMonth()===m&&new Date(inv.paid_date).getFullYear()===y).reduce((s,inv)=>s+(inv.total_fee||inv.amount),0)
    return { label:MONTHS[m], value:total, month:m, year:y }
  })
  const maxMonthly = Math.max(...monthlyData.map(m=>m.value), 1)
  const directRevenue = projects.filter(p=>p.platform==='direct').reduce((s,p)=>s+p.value,0)
  const referralRevenue = projects.filter(p=>p.platform==='referral').reduce((s,p)=>s+p.value,0)
  const totalProjectValue = directRevenue + referralRevenue || 1
  const overdueInvoices = invoices.filter(i => (i.status==='pending'||i.status==='awaiting_deposit') && i.due_date && new Date(i.due_date) < new Date())
  const activeProjects = projects.filter(p => p.status==='active').sort((a,b) => {
    if (!a.end_date) return 1; if (!b.end_date) return -1
    return new Date(a.end_date).getTime() - new Date(b.end_date).getTime()
  })
  const clientsByStage = PIPELINE_STAGES.reduce((acc,s)=>{acc[s]=clients.filter(c=>c.pipeline_stage===s);return acc},{} as Record<string,Client[]>)
  const focusedBooking = focused?.type==='booking'?focused.data as Booking:null
  const focusedSub = focused?.type==='submission'?focused.data as Submission:null
  const focusedClient = focused?.type==='client'?focused.data as Client:null
  const clientDocs = focusedClient ? documents.filter(doc=>doc.client_id===focusedClient.id) : []
  const clientMeetings = focusedClient ? meetings.filter(m=>m.client_id===focusedClient.id).sort((a,b)=>new Date(b.scheduled_at).getTime()-new Date(a.scheduled_at).getTime()) : []
  const clientInvoices = focusedClient ? invoices.filter(inv=>inv.client_id===focusedClient.id) : []
  const bookedDays = new Set(bookings.map(b => { const dt=new Date(b.scheduled_at); return dt.getFullYear()+'-'+dt.getMonth()+'-'+dt.getDate() }))
  const blockedDaySet = new Set(blockedDates.map(b=>b.blocked_date))
  const blockedSlotDays = new Set(blockedSlots.map(s=>s.blocked_date))
  const slotsForSelectedDay = selectedDay ? blockedSlots.filter(s=>s.blocked_date===selectedDay) : []
  const templates = documents.filter(doc=>doc.client_id===null)
  const greetingHour = time.getHours()
  const greeting = greetingHour<12?'Good morning':greetingHour<17?'Good afternoon':'Good evening'
  const CARD_COLORS = dark ? CARD_COLORS_DARK : CARD_COLORS_LIGHT

  const d = dark ? {
    bg:'#18130F', white:'#1E1812', surface:'#251E16', surface2:'#2C2419',
    surface3:'#342B1E', text:'#F0E8DC', text2:'#A08878', text3:'#6A5848',
    border:'rgba(240,220,200,0.1)', border2:'rgba(240,220,200,0.16)',
    accent:'#C4704A', accentBg:'rgba(196,112,74,0.15)',
    sand:'#2C2018', linen:'#261E14', pebble:'#221A12', blush:'#2E1E16',
    green:'#1A2C1A', greenText:'#6AAA6A', amber:'#2C2010', amberText:'#C4944A',
    red:'#2C1010', redText:'#C44A4A',
  } : {
    bg:'#F7F3EE', white:'#FFFFFF', surface:'#F0EAE2', surface2:'#EAE2D8',
    surface3:'#E4DDD4', text:'#2C2420', text2:'#7A6E66', text3:'#A89E96',
    border:'#E4DDD6', border2:'#D4CCC4',
    accent:'#C4704A', accentBg:'#F5EDE6',
    sand:'#F5EDE4', linen:'#EDE8E0', pebble:'#E8E4DC', blush:'#F0E4DC',
    green:'#E8F4E8', greenText:'#4a6a4a', amber:'#FBF0E0', amberText:'#8a6a2a',
    red:'#FAEAEA', redText:'#8a2a2a',
  }

  const inputStyle = { background:d.surface, borderColor:d.border, color:d.text, fontFamily:'DM Sans,sans-serif', fontSize:12, padding:'7px 10px', borderRadius:8, outline:'none', width:'100%', borderWidth:1, borderStyle:'solid' as const }

  const NAV_ITEMS = [
    { v:'home', label:'Home', icon:<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 7.5L9 2l7 5.5V16a1 1 0 01-1 1H3a1 1 0 01-1-1V7.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none"/></svg> },
    { v:'pipeline', label:'Pipeline', icon:<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="5" height="14" rx="2" stroke="currentColor" strokeWidth="1.4"/><rect x="11" y="5" width="5" height="11" rx="2" stroke="currentColor" strokeWidth="1.4"/></svg> },
    { v:'revenue', label:'Revenue', icon:<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 14l4-4 3 3 4-5 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 4h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> },
    { v:'docs', label:'Docs', icon:<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="3" y="1" width="12" height="16" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M6 5h6M6 8h6M6 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> },
    { v:'schedule', label:'Schedule', icon:<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="3" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M6 2v2M12 2v2M2 7h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;overflow:hidden}
        body{font-family:'DM Sans',sans-serif;font-weight:300;font-size:13px}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{border-radius:2px}
        .shell{display:grid;grid-template-columns:80px 1fr;height:100vh;overflow:hidden}
        .main{display:grid;grid-template-columns:1fr 320px;height:100vh;overflow:hidden;min-width:0}
        .center{overflow-y:auto;padding:28px 24px;min-width:0}
        .panel{border-left-width:1px;border-left-style:solid;overflow-y:auto}
        .panel-inner{padding:24px 20px}
        .sidebar{border-right-width:1px;border-right-style:solid;display:flex;flex-direction:column;align-items:center;padding:24px 0 20px}
        .sb-logo{width:42px;height:42px;background:#C4704A;border-radius:14px;display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-style:italic;font-size:17px;color:white;flex-shrink:0}
        .sb-nav{display:flex;flex-direction:column;align-items:center;gap:0;flex:1;justify-content:space-evenly;width:100%;padding:16px 10px}
        .sb-btn{width:52px;height:52px;border-radius:14px;background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;transition:all 0.15s;padding:0}
        .sb-btn-label{font-size:9px;letter-spacing:0.04em;text-transform:uppercase;line-height:1}
        .sb-divider{width:32px;height:1px;margin:8px 0;flex-shrink:0}
        .sb-toggle{width:42px;height:42px;border-radius:50%;background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;margin-top:8px}
        .page-header{margin-bottom:24px}
        .page-greeting{font-family:'Playfair Display',serif;font-size:26px;font-weight:600;line-height:1.2;margin-bottom:4px}
        .page-greeting em{font-style:italic;color:#C4704A}
        .page-sub{font-size:12px}
        .stat-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px}
        .stat-row-3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:24px}
        .stat-card{border-radius:16px;border-width:1px;border-style:solid;padding:16px 18px}
        .sc-label{font-size:11px;margin-bottom:6px}
        .sc-num{font-family:'Playfair Display',serif;font-size:26px;font-weight:600;line-height:1}
        .sc-sub{font-size:11px;margin-top:3px}
        .section{margin-bottom:24px}
        .section-label{font-size:12px;font-weight:500;margin-bottom:12px;display:flex;align-items:center;gap:8px}
        .section-label-count{font-size:11px;padding:2px 8px;border-radius:10px}
        .booking-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
        .booking-card{border-radius:16px;padding:16px;cursor:pointer;transition:all 0.15s;border:2px solid transparent}
        .booking-card:hover{transform:translateY(-2px)}.booking-card.selected{border-color:#C4704A}
        .bc-type{font-size:10px;margin-bottom:8px}.bc-name{font-family:'Playfair Display',serif;font-size:15px;font-weight:600;margin-bottom:4px}
        .bc-date{font-size:11px;margin-bottom:10px}.bc-footer{display:flex;justify-content:space-between;align-items:center}
        .bc-countdown{font-family:'Playfair Display',serif;font-style:italic;font-size:14px;color:#C4704A}
        .bc-arrow{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px}
        .sub-list{display:flex;flex-direction:column;gap:6px}
        .sub-item{border-radius:12px;border-width:1px;border-style:solid;padding:12px 14px;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;gap:12px}
        .si-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
        .si-name{font-family:'Playfair Display',serif;font-size:13px;font-weight:600;flex:1}
        .si-type{font-size:11px}.si-meta{font-size:11px;white-space:nowrap}
        .alert-row{border-radius:12px;border-width:1px;border-style:solid;padding:12px 14px;margin-bottom:6px;display:flex;align-items:center;gap:12px}
        .proj-row{border-radius:12px;border-width:1px;border-style:solid;padding:11px 14px;margin-bottom:6px;display:flex;align-items:center;gap:10px}
        .proj-name{font-family:'Playfair Display',serif;font-size:13px;font-weight:600;flex:1}
        .proj-due{font-size:11px;white-space:nowrap}
        .cal-wrap{border-radius:16px;border-width:1px;border-style:solid;padding:16px;margin-bottom:12px}
        .cal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
        .cal-month-label{font-family:'Playfair Display',serif;font-size:16px;font-weight:600}
        .cal-days-row{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px}
        .cal-day-label{font-size:10px;text-align:center;padding:4px 0}
        .cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
        .cal-cell{aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:12px;cursor:pointer;transition:all 0.12s;position:relative}
        .cal-cell:hover{opacity:0.8}.cal-cell.empty{opacity:0;pointer-events:none}
        .slot-indicator{position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:4px;height:4px;border-radius:50%;background:#C4704A}
        .day-block-panel{border-radius:12px;border-width:1px;border-style:solid;padding:14px;margin-bottom:16px}
        .dbp-title{font-size:12px;font-weight:500;margin-bottom:12px}
        .dbp-slots{display:flex;flex-direction:column;gap:4px;margin-bottom:10px}
        .dbp-slot{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:8px}
        .dbp-slot-time{font-size:12px;flex:1}
        .dbp-slot-rm{background:none;border:none;font-size:14px;cursor:pointer;line-height:1;padding:0 2px}
        .dbp-add{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center}
        .dbp-input{font-family:'DM Sans',sans-serif;font-size:11px;padding:7px 10px;border-radius:8px;outline:none;width:100%;border-width:1px;border-style:solid}
        .dbp-save{background:#C4704A;border:none;color:white;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:500;padding:7px 12px;border-radius:8px;cursor:pointer}
        .dbp-save:disabled{opacity:0.35;cursor:not-allowed}
        .day-cards{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:16px}
        .day-card{border-radius:10px;padding:8px 4px;border-width:1px;border-style:solid;cursor:pointer;text-align:center;transition:all 0.15s}
        .dc-name{font-size:9px;font-weight:500;margin-bottom:4px}.dc-dot{width:4px;height:4px;border-radius:50%;margin:0 auto 3px}.dc-time{font-size:8px}
        .hours-card{border-radius:14px;border-width:1px;border-style:solid;overflow:hidden;margin-bottom:16px}
        .hour-item{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom-width:1px;border-bottom-style:solid}
        .hour-item:last-child{border-bottom:none}.hi-day{font-size:12px;width:34px}
        .hi-toggle{position:relative;width:34px;height:20px;flex-shrink:0}
        .hi-toggle input{opacity:0;width:0;height:0;position:absolute}
        .hi-track{position:absolute;inset:0;border-radius:10px;cursor:pointer;transition:background 0.2s;border-width:1px;border-style:solid}
        .hi-thumb{position:absolute;top:2px;left:2px;width:14px;height:14px;background:white;border-radius:50%;transition:transform 0.2s;pointer-events:none}
        .hi-toggle input:checked~.hi-thumb{transform:translateX(14px)}
        .hi-times{display:flex;align-items:center;gap:6px;margin-left:auto}
        .hi-input{font-family:'DM Sans',sans-serif;font-size:11px;padding:4px 8px;border-radius:8px;width:70px;outline:none;border-width:1px;border-style:solid}
        .hi-sep{font-size:10px}
        .blocked-card{border-radius:14px;border-width:1px;border-style:solid;padding:14px;margin-bottom:16px}
        .blocked-card-title{font-size:12px;font-weight:500;margin-bottom:10px}
        .bl-row{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;margin-bottom:4px}
        .bl-d{font-size:12px;flex:1}.bl-r{font-size:11px;flex:2}
        .bl-x{background:none;border:none;font-size:16px;cursor:pointer;line-height:1;padding:0 2px}
        .add-block-row{display:grid;grid-template-columns:120px 1fr auto;gap:6px;margin-top:10px}
        .ab-input{font-family:'DM Sans',sans-serif;font-size:11px;padding:7px 10px;border-radius:8px;outline:none;width:100%;border-width:1px;border-style:solid}
        .ab-btn{background:#C4704A;border:none;color:white;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:500;padding:7px 14px;border-radius:8px;cursor:pointer}
        .ab-btn:disabled{opacity:0.35;cursor:not-allowed}
        .stage-section{margin-bottom:20px}
        .stage-header{display:flex;align-items:center;gap:8px;margin-bottom:8px}
        .stage-pill{font-size:10px;font-weight:500;padding:3px 10px;border-radius:20px}
        .stage-count{font-size:11px;margin-left:auto}
        .client-row{border-radius:12px;border-width:1px;border-style:solid;padding:11px 14px;margin-bottom:4px;display:flex;align-items:center;gap:10px;cursor:pointer;transition:all 0.15s}
        .cr-name{font-family:'Playfair Display',serif;font-size:13px;font-weight:600;flex:1}.cr-meta{font-size:11px}
        .cr-btn{font-size:10px;font-weight:500;border:none;padding:4px 10px;border-radius:20px;cursor:pointer;white-space:nowrap}
        .rp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;text-align:center;padding:40px}
        .rp-empty-icon{font-size:40px;margin-bottom:8px}.rp-empty-text{font-size:12px;line-height:1.7}
        .rp-card{border-radius:16px;padding:18px;margin-bottom:16px}
        .rp-eyebrow{font-size:10px;font-weight:500;color:#C4704A;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px}
        .rp-name{font-family:'Playfair Display',serif;font-size:20px;font-weight:600;margin-bottom:3px}
        .rp-meta{font-size:12px;margin-bottom:2px}
        .rp-time-badge{display:flex;align-items:center;gap:8px;border-radius:10px;padding:10px 12px;margin-top:10px}
        .rtb-cd{font-family:'Playfair Display',serif;font-style:italic;font-size:14px;color:#C4704A;margin-left:auto}
        .rp-fields{margin-bottom:16px;display:flex;flex-direction:column;gap:12px}
        .rf-label{font-size:10px;font-weight:500;color:#C4704A;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px;opacity:0.8}
        .rf-val{font-size:13px;line-height:1.55}
        .rp-actions{display:flex;flex-direction:column;gap:8px}
        .ra-btn{display:flex;align-items:center;justify-content:center;padding:11px 16px;border-radius:12px;font-size:12px;font-weight:500;cursor:pointer;transition:all 0.15s;text-decoration:none;border:none;width:100%}
        .ra-btn.fill{background:#C4704A;color:white}.ra-btn.fill:hover{background:#d4855f}
        .empty-note{font-size:11px;text-align:center;padding:16px}
        .legend{display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap}
        .legend-item{display:flex;align-items:center;gap:5px;font-size:10px}
        .legend-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
        .chart-wrap{border-radius:16px;border-width:1px;border-style:solid;padding:20px;margin-bottom:20px}
        .chart-title{font-family:'Playfair Display',serif;font-size:15px;font-weight:600;margin-bottom:16px}
        .bar-chart{display:flex;align-items:flex-end;gap:8px;height:120px}
        .bar-col{display:flex;flex-direction:column;align-items:center;gap:4px;flex:1}
        .bar{width:100%;border-radius:6px 6px 0 0;min-height:4px;cursor:pointer}.bar:hover{opacity:0.8}
        .bar-label{font-size:10px;white-space:nowrap}.bar-val{font-size:9px;white-space:nowrap}
        .data-table{border-radius:14px;border-width:1px;border-style:solid;overflow:hidden;margin-bottom:20px}
        .dt-header{display:grid;padding:10px 14px;border-bottom-width:1px;border-bottom-style:solid}
        .dt-row{display:grid;padding:11px 14px;border-bottom-width:1px;border-bottom-style:solid;align-items:center;transition:background 0.12s}
        .dt-row:last-child{border-bottom:none}.dt-row:hover{background:rgba(196,112,74,0.05)}
        .dt-cell{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .dt-cell.hd{font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.06em}
        .status-pill{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:500}
        .add-row-btn{display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;font-size:11px;font-weight:500;cursor:pointer;border:none;background:none}
        .form-card{border-radius:14px;border-width:1px;border-style:solid;padding:16px;margin-bottom:16px}
        .form-title{font-size:13px;font-weight:500;margin-bottom:14px}
        .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
        .form-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px}
        .form-group{display:flex;flex-direction:column;gap:4px}
        .form-label{font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.06em}
        .form-actions{display:flex;gap:8px;justify-content:flex-end}
        .btn-save{background:#C4704A;border:none;color:white;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:500;padding:7px 16px;border-radius:8px;cursor:pointer}
        .btn-cancel{background:none;border-width:1px;border-style:solid;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:500;padding:7px 16px;border-radius:8px;cursor:pointer}
        .platform-bars{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}
        .plat-card{border-radius:14px;border-width:1px;border-style:solid;padding:14px}
        .plat-label{font-size:11px;margin-bottom:6px}
        .plat-num{font-family:'Playfair Display',serif;font-size:22px;font-weight:600;margin-bottom:8px}
        .plat-bar-bg{height:6px;border-radius:3px;overflow:hidden}
        .plat-bar-fill{height:100%;border-radius:3px;transition:width 0.4s}
        .icon-btn{background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;line-height:1}
        .doc-card{border-radius:14px;border-width:1px;border-style:solid;padding:16px;margin-bottom:10px}
        .doc-card-header{display:flex;align-items:center;gap:12px;margin-bottom:12px}
        .doc-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .doc-name{font-family:'Playfair Display',serif;font-size:14px;font-weight:600;flex:1}
        .doc-actions{display:flex;gap:8px}
        .doc-btn{flex:1;padding:8px 12px;border-radius:8px;font-size:11px;font-weight:500;cursor:pointer;border:none;text-align:center;transition:all 0.15s}
        .doc-btn.fill{background:#C4704A;color:white}.doc-btn.fill:hover{opacity:0.85}
        .upload-zone{border-radius:12px;border-width:2px;border-style:dashed;padding:20px;text-align:center;cursor:pointer;transition:all 0.15s;margin-bottom:16px;display:block}
        textarea.form-input{resize:vertical;min-height:70px;font-family:'DM Sans',sans-serif;font-size:12px;padding:8px 10px;border-radius:8px;outline:none;width:100%;border-width:1px;border-style:solid;line-height:1.5}
        .fill-form-wrap{border-radius:14px;border-width:1px;border-style:solid;padding:20px;margin-bottom:20px}
        .fill-form-title{font-family:'Playfair Display',serif;font-size:16px;font-weight:600;margin-bottom:4px}
        .fill-form-sub{font-size:11px;margin-bottom:20px}
        .section-divider{height:1px;margin:16px 0}
        .section-mini-label{font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px}
        .notes-box{border-radius:10px;border-width:1px;border-style:solid;padding:12px;font-size:12px;line-height:1.6;min-height:60px;cursor:pointer}
        .inv-row{display:flex;align-items:flex-start;flex-direction:column;gap:6px;padding:10px 12px;border-radius:10px;margin-bottom:6px}
        .preview-section{padding:12px 0;border-bottom-width:1px;border-bottom-style:solid}
        .preview-section:last-child{border-bottom:none}
        .preview-label{font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px}
        .preview-value{font-size:13px;line-height:1.6;white-space:pre-wrap}
      `}</style>

      <div className="shell" style={{background:d.bg,color:d.text,display:'grid',gridTemplateColumns:'80px 1fr',height:'100vh',overflow:'hidden'}}>
        <div className="sidebar" style={{background:d.white,borderColor:d.border}}>
          <div className="sb-logo">A</div>
          <div className="sb-nav">
            {NAV_ITEMS.map(({v,label,icon})=>(
              <button key={v} className="sb-btn" style={{color:view===v?d.accent:d.text3,background:view===v?d.accentBg:'none'}} onClick={()=>setView(v as any)}>
                {icon}
                <span className="sb-btn-label" style={{color:view===v?d.accent:d.text3}}>{label}</span>
              </button>
            ))}
          </div>
          <div className="sb-divider" style={{background:d.border}}/>
          <button className="sb-toggle" style={{color:d.text3}} onClick={()=>setDark(!dark)}>{dark?'☀️':'🌙'}</button>
          <button className="sb-toggle" style={{color:d.text3,fontSize:12,marginTop:4}} onClick={handleLogout} title="Log out">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        <div className="main" style={{display:'grid',gridTemplateColumns:'1fr 320px',height:'100vh',overflow:'hidden',minWidth:0}}>
          <div className="center" style={{background:d.bg,minWidth:0}}>
            {loading ? (
              <div className="empty-note" style={{paddingTop:60,color:d.text3}}>Loading...</div>
            ) : view==='home' ? (
              <>
                <div className="page-header">
                  <div className="page-greeting" style={{color:d.text}}>{greeting}, <em>Alante.</em></div>
                  <div className="page-sub" style={{color:d.text3}}>{time.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})} · {time.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</div>
                </div>
                <div className="stat-row-3">
                  {[
                    {label:'Upcoming calls',num:bookings.length,sub:bookings.length===0?'None scheduled':'Scheduled',bg:d.sand,hot:bookings.length>0},
                    {label:'Awaiting booking',num:unbooked.length,sub:'No call yet',bg:d.linen,hot:false},
                    {label:'Active projects',num:activeProjects.length,sub:'In progress',bg:d.blush,hot:false},
                  ].map((s,i)=>(
                    <div key={i} className="stat-card" style={{background:s.bg,borderColor:d.border}}>
                      <div className="sc-label" style={{color:d.text2}}>{s.label}</div>
                      <div className="sc-num" style={{color:s.hot?d.accent:d.text}}>{s.num}</div>
                      <div className="sc-sub" style={{color:d.text3}}>{s.sub}</div>
                    </div>
                  ))}
                </div>
                {overdueInvoices.length > 0 && (
                  <div className="section" style={{marginBottom:16}}>
                    <div className="section-label" style={{color:d.redText}}>
                      Overdue Invoices
                      <span className="section-label-count" style={{background:d.red,color:d.redText}}>{overdueInvoices.length}</span>
                    </div>
                    {overdueInvoices.map(inv=>(
                      <div key={inv.id} className="alert-row" style={{background:d.red,borderColor:d.redText+'44'}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:500,color:d.text}}>Invoice #{inv.invoice_number}</div>
                          <div style={{fontSize:11,color:d.redText}}>Due {inv.due_date?fmtShort(inv.due_date):'unknown'} · {fmtMoney(inv.total_fee||inv.amount)}</div>
                        </div>
                        <button className="cr-btn" style={{background:d.redText,color:'white'}} onClick={()=>markInvoicePaid(inv)}>Mark Paid</button>
                      </div>
                    ))}
                  </div>
                )}
                {activeProjects.length > 0 && (
                  <div className="section">
                    <div className="section-label" style={{color:d.text2}}>
                      Active Projects
                      <span className="section-label-count" style={{background:d.surface,color:d.text3}}>{activeProjects.length}</span>
                    </div>
                    {activeProjects.map(p=>{
                      const daysLeft = p.end_date ? Math.ceil((new Date(p.end_date).getTime()-Date.now())/86400000) : null
                      const isUrgent = daysLeft !== null && daysLeft <= 3
                      return (
                        <div key={p.id} className="proj-row" style={{background:d.white,borderColor:isUrgent?d.accent:d.border}}>
                          <div style={{flex:1}}>
                            <div className="proj-name" style={{color:d.text}}>{p.name}</div>
                            <div style={{fontSize:11,color:d.text2}}>{p.type} · {fmtMoney(p.value)}</div>
                          </div>
                          <div className="proj-due" style={{color:isUrgent?d.accent:d.text3}}>
                            {daysLeft===null?'No deadline':daysLeft<0?'Overdue':daysLeft===0?'Due today':daysLeft+'d left'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="section">
                  <div className="section-label" style={{color:d.text2}}>Discovery Calls <span className="section-label-count" style={{background:d.surface,color:d.text3}}>{bookings.length}</span></div>
                  {bookings.length===0 ? <div className="empty-note" style={{color:d.text3}}>No calls scheduled yet.</div> : (
                    <div className="booking-cards">
                      {bookings.map((b,i)=>(
                        <div key={b.id} className={'booking-card'+(focused?.type==='booking'&&focused.data.id===b.id?' selected':'')}
                          style={{background:CARD_COLORS[i%CARD_COLORS.length]}} onClick={()=>setFocused({type:'booking',data:b})}>
                          <div className="bc-type" style={{color:d.text2}}>{b.intake_submissions?.project_type}</div>
                          <div className="bc-name" style={{color:d.text}}>{b.intake_submissions?.name}</div>
                          <div className="bc-date" style={{color:d.text2}}>{fmtShort(b.scheduled_at)} · {new Date(b.scheduled_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</div>
                          <div className="bc-footer">
                            <div className="bc-countdown">{countdown(b.scheduled_at)}</div>
                            <div className="bc-arrow" style={{background:dark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.06)',color:d.text2}}>→</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="section">
                  <div className="section-label" style={{color:d.text2}}>Submitted, No Call Yet <span className="section-label-count" style={{background:d.surface,color:d.text3}}>{unbooked.length}</span></div>
                  {unbooked.length===0 ? <div className="empty-note" style={{color:d.text3}}>No pending submissions.</div> : (
                    <div className="sub-list">
                      {unbooked.map(s=>(
                        <div key={s.id} className="sub-item"
                          style={{background:focused?.type==='submission'&&focused.data.id===s.id?d.accentBg:d.white,borderColor:focused?.type==='submission'&&focused.data.id===s.id?d.accent:d.border}}
                          onClick={()=>setFocused({type:'submission',data:s})}>
                          <div className="si-dot" style={{background:d.accent}}/>
                          <div style={{flex:1}}>
                            <div className="si-name" style={{color:d.text}}>{s.name}</div>
                            <div className="si-type" style={{color:d.text2}}>{s.project_type}</div>
                          </div>
                          <div className="si-meta" style={{color:d.text3}}>{fmtRelative(s.submitted_at)}</div>
                          <div className="si-meta" style={{color:d.accent}}>{s.budget||'TBD'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : view==='pipeline' ? (
              <>
                <div className="page-header">
                  <div className="page-greeting" style={{color:d.text}}>Pipeline</div>
                  <div className="page-sub" style={{color:d.text3}}>{clients.length} clients total</div>
                </div>
                <div style={{marginBottom:16}}>
                  <button className="add-row-btn" style={{color:d.accent,background:d.accentBg,borderRadius:10}} onClick={()=>setShowAddClient(!showAddClient)}>
                    + Add client manually
                  </button>
                </div>
                {showAddClient && (
                  <div className="form-card" style={{background:d.surface,borderColor:d.border,marginBottom:20}}>
                    <div className="form-title" style={{color:d.text}}>New client</div>
                    <div className="form-grid">
                      <div className="form-group"><div className="form-label" style={{color:d.text3}}>Name</div><input style={inputStyle} value={nc.name} onChange={e=>setNc({...nc,name:e.target.value})} placeholder="Full name"/></div>
                      <div className="form-group"><div className="form-label" style={{color:d.text3}}>Email</div><input style={inputStyle} value={nc.email} onChange={e=>setNc({...nc,email:e.target.value})} placeholder="client@email.com"/></div>
                      <div className="form-group"><div className="form-label" style={{color:d.text3}}>Business (optional)</div><input style={inputStyle} value={nc.business} onChange={e=>setNc({...nc,business:e.target.value})} placeholder="Company name"/></div>
                      <div className="form-group"><div className="form-label" style={{color:d.text3}}>Platform</div><select style={inputStyle} value={nc.platform} onChange={e=>setNc({...nc,platform:e.target.value})}><option value="direct">Direct</option><option value="upwork">Upwork</option><option value="fiverr">Fiverr</option><option value="referral">Referral</option></select></div>
                      <div className="form-group"><div className="form-label" style={{color:d.text3}}>Stage</div><select style={inputStyle} value={nc.pipeline_stage} onChange={e=>setNc({...nc,pipeline_stage:e.target.value})}>{PIPELINE_STAGES.map(s=><option key={s} value={s}>{STAGE_LABELS[s]}</option>)}</select></div>
                    </div>
                    <div className="form-actions">
                      <button className="btn-cancel" style={{borderColor:d.border,color:d.text2}} onClick={()=>setShowAddClient(false)}>Cancel</button>
                      <button className="btn-save" onClick={addClientManually}>Add Client</button>
                    </div>
                  </div>
                )}
                {PIPELINE_STAGES.map(stage=>(
                  <div key={stage} className="stage-section">
                    <div className="stage-header">
                      <div className="stage-pill" style={{
                        background:stage==='discovery_call'?d.sand:stage==='proposal_sent'?d.linen:stage==='active_project'?(dark?'#1E2C1E':'#E8F0E8'):stage==='lost'?d.red:d.surface,
                        color:stage==='discovery_call'?(dark?'#C4944A':'#8a6a4a'):stage==='proposal_sent'?(dark?'#A49A6A':'#6a6a4a'):stage==='active_project'?(dark?'#6AAA6A':'#4a6a4a'):stage==='lost'?d.redText:d.text3
                      }}>{STAGE_LABELS[stage]}</div>
                      <div className="stage-count" style={{color:d.text3}}>{clientsByStage[stage]?.length||0}</div>
                    </div>
                    {clientsByStage[stage]?.length===0
                      ? <div className="empty-note" style={{textAlign:'left',paddingLeft:0,paddingTop:4,color:d.text3}}>Empty</div>
                      : clientsByStage[stage].map(c=>(
                        <div key={c.id} className="client-row" style={{background:d.white,borderColor:d.border}}
                          onClick={()=>{setFocused({type:'client',data:c});setClientNotes(c.notes||'');setEditingNotes(false);setShowClientInvoice(false);setInvoiceType(null)}}>
                          <div style={{flex:1}}>
                            <div className="cr-name" style={{color:d.text}}>{c.name}</div>
                            <div className="cr-meta" style={{color:d.text2}}>{c.email}{c.business?' · '+c.business:''}{c.platform&&c.platform!=='direct'?' · '+c.platform:''}</div>
                          </div>
                          {stage!=='closed'&&stage!=='lost'&&<button className="cr-btn" style={{background:d.surface,color:d.text2}} onClick={e=>{e.stopPropagation();moveToNextStage(c)}}>Advance</button>}
                        </div>
                      ))
                    }
                  </div>
                ))}
              </>
            ) : view==='revenue' ? (
              <>
                <div className="page-header">
                  <div className="page-greeting" style={{color:d.text}}>Revenue</div>
                  <div className="page-sub" style={{color:d.text3}}>{new Date().getFullYear()} overview</div>
                </div>
                <div className="stat-row">
                  {[
                    {label:'Total earned',val:fmtMoney(totalEarned),sub:'All time paid',bg:d.sand},
                    {label:'Outstanding',val:fmtMoney(totalOutstanding),sub:'Awaiting payment',bg:d.linen},
                    {label:'This month',val:fmtMoney(thisMonth),sub:MONTHS[new Date().getMonth()],bg:d.blush},
                    {label:'Avg project',val:fmtMoney(avgProject),sub:projects.length+' projects',bg:d.pebble},
                  ].map((s,i)=>(
                    <div key={i} className="stat-card" style={{background:s.bg,borderColor:d.border}}>
                      <div className="sc-label" style={{color:d.text2}}>{s.label}</div>
                      <div className="sc-num" style={{color:d.text,fontSize:20}}>{s.val}</div>
                      <div className="sc-sub" style={{color:d.text3}}>{s.sub}</div>
                    </div>
                  ))}
                </div>
                <div className="chart-wrap" style={{background:d.white,borderColor:d.border}}>
                  <div className="chart-title" style={{color:d.text}}>Monthly revenue</div>
                  <div className="bar-chart">
                    {monthlyData.map((m,i)=>(
                      <div key={i} className="bar-col">
                        <div className="bar-val" style={{color:d.text3}}>{m.value>0?fmtMoney(m.value):''}</div>
                        <div className="bar" style={{height:Math.max((m.value/maxMonthly)*100,4)+'%',background:m.month===new Date().getMonth()&&m.year===new Date().getFullYear()?d.accent:(dark?'rgba(196,112,74,0.35)':'rgba(196,112,74,0.25)')}}/>
                        <div className="bar-label" style={{color:d.text3}}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="platform-bars">
                  {[
                    {label:'Direct clients',val:directRevenue,pct:directRevenue/totalProjectValue*100},
                    {label:'Referrals and Platforms',val:referralRevenue,pct:referralRevenue/totalProjectValue*100},
                  ].map((p,i)=>(
                    <div key={i} className="plat-card" style={{background:d.white,borderColor:d.border}}>
                      <div className="plat-label" style={{color:d.text2}}>{p.label}</div>
                      <div className="plat-num" style={{color:d.text}}>{fmtMoney(p.val)}</div>
                      <div className="plat-bar-bg" style={{background:d.surface2}}>
                        <div className="plat-bar-fill" style={{width:p.pct+'%',background:d.accent}}/>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="section-label" style={{color:d.text2,marginBottom:12}}>
                  Projects
                  <button className="add-row-btn" style={{color:d.accent,background:d.accentBg,marginLeft:'auto'}} onClick={()=>setShowNewProject(!showNewProject)}>+ Add project</button>
                </div>
                {showNewProject && (
                  <div className="form-card" style={{background:d.surface,borderColor:d.border}}>
                    <div className="form-title" style={{color:d.text}}>New project</div>
                    <div className="form-grid">
                      <div className="form-group"><div className="form-label" style={{color:d.text3}}>Name</div><input style={inputStyle} value={np.name} onChange={e=>setNp({...np,name:e.target.value})} placeholder="Project name"/></div>
                      <div className="form-group"><div className="form-label" style={{color:d.text3}}>Type</div><select style={inputStyle} value={np.type} onChange={e=>setNp({...np,type:e.target.value})}>{PROJECT_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
                      <div className="form-group"><div className="form-label" style={{color:d.text3}}>Value ($)</div><input style={inputStyle} type="number" value={np.value} onChange={e=>setNp({...np,value:e.target.value})} placeholder="0"/></div>
                      <div className="form-group"><div className="form-label" style={{color:d.text3}}>Platform</div><select style={inputStyle} value={np.platform} onChange={e=>setNp({...np,platform:e.target.value})}><option value="direct">Direct</option><option value="referral">Referral</option><option value="upwork">Upwork</option><option value="fiverr">Fiverr</option></select></div>
                      <div className="form-group"><div className="form-label" style={{color:d.text3}}>Deadline</div><input style={inputStyle} type="date" value={np.end_date} onChange={e=>setNp({...np,end_date:e.target.value})}/></div>
                    </div>
                    <div className="form-actions">
                      <button className="btn-cancel" style={{borderColor:d.border,color:d.text2}} onClick={()=>setShowNewProject(false)}>Cancel</button>
                      <button className="btn-save" onClick={addProject}>Save</button>
                    </div>
                  </div>
                )}
                <div className="data-table" style={{borderColor:d.border}}>
                  <div className="dt-header" style={{gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 40px',background:d.surface,borderColor:d.border}}>
                    {['Project','Type','Value','Platform','Deadline',''].map((h,i)=><div key={i} className="dt-cell hd" style={{color:d.text3}}>{h}</div>)}
                  </div>
                  {projects.length===0 ? <div className="empty-note" style={{color:d.text3}}>No projects yet.</div>
                  : projects.map(p=>(
                    <div key={p.id} className="dt-row" style={{gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 40px',borderColor:d.border}}>
                      <div className="dt-cell" style={{color:d.text}}>{p.name}</div>
                      <div className="dt-cell" style={{color:d.text2}}>{p.type}</div>
                      <div className="dt-cell" style={{color:d.accent,fontWeight:500}}>{fmtMoney(p.value)}</div>
                      <div className="dt-cell"><span className="status-pill" style={{background:p.platform==='direct'?d.accentBg:d.surface2,color:p.platform==='direct'?d.accent:d.text2}}>{p.platform}</span></div>
                      <div className="dt-cell" style={{color:d.text2}}>{p.end_date?fmtShort(p.end_date):'none'}</div>
                      <div className="dt-cell" style={{display:'flex',gap:4}}>
                        <button className="icon-btn" style={{color:d.text2,fontSize:11}} onClick={()=>{setViewingProject(p);setProjectNotes(p.notes||'');setEditingProjectNotes(false)}} title="View">view</button>
                        <button className="icon-btn" style={{color:d.text3}} onClick={()=>deleteProject(p.id)}>x</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="section-label" style={{color:d.text2,marginBottom:12}}>All Invoices</div>
                <div className="data-table" style={{borderColor:d.border}}>
                  <div className="dt-header" style={{gridTemplateColumns:'1fr 1fr 1fr 1fr 80px',background:d.surface,borderColor:d.border}}>
                    {['Invoice #','Amount','Due','Status',''].map((h,i)=><div key={i} className="dt-cell hd" style={{color:d.text3}}>{h}</div>)}
                  </div>
                  {invoices.length===0 ? <div className="empty-note" style={{color:d.text3}}>No invoices yet.</div>
                  : invoices.map(inv=>{
                    const pillStyle = inv.status==='paid'?{background:d.green,color:d.greenText}:inv.status==='deposit_paid'?{background:d.amber,color:d.amberText}:inv.status==='awaiting_deposit'?{background:d.surface2,color:d.text3}:{background:d.amber,color:d.amberText}
                    const statusLabel = inv.status==='awaiting_deposit'?'Awaiting Dep':inv.status==='deposit_paid'?'Dep Paid':inv.status==='paid'?'Paid':'Pending'
                    return (
                      <div key={inv.id} className="dt-row" style={{gridTemplateColumns:'1fr 1fr 1fr 1fr 80px',borderColor:d.border}}>
                        <div className="dt-cell" style={{color:d.text}}>{inv.invoice_number}{inv.invoice_type==='revision'?' (rev)':''}</div>
                        <div className="dt-cell" style={{color:d.accent,fontWeight:500}}>{fmtMoney(inv.total_fee||inv.amount)}</div>
                        <div className="dt-cell" style={{color:d.text2}}>{inv.due_date?fmtShort(inv.due_date):'none'}</div>
                        <div className="dt-cell"><span className="status-pill" style={pillStyle}>{statusLabel}</span></div>
                        <div className="dt-cell" style={{display:'flex',gap:4}}>
                          <button className="icon-btn" style={{color:d.text2,fontSize:11}} onClick={()=>setViewingInvoice(inv)} title="View">view</button>
                          {inv.status==='awaiting_deposit'&&<button className="icon-btn" style={{color:d.amberText,fontSize:11}} onClick={()=>markInvoicePaid(inv)} title="Mark deposit paid">dep</button>}
                          {inv.status==='deposit_paid'&&<button className="icon-btn" style={{color:d.greenText,fontSize:11}} onClick={()=>markInvoicePaid(inv)} title="Mark final paid">fin</button>}
                          {inv.status==='pending'&&<button className="icon-btn" style={{color:d.greenText,fontSize:12}} onClick={()=>markInvoicePaid(inv)} title="Mark paid">ok</button>}
                          <button className="icon-btn" style={{color:d.text3}} onClick={()=>deleteInvoice(inv.id)}>x</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : view==='docs' ? (
              <div style={{width:'100%'}}>
                <div className="page-header">
                  <div className="page-greeting" style={{color:d.text}}>Documents</div>
                  <div className="page-sub" style={{color:d.text3}}>Templates and fill forms</div>
                </div>
                <div className="section-label" style={{color:d.text2,marginBottom:12}}>My Pricing</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:24}}>
                  {pricing.map(p=>{
                    const isEditing = editingPricing === p.id
                    const edits = pricingEdits[p.id] || {price:p.price,description:p.description}
                    return (
                      <div key={p.id} style={{background:d.surface,borderRadius:12,padding:'12px 14px',border:'1px solid '+(isEditing?d.accent:d.border),transition:'border-color 0.2s'}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                          <div style={{fontSize:11,fontWeight:500,color:d.text}}>{p.name}</div>
                          <button className="icon-btn" style={{color:isEditing?d.accent:d.text3,fontSize:11}} onClick={()=>{
                            if(isEditing){setEditingPricing(null)}
                            else{setEditingPricing(p.id);setPricingEdits(prev=>({...prev,[p.id]:{price:p.price,description:p.description}}))}
                          }}>{isEditing?'cancel':'edit'}</button>
                        </div>
                        {isEditing ? (
                          <>
                            <input style={{...inputStyle,marginBottom:6,fontSize:12,fontWeight:600}} value={edits.price} onChange={e=>setPricingEdits(prev=>({...prev,[p.id]:{...edits,price:e.target.value}}))} placeholder="Price"/>
                            <input style={{...inputStyle,marginBottom:8,fontSize:11}} value={edits.description} onChange={e=>setPricingEdits(prev=>({...prev,[p.id]:{...edits,description:e.target.value}}))} placeholder="Description"/>
                            <button className="btn-save" style={{width:'100%'}} onClick={()=>savePricing(p.id)}>Save</button>
                          </>
                        ) : (
                          <>
                            <div style={{fontFamily:'Playfair Display,serif',fontSize:14,fontWeight:600,color:d.accent,marginBottom:4}}>{p.price}</div>
                            <div style={{fontSize:10,color:d.text3,lineHeight:1.5}}>{p.description}</div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="section-label" style={{color:d.text2,marginBottom:16}}>Fill and generate</div>

                {/* PROPOSAL CARD */}
                <div className="doc-card" style={{background:d.white,borderColor:d.border}}>
                  <div className="doc-card-header">
                    <div className="doc-icon" style={{background:d.blush,color:d.accent}}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                        <path d="M5 4h6M5 6.5h6M5 9h4M5 11.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div>
                      <div className="doc-name" style={{color:d.text}}>Project Proposal</div>
                      <div style={{fontSize:11,color:d.text3}}>Scope, pricing, and milestone schedule combined</div>
                    </div>
                  </div>
                  <div className="doc-actions">
                    <button className="doc-btn fill" onClick={()=>setActiveFillForm(activeFillForm==='proposal'?null:'proposal')}>
                      {activeFillForm==='proposal'?'Close form':'Fill out Proposal'}
                    </button>
                  </div>
                </div>

                {activeFillForm==='proposal' && (
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
                    <div style={{fontSize:10,color:d.text3,marginBottom:10}}>Add each service as a line item with its price. The total and deposit are calculated automatically.</div>
                    {lineItems.map((item, idx) => (
                      <div key={idx} style={{display:'grid',gridTemplateColumns:'1fr 120px 32px',gap:8,marginBottom:8,alignItems:'center'}}>
                        <input style={inputStyle} value={item.description} onChange={e=>{const updated=[...lineItems];updated[idx]={...updated[idx],description:e.target.value};setLineItems(updated)}} placeholder={"Landing page, Scheduling integration..."}/>
                        <input style={{...inputStyle,textAlign:'right'}} type="number" value={item.price} onChange={e=>{const updated=[...lineItems];updated[idx]={...updated[idx],price:e.target.value};setLineItems(updated)}} placeholder="0"/>
                        <button onClick={()=>setLineItems(lineItems.filter((_,i)=>i!==idx))} style={{background:'none',border:'none',color:d.text3,cursor:'pointer',fontSize:16,padding:'0 4px',lineHeight:1}}>x</button>
                      </div>
                    ))}
                    <button onClick={()=>setLineItems([...lineItems,{description:'',price:''}])} style={{background:d.accentBg,border:'none',color:d.accent,fontFamily:'DM Sans,sans-serif',fontSize:11,fontWeight:500,padding:'7px 14px',borderRadius:8,cursor:'pointer',marginBottom:12}}>+ Add line item</button>
                    {lineItems.some(i=>i.price) && (
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderTop:'1px solid '+d.border,marginBottom:12}}>
                        <div style={{fontSize:12,fontWeight:500,color:d.text}}>Total</div>
                        <div style={{fontSize:14,fontWeight:600,color:d.accent}}>${lineItems.reduce((s,i)=>s+(parseFloat(i.price)||0),0).toLocaleString()}</div>
                      </div>
                    )}
                    <div className="section-divider" style={{background:d.border}}/>
                    <div className="section-mini-label" style={{color:d.text3}}>Payment and timeline</div>
                    <div className="form-grid">
                      <div className="form-group"><div className="form-label" style={{color:d.text3}}>Deposit (%)</div><input style={inputStyle} value={proposalForm.deposit_pct} onChange={e=>setProposalForm({...proposalForm,deposit_pct:e.target.value})}/></div>
                      <div className="form-group"><div className="form-label" style={{color:d.text3}}>Timeline estimate</div><input style={inputStyle} value={proposalForm.timeline} onChange={e=>setProposalForm({...proposalForm,timeline:e.target.value})} placeholder="4 to 6 weeks from deposit"/></div>
                      <div className="form-group"><div className="form-label" style={{color:d.text3}}>Start date (est.)</div><input style={inputStyle} type="date" value={proposalForm.start_date} onChange={e=>setProposalForm({...proposalForm,start_date:e.target.value})}/></div>
                      <div className="form-group"><div className="form-label" style={{color:d.text3}}>Delivery date (est.)</div><input style={inputStyle} type="date" value={proposalForm.delivery_date} onChange={e=>setProposalForm({...proposalForm,delivery_date:e.target.value})}/></div>
                      <div className="form-group"><div className="form-label" style={{color:d.text3}}>Revisions included</div><input style={inputStyle} value={proposalForm.revisions} onChange={e=>setProposalForm({...proposalForm,revisions:e.target.value})}/></div>
                      <div className="form-group"><div className="form-label" style={{color:d.text3}}>Hourly rate ($)</div><input style={inputStyle} value={proposalForm.hourly_rate} onChange={e=>setProposalForm({...proposalForm,hourly_rate:e.target.value})}/></div>
                    </div>
                    <div className="section-divider" style={{background:d.border}}/>
                    <div className="section-mini-label" style={{color:d.text3}}>Milestone schedule</div>
                    <div style={{fontSize:10,color:d.text3,marginBottom:10}}>
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
                          <button onClick={()=>setProposalMilestones(proposalMilestones.filter((_,i)=>i!==idx))} style={{background:'none',border:'none',color:d.text3,cursor:'pointer',fontSize:16,padding:'0 4px 0 12px',lineHeight:1}}>x</button>
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                          <div>
                            <div style={{fontSize:10,color:d.text3,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>Due date</div>
                            <input style={inputStyle} type="date" value={milestone.dueDate} onChange={e=>{const u=[...proposalMilestones];u[idx]={...u[idx],dueDate:e.target.value};setProposalMilestones(u)}}/>
                          </div>
                          <div>
                            <div style={{fontSize:10,color:d.text3,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>Fee ($)</div>
                            <input style={{...inputStyle,textAlign:'right'}} type="number" value={milestone.fee} onChange={e=>{const u=[...proposalMilestones];u[idx]={...u[idx],fee:e.target.value};setProposalMilestones(u)}} placeholder="0"/>
                          </div>
                        </div>
                        <div>
                          <div style={{fontSize:10,color:d.text3,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>Deliverables</div>
                          <textarea className="form-input" style={{background:d.surface,borderColor:d.border,color:d.text,minHeight:60}} value={milestone.deliverables} onChange={e=>{const u=[...proposalMilestones];u[idx]={...u[idx],deliverables:e.target.value};setProposalMilestones(u)}} placeholder="What will be delivered at this milestone..."/>
                        </div>
                      </div>
                    ))}
                    <button onClick={()=>setProposalMilestones([...proposalMilestones,{name:'Milestone '+(proposalMilestones.length+1),deliverables:'',dueDate:'',fee:''}])} style={{background:d.accentBg,border:'none',color:d.accent,fontFamily:'DM Sans,sans-serif',fontSize:11,fontWeight:500,padding:'7px 14px',borderRadius:8,cursor:'pointer',marginBottom:12}}>+ Add milestone</button>
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
                    {proposalSent && (
                      <div style={{background:d.green,color:d.greenText,borderRadius:8,padding:'10px 14px',fontSize:12,marginBottom:12,textAlign:'center'}}>
                        Proposal sent to {proposalForm.client_email}
                      </div>
                    )}
                    <div className="form-actions">
                      <button className="btn-cancel" style={{borderColor:d.border,color:d.text2}} onClick={()=>setActiveFillForm(null)}>Cancel</button>
                      <button className="btn-save" style={{background:d.surface2,color:d.text}} onClick={()=>openPreview(buildProposalPreview(),'download',generateProposalDoc)}>Preview</button>
                      <button className="btn-save" style={{background:d.surface2,color:d.text}} onClick={generateProposalDoc}>Download PDF</button>
                      <button className="btn-save" disabled={sendingProposal||!proposalForm.client_email} onClick={sendProposalEmail}>
                        {sendingProposal?'Sending...':'Send to Client'}
                      </button>
                    </div>
                  </div>
                )}

                {/* CONTRACT CARD */}
                <div className="doc-card" style={{background:d.white,borderColor:d.border}}>
                  <div className="doc-card-header">
                    <div className="doc-icon" style={{background:d.pebble,color:d.accent}}><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V6L9 1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M9 1v5h5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg></div>
                    <div>
                      <div className="doc-name" style={{color:d.text}}>Freelance Contract</div>
                      <div style={{fontSize:11,color:d.text3}}>Fill out and download a client ready contract</div>
                    </div>
                  </div>
                  <div className="doc-actions">
                    <button className="doc-btn fill" onClick={()=>setActiveFillForm(activeFillForm==='contract'?null:'contract')}>{activeFillForm==='contract'?'Close form':'Fill out contract'}</button>
                  </div>
                </div>
                {activeFillForm==='contract' && (
                  <div className="fill-form-wrap" style={{background:d.surface,borderColor:d.border}}>
                    <div className="fill-form-title" style={{color:d.text}}>Freelance Contract</div>
                    <div className="fill-form-sub" style={{color:d.text3}}>Select an accepted SOW to auto-fill. All legal terms are pre-loaded. Client signs with a drawn signature.</div>
                    <div className="section-mini-label" style={{color:d.text3}}>Select from accepted SOWs</div>
                    <div className="form-grid">
                      <div className="form-group" style={{gridColumn:'1/-1'}}>
                        <select style={inputStyle} onChange={e=>{
                          const s = sows.find(sw=>sw.id===e.target.value)
                          if(s) {
                            const now = new Date()
                            const invNum = 'INV-' + now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '-' + s.client_name.split(' ')[0].toUpperCase()
                            const sevenDays = new Date(now.getTime() + 7*24*60*60*1000).toISOString().split('T')[0]
                            setContractForm({
                              ...contractForm,
                              client_name: s.client_name,
                              client_email: s.client_email,
                              client_business: s.client_business || '',
                              project_title: s.project_title,
                              project_type: s.project_type,
                              start_date: s.start_date || '',
                              delivery_date: s.delivery_date || '',
                              total_fee: String(s.total),
                              deposit: String(s.deposit),
                              balance: String(s.balance),
                              invoice_number: invNum,
                              invoice_service_desc: s.project_title + ' — Deposit to begin',
                              invoice_due_date: sevenDays,
                            })
                          }
                        }} defaultValue="">
                          <option value="" disabled>Select a client...</option>
                          {sows.filter(s=>s.status==='accepted').map(s=>(
                            <option key={s.id} value={s.id}>{s.client_name} — {s.project_title}</option>
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
                      <div className="form-group"><div className="form-label" style={{color:d.text3}}>Deposit ($)</div><input style={inputStyle} type="number" value={contractForm.deposit} onChange={e=>setContractForm({...contractForm,deposit:e.target.value})} placeholder="0"/></div>
                      <div className="form-group"><div className="form-label" style={{color:d.text3}}>Balance ($)</div><input style={inputStyle} type="number" value={contractForm.balance} onChange={e=>setContractForm({...contractForm,balance:e.target.value})} placeholder="0"/></div>
                      <div className="form-group"><div className="form-label" style={{color:d.text3}}>Kill fee (%)</div><input style={inputStyle} value={contractForm.kill_fee_pct} onChange={e=>setContractForm({...contractForm,kill_fee_pct:e.target.value})}/></div>
                      <div className="form-group" style={{gridColumn:'2/-1'}}><div className="form-label" style={{color:d.text3}}>Payment method</div><input style={inputStyle} value={contractForm.payment_method} onChange={e=>setContractForm({...contractForm,payment_method:e.target.value})}/></div>
                    </div>
                    <div className="section-divider" style={{background:d.border}}/>
                    <div className="section-mini-label" style={{color:d.text3}}>Deposit invoice (sent automatically on signature)</div>
                    <div style={{fontSize:10,color:d.text3,marginBottom:10}}>These details go on the deposit invoice that gets sent the moment the client signs the contract.</div>
                    <div className="form-grid">
                      <div className="form-group"><div className="form-label" style={{color:d.text3}}>Invoice number</div><input style={inputStyle} value={contractForm.invoice_number} onChange={e=>setContractForm({...contractForm,invoice_number:e.target.value})} placeholder="INV-2026-001"/></div>
                      <div className="form-group"><div className="form-label" style={{color:d.text3}}>Due date</div><input style={inputStyle} type="date" value={contractForm.invoice_due_date} onChange={e=>setContractForm({...contractForm,invoice_due_date:e.target.value})}/></div>
                      <div className="form-group" style={{gridColumn:'1/-1'}}><div className="form-label" style={{color:d.text3}}>Service description</div><input style={inputStyle} value={contractForm.invoice_service_desc} onChange={e=>setContractForm({...contractForm,invoice_service_desc:e.target.value})} placeholder="Project name — Deposit to begin"/></div>
                    </div>
                    <div className="section-divider" style={{background:d.border}}/>
                    <div className="section-mini-label" style={{color:d.text3}}>Legal terms included</div>
                    <div style={{background:d.white,border:'1px solid '+d.border,borderRadius:8,padding:16,fontSize:11,color:d.text2,lineHeight:1.8}}>
                      <div style={{marginBottom:6}}>1. Services — Scope and change order rate ($65/hr)</div>
                      <div style={{marginBottom:6}}>2. Payment — Total, deposit, balance, late payment interest (1.5%/month)</div>
                      <div style={{marginBottom:6}}>3. Kill fee — {contractForm.kill_fee_pct}% of total if cancelled after work begins</div>
                      <div style={{marginBottom:6}}>4. Intellectual property — Full ownership transfers on final payment</div>
                      <div style={{marginBottom:6}}>5. Revisions — 2 rounds included, additional at $65/hr</div>
                      <div style={{marginBottom:6}}>6. Confidentiality — Both parties keep proprietary info confidential</div>
                      <div style={{marginBottom:6}}>7. Warranties — Work is original, defect-free for 30 days post-delivery</div>
                      <div style={{marginBottom:6}}>8. Limitation of liability — Capped at total amount paid</div>
                      <div>9. Governing law — State of Indiana</div>
                    </div>
                    {contractSent && (
                      <div style={{background:d.green,color:d.greenText,borderRadius:8,padding:'10px 14px',fontSize:12,marginTop:12,textAlign:'center'}}>
                        Contract sent to {contractForm.client_email} for signature
                      </div>
                    )}
                    <div className="form-actions" style={{marginTop:16}}>
                      <button className="btn-cancel" style={{borderColor:d.border,color:d.text2}} onClick={()=>setActiveFillForm(null)}>Cancel</button>
                      <button className="btn-save" style={{background:d.surface2,color:d.text}} onClick={()=>openPreview(buildContractPreview(),'download',generateContractDoc)}>Preview</button>
                      <button className="btn-save" style={{background:d.surface2,color:d.text}} onClick={generateContractDoc}>Download</button>
                      <button className="btn-save" disabled={sendingContract||!contractForm.client_email} onClick={sendContractEmail}>
                        {sendingContract?'Sending...':'Send for Signature'}
                      </button>
                    </div>
                  </div>
                )}

                {templates.length > 0 && (
                  <>
                    <div className="section-label" style={{color:d.text2,marginBottom:12,marginTop:8}}>Uploaded files</div>
                    {templates.map(t=>(
                      <div key={t.id} className="doc-card" style={{background:d.white,borderColor:d.border}}>
                        <div className="doc-card-header">
                          <div className="doc-icon" style={{background:d.surface,color:d.text3}}><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/></svg></div>
                          <div className="doc-name" style={{color:d.text,flex:1}}>{t.name}</div>
                          <button className="icon-btn" style={{color:d.text3}} onClick={()=>deleteDocument(t.id,t.storage_path)}>x</button>
                        </div>
                        <div className="doc-actions">
                          <button className="doc-btn fill" onClick={()=>downloadDoc(t.storage_path,t.name)}>Download</button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                <label className="upload-zone" style={{borderColor:d.border,color:d.text3,background:d.surface}}>
                  <div style={{fontSize:20,marginBottom:6}}>+</div>
                  <div style={{fontSize:12}}>Upload any document</div>
                  <div style={{fontSize:10,marginTop:3}}>Supports .docx, .pdf, .txt</div>
                  <input type="file" accept=".docx,.pdf,.txt" style={{display:'none'}} onChange={e=>e.target.files&&uploadTemplate(e.target.files[0])}/>
                </label>
              </div>
            ) : (
              <>
                <div className="page-header">
                  <div className="page-greeting" style={{color:d.text}}>Schedule</div>
                  <div className="page-sub" style={{color:d.text3}}>Click any day to block specific hours</div>
                </div>
                <div className="legend">
                  {[{bg:d.text,label:'Today'},{bg:d.accentBg,border:d.accent,label:'Has booking'},{bg:d.surface2,label:'Full day blocked'},{bg:d.accent,label:'Has blocked hours'}].map((l,i)=>(
                    <div key={i} className="legend-item" style={{color:d.text3}}>
                      <div className="legend-dot" style={{background:l.bg,border:l.border?'1px solid '+l.border:'none'}}/>{l.label}
                    </div>
                  ))}
                </div>
                <div className="cal-wrap" style={{background:d.white,borderColor:d.border}}>
                  <div className="cal-header">
                    <div className="cal-month-label" style={{color:d.text}}>Next 14 days</div>
                    <div style={{fontSize:11,color:d.text3}}>{new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'})} to {new Date(Date.now()+13*86400000).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>
                  </div>
                  <div className="cal-days-row">{DAYS_SHORT.map(day=><div key={day} className="cal-day-label" style={{color:d.text3}}>{day}</div>)}</div>
                  <div className="cal-grid">
                    {(()=>{
                      const cells=[], start=new Date(); start.setHours(0,0,0,0)
                      for(let i=0;i<start.getDay();i++) cells.push(<div key={'e'+i} className="cal-cell empty"/>)
                      for(let i=0;i<14;i++){
                        const dt=new Date(start.getTime()+i*86400000)
                        const ds=dt.toISOString().split('T')[0]
                        const key=dt.getFullYear()+'-'+dt.getMonth()+'-'+dt.getDate()
                        const isToday=i===0, hasB=bookedDays.has(key), isBlockedDay=blockedDaySet.has(ds)
                        const hasBlockedSlots=blockedSlotDays.has(ds), isSelected=selectedDay===ds
                        cells.push(
                          <div key={ds} className="cal-cell"
                            style={{background:isToday?d.text:isBlockedDay?d.surface2:isSelected?d.accentBg:hasB?d.accentBg:'transparent',color:isToday?d.white:isBlockedDay?d.text3:hasB?d.accent:d.text2,fontWeight:isToday||hasB?500:300,textDecoration:isBlockedDay?'line-through':'none',outline:isSelected?'2px solid '+d.accent:'none',outlineOffset:'1px'}}
                            onClick={()=>!isBlockedDay&&setSelectedDay(isSelected?null:ds)}>
                            {dt.getDate()}
                            {hasBlockedSlots&&!isBlockedDay&&<div className="slot-indicator"/>}
                          </div>
                        )
                      }
                      return cells
                    })()}
                  </div>
                </div>
                {selectedDay && (
                  <div className="day-block-panel" style={{background:d.surface,borderColor:d.border}}>
                    <div className="dbp-title" style={{color:d.text}}>{fmtDayFull(selectedDay)}</div>
                    {slotsForSelectedDay.length>0 && (
                      <div className="dbp-slots">
                        {slotsForSelectedDay.map(s=>(
                          <div key={s.id} className="dbp-slot" style={{background:d.surface2}}>
                            <div className="dbp-slot-time" style={{color:d.text}}>{fmt12(s.start_time)} to {fmt12(s.end_time)}</div>
                            <button className="dbp-slot-rm" style={{color:d.text3}} onClick={()=>removeBlockedSlot(s.id)}>x</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="dbp-add">
                      <input type="time" className="dbp-input" value={blockStart} style={{background:d.white,borderColor:d.border,color:d.text}} onChange={e=>setBlockStart(e.target.value)}/>
                      <input type="time" className="dbp-input" value={blockEnd} style={{background:d.white,borderColor:d.border,color:d.text}} onChange={e=>setBlockEnd(e.target.value)}/>
                      <button className="dbp-save" onClick={saveBlockedSlot} disabled={!blockStart||!blockEnd}>Block</button>
                    </div>
                    <div style={{fontSize:10,color:d.text3,marginTop:6}}>Selected hours will be hidden from client booking calendar</div>
                  </div>
                )}
                <div className="section-label" style={{color:d.text2,marginBottom:10,marginTop:8}}>Weekly availability</div>
                <div className="day-cards">
                  {availability.map(a=>(
                    <div key={a.id} className="day-card" style={{background:a.is_active?d.accentBg:d.white,borderColor:a.is_active?d.accent:d.border}} onClick={()=>toggleDay(a)}>
                      <div className="dc-name" style={{color:a.is_active?d.accent:d.text3}}>{DAYS_SHORT[a.day_of_week]}</div>
                      <div className="dc-dot" style={{background:a.is_active?d.accent:d.border}}/>
                      <div className="dc-time" style={{color:a.is_active?d.text2:d.text3}}>{a.is_active?a.start_time.slice(0,5):'off'}</div>
                    </div>
                  ))}
                </div>
                <div className="hours-card" style={{background:d.white,borderColor:d.border}}>
                  {availability.map(a=>(
                    <div key={a.id} className="hour-item" style={{borderColor:d.border,opacity:a.is_active?1:0.5}}>
                      <div className="hi-day" style={{color:d.text2}}>{DAYS_FULL[a.day_of_week].slice(0,3)}</div>
                      <label className="hi-toggle">
                        <input type="checkbox" checked={a.is_active} onChange={()=>toggleDay(a)}/>
                        <div className="hi-track" style={{background:a.is_active?d.accent:d.surface2,borderColor:a.is_active?d.accent:d.border}}/>
                        <div className="hi-thumb"/>
                      </label>
                      {a.is_active&&(
                        <div className="hi-times">
                          <input type="time" className="hi-input" value={a.start_time.slice(0,5)} style={{background:d.surface,borderColor:d.border,color:d.text}} onChange={e=>updateHours(a,'start_time',e.target.value)}/>
                          <span className="hi-sep" style={{color:d.text3}}>to</span>
                          <input type="time" className="hi-input" value={a.end_time.slice(0,5)} style={{background:d.surface,borderColor:d.border,color:d.text}} onChange={e=>updateHours(a,'end_time',e.target.value)}/>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="blocked-card" style={{background:d.white,borderColor:d.border}}>
                  <div className="blocked-card-title" style={{color:d.text2}}>Full day blocks</div>
                  {blockedDates.length===0&&<div className="empty-note" style={{textAlign:'left',paddingLeft:0,paddingTop:0,paddingBottom:8,color:d.text3}}>None blocked.</div>}
                  {blockedDates.map(b=>(
                    <div key={b.id} className="bl-row" style={{background:d.surface}}>
                      <div className="bl-d" style={{color:d.text}}>{b.blocked_date}</div>
                      <div className="bl-r" style={{color:d.text2}}>{b.reason}</div>
                      <button className="bl-x" style={{color:d.text3}} onClick={()=>removeBlockedDate(b.id)}>x</button>
                    </div>
                  ))}
                  <div className="add-block-row">
                    <input type="date" className="ab-input" value={newBlockedDate} style={{background:d.surface,borderColor:d.border,color:d.text}} onChange={e=>setNewBlockedDate(e.target.value)}/>
                    <input type="text" className="ab-input" placeholder="Reason (optional)" value={newBlockedReason} style={{background:d.surface,borderColor:d.border,color:d.text}} onChange={e=>setNewBlockedReason(e.target.value)}/>
                    <button className="ab-btn" onClick={addBlockedDate} disabled={!newBlockedDate}>Block Day</button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="panel" style={{background:d.white,borderColor:d.border}}>
            <div className="panel-inner">
              {!focused ? (
                <div className="rp-empty">
                  <div className="rp-empty-icon">✦</div>
                  <div className="rp-empty-text" style={{color:d.text3}}>Select a call or submission<br/>to see the details here</div>
                </div>
              ) : focusedBooking ? (
                <>
                  <div className="rp-card" style={{background:d.sand}}>
                    <div className="rp-eyebrow">Discovery Call</div>
                    <div className="rp-name" style={{color:d.text}}>{focusedBooking.intake_submissions?.name}</div>
                    <div className="rp-meta" style={{color:d.text2}}>{focusedBooking.intake_submissions?.email}</div>
                    {focusedBooking.intake_submissions?.business&&<div className="rp-meta" style={{color:d.text2}}>{focusedBooking.intake_submissions.business}</div>}
                    <div className="rp-time-badge" style={{background:d.white}}>
                      <div>
                        <div style={{fontSize:12,color:d.text}}>{fmtDate(focusedBooking.scheduled_at)}</div>
                        <div style={{fontSize:11,color:d.text2,marginTop:1}}>{fmtTime(focusedBooking.scheduled_at)}</div>
                      </div>
                      <div className="rtb-cd">{countdown(focusedBooking.scheduled_at)}</div>
                    </div>
                  </div>
                  <div className="rp-fields">
                    {[
                      {label:'Project',val:focusedBooking.intake_submissions?.project_type},
                      {label:'Description',val:focusedBooking.intake_submissions?.description},
                      {label:'Budget',val:focusedBooking.intake_submissions?.budget||'Not provided'},
                      {label:'Timeline',val:focusedBooking.intake_submissions?.timeline||'Not provided'},
                      ...(focusedBooking.intake_submissions?.priority?[{label:'Priority',val:focusedBooking.intake_submissions.priority}]:[]),
                      ...(focusedBooking.intake_submissions?.notes?[{label:'Notes',val:focusedBooking.intake_submissions.notes}]:[]),
                      {label:'Found via',val:focusedBooking.intake_submissions?.heard_from},
                    ].map((f,i)=>(
                      <div key={i}><div className="rf-label">{f.label}</div><div className="rf-val" style={{color:d.text}}>{f.val}</div></div>
                    ))}
                  </div>
                  <div className="rp-actions">
                    {focusedBooking.zoom_host_url&&<a href={focusedBooking.zoom_host_url} target="_blank" className="ra-btn fill">Start Zoom Call</a>}
                    <button className="ra-btn" style={{background:d.surface,color:d.text2,border:'1px solid '+d.border}} onClick={()=>createClientFromBooking(focusedBooking)}>Add to Pipeline</button>
                  </div>
                </>
              ) : focusedSub ? (
                <>
                  <div className="rp-card" style={{background:d.linen}}>
                    <div className="rp-eyebrow">No Call Booked</div>
                    <div className="rp-name" style={{color:d.text}}>{focusedSub.name}</div>
                    <div className="rp-meta" style={{color:d.text2}}>{focusedSub.email}</div>
                    {focusedSub.business&&<div className="rp-meta" style={{color:d.text2}}>{focusedSub.business}</div>}
                    <div style={{marginTop:10,fontSize:11,color:d.text3}}>Submitted {fmtRelative(focusedSub.submitted_at)}</div>
                  </div>
                  <div className="rp-fields">
                    {[
                      {label:'Project',val:focusedSub.project_type},
                      {label:'Description',val:focusedSub.description},
                      {label:'Budget',val:focusedSub.budget||'Not provided'},
                      {label:'Timeline',val:focusedSub.timeline||'Not provided'},
                      ...(focusedSub.priority?[{label:'Priority',val:focusedSub.priority}]:[]),
                      ...(focusedSub.notes?[{label:'Notes',val:focusedSub.notes}]:[]),
                      {label:'Found via',val:focusedSub.heard_from},
                    ].map((f,i)=>(
                      <div key={i}><div className="rf-label">{f.label}</div><div className="rf-val" style={{color:d.text}}>{f.val}</div></div>
                    ))}
                  </div>
                </>
              ) : focusedClient ? (
                <>
                  <div className="rp-card" style={{background:d.pebble}}>
                    <div className="rp-eyebrow">{STAGE_LABELS[focusedClient.pipeline_stage]}{focusedClient.platform&&focusedClient.platform!=='direct'?' · '+focusedClient.platform:''}</div>
                    <div className="rp-name" style={{color:d.text}}>{focusedClient.name}</div>
                    <div className="rp-meta" style={{color:d.text2}}>{focusedClient.email}</div>
                    {focusedClient.business&&<div className="rp-meta" style={{color:d.text2}}>{focusedClient.business}</div>}
                  </div>
                  <div className="rp-actions" style={{marginBottom:16}}>
                    {focusedClient.pipeline_stage!=='closed'&&focusedClient.pipeline_stage!=='lost'&&(
                      <button className="ra-btn fill" onClick={()=>moveToNextStage(focusedClient)}>
                        Advance to {STAGE_LABELS[PIPELINE_STAGES[PIPELINE_STAGES.indexOf(focusedClient.pipeline_stage)+1]]}
                      </button>
                    )}
                    {focusedClient.pipeline_stage!=='closed'&&focusedClient.pipeline_stage!=='lost'&&(
                      <button className="ra-btn" style={{background:d.red,color:d.redText,border:'1px solid '+d.redText+'44'}} onClick={()=>markAsLost(focusedClient)}>
                        Mark as Lost
                      </button>
                    )}
                    {focusedClient.pipeline_stage==='lost'&&(
                      <button className="ra-btn" style={{background:d.surface,color:d.text2,border:'1px solid '+d.border}} onClick={()=>moveToNextStage(focusedClient)}>
                        Reactivate
                      </button>
                    )}
                    <button className="ra-btn" style={{background:d.surface,color:d.text2,border:'1px solid '+d.border}} onClick={()=>{setShowEmailModal(true);setEmailSent(false)}}>
                      Email {focusedClient.name.split(' ')[0]}
                    </button>
                    <button className="ra-btn" style={{background:d.accentBg,color:d.accent,border:'1px solid '+d.border2}} onClick={()=>{setShowClientInvoice(!showClientInvoice);setInvoiceType(null)}}>
                      Create Invoice
                    </button>
                    <button className="ra-btn" style={{background:d.surface,color:d.text2,border:'1px solid '+d.border}} onClick={()=>setShowScheduleMeeting(!showScheduleMeeting)}>
                      Schedule Meeting
                    </button>
                  </div>
                  {showClientInvoice && (
                    <div className="form-card" style={{background:d.surface,borderColor:d.border,marginBottom:16}}>
                      <div className="form-title" style={{color:d.text}}>Invoice for {focusedClient.name}</div>
                      {!invoiceType ? (
                        <div style={{display:'flex',flexDirection:'column',gap:8}}>
                          <button className="ra-btn fill" onClick={()=>setInvoiceType('project')}>Project Invoice</button>
                          <button className="ra-btn" style={{background:d.surface2,color:d.text2,border:'1px solid '+d.border}} onClick={()=>setInvoiceType('revision')}>Revision Invoice</button>
                          <button className="btn-cancel" style={{borderColor:d.border,color:d.text2,marginTop:4}} onClick={()=>{setShowClientInvoice(false);setInvoiceType(null)}}>Cancel</button>
                        </div>
                      ) : invoiceType === 'project' ? (
                        <>
                          <div style={{fontSize:10,color:d.accent,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>Project Invoice</div>
                          <div className="form-grid">
                            <div className="form-group"><div className="form-label" style={{color:d.text3}}>Invoice #</div><input style={inputStyle} value={clientInvoiceForm.invoice_number} onChange={e=>setClientInvoiceForm({...clientInvoiceForm,invoice_number:e.target.value})} placeholder="INV-001"/></div>
                            <div className="form-group"><div className="form-label" style={{color:d.text3}}>Total Fee ($)</div><input style={inputStyle} type="number" value={clientInvoiceForm.total_fee} onChange={e=>setClientInvoiceForm({...clientInvoiceForm,total_fee:e.target.value})} placeholder="0"/></div>
                            <div className="form-group"><div className="form-label" style={{color:d.text3}}>Deposit ($)</div><input style={inputStyle} type="number" value={clientInvoiceForm.deposit_amount} onChange={e=>setClientInvoiceForm({...clientInvoiceForm,deposit_amount:e.target.value})} placeholder="50% auto"/></div>
                            <div className="form-group"><div className="form-label" style={{color:d.text3}}>Due date</div><input style={inputStyle} type="date" value={clientInvoiceForm.due_date} onChange={e=>setClientInvoiceForm({...clientInvoiceForm,due_date:e.target.value})}/></div>
                            <div className="form-group" style={{gridColumn:'1/-1'}}><div className="form-label" style={{color:d.text3}}>Service description</div><input style={inputStyle} value={clientInvoiceForm.service_desc} onChange={e=>setClientInvoiceForm({...clientInvoiceForm,service_desc:e.target.value})} placeholder="Web development services"/></div>
                          </div>
                          <div className="form-actions">
                            <button className="btn-cancel" style={{borderColor:d.border,color:d.text2}} onClick={()=>setInvoiceType(null)}>Back</button>
                            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                              <button className="btn-save" style={{background:d.surface2,color:d.text}} onClick={()=>{
                                const total = parseFloat(clientInvoiceForm.total_fee)||0
                                const dep = parseFloat(clientInvoiceForm.deposit_amount||String(total*0.5))||0
                                openPreview(buildInvoicePreview(focusedClient.name,focusedClient.email,'project',total,dep),'download',()=>addClientInvoice(focusedClient.id,focusedClient.name,focusedClient.email,'download'))
                              }}>Preview</button>
                              <button className="btn-save" style={{background:d.surface2,color:d.text}} onClick={async()=>{await addClientInvoice(focusedClient.id,focusedClient.name,focusedClient.email,'download')}}>Download PDF</button>
                              <button className="btn-save" onClick={async()=>{await addClientInvoice(focusedClient.id,focusedClient.name,focusedClient.email,'send')}}>Send to Client</button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{fontSize:10,color:d.accent,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>Revision Invoice</div>
                          <div className="form-grid">
                            <div className="form-group"><div className="form-label" style={{color:d.text3}}>Invoice #</div><input style={inputStyle} value={clientInvoiceForm.invoice_number} onChange={e=>setClientInvoiceForm({...clientInvoiceForm,invoice_number:e.target.value})} placeholder="INV-002-REV"/></div>
                            <div className="form-group"><div className="form-label" style={{color:d.text3}}>Hours</div><input style={inputStyle} type="number" value={clientInvoiceForm.hours} onChange={e=>setClientInvoiceForm({...clientInvoiceForm,hours:e.target.value})} placeholder="0"/></div>
                            <div className="form-group"><div className="form-label" style={{color:d.text3}}>Hourly rate ($)</div><input style={inputStyle} type="number" value={clientInvoiceForm.hourly_rate} onChange={e=>setClientInvoiceForm({...clientInvoiceForm,hourly_rate:e.target.value})}/></div>
                            <div className="form-group"><div className="form-label" style={{color:d.text3}}>Due date</div><input style={inputStyle} type="date" value={clientInvoiceForm.due_date} onChange={e=>setClientInvoiceForm({...clientInvoiceForm,due_date:e.target.value})}/></div>
                            <div className="form-group" style={{gridColumn:'1/-1'}}><div className="form-label" style={{color:d.text3}}>Revision description</div><input style={inputStyle} value={clientInvoiceForm.service_desc} onChange={e=>setClientInvoiceForm({...clientInvoiceForm,service_desc:e.target.value})} placeholder="Additional revision round"/></div>
                          </div>
                          <div className="form-actions">
                            <button className="btn-cancel" style={{borderColor:d.border,color:d.text2}} onClick={()=>setInvoiceType(null)}>Back</button>
                            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                              <button className="btn-save" style={{background:d.surface2,color:d.text}} onClick={async()=>{await addClientInvoice(focusedClient.id,focusedClient.name,focusedClient.email,'download')}}>Download PDF</button>
                              <button className="btn-save" onClick={async()=>{await addClientInvoice(focusedClient.id,focusedClient.name,focusedClient.email,'send')}}>Send to Client</button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {showScheduleMeeting && (
                    <div className="form-card" style={{background:d.surface,borderColor:d.border,marginBottom:16}}>
                      <div className="form-title" style={{color:d.text}}>Schedule a meeting</div>
                      <div className="form-group" style={{marginBottom:10}}>
                        <div className="form-label" style={{color:d.text3}}>Meeting title</div>
                        <input style={inputStyle} value={meetingForm.title} onChange={e=>setMeetingForm({...meetingForm,title:e.target.value})} placeholder="Project Check-in"/>
                      </div>
                      <div className="form-grid">
                        <div className="form-group"><div className="form-label" style={{color:d.text3}}>Date</div><input style={inputStyle} type="date" value={meetingForm.date} onChange={e=>setMeetingForm({...meetingForm,date:e.target.value})}/></div>
                        <div className="form-group"><div className="form-label" style={{color:d.text3}}>Time (EST)</div><input style={inputStyle} type="time" value={meetingForm.time} onChange={e=>setMeetingForm({...meetingForm,time:e.target.value})}/></div>
                      </div>
                      <div className="form-actions">
                        <button className="btn-cancel" style={{borderColor:d.border,color:d.text2}} onClick={()=>setShowScheduleMeeting(false)}>Cancel</button>
                        <button className="btn-save" disabled={schedulingMeeting||!meetingForm.date||!meetingForm.time} onClick={()=>scheduleMeeting(focusedClient.id,focusedClient.name,focusedClient.email)}>
                          {schedulingMeeting?'Scheduling...':'Schedule and Email Client'}
                        </button>
                      </div>
                    </div>
                  )}
                  {clientMeetings.length > 0 && (
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:10,fontWeight:500,color:d.text3,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Meetings</div>
                      {clientMeetings.map(m=>{
                        const isPast = new Date(m.scheduled_at) < new Date()
                        return (
                          <div key={m.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',background:d.surface,borderRadius:10,marginBottom:4,opacity:isPast?0.6:1}}>
                            <div style={{flex:1}}>
                              <div style={{fontSize:12,color:d.text,fontWeight:500}}>{m.title}</div>
                              <div style={{fontSize:11,color:d.text2}}>{fmtShort(m.scheduled_at)} · {new Date(m.scheduled_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York',timeZoneName:'short'})}</div>
                            </div>
                            {!isPast&&m.zoom_host_url&&<a href={m.zoom_host_url} target="_blank" style={{fontSize:10,color:d.accent,textDecoration:'none',fontWeight:500}}>Start</a>}
                            {isPast&&<span style={{fontSize:10,color:d.text3}}>Done</span>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {clientInvoices.length > 0 && (
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:10,fontWeight:500,color:d.text3,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Invoices</div>
                      {clientInvoices.map(inv=>{
                        const statusColors: Record<string,{bg:string,text:string}> = {
                          paid: {bg:d.green,text:d.greenText},
                          deposit_paid: {bg:d.amber,text:d.amberText},
                          awaiting_deposit: {bg:d.surface2,text:d.text3},
                          pending: {bg:d.amber,text:d.amberText},
                        }
                        const sc = statusColors[inv.status] || {bg:d.surface2,text:d.text3}
                        const statusLabel = inv.status==='awaiting_deposit'?'Awaiting Deposit':inv.status==='deposit_paid'?'Deposit Paid':inv.status==='paid'?'Paid in Full':'Pending'
                        const nextAction = inv.status==='awaiting_deposit'?'Mark Deposit Paid':inv.status==='deposit_paid'?'Mark Final Paid':inv.status==='pending'?'Mark Paid':null
                        return (
                          <div key={inv.id} className="inv-row" style={{background:d.surface}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,width:'100%'}}>
                              <div style={{flex:1}}>
                                <div style={{fontSize:12,color:d.text,fontWeight:500}}>#{inv.invoice_number}{inv.invoice_type==='revision'?' · Revision':''}</div>
                                <div style={{fontSize:11,color:d.text2}}>{fmtMoney(inv.total_fee||inv.amount)}{inv.due_date?' · Due '+fmtShort(inv.due_date):''}</div>
                              </div>
                              <span className="status-pill" style={{background:sc.bg,color:sc.text}}>{statusLabel}</span>
                            </div>
                            {inv.invoice_type==='project' && inv.status!=='paid' && (
                              <div style={{fontSize:10,color:d.text3,paddingLeft:2}}>
                                {inv.status==='awaiting_deposit'&&'Deposit: '+fmtMoney(inv.deposit_amount||inv.total_fee*0.5)+' · Balance: '+fmtMoney((inv.total_fee||0)-(inv.deposit_amount||inv.total_fee*0.5))}
                                {inv.status==='deposit_paid'&&'Deposit received · Balance due: '+fmtMoney((inv.total_fee||0)-(inv.deposit_amount||0))}
                              </div>
                            )}
                            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                              <button className="cr-btn" style={{background:d.surface,color:d.text2,fontSize:10,padding:'4px 10px'}} onClick={()=>setViewingInvoice(inv)}>View</button>
                              {nextAction && (
                                <button className="cr-btn" style={{background:d.accentBg,color:d.accent,fontSize:10,padding:'4px 10px'}} onClick={()=>markInvoicePaid(inv)}>{nextAction}</button>
                              )}
                              {inv.status!=='paid'&&<button className="cr-btn" style={{background:d.surface,color:d.text2,fontSize:10,padding:'4px 10px'}} onClick={()=>sendInvoiceEmail(focusedClient.name,focusedClient.email,inv)}>{sendingInvoice?'Sending...':'Resend'}</button>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:10,fontWeight:500,color:d.text3,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8,display:'flex',alignItems:'center',gap:8}}>
                      Notes
                      <button className="icon-btn" style={{color:d.accent,fontSize:11}} onClick={()=>setEditingNotes(!editingNotes)}>{editingNotes?'cancel':'edit'}</button>
                    </div>
                    {editingNotes ? (
                      <div>
                        <textarea className="form-input" style={{background:d.surface,borderColor:d.border,color:d.text,marginBottom:8}} value={clientNotes} onChange={e=>setClientNotes(e.target.value)} placeholder="Notes from discovery call, client preferences, anything relevant..."/>
                        <button className="btn-save" onClick={()=>saveClientNotes(focusedClient.id)}>Save Notes</button>
                      </div>
                    ) : (
                      <div className="notes-box" style={{background:d.surface,borderColor:d.border,color:focusedClient.notes?d.text:d.text3}} onClick={()=>setEditingNotes(true)}>
                        {focusedClient.notes || 'Click to add notes...'}
                      </div>
                    )}
                  </div>
                  {clientDocs.length > 0 && (
                    <div>
                      <div style={{fontSize:10,fontWeight:500,color:d.text3,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Documents</div>
                      {clientDocs.map(doc=>(
                        <div key={doc.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:d.surface,borderRadius:10,marginBottom:6}}>
                          <span style={{fontSize:11,color:d.text3}}>doc</span>
                          <span style={{flex:1,fontSize:12,color:d.text}}>{doc.name}</span>
                          <button className="icon-btn" style={{color:d.accent,fontSize:12}} onClick={()=>downloadDoc(doc.storage_path,doc.name)}>↓</button>
                          <button className="icon-btn" style={{color:d.text3}} onClick={()=>deleteDocument(doc.id,doc.storage_path)}>x</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* ─── DOCUMENT PREVIEW MODAL ──────────────────────────────────────────── */}
      {previewDoc && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1100,padding:24}} onClick={()=>setPreviewDoc(null)}>
          <div style={{background:d.white,borderRadius:20,width:'100%',maxWidth:560,maxHeight:'85vh',display:'flex',flexDirection:'column',border:'1px solid '+d.border}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'20px 24px 16px',borderBottom:'1px solid '+d.border,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <div>
                <div style={{fontFamily:'Playfair Display,serif',fontSize:17,fontWeight:600,color:d.text}}>{previewDoc.title}</div>
                <div style={{fontSize:11,color:d.text3,marginTop:2}}>Review before {previewAction === 'send' ? 'sending' : 'downloading'}</div>
              </div>
              <button className="icon-btn" style={{color:d.text3,fontSize:18}} onClick={()=>setPreviewDoc(null)}>x</button>
            </div>
            <div style={{overflowY:'auto',padding:'8px 24px 16px',flex:1}}>
              {previewDoc.sections.map((s,i)=>(
                <div key={i} className="preview-section" style={{borderColor:d.border}}>
                  <div className="preview-label" style={{color:d.accent}}>{s.label}</div>
                  <div className="preview-value" style={{color:d.text}}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{padding:'16px 24px',borderTop:'1px solid '+d.border,display:'flex',gap:8,justifyContent:'flex-end',flexShrink:0}}>
              <button className="btn-cancel" style={{borderColor:d.border,color:d.text2}} onClick={()=>setPreviewDoc(null)}>Back to edit</button>
              <button className="btn-save" onClick={()=>{previewOnConfirm&&previewOnConfirm();setPreviewDoc(null);setPreviewOnConfirm(null)}}>
                {previewAction==='send'?'Confirm and Send':'Confirm and Download'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── INVOICE DETAIL MODAL ────────────────────────────────────────────── */}
      {viewingInvoice && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:24}} onClick={()=>setViewingInvoice(null)}>
          <div style={{background:d.white,borderRadius:20,padding:32,width:'100%',maxWidth:480,border:'1px solid '+d.border}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
              <div style={{fontFamily:'Playfair Display,serif',fontSize:18,fontWeight:600,color:d.text}}>Invoice #{viewingInvoice.invoice_number}</div>
              <button className="icon-btn" style={{color:d.text3,fontSize:18}} onClick={()=>setViewingInvoice(null)}>x</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:20}}>
              {[
                {label:'Type',val:(viewingInvoice.invoice_type==='revision'?'Revision Invoice':'Project Invoice')},
                {label:'Service',val:viewingInvoice.service_desc||'Web development services'},
                {label:'Total fee',val:fmtMoney(viewingInvoice.total_fee||viewingInvoice.amount)},
                ...(viewingInvoice.invoice_type==='project'?[
                  {label:'Deposit',val:fmtMoney(viewingInvoice.deposit_amount||viewingInvoice.total_fee*0.5)},
                  {label:'Balance',val:fmtMoney((viewingInvoice.total_fee||0)-(viewingInvoice.deposit_amount||0))},
                ]:[
                  {label:'Hours',val:viewingInvoice.hours+'h x $'+viewingInvoice.hourly_rate+'/hr'},
                ]),
                {label:'Due date',val:viewingInvoice.due_date?fmtShort(viewingInvoice.due_date):'Upon receipt'},
                {label:'Status',val:viewingInvoice.status==='awaiting_deposit'?'Awaiting Deposit':viewingInvoice.status==='deposit_paid'?'Deposit Paid':viewingInvoice.status==='paid'?'Paid in Full':'Pending'},
              ].map((row,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid '+d.border}}>
                  <div style={{fontSize:11,color:d.text3,textTransform:'uppercase',letterSpacing:'0.06em'}}>{row.label}</div>
                  <div style={{fontSize:13,color:d.text,fontWeight:500}}>{row.val}</div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn-save" style={{flex:1,background:d.surface2,color:d.text}} onClick={()=>{generateClientInvoicePDF('Client','',viewingInvoice.invoice_type,viewingInvoice.total_fee||viewingInvoice.amount,viewingInvoice.deposit_amount||0)}}>Download PDF</button>
              <button className="btn-cancel" style={{flex:1,borderColor:d.border,color:d.text2}} onClick={()=>setViewingInvoice(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PROJECT DETAIL MODAL ────────────────────────────────────────────── */}
      {viewingProject && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:24}} onClick={()=>setViewingProject(null)}>
          <div style={{background:d.white,borderRadius:20,padding:32,width:'100%',maxWidth:480,border:'1px solid '+d.border}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
              <div style={{fontFamily:'Playfair Display,serif',fontSize:18,fontWeight:600,color:d.text}}>{viewingProject.name}</div>
              <button className="icon-btn" style={{color:d.text3,fontSize:18}} onClick={()=>setViewingProject(null)}>x</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:0,marginBottom:20}}>
              {[
                {label:'Type',val:viewingProject.type},
                {label:'Value',val:fmtMoney(viewingProject.value)},
                {label:'Platform',val:viewingProject.platform},
                {label:'Status',val:viewingProject.status},
                {label:'Deadline',val:viewingProject.end_date?fmtShort(viewingProject.end_date):'None set'},
              ].map((row,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid '+d.border}}>
                  <div style={{fontSize:11,color:d.text3,textTransform:'uppercase',letterSpacing:'0.06em'}}>{row.label}</div>
                  <div style={{fontSize:13,color:d.text,fontWeight:500}}>{row.val}</div>
                </div>
              ))}
            </div>
            <div style={{marginBottom:16}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <div style={{fontSize:11,color:d.text3,textTransform:'uppercase',letterSpacing:'0.06em'}}>Notes</div>
                <button className="icon-btn" style={{color:d.accent,fontSize:11}} onClick={()=>setEditingProjectNotes(!editingProjectNotes)}>{editingProjectNotes?'cancel':'edit'}</button>
              </div>
              {editingProjectNotes ? (
                <div>
                  <textarea className="form-input" style={{background:d.surface,borderColor:d.border,color:d.text,marginBottom:8}} value={projectNotes} onChange={e=>setProjectNotes(e.target.value)} placeholder="Project notes, links, login credentials, anything relevant..."/>
                  <button className="btn-save" onClick={()=>saveProjectNotes(viewingProject.id)}>Save Notes</button>
                </div>
              ) : (
                <div className="notes-box" style={{background:d.surface,borderColor:d.border,color:viewingProject.notes?d.text:d.text3}} onClick={()=>setEditingProjectNotes(true)}>
                  {viewingProject.notes || 'Click to add notes...'}
                </div>
              )}
            </div>
            <button className="btn-cancel" style={{width:'100%',borderColor:d.border,color:d.text2}} onClick={()=>setViewingProject(null)}>Close</button>
          </div>
        </div>
      )}

      {/* ─── EMAIL MODAL ─────────────────────────────────────────────────────── */}
      {showEmailModal && focusedClient && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:24}} onClick={()=>setShowEmailModal(false)}>
          <div style={{background:d.white,borderRadius:20,padding:32,width:'100%',maxWidth:520,border:'1px solid '+d.border}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
              <div style={{fontFamily:'Playfair Display,serif',fontSize:18,fontWeight:600,color:d.text}}>Email {focusedClient.name.split(' ')[0]}</div>
              <button className="icon-btn" style={{color:d.text3,fontSize:18}} onClick={()=>setShowEmailModal(false)}>x</button>
            </div>
            <div style={{fontSize:12,color:d.text3,marginBottom:20}}>{focusedClient.email} · CC: {MY_EMAIL}</div>
            {emailSent ? (
              <div style={{textAlign:'center',padding:'32px 0'}}>
                <div style={{fontSize:32,marginBottom:12}}>✓</div>
                <div style={{fontSize:14,color:d.greenText,fontWeight:500}}>Email sent</div>
              </div>
            ) : (
              <>
                <div className="form-group" style={{marginBottom:12}}>
                  <div className="form-label" style={{color:d.text3}}>Subject</div>
                  <input style={inputStyle} value={emailForm.subject} onChange={e=>setEmailForm({...emailForm,subject:e.target.value})} placeholder="Project update, quick question..."/>
                </div>
                <div className="form-group" style={{marginBottom:20}}>
                  <div className="form-label" style={{color:d.text3}}>Message</div>
                  <textarea className="form-input" style={{background:d.surface,borderColor:d.border,color:d.text,minHeight:140}} value={emailForm.message} onChange={e=>setEmailForm({...emailForm,message:e.target.value})} placeholder={'Hi '+focusedClient.name.split(' ')[0]+','}/>
                </div>
                <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                  <button className="btn-cancel" style={{borderColor:d.border,color:d.text2}} onClick={()=>setShowEmailModal(false)}>Cancel</button>
                  <button className="btn-save" disabled={sendingEmail||!emailForm.subject||!emailForm.message} onClick={()=>sendClientEmail(focusedClient.name,focusedClient.email)}>
                    {sendingEmail?'Sending...':'Send Email'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── ACTIVE PROJECT POPUP ────────────────────────────────────────────── */}
      {showActiveProjectPopup && pendingAdvanceClient && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:d.white,borderRadius:20,padding:32,width:380,border:'1px solid '+d.border}}>
            <div style={{fontFamily:'Playfair Display,serif',fontSize:18,fontWeight:600,color:d.text,marginBottom:6}}>Moving to Active Project</div>
            <div style={{fontSize:12,color:d.text3,marginBottom:24}}>{pendingAdvanceClient.name} is now an active client. Add project details below.</div>
            <div className="form-group" style={{marginBottom:12}}>
              <div className="form-label" style={{color:d.text3}}>Project value ($)</div>
              <input style={inputStyle} type="number" value={activeProjectForm.value} onChange={e=>setActiveProjectForm({...activeProjectForm,value:e.target.value})} placeholder="Total project fee"/>
            </div>
            <div className="form-group" style={{marginBottom:20}}>
              <div className="form-label" style={{color:d.text3}}>Delivery deadline</div>
              <input style={inputStyle} type="date" value={activeProjectForm.end_date} onChange={e=>setActiveProjectForm({...activeProjectForm,end_date:e.target.value})}/>
            </div>
            <div className="form-actions">
              <button className="btn-cancel" style={{borderColor:d.border,color:d.text2}} onClick={()=>{setShowActiveProjectPopup(false);setPendingAdvanceClient(null)}}>Cancel</button>
              <button className="btn-save" onClick={confirmActiveProject}>Confirm and Advance</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}