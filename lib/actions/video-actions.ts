'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logLeadEvent } from './lead-actions'

export async function uploadLeadVideo(leadId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()

  const file = formData.get('video') as File
  const videoName = formData.get('name') as string

  if (!file || file.size === 0) {
    return { error: 'Please select a video file' }
  }

  // Generate a unique slug for the public video page
  const slug = `${leadId.slice(0, 8)}-${Date.now()}`
  const filePath = `${leadId}/${slug}-${file.name}`

  // Upload to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('lead-videos')
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    console.error('Upload error:', uploadError)
    return { error: uploadError.message }
  }

  // Get a signed URL (valid 7 days — can be regenerated)
  const { data: signedUrlData } = await supabase.storage
    .from('lead-videos')
    .createSignedUrl(filePath, 60 * 60 * 24 * 7) // 7 days

  // Save asset record
  const { data: asset, error: assetError } = await supabase
    .from('lead_assets')
    .insert({
      lead_id: leadId,
      name: videoName || file.name,
      type: 'video',
      url: signedUrlData?.signedUrl || '',
      slug,
    })
    .select()
    .single()

  if (assetError) {
    console.error('Asset insert error:', assetError)
    return { error: assetError.message }
  }

  // Log event
  await logLeadEvent(leadId, 'Video Uploaded', `Video "${videoName || file.name}" uploaded by ${user.user?.email || 'unknown'}`)

  revalidatePath(`/dashboard/leads/${leadId}`)
  revalidatePath('/dashboard/videos')

  return { success: true, asset }
}

export async function deleteLeadVideo(assetId: string, leadId: string, storagePath: string) {
  const supabase = await createClient()

  // Delete from storage
  if (storagePath) {
    await supabase.storage.from('lead-videos').remove([storagePath])
  }

  // Delete record
  const { error } = await supabase.from('lead_assets').delete().eq('id', assetId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/videos')
  revalidatePath(`/dashboard/leads/${leadId}`)
  return { success: true }
}
