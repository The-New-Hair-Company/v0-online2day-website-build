import { NextResponse } from 'next/server'
import { demoDocumentTypes, createDemoPdf, type DemoDocumentType, type DemoQuotationInput } from '@/lib/tradewindows/demo-pdf'
import { enforceRateLimit, getClientIp, rateLimitHeaders } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'

function readRequestType(request: Request) {
  const url = new URL(request.url)
  const type = url.searchParams.get('type')
  const contract = url.searchParams.get('contract')
  if (!type || !demoDocumentTypes.includes(type as DemoDocumentType) || contract !== '240184') {
    return null
  }
  return type as DemoDocumentType
}

async function documentRateLimit(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    const limit = await enforceRateLimit({ key: `public:tradewindows:pdf:${getClientIp(request)}`, limit: 30, windowMs: 10 * 60 * 1000 })
    if (!limit.ok) {
      return NextResponse.json(
        { error: limit.unavailable ? 'Document protection is temporarily unavailable.' : 'Too many document requests. Please try again later.' },
        { status: limit.unavailable ? 503 : 429, headers: rateLimitHeaders(limit, 30) },
      )
    }
  }
  return null
}

function pdfResponse(type: DemoDocumentType, quotation?: DemoQuotationInput) {
  const pdf = createDemoPdf(type, quotation)
  return new Response(pdf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="tradewindows-${type}-240184.pdf"`,
      'Cache-Control': quotation ? 'private, no-store' : 'public, max-age=300, s-maxage=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function isQuotation(value: unknown): value is DemoQuotationInput {
  if (!value || typeof value !== 'object') return false
  const quote = value as Partial<DemoQuotationInput>
  return Array.isArray(quote.lines)
    && quote.lines.length > 0
    && quote.lines.length <= 20
    && Number.isFinite(quote.discountPercent)
    && Number(quote.discountPercent) >= 0
    && Number(quote.discountPercent) <= 30
    && quote.lines.every((line) => !!line
      && typeof line.id === 'string' && line.id.length <= 80
      && typeof line.description === 'string' && line.description.trim().length > 0 && line.description.length <= 120
      && Number.isInteger(line.quantity) && line.quantity >= 1 && line.quantity <= 99
      && Number.isInteger(line.unitPricePence) && line.unitPricePence >= 0 && line.unitPricePence <= 100_000_000)
}

export async function GET(request: Request) {
  const type = readRequestType(request)
  if (!type) return NextResponse.json({ error: 'Unknown demonstration document.' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
  const limited = await documentRateLimit(request)
  return limited || pdfResponse(type)
}

export async function POST(request: Request) {
  const type = readRequestType(request)
  if (type !== 'quotation') return NextResponse.json({ error: 'Only quotation previews accept demonstration input.' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > 50_000) return NextResponse.json({ error: 'Quotation input is too large.' }, { status: 413, headers: { 'Cache-Control': 'private, no-store' } })
  const limited = await documentRateLimit(request)
  if (limited) return limited
  let quotation: unknown
  try { quotation = await request.json() } catch { return NextResponse.json({ error: 'Invalid quotation input.' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } }) }
  if (!isQuotation(quotation)) return NextResponse.json({ error: 'Invalid quotation input.' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
  return pdfResponse(type, quotation)
}
