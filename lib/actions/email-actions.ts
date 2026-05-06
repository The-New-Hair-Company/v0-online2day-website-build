'use server'

import { Resend } from 'resend'
import { logLeadEvent } from './lead-actions'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logAsyncActionFailure, withRetry } from './reliability-actions'

type SendEnterpriseEmailInput = {
  leadId?: string
  to: string
  recipientName?: string
  subject: string
  body: string
  templateName?: string
  videoAssetId?: string
  videoSlug?: string
  ctaLabel?: string
}

const getResend = () => {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  return new Resend(apiKey)
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

function renderEmailHtml({
  recipientName,
  body,
  videoUrl,
  videoTitle,
  ctaLabel,
}: {
  recipientName?: string
  body: string
  videoUrl?: string
  videoTitle?: string
  ctaLabel?: string
}) {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 16px;color:#d6deea;line-height:1.65">${escapeHtml(paragraph).replaceAll('\n', '<br/>')}</p>`)
    .join('')

  return `
    <div style="margin:0;padding:0;background:#05070b;font-family:Inter,Arial,sans-serif;color:#f7f9ff">
      <table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="background:#05070b;padding:32px 16px">
        <tr>
          <td align="center">
            <table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="max-width:680px;border:1px solid #20304f;border-radius:16px;overflow:hidden;background:#0c121d">
              <tr>
                <td style="padding:24px 28px;border-bottom:1px solid #20304f">
                  <div style="font-size:24px;font-weight:800;color:#4d86ff">Online2Day</div>
                  <div style="margin-top:6px;color:#8f9caf;font-size:13px">Personalised client communication</div>
                </td>
              </tr>
              <tr>
                <td style="padding:28px">
                  ${recipientName ? `<p style="margin:0 0 16px;color:#f7f9ff;font-size:18px;font-weight:700">Hi ${escapeHtml(recipientName)},</p>` : ''}
                  ${paragraphs}
                  ${videoUrl ? `
                    <a href="${videoUrl}" style="display:block;margin:24px 0;padding:20px;border:1px solid #2f6bff;border-radius:12px;background:#08152d;text-decoration:none">
                      <span style="display:block;color:#72aeff;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em">Personalised video</span>
                      <strong style="display:block;margin-top:8px;color:#ffffff;font-size:18px">${escapeHtml(videoTitle || 'Watch your video')}</strong>
                      <span style="display:inline-block;margin-top:14px;padding:10px 16px;border-radius:8px;background:#2f6bff;color:#fff;font-weight:800">${escapeHtml(ctaLabel || 'Watch video')}</span>
                    </a>
                  ` : ''}
                  <p style="margin:22px 0 0;color:#8f9caf;font-size:12px;line-height:1.6">This email was sent from the Online2Day CRM. Video assets are streamed from the secure Online2Day database and tracked for engagement.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `
}

export async function sendEnterpriseEmail(input: SendEnterpriseEmailInput) {
  const resend = getResend()
  if (!resend) {
    return { error: 'Email service is not configured. RESEND_API_KEY is missing.' }
  }

  const to = input.to.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { error: 'Enter a valid recipient email address.' }
  }

  if (!input.subject.trim() || !input.body.trim()) {
    return { error: 'Subject and message body are required.' }
  }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  let lead: any = null
  if (input.leadId) {
    const { data } = await supabase
      .from('leads')
      .select('id, name, company, email')
      .eq('id', input.leadId)
      .single()
    lead = data
  }

  let video: any = null
  if (input.videoAssetId) {
    const { data } = await supabase
      .from('lead_assets')
      .select('id, lead_id, name, slug, url, storage_path')
      .eq('id', input.videoAssetId)
      .eq('type', 'video')
      .single()
    video = data
  }

  let videoUrl = input.videoSlug ? `${siteUrl()}/v/${input.videoSlug}` : video?.slug ? `${siteUrl()}/v/${video.slug}` : video?.url

  if (video?.storage_path && !video?.slug) {
    const { data } = await supabase.storage
      .from('lead-videos')
      .createSignedUrl(video.storage_path, 60 * 60 * 24 * 14)
    videoUrl = data?.signedUrl || videoUrl
  }

  const html = renderEmailHtml({
    recipientName: input.recipientName || lead?.name,
    body: input.body,
    videoUrl,
    videoTitle: video?.name,
    ctaLabel: input.ctaLabel,
  })

  let data: { id?: string } | null = null
  let error: unknown = null
  try {
    data = await withRetry('send_enterprise_email', async () => {
      const result = await resend.emails.send({
        from: process.env.EMAIL_FROM || 'Online2Day <hello@online2day.com>',
        replyTo: process.env.EMAIL_REPLY_TO || 'hello@online2day.com',
        to: [to],
        subject: input.subject.trim(),
        html,
        text: `${input.recipientName || lead?.name ? `Hi ${input.recipientName || lead?.name},\n\n` : ''}${input.body}${videoUrl ? `\n\nWatch video: ${videoUrl}` : ''}`,
        tags: [
          { name: 'system', value: 'crm' },
          { name: 'template', value: (input.templateName || 'custom').toLowerCase().replace(/[^a-z0-9_-]/g, '-') },
        ],
      })
      return { id: (result as any)?.data?.id || (result as any)?.id }
    }, { attempts: 3, payload: { to, leadId: input.leadId || null, template: input.templateName || 'custom' } })
  } catch (err) {
    error = err
  }

  if (error) {
    await logAsyncActionFailure({
      action: 'send_enterprise_email',
      payload: { to, leadId: input.leadId || null, subject: input.subject.trim() },
      error,
      recoverable: true,
    })
    return { error: error instanceof Error ? error.message : 'Resend rejected the message.' }
  }

  if (input.leadId) {
    await logLeadEvent(input.leadId, 'Email Sent', `Email "${input.subject}" sent to ${to}`, {
      subject: input.subject,
      template: input.templateName,
      videoAssetId: input.videoAssetId,
      videoSlug: input.videoSlug,
      resendId: data?.id,
      sentBy: userData.user?.email,
    })
    revalidatePath(`/dashboard/leads/${input.leadId}`)
  }

  revalidatePath('/dashboard/emails')
  return { success: true, id: data?.id }
}

export async function sendVideoFollowUpEmail(leadId: string, email: string, name: string, videoSlug: string) {
  try {
    const result = await sendEnterpriseEmail({
      leadId,
      to: email,
      recipientName: name,
      subject: 'Your personalised video from Online2Day',
      body: 'I recorded a short personalised video for you.\n\nHave a look when you get a moment, and reply with any questions.',
      templateName: 'Video Follow-up',
      videoSlug,
      ctaLabel: 'Watch video',
    })

    return result
  } catch (error) {
    return { error: 'Failed to send email' }
  }
}
