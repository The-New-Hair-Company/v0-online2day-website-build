import { NextResponse } from 'next/server'
import { getClientIp } from '@/lib/security/rate-limit'
import { recordSecurityEvent } from '@/lib/security/security-events'

type CspReportEnvelope = {
  'csp-report'?: Record<string, unknown>
}

export async function POST(request: Request) {
  const ip = getClientIp(request)
  try {
    const body = await request.json() as CspReportEnvelope
    const report = body?.['csp-report'] || {}
    const blockedUri = typeof report['blocked-uri'] === 'string' ? report['blocked-uri'] : 'unknown'
    const violatedDirective = typeof report['violated-directive'] === 'string' ? report['violated-directive'] : 'unknown'
    const documentUri = typeof report['document-uri'] === 'string' ? report['document-uri'] : 'unknown'
    await recordSecurityEvent({
      type: 'csp_violation',
      route: '/api/security/csp-report',
      ip,
      detail: `blocked=${blockedUri}; directive=${violatedDirective}; document=${documentUri}`,
    })
    return NextResponse.json({ success: true }, { status: 202 })
  } catch {
    await recordSecurityEvent({
      type: 'csp_violation',
      route: '/api/security/csp-report',
      ip,
      detail: 'Malformed CSP report payload',
    })
    return NextResponse.json({ error: 'Invalid CSP report payload' }, { status: 400 })
  }
}
