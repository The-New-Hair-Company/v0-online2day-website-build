'use server'

import { Resend } from 'resend'
import { logLeadEvent } from './lead-actions'
import { revalidatePath } from 'next/cache'
// Import templates when we create them
// import VideoFollowUpEmail from '@/emails/VideoFollowUpEmail'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendVideoFollowUpEmail(leadId: string, email: string, name: string, videoSlug: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Online2Day <hello@online2day.com>',
      to: [email],
      subject: `Your personalized video from Online2Day`,
      html: `
        <p>Hi ${name},</p>
        <p>I recorded a short personalized video for you.</p>
        <p><a href="https://online2day.com/v/${videoSlug}">Watch it here</a></p>
        <p>Regards,<br/>Online2Day</p>
      `,
    })

    if (error) {
      console.error('Resend error:', error)
      return { error }
    }

    // Log the event
    await logLeadEvent(leadId, 'Email Sent', `Video Follow-up sent to ${email}`)
    
    revalidatePath(`/dashboard/leads/${leadId}`)
    return { success: true, data }
  } catch (error) {
    return { error: 'Failed to send email' }
  }
}
