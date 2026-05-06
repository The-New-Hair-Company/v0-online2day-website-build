import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { recordSecurityEvent } from '@/lib/security/security-events'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_IDS = 100

function escapeHtml(value: unknown) {
  const input = String(value ?? '')
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * GET /api/download-agreements?ids=uuid1,uuid2
 * Generates a plain-text/HTML "agreement summary" for the selected leads
 * and returns it as a downloadable file.
 * 
 * For a full PDF, install @react-pdf/renderer and swap the body below.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rate = enforceRateLimit({
    key: `download-agreements:${ip}`,
    limit: 20,
    windowMs: 60_000,
  })
  if (!rate.ok) {
    await recordSecurityEvent({ type: 'rate_limit', route: '/api/download-agreements', ip, detail: 'Rate limit exceeded' })
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    await recordSecurityEvent({ type: 'failed_auth', route: '/api/download-agreements', ip, detail: 'Unauthorized request' })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const idsParam = request.nextUrl.searchParams.get('ids')
  if (!idsParam) {
    return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })
  }

  const ids = idsParam
    .split(',')
    .map((id) => id.trim())
    .filter((id) => UUID_RE.test(id))
    .slice(0, MAX_IDS)
  if (ids.length === 0) {
    await recordSecurityEvent({ type: 'invalid_uuid', route: '/api/download-agreements', ip, detail: `ids=${idsParam}` })
    return NextResponse.json({ error: 'No valid IDs provided' }, { status: 400 })
  }

  const { data: leads, error } = await supabase
    .from('leads')
    .select('*, lead_events(*)')
    .in('id', ids)
    .order('created_at', { ascending: false })

  if (error || !leads) {
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }

  // Generate HTML document (renders as PDF when saved/printed)
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Online2Day — Lead Agreements</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, serif; color: #111; background: #fff; padding: 40px; }
    .header { border-bottom: 3px solid #7c3aed; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { font-size: 28px; color: #7c3aed; }
    .header p { color: #666; font-size: 14px; margin-top: 4px; }
    .lead { page-break-after: always; padding: 30px 0; border-bottom: 1px solid #e5e7eb; }
    .lead:last-child { page-break-after: auto; border-bottom: none; }
    .lead-name { font-size: 22px; font-weight: bold; color: #1a1a2e; }
    .lead-company { font-size: 14px; color: #7c3aed; margin-top: 2px; }
    .badge { display: inline-block; padding: 3px 12px; border-radius: 999px; font-size: 12px; font-weight: bold; background: #f3f4f6; color: #374151; margin-top: 8px; }
    .section { margin-top: 20px; }
    .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; font-weight: bold; margin-bottom: 8px; }
    .field { display: flex; gap: 8px; font-size: 14px; margin-bottom: 6px; }
    .field-label { color: #6b7280; min-width: 100px; }
    .field-value { color: #111; font-weight: 500; }
    .notes { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; font-size: 14px; color: #374151; margin-top: 8px; line-height: 1.6; }
    .events { margin-top: 8px; }
    .event { border-left: 3px solid #7c3aed; padding-left: 12px; margin-bottom: 10px; }
    .event-type { font-weight: bold; font-size: 13px; color: #1a1a2e; }
    .event-date { font-size: 11px; color: #9ca3af; }
    .event-note { font-size: 13px; color: #4b5563; margin-top: 2px; }
    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Online2Day</h1>
    <p>Lead Agreement Summary — Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
  </div>

  ${leads.map((lead) => {
    const events = (lead as any).lead_events || []
    return `
    <div class="lead">
      <div class="lead-name">${escapeHtml(lead.name)}</div>
      ${lead.company ? `<div class="lead-company">${escapeHtml(lead.company)}</div>` : ''}
      <span class="badge">${escapeHtml(lead.status || 'New')}</span>

      <div class="section">
        <div class="section-title">Contact Details</div>
        ${lead.email ? `<div class="field"><span class="field-label">Email</span><span class="field-value">${escapeHtml(lead.email)}</span></div>` : ''}
        ${lead.phone ? `<div class="field"><span class="field-label">Phone</span><span class="field-value">${escapeHtml(lead.phone)}</span></div>` : ''}
        ${lead.website ? `<div class="field"><span class="field-label">Website</span><span class="field-value">${escapeHtml(lead.website)}</span></div>` : ''}
        ${lead.source ? `<div class="field"><span class="field-label">Source</span><span class="field-value">${escapeHtml(lead.source)}</span></div>` : ''}
        <div class="field"><span class="field-label">Added</span><span class="field-value">${new Date(lead.created_at).toLocaleDateString('en-GB')}</span></div>
        ${lead.follow_up_date ? `<div class="field"><span class="field-label">Follow-up</span><span class="field-value">${new Date(lead.follow_up_date).toLocaleDateString('en-GB')}</span></div>` : ''}
      </div>

      ${lead.notes ? `
      <div class="section">
        <div class="section-title">Notes</div>
        <div class="notes">${escapeHtml(lead.notes)}</div>
      </div>` : ''}

      ${events.length > 0 ? `
      <div class="section">
        <div class="section-title">Activity Timeline (${events.length} events)</div>
        <div class="events">
          ${events.map((e: any) => `
          <div class="event">
            <div class="event-type">${escapeHtml(e.type)}</div>
            <div class="event-date">${new Date(e.created_at).toLocaleString('en-GB')}</div>
            ${e.note ? `<div class="event-note">${escapeHtml(e.note)}</div>` : ''}
          </div>`).join('')}
        </div>
      </div>` : ''}
    </div>`
  }).join('')}

  <div class="footer">
    Online2Day CRM · Confidential · ${new Date().getFullYear()}
  </div>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="online2day-agreements-${Date.now()}.html"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-RateLimit-Remaining': String(rate.remaining),
    },
  })
}
