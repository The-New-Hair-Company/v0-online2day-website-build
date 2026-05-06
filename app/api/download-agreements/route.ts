import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { recordSecurityEvent } from '@/lib/security/security-events'
import { getEnterpriseStateValue, setEnterpriseStateValue } from '@/lib/actions/enterprise-actions'
import { renderAgreementSummaryHtml } from '@/lib/security/agreement-export'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_IDS = 100

type ExportJobState = 'queued' | 'processing' | 'completed' | 'failed'
type LegacyExportJob = {
  id: string
  userId: string
  ids: string[]
  status: ExportJobState
  createdAt: string
  updatedAt: string
  completedAt: string | null
  error: string | null
}

function parseIds(idsParam: string | null) {
  if (!idsParam) return []
  return idsParam
    .split(',')
    .map((id) => id.trim())
    .filter((id) => UUID_RE.test(id))
    .slice(0, MAX_IDS)
}

function buildJobId() {
  return `export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

async function createLegacyJob(job: LegacyExportJob) {
  const key = 'agreement_export_jobs_fallback'
  const current = await getEnterpriseStateValue(key)
  const list = Array.isArray(current) ? current : []
  const next = [job, ...list].slice(0, 200)
  await setEnterpriseStateValue(key, next)
}

async function getLegacyJob(jobId: string, userId: string): Promise<LegacyExportJob | null> {
  const key = 'agreement_export_jobs_fallback'
  const current = await getEnterpriseStateValue(key)
  if (!Array.isArray(current)) return null
  const match = current.find((row) => {
    if (!row || typeof row !== 'object') return false
    const candidate = row as Record<string, unknown>
    return candidate.id === jobId && candidate.userId === userId
  })
  return (match as LegacyExportJob) || null
}

async function updateLegacyJob(jobId: string, userId: string, patch: Partial<LegacyExportJob>) {
  const key = 'agreement_export_jobs_fallback'
  const current = await getEnterpriseStateValue(key)
  const list = Array.isArray(current) ? current : []
  const next = list.map((row) => {
    if (!row || typeof row !== 'object') return row
    const item = row as LegacyExportJob
    if (item.id !== jobId || item.userId !== userId) return row
    return { ...item, ...patch, updatedAt: new Date().toISOString() }
  })
  await setEnterpriseStateValue(key, next)
}

async function setLegacyResult(jobId: string, html: string) {
  await setEnterpriseStateValue(`agreement_export_result:${jobId}`, html)
}

async function getLegacyResult(jobId: string): Promise<string | null> {
  const value = await getEnterpriseStateValue(`agreement_export_result:${jobId}`)
  return typeof value === 'string' ? value : null
}

async function renderAgreementHtml(ids: string[]) {
  const supabase = await createClient()
  const { data: leads, error } = await supabase
    .from('leads')
    .select('*, lead_events(*)')
    .in('id', ids)
    .order('created_at', { ascending: false })

  if (error || !leads) {
    throw new Error('Failed to fetch leads')
  }

  return renderAgreementSummaryHtml(leads as any[])
}

async function resolveQueuedExport(jobId: string, userId: string): Promise<{ status: ExportJobState; error?: string }> {
  const supabase = await createClient()
  const { data: jobData, error: jobError } = await supabase
    .from('agreement_export_jobs')
    .select('id, user_id, ids, status')
    .eq('id', jobId)
    .eq('user_id', userId)
    .single()

  if (!jobError && jobData) {
    const currentStatus = String(jobData.status || 'queued') as ExportJobState
    if (currentStatus === 'completed') return { status: 'completed' }
    if (currentStatus === 'failed') return { status: 'failed', error: 'Export failed. Please retry.' }

    await supabase
      .from('agreement_export_jobs')
      .update({ status: 'processing', updated_at: new Date().toISOString() } as any)
      .eq('id', jobId)
      .eq('user_id', userId)

    try {
      const ids = Array.isArray(jobData.ids) ? jobData.ids.filter((id) => typeof id === 'string') : []
      const html = await renderAgreementHtml(ids as string[])
      await setEnterpriseStateValue(`agreement_export_result:${jobId}`, html)
      await supabase
        .from('agreement_export_jobs')
        .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any)
        .eq('id', jobId)
        .eq('user_id', userId)
      return { status: 'completed' }
    } catch (error) {
      await supabase
        .from('agreement_export_jobs')
        .update({ status: 'failed', error: error instanceof Error ? error.message : 'Unknown error', updated_at: new Date().toISOString() } as any)
        .eq('id', jobId)
        .eq('user_id', userId)
      return { status: 'failed', error: error instanceof Error ? error.message : 'Failed to build export' }
    }
  }

  const legacy = await getLegacyJob(jobId, userId)
  if (!legacy) return { status: 'failed', error: 'Job not found.' }
  if (legacy.status === 'completed') return { status: 'completed' }
  if (legacy.status === 'failed') return { status: 'failed', error: legacy.error || 'Export failed.' }

  await updateLegacyJob(jobId, userId, { status: 'processing' })
  try {
    const html = await renderAgreementHtml(legacy.ids)
    await setLegacyResult(jobId, html)
    await updateLegacyJob(jobId, userId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      error: null,
    })
    return { status: 'completed' }
  } catch (error) {
    await updateLegacyJob(jobId, userId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Failed to build export',
    })
    return { status: 'failed', error: error instanceof Error ? error.message : 'Failed to build export' }
  }
}

export async function POST(request: NextRequest) {
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    await recordSecurityEvent({ type: 'failed_auth', route: '/api/download-agreements', ip, detail: 'Unauthorized request' })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await request.json().catch(() => ({}))
  const ids = parseIds(Array.isArray(payload?.ids) ? payload.ids.join(',') : null)
  if (!ids.length) {
    await recordSecurityEvent({ type: 'invalid_uuid', route: '/api/download-agreements', ip, detail: 'Invalid ids payload' })
    return NextResponse.json({ error: 'No valid IDs provided' }, { status: 400 })
  }

  const jobId = buildJobId()
  const nowIso = new Date().toISOString()
  const insertResult = await supabase.from('agreement_export_jobs').insert({
    id: jobId,
    user_id: user.id,
    ids,
    status: 'queued',
    created_at: nowIso,
    updated_at: nowIso,
  } as any)

  if (insertResult.error) {
    await createLegacyJob({
      id: jobId,
      userId: user.id,
      ids,
      status: 'queued',
      createdAt: nowIso,
      updatedAt: nowIso,
      completedAt: null,
      error: null,
    })
  }

  return NextResponse.json(
    { success: true, jobId, status: 'queued' },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-RateLimit-Remaining': String(rate.remaining),
      },
    },
  )
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rate = enforceRateLimit({
    key: `download-agreements:${ip}`,
    limit: 30,
    windowMs: 60_000,
  })
  if (!rate.ok) {
    await recordSecurityEvent({ type: 'rate_limit', route: '/api/download-agreements', ip, detail: 'Rate limit exceeded' })
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    await recordSecurityEvent({ type: 'failed_auth', route: '/api/download-agreements', ip, detail: 'Unauthorized request' })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jobId = request.nextUrl.searchParams.get('jobId')
  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required.' }, { status: 400 })
  }

  const resolution = await resolveQueuedExport(jobId, user.id)
  if (resolution.status === 'failed') {
    return NextResponse.json({ error: resolution.error || 'Export failed', status: 'failed' }, { status: 500 })
  }
  if (resolution.status !== 'completed') {
    return NextResponse.json({ status: resolution.status }, { status: 202 })
  }

  const shouldDownload = request.nextUrl.searchParams.get('download') === '1'
  const html = await getLegacyResult(jobId)
  if (!html) {
    return NextResponse.json({ error: 'Export output is not available yet.', status: 'processing' }, { status: 202 })
  }

  if (!shouldDownload) {
    return NextResponse.json({ status: 'completed', downloadUrl: `/api/download-agreements?jobId=${encodeURIComponent(jobId)}&download=1` })
  }

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
