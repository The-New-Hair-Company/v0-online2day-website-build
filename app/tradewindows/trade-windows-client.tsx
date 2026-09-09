'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileCheck2,
  FilePlus2,
  FileText,
  HardHat,
  Home,
  ImageIcon,
  Inbox,
  LayoutDashboard,
  Mail,
  MapPin,
  Menu,
  MessageSquareText,
  PanelTop,
  PencilLine,
  Phone,
  Plus,
  PoundSterling,
  RefreshCcw,
  Ruler,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Wrench,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  calculateQuote,
  canDirectAmend,
  createDemoState,
  demoContracts,
  flagshipContract,
  formatActivityTime,
  formatCurrency,
  formatShortDate,
  isDemoState,
  newActivity,
  roles,
  safeDemoFilename,
  stages,
  validateSurveyUnit,
  type DemoActivity,
  type DemoState,
  type SurveyUnit,
  type TradeWindowsRole,
} from '@/lib/tradewindows/demo-data'
import styles from './tradewindows.module.css'

const ROLE_KEY = 'tradewindows-demo-role'
const STATE_KEY = 'tradewindows-demo-state-v1'
const FITTING_PHONE = '01332 555 018'

type ConfirmState = {
  title: string
  detail: string
  actionLabel: string
  action: () => void
} | null

const roleIcons: Record<TradeWindowsRole, ReactNode> = {
  customer: <Home />,
  sales: <BriefcaseBusiness />,
  surveyor: <Ruler />,
  admin: <Building2 />,
  fitting: <HardHat />,
}

const navByRole: Record<TradeWindowsRole, Array<{ id: string; label: string; icon: ReactNode }>> = {
  customer: [
    { id: 'home', label: 'Overview', icon: <LayoutDashboard /> },
    { id: 'appointments', label: 'Appointments', icon: <CalendarDays /> },
    { id: 'order', label: 'My order', icon: <PanelTop /> },
    { id: 'documents', label: 'Documents', icon: <FileText /> },
    { id: 'support', label: 'Support', icon: <MessageSquareText /> },
  ],
  sales: [
    { id: 'home', label: 'Today', icon: <LayoutDashboard /> },
    { id: 'inbox', label: 'Inbox', icon: <Inbox /> },
    { id: 'quote', label: 'Quotation', icon: <PoundSterling /> },
    { id: 'mockup', label: 'Visualiser', icon: <Sparkles /> },
  ],
  surveyor: [
    { id: 'home', label: 'Visits', icon: <LayoutDashboard /> },
    { id: 'search', label: 'Contract', icon: <Search /> },
    { id: 'survey', label: 'Survey', icon: <Ruler /> },
    { id: 'documents', label: 'Documents', icon: <FilePlus2 /> },
  ],
  admin: [
    { id: 'home', label: 'Operations', icon: <LayoutDashboard /> },
    { id: 'workspace', label: 'Contract', icon: <BriefcaseBusiness /> },
    { id: 'documents', label: 'Orders', icon: <FileCheck2 /> },
    { id: 'activity', label: 'Activity', icon: <Clock3 /> },
  ],
  fitting: [{ id: 'home', label: 'Coming soon', icon: <HardHat /> }],
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={styles.brand} aria-label="Trade Windows Derby">
      <span className={styles.brandWord}>TRADE</span>
      {!compact ? <span className={styles.brandSub}>WINDOWS · DERBY</span> : null}
    </span>
  )
}

function DemoBadge() {
  return <span className={styles.demoBadge}><ShieldCheck /> Safe demonstration</span>
}

function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'red' | 'green' | 'amber' | 'blue' | 'neutral' }) {
  return <span className={`${styles.statusPill} ${styles[`tone_${tone}`]}`}>{children}</span>
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`${styles.card} ${className}`}>{children}</section>
}

function SectionHeading({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className={styles.sectionHeading}>
      <div>{eyebrow ? <span>{eyebrow}</span> : null}<h2>{title}</h2></div>
      {action}
    </div>
  )
}

function Metric({ label, value, detail, tone = 'dark' }: { label: string; value: string; detail: string; tone?: 'dark' | 'red' | 'light' }) {
  return (
    <div className={`${styles.metric} ${styles[`metric_${tone}`]}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

function ActivityList({ activity, limit }: { activity: DemoActivity[]; limit?: number }) {
  const shown = limit ? activity.slice(0, limit) : activity
  return (
    <div className={styles.activityList}>
      {shown.map((item) => (
        <article key={item.id}>
          <span className={`${styles.activityIcon} ${styles[`activity_${item.kind}`]}`} aria-hidden="true">
            {item.kind === 'payment' ? <CreditCard /> : item.kind === 'survey' ? <Ruler /> : item.kind === 'message' ? <Mail /> : item.kind === 'document' ? <FileText /> : item.kind === 'appointment' ? <CalendarDays /> : item.kind === 'amendment' ? <PencilLine /> : <Check />}
          </span>
          <div><strong>{item.title}</strong><p>{item.detail}</p><small>{item.actor} · {formatActivityTime(item.at)}</small></div>
        </article>
      ))}
    </div>
  )
}

function ProjectTimeline({ state }: { state: DemoState }) {
  const activeIndex = state.survey.complete ? 5 : flagshipContract.stageIndex
  return (
    <ol className={styles.timeline} aria-label="Project progress">
      {stages.map((stage, index) => (
        <li key={stage} className={index < activeIndex ? styles.timelineDone : index === activeIndex ? styles.timelineActive : ''}>
          <span>{index < activeIndex ? <Check /> : index + 1}</span>
          <div><strong>{stage}</strong>{index === activeIndex ? <small>Current stage</small> : null}</div>
        </li>
      ))}
    </ol>
  )
}

function RoleSelection({ onSelect }: { onSelect: (role: TradeWindowsRole) => void }) {
  return (
    <main className={styles.rolePage} data-tradewindows-demo>
      <div className={styles.roleGeometry} aria-hidden="true"><span /><span /><span /><span /></div>
      <header className={styles.roleHeader}><BrandMark /><DemoBadge /></header>
      <section className={styles.roleIntro}>
        <span className={styles.kicker}>One project. One shared view.</span>
        <h1>See the right work,<br />at the right moment.</h1>
        <p>Choose a perspective to explore the connected Trade Windows operations platform.</p>
      </section>
      <section className={styles.roleGrid} aria-label="Choose your role">
        {roles.map((role, index) => (
          <button key={role.id} type="button" className={styles.roleCard} onClick={(event) => { event.currentTarget.blur(); window.scrollTo(0, 0); onSelect(role.id) }}>
            <span className={styles.roleNumber}>0{index + 1}</span>
            <span className={styles.roleIcon}>{roleIcons[role.id]}</span>
            <strong>{role.name}</strong>
            <span>{role.description}</span>
            <span className={styles.roleArrow}><ArrowRight /></span>
          </button>
        ))}
      </section>
      <footer className={styles.roleFooter}>
        <span>Fictional data · No live actions</span>
        <span>Designed for Trade Windows Derby</span>
      </footer>
    </main>
  )
}

function DashboardShell({ role, section, setSection, onChangeRole, onReset, children }: {
  role: TradeWindowsRole
  section: string
  setSection: (value: string) => void
  onChangeRole: () => void
  onReset: () => void
  children: ReactNode
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const roleName = roles.find((item) => item.id === role)?.name || role
  const nav = navByRole[role]
  return (
    <div className={styles.appShell} data-tradewindows-demo>
      <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarTop}>
          <BrandMark />
          <button type="button" className={styles.closeMenu} onClick={() => setMenuOpen(false)} aria-label="Close navigation"><X /></button>
        </div>
        <div className={styles.roleIdentity}>
          <span>{roleIcons[role]}</span>
          <div><small>Viewing as</small><strong>{roleName}</strong></div>
          <button type="button" onClick={onChangeRole} aria-label="Change role"><RefreshCcw /></button>
        </div>
        <nav aria-label={`${roleName} navigation`}>
          {nav.map((item) => (
            <button key={item.id} type="button" onClick={() => { setSection(item.id); setMenuOpen(false) }} className={section === item.id ? styles.navActive : ''}>
              {item.icon}<span>{item.label}</span><ChevronRight />
            </button>
          ))}
        </nav>
        <div className={styles.sidebarFoot}>
          <DemoBadge />
          <p>Everything here is fictional and isolated from production records.</p>
          <button type="button" onClick={onReset}><RefreshCcw /> Reset demo</button>
        </div>
      </aside>
      {menuOpen ? <button className={styles.menuScrim} type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} /> : null}
      <div className={styles.workspace}>
        <header className={styles.mobileHeader}>
          <BrandMark compact />
          <div><span>{roleName}</span><button type="button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu /></button></div>
        </header>
        <div className={styles.workspaceBar}>
          <div><span className={styles.liveDot} /> Demonstration workspace</div>
          <div><span className={styles.notificationStatus} aria-label="No unread notifications"><Bell /></span><span className={styles.avatar}>TW</span></div>
        </div>
        <main className={styles.main}>{children}</main>
        <nav className={styles.mobileNav} aria-label={`${roleName} mobile navigation`}>
          {nav.slice(0, 4).map((item) => (
            <button key={item.id} type="button" onClick={() => setSection(item.id)} className={section === item.id ? styles.navActive : ''}>
              {item.icon}<span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}

function DashboardHero({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <header className={styles.dashboardHero}>
      <div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      {action}
    </header>
  )
}

type DashboardProps = {
  state: DemoState
  section: string
  setSection: (section: string) => void
  update: (updater: (current: DemoState) => DemoState, message?: string) => void
  confirm: (value: ConfirmState) => void
  notify: (message: string) => void
}

function CustomerDashboard({ state, section, setSection, update, confirm, notify }: DashboardProps) {
  if (section === 'appointments') return <CustomerAppointments state={state} update={update} />
  if (section === 'order') return <CustomerOrder state={state} update={update} notify={notify} />
  if (section === 'documents') return <CustomerDocuments state={state} update={update} confirm={confirm} />
  if (section === 'support') return <CustomerSupport update={update} />

  const balance = state.invoice.totalPence - state.invoice.paidPence
  return (
    <>
      <DashboardHero eyebrow={`Contract ${flagshipContract.number}`} title={`Good morning, ${flagshipContract.firstName}.`} description="Your home improvement project is moving forward. Here is what matters today." action={<button className={styles.heroAction} type="button" onClick={() => setSection('appointments')}><CalendarDays /> Confirm availability</button>} />
      <div className={styles.heroContract}>
        <div><MapPin /><span><small>Project address</small><strong>{flagshipContract.address}</strong></span></div>
        <StatusPill tone={state.survey.complete ? 'green' : 'red'}>{state.survey.complete ? 'Survey complete' : 'Survey scheduled'}</StatusPill>
      </div>
      <div className={styles.customerGrid}>
        <Card className={styles.timelineCard}>
          <SectionHeading eyebrow="Your journey" title="Project progress" />
          <ProjectTimeline state={state} />
        </Card>
        <div className={styles.sideStack}>
          <Card className={styles.nextCard}>
            <span className={styles.cardIcon}><CalendarDays /></span>
            <small>Next appointment</small><h2>{state.survey.complete ? 'Survey completed' : 'Home survey'}</h2>
            <p>{state.survey.complete ? formatActivityTime(state.survey.completedAt || '') : flagshipContract.nextAppointment}</p>
            <button type="button" onClick={() => setSection('appointments')}>{state.survey.complete ? 'View record' : 'Manage availability'}<ArrowRight /></button>
          </Card>
          <Card className={styles.balanceCard}>
            <small>{state.invoice.status === 'paid' ? 'Payment complete' : 'Remaining balance'}</small>
            <strong>{formatCurrency(balance)}</strong>
            <div><span>{formatCurrency(state.invoice.paidPence)} paid</span><span>{Math.round(state.invoice.paidPence / state.invoice.totalPence * 100)}%</span></div>
            <div className={styles.paymentProgress}><span style={{ width: `${Math.min(100, state.invoice.paidPence / state.invoice.totalPence * 100)}%` }} /></div>
            <button type="button" disabled={balance === 0} onClick={() => setSection('documents')}><CreditCard />{balance ? 'View payment options' : 'View receipt'}</button>
          </Card>
        </div>
      </div>
      <Card>
        <SectionHeading eyebrow="Latest" title="Recent updates" action={<button className={styles.textButton} type="button" onClick={() => setSection('documents')}>Documents <ArrowRight /></button>} />
        <ActivityList activity={state.activity} limit={4} />
      </Card>
    </>
  )
}

function CustomerAppointments({ state, update }: Pick<DashboardProps, 'state' | 'update'>) {
  const [date, setDate] = useState('2026-09-16')
  const [period, setPeriod] = useState<'Morning' | 'Afternoon' | 'All day'>('Morning')
  const [notes, setNotes] = useState('')
  function addAvailability() {
    if (!date) return
    update((current) => ({
      ...current,
      availability: [...current.availability, { id: crypto.randomUUID(), date, period, notes: notes.trim() }],
      activity: [newActivity({ actor: 'Maya Carter', title: 'Availability updated', detail: `${formatShortDate(date)}, ${period.toLowerCase()} added as a preference.`, kind: 'appointment' }), ...current.activity],
    }), 'Availability shared with the operations team.')
    setNotes('')
  }
  return (
    <>
      <DashboardHero eyebrow="Appointments" title="When works for you?" description="Share several options. These are preferences until our team confirms a time with you." />
      <div className={styles.twoColumn}>
        <Card>
          <SectionHeading eyebrow="Your preferences" title="Available dates" />
          <div className={styles.availabilityList}>
            {state.availability.map((item) => <article key={item.id}><CalendarDays /><div><strong>{formatShortDate(item.date)} · {item.period}</strong><p>{item.notes || 'No access notes added.'}</p></div><StatusPill tone="amber">Preference</StatusPill></article>)}
          </div>
        </Card>
        <Card>
          <SectionHeading eyebrow="Add another" title="Share a date" />
          <div className={styles.formGrid}>
            <label>Date<input type="date" value={date} min="2026-09-10" onChange={(event) => setDate(event.target.value)} /></label>
            <fieldset><legend>Time of day</legend><div className={styles.segmented}>{(['Morning', 'Afternoon', 'All day'] as const).map((value) => <button key={value} type="button" className={period === value ? styles.selected : ''} onClick={() => setPeriod(value)}>{value}</button>)}</div></fieldset>
            <label className={styles.fullField}>Access notes or considerations<textarea rows={4} maxLength={300} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="For example, please call before arrival." /></label>
            <button type="button" className={styles.primaryButton} onClick={addAvailability}><Send /> Share preference</button>
          </div>
          <div className={styles.infoNote}><ShieldCheck /><p><strong>Your chosen date is not yet confirmed.</strong> The team will check the diary and contact you.</p></div>
        </Card>
      </div>
    </>
  )
}

function CustomerOrder({ state, update, notify }: Pick<DashboardProps, 'state' | 'update' | 'notify'>) {
  const [amendment, setAmendment] = useState('')
  const [pendingFiles, setPendingFiles] = useState<string[]>([])
  const direct = canDirectAmend(state)
  function submitAmendment() {
    if (amendment.trim().length < 10) return notify('Please describe the requested change in a little more detail.')
    const nextStatus = direct ? 'submitted' : 'under review'
    update((current) => ({ ...current, amendment: { detail: amendment.trim(), status: nextStatus, updatedBy: 'Maya Carter', updatedAt: new Date().toISOString() }, activity: [newActivity({ actor: 'Maya Carter', title: 'Amendment requested', detail: amendment.trim(), kind: 'amendment' }), ...current.activity] }), direct ? 'Amendment submitted.' : 'Review request sent to the admin team.')
    setAmendment('')
  }
  function selectFiles(files: FileList | null) {
    if (!files) return
    const accepted = Array.from(files).slice(0, 6).filter((file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 8 * 1024 * 1024).map((file) => safeDemoFilename(file.name))
    setPendingFiles((current) => [...current, ...accepted].slice(0, 6))
    if (accepted.length !== files.length) notify('Only JPEG, PNG or WebP files up to 8 MB are accepted.')
  }
  function submitFiles() {
    if (!pendingFiles.length) return notify('Choose at least one photograph first.')
    update((current) => ({ ...current, customerFiles: [...current.customerFiles, ...pendingFiles], activity: [newActivity({ actor: 'Maya Carter', title: 'Property photographs added', detail: `${pendingFiles.length} safe demo filename${pendingFiles.length === 1 ? '' : 's'} saved in this browser.`, kind: 'document' }), ...current.activity] }), 'Photographs added to the demonstration contract.')
    setPendingFiles([])
  }
  return (
    <>
      <DashboardHero eyebrow="My order" title="Everything agreed, in one place." description="Review products, share useful photographs and ask for a change without losing the original order." />
      <div className={styles.twoColumnWide}>
        <Card>
          <SectionHeading eyebrow="Contract 240184" title="Products in your order" />
          <div className={styles.productList}>{flagshipContract.products.map((product) => <article key={product.id}><span>{product.quantity}</span><div><strong>{product.name}</strong><p>{product.location}</p></div><CheckCircle2 /></article>)}</div>
          <div className={styles.photoStrip}>
            <Image src="/tradewindows/property-before.jpg" alt="Fictional red-brick Derbyshire property before proposed work" width={720} height={480} sizes="(max-width: 800px) 90vw, 42vw" />
            <div><strong>{state.customerFiles.length} photographs</strong><span>Available to sales, survey and admin</span></div>
          </div>
          <div className={styles.uploadPanel}>
            <Upload /><div><strong>Add property photographs</strong><p>JPEG, PNG or WebP · 8 MB each · up to 6 at a time</p></div>
            <label className={styles.secondaryButton}>Choose files<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => selectFiles(event.target.files)} /></label>
          </div>
          {pendingFiles.length ? <div className={styles.pendingFiles}>{pendingFiles.map((file) => <span key={file}><ImageIcon />{file}<button type="button" aria-label={`Remove ${file}`} onClick={() => setPendingFiles((current) => current.filter((item) => item !== file))}><X /></button></span>)}<button type="button" className={styles.primaryButton} onClick={submitFiles}>Add to contract</button></div> : null}
          <p className={styles.demoNotice}><ShieldCheck /> Demo uploads stay in this browser; no file is sent to production storage.</p>
        </Card>
        <Card>
          <SectionHeading eyebrow="Change request" title="Need to amend something?" />
          <StatusPill tone={direct ? 'green' : 'amber'}>{direct ? 'Direct request available' : 'Admin review required'}</StatusPill>
          <p className={styles.explainer}>{direct ? 'You can request changes until the survey is signed off. Our team will confirm price or timing changes before anything is altered.' : 'The survey has been signed off, so your change will be preserved and sent to the admin team for review rather than altering the manufacturing order.'}</p>
          <label className={styles.fullField}>Describe the change<textarea rows={6} value={amendment} maxLength={1000} onChange={(event) => setAmendment(event.target.value)} placeholder="Tell us which room or product is affected and what you would like to change." /></label>
          <button type="button" className={styles.primaryButton} onClick={submitAmendment}><PencilLine />{direct ? 'Submit amendment' : 'Request a review'}</button>
          <div className={styles.currentAmendment}><small>Latest request</small><strong>{state.amendment.status}</strong><p>{state.amendment.detail}</p><span>Updated by {state.amendment.updatedBy} · {formatActivityTime(state.amendment.updatedAt)}</span></div>
        </Card>
      </div>
    </>
  )
}

function CustomerDocuments({ state, update, confirm }: Pick<DashboardProps, 'state' | 'update' | 'confirm'>) {
  const outstanding = state.invoice.totalPence - state.invoice.paidPence
  function completePayment() {
    update((current) => ({ ...current, invoice: { ...current.invoice, status: 'paid', paidPence: current.invoice.totalPence }, activity: [newActivity({ actor: 'Stripe test mode', title: 'Balance payment confirmed', detail: `${formatCurrency(outstanding)} demonstration payment reconciled against INV-240184-2.`, kind: 'payment' }), ...current.activity] }), 'Stripe test payment simulated. No money was taken.')
  }
  return (
    <>
      <DashboardHero eyebrow="Documents & payments" title="Clear records. No surprises." description="View project documents, invoices and the current payment position." />
      <div className={styles.metricGrid}>
        <Metric label="Contract value" value={formatCurrency(state.invoice.totalPence)} detail="Including VAT" />
        <Metric label="Paid to date" value={formatCurrency(state.invoice.paidPence)} detail="Deposit reconciled" tone="light" />
        <Metric label="Outstanding" value={formatCurrency(outstanding)} detail={state.invoice.status === 'paid' ? 'Nothing to pay' : 'Due before fitting'} tone={state.invoice.status === 'paid' ? 'dark' : 'red'} />
      </div>
      <div className={styles.twoColumn}>
        <Card>
          <SectionHeading eyebrow="Project files" title="Your documents" />
          <div className={styles.documentList}>
            {state.documents.filter((doc) => doc.status !== 'Draft').map((document) => <article key={document.id}><FileText /><div><strong>{document.title}</strong><p>PDF · {formatActivityTime(document.createdAt)}</p></div><a href={`/api/tradewindows/demo-document?type=${document.title.startsWith('Quotation') ? 'quotation' : 'invoice'}&contract=240184`} target="_blank" rel="noreferrer">View <ExternalLink /></a></article>)}
          </div>
        </Card>
        <Card className={styles.paymentCard}>
          <StatusPill tone={state.invoice.status === 'paid' ? 'green' : 'amber'}>{state.invoice.status}</StatusPill>
          <h2>{state.invoice.status === 'paid' ? 'You are all paid up.' : `${formatCurrency(outstanding)} remaining`}</h2>
          <p>{state.invoice.status === 'paid' ? 'A demonstration receipt is available with your project documents.' : 'In production this button creates a Stripe-hosted checkout. Wallets appear only when Stripe and the device confirm eligibility.'}</p>
          {state.invoice.status !== 'paid' ? <button type="button" className={styles.primaryButton} onClick={() => confirm({ title: 'Simulate a Stripe test payment?', detail: `This updates only the fictional demonstration contract. No checkout is created and no payment of ${formatCurrency(outstanding)} is taken.`, actionLabel: 'Confirm test payment', action: completePayment })}><CreditCard /> Simulate test payment</button> : <a className={styles.secondaryButton} href="/api/tradewindows/demo-document?type=receipt&contract=240184" target="_blank" rel="noreferrer"><Download /> Open receipt</a>}
          <small><ShieldCheck /> Test-mode demonstration · card details are never collected here</small>
        </Card>
      </div>
    </>
  )
}

function CustomerSupport({ update }: Pick<DashboardProps, 'update'>) {
  const [message, setMessage] = useState('')
  function sendMessage() {
    if (!message.trim()) return
    update((current) => ({ ...current, activity: [newActivity({ actor: 'Maya Carter', title: 'Support message added', detail: message.trim(), kind: 'message' }), ...current.activity] }), 'Message added to the demo conversation. No email was sent.')
    setMessage('')
  }
  return (
    <>
      <DashboardHero eyebrow="Support" title="We are here when you need us." description="Your project context travels with every message, so you do not need to repeat the details." />
      <div className={styles.twoColumn}>
        <Card>
          <SectionHeading eyebrow="Project team" title="Useful contacts" />
          <div className={styles.contactList}>
            <article><span>LM</span><div><strong>{flagshipContract.salesOwner}</strong><p>Your project adviser</p></div><a href="tel:01332755551"><Phone /> Call</a></article>
            <article><span>TW</span><div><strong>Customer care</strong><p>Monday–Friday, 10am–6pm</p></div><a href="tel:01332755551"><Phone /> 01332 755551</a></article>
          </div>
        </Card>
        <Card>
          <SectionHeading eyebrow="Conversation" title="Send a project message" />
          <label className={styles.fullField}>How can we help?<textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={6} maxLength={1000} placeholder="Write your message here." /></label>
          <button type="button" className={styles.primaryButton} onClick={sendMessage}><Send /> Add demo message</button>
          <p className={styles.demoNotice}><ShieldCheck /> Demonstration messages remain in this session and are not delivered externally.</p>
        </Card>
      </div>
    </>
  )
}

function SalesDashboard({ state, section, setSection, update, notify }: DashboardProps) {
  if (section === 'inbox') return <SalesInbox state={state} update={update} notify={notify} />
  if (section === 'quote') return <SalesQuote state={state} update={update} notify={notify} />
  if (section === 'mockup') return <SalesMockup state={state} update={update} notify={notify} />
  return (
    <>
      <DashboardHero eyebrow="Sales workspace" title="Keep every promising project moving." description="Priority conversations, appointments and quotations are arranged around the next useful action." action={<button type="button" className={styles.heroAction} onClick={() => setSection('inbox')}><MessageSquareText /> Open priority inbox</button>} />
      <div className={styles.metricGridFour}>
        <Metric label="New enquiries" value="8" detail="3 since yesterday" tone="red" />
        <Metric label="Awaiting reply" value="5" detail="2 high priority" />
        <Metric label="Quotes in progress" value="4" detail={formatCurrency(3215000)} tone="light" />
        <Metric label="Today" value="3" detail="Appointments" />
      </div>
      <div className={styles.twoColumnWide}>
        <Card>
          <SectionHeading eyebrow="Priority queue" title="Conversations needing you" action={<button className={styles.textButton} type="button" onClick={() => setSection('inbox')}>View inbox <ArrowRight /></button>} />
          <div className={styles.conversationList}>
            <button type="button" onClick={() => setSection('inbox')}><span className={styles.unreadDot} /><div><strong>Maya Carter</strong><p>Thanks — Saturday morning works best for the survey.</p><small>Contract 240184 · 18 min ago</small></div><StatusPill tone="red">Priority</StatusPill></button>
            <button type="button" onClick={() => setSection('inbox')}><span>PS</span><div><strong>Priya Shah</strong><p>Could you explain the difference between the two door finishes?</p><small>Contract 240205 · 42 min ago</small></div><StatusPill tone="amber">Quote sent</StatusPill></button>
            <button type="button" onClick={() => setSection('inbox')}><span>TB</span><div><strong>Tom Bennett</strong><p>Photograph added to the manufacturing query.</p><small>Contract 240231 · 1 hr ago</small></div></button>
          </div>
        </Card>
        <Card>
          <SectionHeading eyebrow="Next appointment" title="Maya & Daniel Carter" />
          <div className={styles.appointmentFeature}><CalendarDays /><div><strong>Home survey handover</strong><span>12 Sep · 09:30</span><p>17 Millstone View, Oakwell</p></div></div>
          <div className={styles.contextRows}><span><UserRound /> Customer availability <strong>Received</strong></span><span><FileText /> Quotation <strong>Sent</strong></span><span><Camera /> Property images <strong>{state.customerFiles.length}</strong></span></div>
          <button type="button" className={styles.secondaryButton} onClick={() => setSection('quote')}>Open contract context <ArrowRight /></button>
        </Card>
      </div>
      <Card>
        <SectionHeading eyebrow="Signals" title="Recent customer activity" />
        <ActivityList activity={state.activity.filter((item) => ['Maya Carter', 'Stripe test mode'].includes(item.actor))} limit={4} />
      </Card>
    </>
  )
}

function SalesInbox({ state, update, notify }: Pick<DashboardProps, 'state' | 'update' | 'notify'>) {
  const [reply, setReply] = useState(state.salesReply)
  function saveDraft() { update((current) => ({ ...current, salesReply: reply }), 'Draft saved in this browser session.') }
  function sendReply() {
    if (reply.trim().length < 2) return notify('Write a reply before sending.')
    update((current) => ({ ...current, salesReply: '', activity: [newActivity({ actor: 'Leah Morgan', title: 'Sales reply prepared', detail: reply.trim(), kind: 'message' }), ...current.activity] }), 'Demo reply recorded. No message or email was sent.')
    setReply('')
  }
  return (
    <>
      <DashboardHero eyebrow="Sales inbox" title="Reply with the whole project in view." description="Conversation, contract and next action stay together so follow-up remains personal and precise." />
      <div className={styles.inboxLayout}>
        <Card className={styles.inboxList}>
          <label className={styles.searchBox}><Search /><span className={styles.srOnly}>Search conversations</span><input type="search" placeholder="Search customer or contract" /></label>
          {['Maya Carter|240184|Saturday morning works best.|Priority', 'Priya Shah|240205|Question about door finishes.|Unread', 'Tom Bennett|240231|New property photograph.|Open'].map((row, index) => { const [name, contract, preview, status] = row.split('|'); return <button type="button" key={name} className={index === 0 ? styles.activeConversation : ''} onClick={() => notify(index === 0 ? 'Contract 240184 is already open.' : `Contract ${contract} is a supporting record. The connected demonstration stays on contract 240184.`)}><span>{name.split(' ').map((part) => part[0]).join('')}</span><div><strong>{name}</strong><p>{preview}</p><small>Contract {contract}</small></div><em>{status}</em></button> })}
        </Card>
        <Card className={styles.thread}>
          <header><div><span>MC</span><div><strong>Maya Carter</strong><small>Contract 240184 · Survey scheduled</small></div></div><a href="tel:01332555014"><Phone /> Call</a></header>
          <div className={styles.messages}>
            <article><p>I have uploaded the front of the house and our living room window. Will the surveyor be able to see them?</p><small>Maya · Yesterday, 16:48</small></article>
            <article className={styles.fromTeam}><p>Yes — Jamie will see both photographs with the survey brief. Could you share two suitable dates?</p><small>You · Yesterday, 17:06</small></article>
            <article><p>Thanks — Saturday morning works best. Monday afternoon is also possible.</p><small>Maya · Today, 08:42</small></article>
          </div>
          <div className={styles.composer}>
            <label><span className={styles.srOnly}>Reply to Maya</span><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={4} maxLength={5000} placeholder="Write a helpful reply…" /></label>
            <div><button type="button" className={styles.textButton} onClick={saveDraft}>Save draft</button><button type="button" className={styles.primaryButton} onClick={sendReply}><Send /> Record demo reply</button></div>
            <small><ShieldCheck /> Safe demo: replies are not delivered externally.</small>
          </div>
        </Card>
        <aside className={styles.contextPanel}>
          <Card><small>Contract</small><strong>240184</strong><p>{flagshipContract.address}</p><dl><div><dt>Stage</dt><dd>Survey scheduled</dd></div><div><dt>Value</dt><dd>{formatCurrency(state.invoice.totalPence)}</dd></div><div><dt>Images</dt><dd>{state.customerFiles.length}</dd></div></dl></Card>
        </aside>
      </div>
    </>
  )
}

function SalesQuote({ state, update, notify }: Pick<DashboardProps, 'state' | 'update' | 'notify'>) {
  const totals = calculateQuote(state.quote.lines, state.quote.discountPercent)
  function patchLine(id: string, patch: Partial<(typeof state.quote.lines)[number]>) { update((current) => ({ ...current, quote: { ...current.quote, lines: current.quote.lines.map((line) => line.id === id ? { ...line, ...patch } : line) } })) }
  function addLine() { update((current) => ({ ...current, quote: { ...current.quote, lines: [...current.quote.lines, { id: crypto.randomUUID(), description: 'Additional item', quantity: 1, unitPricePence: 0 }] } })) }
  function sendQuote() { update((current) => ({ ...current, quote: { ...current.quote, status: 'sent' }, documents: current.documents.some((doc) => doc.id === 'd1') ? current.documents : [...current.documents, { id: 'd1', title: 'Quotation Q-240184', status: 'Ready', createdAt: new Date().toISOString() }], activity: [newActivity({ actor: 'Leah Morgan', title: 'Quotation updated', detail: `Q-240184 prepared at ${formatCurrency(totals.totalPence)} including VAT.`, kind: 'document' }), ...current.activity] }), 'Quotation saved to the demo contract. No email was sent.') }
  async function previewQuote() {
    const preview = window.open('', '_blank')
    if (preview) preview.opener = null
    try {
      const response = await fetch('/api/tradewindows/demo-document?type=quotation&contract=240184', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: state.quote.lines, discountPercent: state.quote.discountPercent }),
      })
      if (!response.ok) throw new Error('Preview unavailable')
      const objectUrl = URL.createObjectURL(await response.blob())
      if (preview) preview.location.href = objectUrl
      else {
        const link = document.createElement('a')
        link.href = objectUrl
        link.target = '_blank'
        link.rel = 'noreferrer'
        link.click()
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch {
      preview?.close()
      notify('The PDF preview could not be prepared. Please try again.')
    }
  }
  return (
    <>
      <DashboardHero eyebrow="Quotation builder" title="A clear proposal, ready to personalise." description="Prices are calculated in pence, with VAT and discount shown before anything is shared." />
      <div className={styles.quoteLayout}>
        <Card>
          <div className={styles.quoteMeta}><div><span>Customer</span><strong>Maya & Daniel Carter</strong></div><div><span>Contract</span><strong>240184</strong></div><div><span>Status</span><StatusPill tone="amber">{state.quote.status}</StatusPill></div></div>
          <div className={styles.quoteTable}>
            <div className={styles.quoteHead}><span>Description</span><span>Qty</span><span>Unit price</span><span>Total</span><span /></div>
            {state.quote.lines.map((line) => <div className={styles.quoteRow} key={line.id}><label><span className={styles.srOnly}>Description</span><input value={line.description} maxLength={120} onChange={(event) => patchLine(line.id, { description: event.target.value })} /></label><label><span className={styles.srOnly}>Quantity</span><input type="number" inputMode="numeric" min={1} max={99} value={line.quantity} onChange={(event) => patchLine(line.id, { quantity: Number(event.target.value) })} /></label><label><span className={styles.srOnly}>Unit price in pounds</span><span className={styles.moneyInput}>£<input type="number" inputMode="decimal" min={0} step="0.01" value={(line.unitPricePence / 100).toFixed(2)} onChange={(event) => patchLine(line.id, { unitPricePence: Math.round(Number(event.target.value) * 100) })} /></span></label><strong>{formatCurrency(line.quantity * line.unitPricePence)}</strong><button type="button" aria-label={`Remove ${line.description}`} onClick={() => update((current) => ({ ...current, quote: { ...current.quote, lines: current.quote.lines.filter((item) => item.id !== line.id) } }))}><Trash2 /></button></div>)}
          </div>
          <button type="button" className={styles.addButton} onClick={addLine}><Plus /> Add line item</button>
        </Card>
        <Card className={styles.quoteSummary}>
          <SectionHeading eyebrow="Summary" title="Quotation total" />
          <label>Discount<input type="number" min={0} max={30} value={state.quote.discountPercent} onChange={(event) => update((current) => ({ ...current, quote: { ...current.quote, discountPercent: Number(event.target.value) } }))} /><span>%</span></label>
          <dl><div><dt>Subtotal</dt><dd>{formatCurrency(totals.subtotalPence)}</dd></div><div><dt>Discount</dt><dd>−{formatCurrency(totals.discountPence)}</dd></div><div><dt>VAT (20%)</dt><dd>{formatCurrency(totals.vatPence)}</dd></div><div className={styles.quoteTotal}><dt>Total</dt><dd>{formatCurrency(totals.totalPence)}</dd></div></dl>
          <button type="button" className={styles.secondaryButton} onClick={previewQuote}><FileText /> Preview current PDF</button>
          <button type="button" className={styles.primaryButton} onClick={sendQuote}><Send /> Save demonstration quote</button>
          <small><ShieldCheck /> No email, invoice or external payment link is created in demo mode.</small>
        </Card>
      </div>
    </>
  )
}

function SalesMockup({ state, update, notify }: Pick<DashboardProps, 'state' | 'update' | 'notify'>) {
  const [position, setPosition] = useState(52)
  async function copyLink() {
    const link = `${window.location.origin}/tradewindows/share/demo-larkfield`
    try { await navigator.clipboard.writeText(link); notify('Secure demonstration link copied.') } catch { notify(link) }
  }
  return (
    <>
      <DashboardHero eyebrow="Property visualiser" title="Help customers picture the change." description="This prepared fictional comparison demonstrates the approved workflow without calling a live image service." />
      <div className={styles.mockupLayout}>
        <Card className={styles.visualCard}>
          <div className={styles.compare} style={{ '--compare': `${position}%` } as CSSProperties}>
            <Image src="/tradewindows/property-before.jpg" alt="Fictional property before proposed window changes" fill sizes="(max-width: 900px) 96vw, 64vw" priority />
            <div className={styles.afterImage}><Image src="/tradewindows/property-after.jpg" alt="Prepared demonstration visual showing anthracite windows and a red door" fill sizes="(max-width: 900px) 96vw, 64vw" /></div>
            <span className={styles.beforeLabel}>Original</span><span className={styles.afterLabel}>Prepared demo</span><i />
          </div>
          <label className={styles.compareControl}>Drag to compare<input type="range" min={10} max={90} value={position} onChange={(event) => setPosition(Number(event.target.value))} /></label>
        </Card>
        <Card className={styles.mockupControls}>
          <StatusPill tone="blue">Prepared demonstration</StatusPill>
          <h2>Anthracite frames + Trade red door</h2>
          <p>Generated from an entirely fictional property photograph. Production would queue the approved image provider through the authenticated Azure API.</p>
          <label>Visual change brief<textarea rows={5} defaultValue="Replace the right-hand property’s white frames with slim anthracite casements and show a muted red composite entrance door." /></label>
          <button type="button" className={styles.primaryButton} onClick={() => update((current) => ({ ...current, mockupSaved: true, activity: [newActivity({ actor: 'Leah Morgan', title: 'Design mock-up saved', detail: 'Anthracite window and Trade red door visual attached to contract 240184.', kind: 'document' }), ...current.activity] }), 'Prepared mock-up saved to this demonstration session.')}><FileCheck2 /> {state.mockupSaved ? 'Saved to contract' : 'Save to contract'}</button>
          <button type="button" className={styles.secondaryButton} onClick={copyLink}><Copy /> Copy guest link</button>
          <a className={styles.secondaryButton} href="/tradewindows/property-after.jpg" download><Download /> Download image</a>
          <Link className={styles.textLink} href="/tradewindows/share/demo-larkfield" target="_blank">Open customer view <ExternalLink /></Link>
        </Card>
      </div>
    </>
  )
}

function SurveyorDashboard({ state, section, setSection, update, confirm, notify }: DashboardProps) {
  if (section === 'search') return <SurveySearch setSection={setSection} notify={notify} />
  if (section === 'survey') return <SurveyCapture state={state} update={update} confirm={confirm} notify={notify} />
  if (section === 'documents') return <SurveyDocuments update={update} />
  return (
    <>
      <DashboardHero eyebrow="Surveyor field desk" title="Morning, Jamie. Your next job is ready." description="Everything required on site is available in one tap, with draft recovery built into this browser session." action={<button type="button" className={styles.heroAction} onClick={() => setSection('survey')}><Ruler /> Start next survey</button>} />
      <div className={styles.fieldStatus}><span className={styles.onlineDot} /> Online · Changes save automatically</div>
      <div className={styles.visitGrid}>
        <Card className={styles.nextVisit}>
          <div className={styles.visitTime}><strong>09:30</strong><span>Today</span></div>
          <div className={styles.visitDetails}><StatusPill tone="red">Next visit</StatusPill><h2>{flagshipContract.customer}</h2><p><MapPin />{flagshipContract.address}</p><span>Contract {flagshipContract.number} · {flagshipContract.products.length} product groups</span></div>
          <div className={styles.visitActions}><a href={`tel:${flagshipContract.phone.replace(/\s/g, '')}`}><Phone /> Call customer</a><button type="button" onClick={() => setSection('survey')}>Open survey <ArrowRight /></button></div>
        </Card>
        <Card><SectionHeading eyebrow="Today" title="Visit plan" /><div className={styles.visitList}><article><span>12:45</span><div><strong>Priya Shah</strong><p>Littleover · Contract 240205</p></div><StatusPill>Upcoming</StatusPill></article><article><span>15:30</span><div><strong>Tom Bennett</strong><p>Duffield · Contract 240231</p></div><StatusPill>Upcoming</StatusPill></article></div></Card>
      </div>
      <div className={styles.mobileSearchCard}><label><Search /><span>Contract number</span><input type="search" inputMode="numeric" pattern="[0-9]*" placeholder="e.g. 240184" /></label><button type="button" onClick={() => setSection('search')}>Search</button></div>
    </>
  )
}

function SurveySearch({ setSection, notify }: Pick<DashboardProps, 'setSection' | 'notify'>) {
  const [query, setQuery] = useState('240184')
  const [searched, setSearched] = useState(true)
  const match = demoContracts.find((contract) => String(contract.number) === query.trim())
  return (
    <>
      <DashboardHero eyebrow="Contract access" title="Find a survey by number." description="Numeric search keeps field access quick and avoids exposing unrelated records." />
      <Card className={styles.searchCard}>
        <label>Contract number<div><Search /><input type="search" inputMode="numeric" pattern="[0-9]*" value={query} onChange={(event) => setQuery(event.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="240184" /><button type="button" onClick={() => setSearched(true)}>Search</button></div></label>
      </Card>
      {searched && match ? <Card className={styles.contractResult}><div><span className={styles.resultNumber}>{match.number}</span><div><StatusPill tone="red">{match.stage}</StatusPill><h2>{match.customer}</h2><p><MapPin />{match.area}</p><span>{match.attention}</span></div></div><button type="button" className={styles.primaryButton} onClick={() => match.number === 240184 ? setSection('survey') : notify('Only contract 240184 is expanded in this focused demonstration.')}><Ruler /> Open survey</button></Card> : searched ? <Card className={styles.emptyState}><Search /><h2>No demonstration contract found</h2><p>Try 240184, 240205, 240231 or 240246.</p></Card> : null}
    </>
  )
}

function SurveyCapture({ state, update, confirm, notify }: Pick<DashboardProps, 'state' | 'update' | 'confirm' | 'notify'>) {
  const units = state.survey.units
  const errors = units.flatMap((unit, index) => validateSurveyUnit(unit).map((field) => `Unit ${index + 1}: ${field}`))
  function patchUnit(id: string, patch: Partial<SurveyUnit>) { update((current) => ({ ...current, survey: { ...current.survey, units: current.survey.units.map((unit) => unit.id === id ? { ...unit, ...patch } : unit) } })) }
  function addUnit(source?: SurveyUnit) {
    const next: SurveyUnit = source ? { ...source, id: crypto.randomUUID(), room: `${source.room} copy` } : { id: crypto.randomUUID(), room: '', type: 'Casement window', width: 0, height: 0, notes: '', photoName: '' }
    update((current) => ({ ...current, survey: { ...current.survey, units: [...current.survey.units, next] } }), source ? 'Unit duplicated.' : 'Blank unit added. Draft saved automatically.')
  }
  function moveUnit(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= units.length) return
    update((current) => { const next = [...current.survey.units]; [next[index], next[target]] = [next[target], next[index]]; return { ...current, survey: { ...current.survey, units: next } } })
  }
  function completeSurvey() {
    if (!state.survey.note.trim()) return notify('Notes help us all stay connected. Please add a note before completing this survey.')
    if (errors.length) return notify(`Complete the missing information first: ${errors.slice(0, 3).join(', ')}.`)
    confirm({ title: 'Complete and sign off this survey?', detail: 'The demonstration survey will be versioned, the shared project timeline will advance and an audit event will be recorded.', actionLabel: 'Complete survey', action: () => update((current) => ({ ...current, survey: { ...current.survey, complete: true, completedAt: new Date().toISOString() }, activity: [newActivity({ actor: 'Jamie Foster', title: 'Survey completed', detail: `${current.survey.units.length} units measured and survey note signed off.`, kind: 'survey' }), ...current.activity] }), 'Survey complete. The customer and admin timelines are now updated.') })
  }
  return (
    <>
      <DashboardHero eyebrow={`Contract ${flagshipContract.number}`} title="Residential window & door survey" description={`${flagshipContract.customer} · ${flagshipContract.address}`} action={<div className={styles.autosave}><CheckCircle2 /> Draft saved</div>} />
      <div className={styles.contractQuick}><a href={`tel:${flagshipContract.phone.replace(/\s/g, '')}`}><Phone />{flagshipContract.phone}</a><span><CalendarDays />{flagshipContract.nextAppointment}</span><span><Camera />{state.customerFiles.length} customer photos</span></div>
      {state.survey.complete ? <Card className={styles.completeBanner}><CheckCircle2 /><div><strong>Survey complete</strong><p>Signed off by Jamie Foster · {formatActivityTime(state.survey.completedAt || '')}</p></div><a href={`tel:${FITTING_PHONE.replace(/\s/g, '')}`}><Phone /> Call fitting bookings</a></Card> : null}
      <div className={styles.surveyUnits}>
        {units.map((unit, index) => { const missing = validateSurveyUnit(unit); return <Card key={unit.id} className={styles.unitCard}>
          <header><div><span>Unit {String(index + 1).padStart(2, '0')}</span><StatusPill tone={missing.length ? 'amber' : 'green'}>{missing.length ? `${missing.length} to check` : 'Complete'}</StatusPill></div><div><button type="button" aria-label={`Move unit ${index + 1} up`} disabled={index === 0} onClick={() => moveUnit(index, -1)}><ChevronDown className={styles.upIcon} /></button><button type="button" aria-label={`Move unit ${index + 1} down`} disabled={index === units.length - 1} onClick={() => moveUnit(index, 1)}><ChevronDown /></button><button type="button" aria-label={`Duplicate unit ${index + 1}`} onClick={() => addUnit(unit)}><Copy /></button><button type="button" aria-label={`Remove unit ${index + 1}`} disabled={units.length === 1 || state.survey.complete} onClick={() => update((current) => ({ ...current, survey: { ...current.survey, units: current.survey.units.filter((item) => item.id !== unit.id) } }), 'Unit removed from the draft.')}><Trash2 /></button></div></header>
          <div className={styles.unitFields}>
            <label>Room or location<input disabled={state.survey.complete} value={unit.room} onChange={(event) => patchUnit(unit.id, { room: event.target.value })} placeholder="e.g. Living room" /></label>
            <label>Unit type<select disabled={state.survey.complete} value={unit.type} onChange={(event) => patchUnit(unit.id, { type: event.target.value })}><option>Casement window</option><option>Bay window</option><option>French doors</option><option>Composite door</option><option>Bi-fold doors</option></select></label>
            <label>Width <span>mm</span><input disabled={state.survey.complete} type="number" inputMode="numeric" min={200} max={5000} value={unit.width || ''} onChange={(event) => patchUnit(unit.id, { width: Number(event.target.value) })} /></label>
            <label>Height <span>mm</span><input disabled={state.survey.complete} type="number" inputMode="numeric" min={200} max={5000} value={unit.height || ''} onChange={(event) => patchUnit(unit.id, { height: Number(event.target.value) })} /></label>
            <label className={styles.unitNotes}>Unit notes<textarea disabled={state.survey.complete} rows={3} value={unit.notes} onChange={(event) => patchUnit(unit.id, { notes: event.target.value })} placeholder="Access, lintel, finish or installation notes" /></label>
            <label className={`${styles.photoCapture} ${unit.photoName ? styles.hasPhoto : ''}`}><Camera /><span>{unit.photoName || 'Take or choose photograph'}</span><input disabled={state.survey.complete} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 8 * 1024 * 1024) return notify('Photographs must be 8 MB or smaller.'); patchUnit(unit.id, { photoName: safeDemoFilename(file.name) }) }} /></label>
          </div>
        </Card> })}
      </div>
      {!state.survey.complete ? <button type="button" className={styles.addUnitButton} onClick={() => addUnit()}><Plus /> Add another unit</button> : null}
      <Card className={styles.surveyNote}>
        <div><MessageSquareText /><div><strong>Notes help us all stay connected.</strong><p>Please add a note before completing this survey.</p></div></div>
        <label><span className={styles.srOnly}>Account note</span><textarea disabled={state.survey.complete} rows={4} value={state.survey.note} onChange={(event) => update((current) => ({ ...current, survey: { ...current.survey, note: event.target.value } }))} placeholder="Add an account note visible to the wider team." /></label>
      </Card>
      <div className={styles.stickyComplete}><div><strong>{units.length} units</strong><span>{errors.length ? `${errors.length} items need attention` : 'Required fields complete'}</span></div><button type="button" disabled={state.survey.complete} onClick={completeSurvey}><ClipboardCheck />{state.survey.complete ? 'Survey completed' : 'Review and complete'}</button></div>
    </>
  )
}

function SurveyDocuments({ update }: Pick<DashboardProps, 'update'>) {
  const documentTypes = [
    { id: 'steel', title: 'Steel requirement', description: 'Structural steel order request for accounts review.', recipient: 'Derby Steel Services · approved supplier' },
    { id: 'scaffolding', title: 'Scaffolding order', description: 'Access requirements with the agreed fitting date.', recipient: 'Midlands Access Ltd · approved supplier' },
    { id: 'third-party', title: 'Third-party document', description: 'Reusable contract document for an approved recipient.', recipient: 'Configured recipients only' },
  ]
  function queueDocument(type: (typeof documentTypes)[number]) { update((current) => ({ ...current, documents: [...current.documents.filter((doc) => doc.id !== `doc-${type.id}`), { id: `doc-${type.id}`, title: type.title, status: 'Queued', createdAt: new Date().toISOString() }], activity: [newActivity({ actor: 'Jamie Foster', title: `${type.title} queued`, detail: `${type.recipient}. Safe demonstration delivery only.`, kind: 'document' }), ...current.activity] }), `${type.title} queued in demo mode. Nothing was emailed or ordered.`) }
  return (
    <>
      <DashboardHero eyebrow={`Contract ${flagshipContract.number}`} title="Site documents" description="Create consistent supplier-ready paperwork without entering arbitrary external recipients." />
      <div className={styles.documentCards}>{documentTypes.map((type) => <Card key={type.id}><span className={styles.cardIcon}><FilePlus2 /></span><StatusPill tone="blue">Demo workflow</StatusPill><h2>{type.title}</h2><p>{type.description}</p><dl><dt>Recipient</dt><dd>{type.recipient}</dd><dt>Attachments</dt><dd>Property overview + survey summary</dd></dl><label>Requirements and notes<textarea rows={4} defaultValue={type.id === 'steel' ? 'Provide support above living-room opening. Final dimensions subject to structural review.' : type.id === 'scaffolding' ? 'Front elevation access. Keep customer driveway clear. Proposed fitting date: 28 September 2026.' : 'Supporting detail for contract 240184.'} /></label><div><a className={styles.secondaryButton} href={`/api/tradewindows/demo-document?type=${type.id}&contract=240184`} target="_blank" rel="noreferrer"><FileText /> Preview PDF</a><button className={styles.primaryButton} type="button" onClick={() => queueDocument(type)}><Send /> Queue safely</button></div></Card>)}</div>
      <p className={styles.demoNotice}><ShieldCheck /> Suppliers are selected from an allowlist. Demonstration delivery records an audit event but sends nothing externally.</p>
    </>
  )
}

function AdminDashboard({ state, section, setSection, update, notify }: DashboardProps) {
  if (section === 'workspace') return <AdminWorkspace state={state} update={update} />
  if (section === 'documents') return <AdminOrders state={state} update={update} />
  if (section === 'activity') return <><DashboardHero eyebrow="Audit history" title="Every material action, in sequence." description="The shared contract record makes handovers visible and accountable." /><Card><ActivityList activity={state.activity} /></Card></>
  return (
    <>
      <DashboardHero eyebrow="Operations control" title="The work that needs attention, first." description="Actionable stages, appointments and exceptions replace vanity reporting." action={<button type="button" className={styles.heroAction} onClick={() => setSection('workspace')}><Search /> Open contract 240184</button>} />
      <div className={styles.adminMetrics}>
        <button type="button" onClick={() => setSection('workspace')}><span>Contracts in progress</span><strong>28</strong><small>Across 6 active stages</small><ArrowRight /></button>
        <button type="button" onClick={() => setSection('workspace')}><span>Need attention</span><strong>7</strong><small>2 amendment requests</small><ArrowRight /></button>
        <button type="button" onClick={() => setSection('documents')}><span>Documents waiting</span><strong>4</strong><small>Steel, access and orders</small><ArrowRight /></button>
        <button type="button" onClick={() => setSection('workspace')}><span>Unpaid invoices</span><strong>{formatCurrency(2174000)}</strong><small>5 customer accounts</small><ArrowRight /></button>
      </div>
      <Card>
        <SectionHeading eyebrow="Live operations" title="Contracts requiring attention" action={<label className={styles.inlineSearch}><Search /><span className={styles.srOnly}>Search contracts</span><input type="search" placeholder="Search contract or customer" /></label>} />
        <div className={styles.adminTable} role="table" aria-label="Demonstration contracts">
          <div role="row" className={styles.adminTableHead}><span role="columnheader">Contract</span><span role="columnheader">Customer</span><span role="columnheader">Stage</span><span role="columnheader">Attention</span><span role="columnheader">Value</span><span /></div>
          {demoContracts.map((contract) => <button type="button" role="row" key={contract.number} onClick={() => contract.number === 240184 ? setSection('workspace') : notify(`Contract ${contract.number} is a supporting record. Open contract 240184 for the complete connected workflow.`)}><strong role="cell">{contract.number}</strong><span role="cell">{contract.customer}<small>{contract.area}</small></span><span role="cell"><StatusPill tone={contract.stage === 'Manufacturing' ? 'blue' : 'neutral'}>{contract.stage}</StatusPill></span><span role="cell">{contract.attention}</span><span role="cell">{formatCurrency(contract.valuePence)}</span><ChevronRight /></button>)}
        </div>
      </Card>
      <div className={styles.twoColumn}>
        <Card><SectionHeading eyebrow="Diary" title="Upcoming surveys & fittings" /><div className={styles.visitList}><article><span>12 Sep</span><div><strong>Carter · Survey</strong><p>09:30 · Jamie Foster</p></div><StatusPill tone="red">Confirmed</StatusPill></article><article><span>14 Sep</span><div><strong>Shah · Sales revisit</strong><p>13:00 · Leah Morgan</p></div><StatusPill>Proposed</StatusPill></article><article><span>28 Sep</span><div><strong>Yusuf · Fitting</strong><p>08:00 · Team A</p></div><StatusPill tone="green">Booked</StatusPill></article></div></Card>
        <Card><SectionHeading eyebrow="Activity" title="Latest across the team" /><ActivityList activity={state.activity} limit={3} /></Card>
      </div>
    </>
  )
}

function AdminWorkspace({ state, update }: Pick<DashboardProps, 'state' | 'update'>) {
  const [tab, setTab] = useState<'overview' | 'files' | 'amendment' | 'messages'>('overview')
  function setAmendmentStatus(status: DemoState['amendment']['status']) { update((current) => ({ ...current, amendment: { ...current.amendment, status, updatedBy: 'Alex Reed · Admin', updatedAt: new Date().toISOString() }, activity: [newActivity({ actor: 'Alex Reed', title: `Amendment ${status}`, detail: current.amendment.detail, kind: 'amendment' }), ...current.activity] }), `Amendment marked ${status}.`) }
  return (
    <>
      <DashboardHero eyebrow="Contract workspace" title="240184 · Carter" description={flagshipContract.address} action={<StatusPill tone={state.survey.complete ? 'green' : 'red'}>{state.survey.complete ? 'Survey complete' : 'Survey scheduled'}</StatusPill>} />
      <div className={styles.contractHeader}>
        <div><span>Customer</span><strong>{flagshipContract.customer}</strong><small>{flagshipContract.email} · {flagshipContract.phone}</small></div>
        <div><span>Contract value</span><strong>{formatCurrency(state.invoice.totalPence)}</strong><small>{state.invoice.status}</small></div>
        <div><span>Owner</span><strong>{flagshipContract.salesOwner}</strong><small>Sales team</small></div>
        <div><span>Next action</span><strong>{state.survey.complete ? 'Prepare FrameFast order' : 'Complete survey'}</strong><small>{state.survey.complete ? 'Survey data available' : flagshipContract.nextAppointment}</small></div>
      </div>
      <div className={styles.workspaceTabs} role="tablist" aria-label="Contract workspace views">{(['overview', 'files', 'amendment', 'messages'] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>{value === 'overview' ? 'Overview' : value === 'files' ? `Files (${state.documents.length + state.customerFiles.length})` : value === 'amendment' ? 'Amendment' : 'Communications'}</button>)}</div>
      {tab === 'overview' ? <div className={styles.twoColumnWide}><Card><SectionHeading eyebrow="Progress" title="Project timeline" /><ProjectTimeline state={state} /></Card><Card><SectionHeading eyebrow="Handover" title="Survey information" /><div className={styles.summaryRows}><span><Ruler /> Units captured <strong>{state.survey.units.length}</strong></span><span><Camera /> Customer photographs <strong>{state.customerFiles.length}</strong></span><span><MessageSquareText /> Survey note <strong>{state.survey.note ? 'Added' : 'Missing'}</strong></span><span><ClipboardCheck /> Sign-off <strong>{state.survey.complete ? 'Complete' : 'Awaiting surveyor'}</strong></span></div></Card></div> : null}
      {tab === 'files' ? <Card><SectionHeading eyebrow="Authorised files" title="Contract documents" /><div className={styles.documentList}>{state.documents.map((document) => <article key={document.id}><FileText /><div><strong>{document.title}</strong><p>{document.status} · {formatActivityTime(document.createdAt)}</p></div><a href={`/api/tradewindows/demo-document?type=contract&contract=240184`} target="_blank" rel="noreferrer">Preview <ExternalLink /></a></article>)}</div></Card> : null}
      {tab === 'amendment' ? <Card className={styles.amendmentReview}><div><StatusPill tone={state.amendment.status === 'approved' ? 'green' : 'amber'}>{state.amendment.status}</StatusPill><h2>Customer change request</h2><p>{state.amendment.detail}</p><small>Requested by {state.amendment.updatedBy} · {formatActivityTime(state.amendment.updatedAt)}</small></div><label>Admin decision note<textarea rows={4} defaultValue="Confirm glass specification and any price change before manufacturing release." /></label><div><button type="button" className={styles.secondaryButton} onClick={() => setAmendmentStatus('rejected')}><X /> Reject with reason</button><button type="button" className={styles.primaryButton} onClick={() => setAmendmentStatus('approved')}><Check /> Approve request</button></div></Card> : null}
      {tab === 'messages' ? <Card><SectionHeading eyebrow="Communication history" title="Customer and team messages" /><ActivityList activity={state.activity.filter((item) => item.kind === 'message' || item.kind === 'appointment')} /></Card> : null}
    </>
  )
}

function AdminOrders({ state, update }: Pick<DashboardProps, 'state' | 'update'>) {
  const orderTypes = [
    { id: 'framefast', title: 'FrameFast manufacturing order', detail: `${state.survey.units.length} measured units · supplier mapping v1`, readiness: state.survey.complete ? 'Ready' : 'Waiting for survey' },
    { id: 'steel', title: 'Steel order request', detail: 'Living-room support detail · Derby Steel Services', readiness: 'Review' },
    { id: 'scaffolding', title: 'Scaffolding order', detail: 'Front elevation access · Midlands Access Ltd', readiness: 'Draft' },
  ]
  function saveOrder(order: (typeof orderTypes)[number]) { update((current) => ({ ...current, documents: [...current.documents.filter((doc) => doc.id !== `admin-${order.id}`), { id: `admin-${order.id}`, title: order.title, status: 'Ready', createdAt: new Date().toISOString() }], activity: [newActivity({ actor: 'Alex Reed', title: `${order.title} generated`, detail: 'Preview created and saved to the fictional contract. No supplier submission occurred.', kind: 'document' }), ...current.activity] }), `${order.title} saved. No external order was placed.`) }
  return (
    <>
      <DashboardHero eyebrow="Orders & documents" title="Build once. Review before release." description="Supplier-specific mapping stays separate from the shared contract data, with approved recipients only." />
      <div className={styles.orderBuilder}>
        {orderTypes.map((order) => <Card key={order.id}><div className={styles.orderIcon}><Wrench /></div><StatusPill tone={order.readiness === 'Ready' ? 'green' : order.readiness === 'Review' ? 'amber' : 'neutral'}>{order.readiness}</StatusPill><h2>{order.title}</h2><p>{order.detail}</p><dl><div><dt>Contract</dt><dd>240184</dd></div><div><dt>Recipient</dt><dd>{order.id === 'framefast' ? 'FrameFast · configured adapter' : order.id === 'steel' ? 'Derby Steel Services' : 'Midlands Access Ltd'}</dd></div><div><dt>External status</dt><dd>Not submitted</dd></div></dl><div><a className={styles.secondaryButton} href={`/api/tradewindows/demo-document?type=${order.id}&contract=240184`} target="_blank" rel="noreferrer"><FileText /> Preview PDF</a><button type="button" className={styles.primaryButton} disabled={order.id === 'framefast' && !state.survey.complete} onClick={() => saveOrder(order)}><FileCheck2 /> Generate draft</button></div>{order.id === 'framefast' && !state.survey.complete ? <small>Complete the survey before generating the manufacturing order.</small> : null}</Card>)}
      </div>
    </>
  )
}

function FittingDashboard({ onChangeRole }: { onChangeRole: () => void }) {
  return (
    <div className={styles.comingSoon}>
      <div className={styles.frameGraphic} aria-hidden="true"><span /><span /><span /><span /></div>
      <StatusPill tone="red">Next release</StatusPill>
      <HardHat />
      <h1>Built for a cleaner<br />day on site.</h1>
      <p>The fitting workspace is being prepared around the information installers need—not another generic checklist.</p>
      <div className={styles.plannedGrid}>
        <article><CalendarDays /><strong>Installation schedules</strong><span>Clear daily routes and arrival windows.</span></article>
        <article><BriefcaseBusiness /><strong>Digital job packs</strong><span>Survey, products and access notes together.</span></article>
        <article><Camera /><strong>Completion photographs</strong><span>Fast, structured evidence from site.</span></article>
        <article><ClipboardCheck /><strong>Snagging & sign-off</strong><span>Customer acknowledgement and aftercare handover.</span></article>
      </div>
      <div className={styles.fittingActions}><button type="button" className={styles.primaryButton} onClick={onChangeRole}><RefreshCcw /> Change demonstration role</button><p className={styles.demoNotice}><ShieldCheck /> No fake operational controls are shown in this preview.</p></div>
    </div>
  )
}

function ConfirmDialog({ value, close }: { value: ConfirmState; close: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (value) cancelRef.current?.focus() }, [value])
  if (!value) return null
  return (
    <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) close() }}>
      <section className={styles.modal} role="alertdialog" aria-modal="true" aria-labelledby="tw-confirm-title" aria-describedby="tw-confirm-detail">
        <span className={styles.modalIcon}><ShieldCheck /></span><h2 id="tw-confirm-title">{value.title}</h2><p id="tw-confirm-detail">{value.detail}</p>
        <div><button ref={cancelRef} type="button" className={styles.secondaryButton} onClick={close}>Cancel</button><button type="button" className={styles.primaryButton} onClick={() => { const action = value.action; close(); action() }}>{value.actionLabel}</button></div>
      </section>
    </div>
  )
}

export function TradeWindowsClient() {
  const [hydrated, setHydrated] = useState(false)
  const [role, setRole] = useState<TradeWindowsRole | null>(null)
  const [section, setSection] = useState('home')
  const [state, setState] = useState<DemoState>(() => createDemoState())
  const [toast, setToast] = useState('')
  const [confirm, setConfirm] = useState<ConfirmState>(null)

  useEffect(() => {
    try {
      const savedRole = sessionStorage.getItem(ROLE_KEY) as TradeWindowsRole | null
      if (savedRole && roles.some((item) => item.id === savedRole)) setRole(savedRole)
      const savedState = sessionStorage.getItem(STATE_KEY)
      if (savedState && savedState.length < 200_000) {
        const parsed = JSON.parse(savedState) as DemoState
        if (isDemoState(parsed)) setState(parsed)
      }
    } catch { /* use deterministic defaults */ }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try { sessionStorage.setItem(STATE_KEY, JSON.stringify(state)) } catch { /* session storage unavailable */ }
  }, [hydrated, state])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 4200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 })
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0 }))
    const timeout = window.setTimeout(() => window.scrollTo({ top: 0, left: 0 }), 50)
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timeout) }
  }, [role, section])

  const update = (updater: (current: DemoState) => DemoState, message?: string) => {
    setState((current) => updater(current))
    if (message) setToast(message)
  }
  const selectRole = (next: TradeWindowsRole) => {
    setRole(next); setSection('home')
    try { sessionStorage.setItem(ROLE_KEY, next) } catch { /* session storage unavailable */ }
  }
  const changeRole = () => { setRole(null); setSection('home'); try { sessionStorage.removeItem(ROLE_KEY) } catch { /* ignore */ } }
  const reset = () => { const next = createDemoState(); setState(next); setSection('home'); try { sessionStorage.setItem(STATE_KEY, JSON.stringify(next)) } catch { /* ignore */ } setToast('Demonstration data reset.') }

  const dashboard = useMemo(() => {
    if (!role) return null
    const props: DashboardProps = { state, section, setSection, update, confirm: setConfirm, notify: setToast }
    if (role === 'customer') return <CustomerDashboard {...props} />
    if (role === 'sales') return <SalesDashboard {...props} />
    if (role === 'surveyor') return <SurveyorDashboard {...props} />
    if (role === 'admin') return <AdminDashboard {...props} />
    return <FittingDashboard onChangeRole={changeRole} />
  }, [role, section, state])

  if (!hydrated) return <main className={styles.loading}><BrandMark /><span>Preparing demonstration…</span></main>
  if (!role) return <RoleSelection onSelect={selectRole} />
  return (
    <>
      <DashboardShell role={role} section={section} setSection={setSection} onChangeRole={changeRole} onReset={reset}>{dashboard}</DashboardShell>
      {toast ? <div className={styles.toast} role="status"><CheckCircle2 />{toast}<button type="button" onClick={() => setToast('')} aria-label="Dismiss notification"><X /></button></div> : null}
      <ConfirmDialog value={confirm} close={() => setConfirm(null)} />
    </>
  )
}
