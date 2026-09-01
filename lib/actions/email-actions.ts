'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { emailWorkspaceApi } from '@/lib/api/client'

type SendEnterpriseEmailInput = {
  leadId?: string
  to: string
  recipientName?: string
  subject: string
  body: string
  templateId?: string
  templateName?: string
  videoAssetId?: string
  videoSlug?: string
  ctaLabel?: string
}

async function getToken() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

export async function sendEnterpriseEmail(input: SendEnterpriseEmailInput) {
  const to = input.to.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { error: 'Enter a valid recipient email address.' }
  }

  if (!input.subject.trim() || !input.body.trim()) {
    return { error: 'Subject and message body are required.' }
  }
  if (input.subject.trim().length > 180) return { error: 'Keep the subject under 180 characters.' }
  if (input.body.trim().length > 20_000) return { error: 'Keep the message under 20,000 characters.' }

  const token = await getToken()
  if (!token) return { error: 'Your session has expired. Sign in and try again.' }
  try {
    const result = await emailWorkspaceApi.sendEmail(token, {
      leadId: input.leadId || null,
      templateId: input.templateId || null,
      to,
      recipientName: input.recipientName,
      subject: input.subject.trim(),
      body: input.body.trim(),
      templateName: input.templateName,
      videoAssetId: input.videoAssetId,
      videoSlug: input.videoSlug,
      ctaLabel: input.ctaLabel,
      idempotencyKey: crypto.randomUUID(),
    })
    if (input.leadId) revalidatePath(`/dashboard/leads/${input.leadId}`)
    revalidatePath('/dashboard/emails')
    return { success: true, id: result.id, warning: result.warning }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'The Online2Day API could not deliver the email.' }
  }
}

type EmailTemplateInput = {
  name: string
  subject: string
  body: string
  category?: string
  audience?: string
  stage?: string
  ctaLabel?: string
}

function validateTemplate(input: EmailTemplateInput) {
  if (!input.name.trim()) return 'Template name is required.'
  if (!input.subject.trim()) return 'Subject is required.'
  if (!input.body.trim()) return 'Message body is required.'
  if (input.name.trim().length > 120) return 'Keep the template name under 120 characters.'
  if (input.subject.trim().length > 180) return 'Keep the subject under 180 characters.'
  if (input.body.trim().length > 20_000) return 'Keep the message under 20,000 characters.'
  return null
}

export async function createEmailTemplate(input: EmailTemplateInput) {
  const validation = validateTemplate(input)
  if (validation) return { error: validation }
  const token = await getToken()
  if (!token) return { error: 'Your session has expired. Sign in and try again.' }
  try {
    const template = await emailWorkspaceApi.createTemplate(token, input)
    revalidatePath('/dashboard/emails')
    return { success: true, template }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Template could not be created.' }
  }
}

export async function updateEmailTemplate(id: string, input: EmailTemplateInput) {
  if (!id) return { error: 'Template is required.' }
  const validation = validateTemplate(input)
  if (validation) return { error: validation }
  const token = await getToken()
  if (!token) return { error: 'Your session has expired. Sign in and try again.' }
  try {
    const template = await emailWorkspaceApi.updateTemplate(token, id, input)
    revalidatePath('/dashboard/emails')
    return { success: true, template }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Template could not be updated.' }
  }
}

export async function deleteEmailTemplate(id: string) {
  if (!id) return { error: 'Template is required.' }
  const token = await getToken()
  if (!token) return { error: 'Your session has expired. Sign in and try again.' }
  try {
    await emailWorkspaceApi.deleteTemplate(token, id)
    revalidatePath('/dashboard/emails')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Template could not be deleted.' }
  }
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
