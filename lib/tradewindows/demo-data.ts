export type TradeWindowsRole = 'customer' | 'sales' | 'surveyor' | 'admin' | 'fitting'

export type DemoActivity = {
  id: string
  at: string
  actor: string
  title: string
  detail: string
  kind: 'appointment' | 'document' | 'message' | 'survey' | 'payment' | 'amendment' | 'system'
}

export type AvailabilityWindow = {
  id: string
  date: string
  period: 'Morning' | 'Afternoon' | 'All day'
  notes: string
}

export type SurveyUnit = {
  id: string
  room: string
  type: string
  width: number
  height: number
  notes: string
  photoName: string
}

export type QuoteLine = {
  id: string
  description: string
  quantity: number
  unitPricePence: number
}

export type DemoState = {
  version: 1
  availability: AvailabilityWindow[]
  amendment: {
    detail: string
    status: 'draft' | 'submitted' | 'under review' | 'approved' | 'rejected' | 'superseded'
    updatedBy: string
    updatedAt: string
  }
  survey: {
    complete: boolean
    completedAt: string | null
    note: string
    units: SurveyUnit[]
  }
  invoice: {
    status: 'due' | 'part-paid' | 'paid' | 'overdue'
    totalPence: number
    paidPence: number
  }
  quote: {
    status: 'draft' | 'sent' | 'accepted'
    discountPercent: number
    lines: QuoteLine[]
  }
  customerFiles: string[]
  salesReply: string
  mockupSaved: boolean
  activity: DemoActivity[]
  documents: Array<{ id: string; title: string; status: 'Draft' | 'Ready' | 'Queued'; createdAt: string }>
}

export const roles: Array<{
  id: TradeWindowsRole
  name: string
  shortName: string
  description: string
}> = [
  { id: 'customer', name: 'Customer', shortName: 'Customer', description: 'Track your project, appointments, documents and payments.' },
  { id: 'sales', name: 'Sales Team', shortName: 'Sales', description: 'Manage enquiries, conversations, designs and quotations.' },
  { id: 'surveyor', name: 'Surveyor', shortName: 'Surveyor', description: 'Capture measurements, photographs, notes and site requirements.' },
  { id: 'admin', name: 'Admin Team', shortName: 'Admin', description: 'Coordinate contracts, orders, documents and communications.' },
  { id: 'fitting', name: 'Fitting Team', shortName: 'Fitting', description: 'Preview the installation workspace that is coming next.' },
]

export const stages = [
  'Enquiry received',
  'Sales appointment',
  'Quote prepared',
  'Order confirmed',
  'Survey scheduled',
  'Survey complete',
  'Manufacturing',
  'Fitting scheduled',
  'Installation complete',
  'Aftercare',
]

export const flagshipContract = {
  id: 'demo-contract-larkfield',
  number: 240184,
  customer: 'Maya and Daniel Carter',
  firstName: 'Maya',
  address: '17 Millstone View, Oakwell, Derby, DE99 1TW',
  phone: '01332 555 014',
  email: 'maya.carter@example.test',
  stageIndex: 4,
  nextAppointment: 'Saturday 12 September, 09:30–11:30',
  surveyor: 'Jamie Foster',
  salesOwner: 'Leah Morgan',
  products: [
    { id: 'p1', name: 'Anthracite casement window', location: 'Living room', quantity: 2 },
    { id: 'p2', name: 'White casement window', location: 'Bedrooms', quantity: 3 },
    { id: 'p3', name: 'Composite entrance door', location: 'Front elevation', quantity: 1 },
  ],
}

export const demoContracts = [
  { number: 240184, customer: 'Maya and Daniel Carter', area: 'Oakwell, Derby', stage: 'Survey scheduled', attention: 'Availability received', valuePence: 984000 },
  { number: 240205, customer: 'Priya Shah', area: 'Littleover, Derby', stage: 'Quote prepared', attention: 'Quote awaiting approval', valuePence: 642500 },
  { number: 240231, customer: 'Tom Bennett', area: 'Duffield, Derbyshire', stage: 'Manufacturing', attention: 'Steel detail required', valuePence: 1289000 },
  { number: 240246, customer: 'Amina Yusuf', area: 'Mickleover, Derby', stage: 'Fitting scheduled', attention: 'Balance due', valuePence: 775000 },
]

const initialActivity: DemoActivity[] = [
  { id: 'a1', at: '2026-09-08T16:22:00.000Z', actor: 'Maya Carter', title: 'Availability added', detail: 'Saturday morning and Monday afternoon preferred for the survey.', kind: 'appointment' },
  { id: 'a2', at: '2026-09-08T11:05:00.000Z', actor: 'Leah Morgan', title: 'Order confirmed', detail: 'Signed quotation Q-240184 accepted. Survey requested.', kind: 'system' },
  { id: 'a3', at: '2026-09-07T14:40:00.000Z', actor: 'Accounts', title: 'Deposit received', detail: '£2,500.00 received through Stripe test mode.', kind: 'payment' },
  { id: 'a4', at: '2026-09-06T10:12:00.000Z', actor: 'Leah Morgan', title: 'Quotation sent', detail: 'Quotation Q-240184 and design preview shared with the customer.', kind: 'document' },
  { id: 'a5', at: '2026-09-04T09:00:00.000Z', actor: 'Trade Windows', title: 'Project created', detail: 'Fictional demonstration contract opened from the showroom enquiry.', kind: 'system' },
]

export function createDemoState(): DemoState {
  return {
    version: 1,
    availability: [
      { id: 'av1', date: '2026-09-12', period: 'Morning', notes: 'Side gate will be unlocked.' },
      { id: 'av2', date: '2026-09-14', period: 'Afternoon', notes: 'Please call 15 minutes before arrival.' },
    ],
    amendment: {
      detail: 'Please quote for obscure glass in the downstairs cloakroom.',
      status: 'submitted',
      updatedBy: 'Maya Carter',
      updatedAt: '2026-09-08T17:04:00.000Z',
    },
    survey: {
      complete: false,
      completedAt: null,
      note: 'Driveway access is clear. Customer prefers the red door sample shown at appointment.',
      units: [
        { id: 'u1', room: 'Living room', type: 'Casement window', width: 1780, height: 1210, notes: 'Check lintel above bay return.', photoName: 'living-room-window.jpg' },
        { id: 'u2', room: 'Front entrance', type: 'Composite door', width: 930, height: 2090, notes: 'Low aluminium threshold required.', photoName: 'front-door.jpg' },
      ],
    },
    invoice: { status: 'part-paid', totalPence: 984000, paidPence: 250000 },
    quote: {
      status: 'sent',
      discountPercent: 0,
      lines: [
        { id: 'q1', description: 'A-rated casement windows', quantity: 5, unitPricePence: 100000 },
        { id: 'q2', description: 'Composite entrance door', quantity: 1, unitPricePence: 220000 },
        { id: 'q3', description: 'Survey, fitting and disposal', quantity: 1, unitPricePence: 100000 },
      ],
    },
    customerFiles: ['front-elevation.jpg', 'living-room-bay.jpg'],
    salesReply: '',
    mockupSaved: true,
    activity: initialActivity,
    documents: [
      { id: 'd1', title: 'Quotation Q-240184', status: 'Ready', createdAt: '2026-09-06T10:10:00.000Z' },
      { id: 'd2', title: 'Deposit invoice INV-240184-1', status: 'Ready', createdAt: '2026-09-07T13:55:00.000Z' },
    ],
  }
}

export function isDemoState(value: unknown): value is DemoState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<DemoState>
  return candidate.version === 1
    && Array.isArray(candidate.availability)
    && !!candidate.amendment && typeof candidate.amendment.detail === 'string'
    && !!candidate.survey && Array.isArray(candidate.survey.units)
    && !!candidate.invoice && Number.isFinite(candidate.invoice.totalPence)
    && !!candidate.quote && Array.isArray(candidate.quote.lines)
    && Array.isArray(candidate.customerFiles)
    && Array.isArray(candidate.activity)
    && Array.isArray(candidate.documents)
}

export function calculateQuote(lines: QuoteLine[], discountPercent: number) {
  const subtotalPence = lines.reduce((total, line) => total + Math.max(0, line.quantity) * Math.max(0, line.unitPricePence), 0)
  const discountPence = Math.round(subtotalPence * Math.min(100, Math.max(0, discountPercent)) / 100)
  const netPence = subtotalPence - discountPence
  const vatPence = Math.round(netPence * 0.2)
  return { subtotalPence, discountPence, netPence, vatPence, totalPence: netPence + vatPence }
}

export function formatCurrency(pence: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100)
}

export function formatShortDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

export function formatActivityTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

export function canDirectAmend(state: DemoState) {
  return !state.survey.complete
}

export function validateSurveyUnit(unit: SurveyUnit) {
  const missing: string[] = []
  if (!unit.room.trim()) missing.push('location')
  if (!unit.type.trim()) missing.push('unit type')
  if (!Number.isFinite(unit.width) || unit.width < 200 || unit.width > 5000) missing.push('valid width')
  if (!Number.isFinite(unit.height) || unit.height < 200 || unit.height > 5000) missing.push('valid height')
  if (!unit.photoName.trim()) missing.push('photograph')
  return missing
}

export function safeDemoFilename(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/[._-]{2,}/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 100) || 'property-photo'
}

export function newActivity(input: Omit<DemoActivity, 'id' | 'at'>): DemoActivity {
  return { ...input, id: crypto.randomUUID(), at: new Date().toISOString() }
}
