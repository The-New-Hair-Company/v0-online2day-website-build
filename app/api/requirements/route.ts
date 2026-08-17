import { NextResponse } from 'next/server'
import { z } from 'zod'
import { syncOnline2DayBrief } from '@/lib/hubspot/online2day'
import { enforceRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { createClient } from '@/lib/supabase/server'

const requestSchema = z.object({
  plan: z.enum(['not-sure', 'launch', 'growth', 'bespoke']),
  projectType: z.enum(['new-website', 'redesign', 'webapp', 'marketing']),
  pages: z.enum(['1-5', '6-12', '13-25', '25+']),
  features: z.array(z.string().trim().min(1).max(80)).max(12),
  timeline: z.enum(['asap', '4-8-weeks', '2-4-months', 'flexible']),
  budget: z.enum(['not-sure', 'under-1k', '1k-3k', '3k-8k', '8k+']),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  company: z.string().trim().max(160),
  notes: z.string().trim().max(3000),
  website: z.string().max(200).default(''),
  utmSource: z.string().trim().max(160).optional().default(''),
  utmMedium: z.string().trim().max(160).optional().default(''),
  utmCampaign: z.string().trim().max(200).optional().default(''),
  referrer: z.string().trim().max(500).optional().default(''),
  startedAt: z.number().int().positive(),
})

const budgets: Record<string, [number, number]> = {
  'not-sure': [0, 0],
  'under-1k': [0, 1000],
  '1k-3k': [1000, 3000],
  '3k-8k': [3000, 8000],
  '8k+': [8000, 0],
}

const timelineWeeks: Record<string, number> = {
  asap: 2,
  '4-8-weeks': 6,
  '2-4-months': 12,
  flexible: 0,
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > 20_000) {
    return NextResponse.json({ error: 'Request is too large.' }, { status: 413 })
  }

  const ip = getClientIp(request)
  const limit = enforceRateLimit({ key: `requirements:${ip}`, limit: 5, windowMs: 15 * 60 * 1000 })
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please check the form and try again.' }, { status: 400 })
  }

  const data = parsed.data
  const submissionId = crypto.randomUUID()
  const formAge = Date.now() - data.startedAt
  if (data.website || formAge < 1_200 || formAge > 2 * 60 * 60 * 1000) {
    return NextResponse.json({ ok: true }, { status: 202 })
  }

  const [budgetMin, budgetMax] = budgets[data.budget]
  const summary = [
    `Project type: ${data.projectType}`,
    `Plan: ${data.plan}`,
    `Pages/views: ${data.pages}`,
    `Features: ${data.features.length ? data.features.join(', ') : 'None selected'}`,
    `Timeline: ${data.timeline}`,
    `Budget: ${data.budget}`,
    `Notes: ${data.notes || 'None provided'}`,
  ].join('\n')

  const supabaseWrite = async () => {
    const supabase = await createClient()
    const { error } = await supabase.from('site_requests').insert({
      id: submissionId,
      title: `${data.projectType.replaceAll('-', ' ')} — ${data.plan}`,
      company: data.company || 'Individual enquiry',
      type: data.projectType === 'webapp' ? 'Web application' : data.projectType === 'marketing' ? 'Marketing' : 'Website',
      priority: data.timeline === 'asap' ? 'High' : 'Medium',
      stage: 'New',
      contact_name: data.name,
      contact_email: data.email.toLowerCase(),
      description: summary,
      budget_min: budgetMin,
      budget_max: budgetMax,
      timeline_weeks: timelineWeeks[data.timeline],
      next_action: 'Review project brief',
    } as never)
    if (error) throw error
  }

  const hubspotWrite = async () => {
    await syncOnline2DayBrief({
      ...data,
      submissionId,
      email: data.email.toLowerCase(),
    })
  }

  const results = await Promise.allSettled([supabaseWrite(), hubspotWrite()])
  const hubspotResult = results[1]
  if (hubspotResult.status === 'rejected') {
    console.error('HubSpot brief sync failed', hubspotResult.reason instanceof Error ? hubspotResult.reason.message : 'Unknown error')
  }
  if (results.every((result) => result.status === 'rejected')) {
    return NextResponse.json({ error: 'We could not send your brief. Please email hello@online2day.com.' }, { status: 503 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
