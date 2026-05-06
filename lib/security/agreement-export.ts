type LeadEventLike = {
  type?: string | null
  created_at?: string | null
  note?: string | null
}

type LeadLike = {
  name?: string | null
  company?: string | null
  status?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  source?: string | null
  created_at?: string | null
  follow_up_date?: string | null
  notes?: string | null
  lead_events?: LeadEventLike[] | null
}

export function escapeAgreementHtml(value: unknown) {
  const input = String(value ?? '')
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB')
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-GB')
}

export function renderAgreementSummaryHtml(leads: LeadLike[]) {
  return `<!DOCTYPE html>
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
    const events = lead.lead_events || []
    return `
    <div class="lead">
      <div class="lead-name">${escapeAgreementHtml(lead.name)}</div>
      ${lead.company ? `<div class="lead-company">${escapeAgreementHtml(lead.company)}</div>` : ''}
      <span class="badge">${escapeAgreementHtml(lead.status || 'New')}</span>

      <div class="section">
        <div class="section-title">Contact Details</div>
        ${lead.email ? `<div class="field"><span class="field-label">Email</span><span class="field-value">${escapeAgreementHtml(lead.email)}</span></div>` : ''}
        ${lead.phone ? `<div class="field"><span class="field-label">Phone</span><span class="field-value">${escapeAgreementHtml(lead.phone)}</span></div>` : ''}
        ${lead.website ? `<div class="field"><span class="field-label">Website</span><span class="field-value">${escapeAgreementHtml(lead.website)}</span></div>` : ''}
        ${lead.source ? `<div class="field"><span class="field-label">Source</span><span class="field-value">${escapeAgreementHtml(lead.source)}</span></div>` : ''}
        <div class="field"><span class="field-label">Added</span><span class="field-value">${formatDate(lead.created_at)}</span></div>
        ${lead.follow_up_date ? `<div class="field"><span class="field-label">Follow-up</span><span class="field-value">${formatDate(lead.follow_up_date)}</span></div>` : ''}
      </div>

      ${lead.notes ? `
      <div class="section">
        <div class="section-title">Notes</div>
        <div class="notes">${escapeAgreementHtml(lead.notes)}</div>
      </div>` : ''}

      ${events.length > 0 ? `
      <div class="section">
        <div class="section-title">Activity Timeline (${events.length} events)</div>
        <div class="events">
          ${events.map((event) => `
          <div class="event">
            <div class="event-type">${escapeAgreementHtml(event.type)}</div>
            <div class="event-date">${formatDateTime(event.created_at)}</div>
            ${event.note ? `<div class="event-note">${escapeAgreementHtml(event.note)}</div>` : ''}
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
}
