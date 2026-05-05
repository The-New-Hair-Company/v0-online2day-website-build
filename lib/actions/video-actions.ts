'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logLeadEvent } from './lead-actions'

type EditorProjectPayload = {
  title: string
  leadId: string
  sourceAssetId?: string
  duration: number
  format: string
  scenes: Array<Record<string, unknown>>
  timeline: Array<Record<string, unknown>>
  brand: Record<string, unknown>
  cta: Record<string, unknown>
  email: Record<string, unknown>
  recording?: Record<string, unknown> | null
  settings: Record<string, unknown>
}

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
      storage_path: filePath,
      slug,
      metadata: {
        uploadedVideo: true,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
      },
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

export async function saveVideoEditorProject(payload: EditorProjectPayload) {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()

  if (!payload.leadId) return { error: 'Choose a lead before saving the video project.' }
  if (!payload.title.trim()) return { error: 'Give the video project a title.' }

  const slug = `${payload.leadId.slice(0, 8)}-editor-${Date.now()}`
  const projectMetadata = {
    editorProject: true,
    duration: payload.duration,
    format: payload.format,
    scenes: payload.scenes,
    timeline: payload.timeline,
    brand: payload.brand,
    cta: payload.cta,
    email: payload.email,
    recording: payload.recording || null,
    settings: payload.settings,
    createdBy: user.user?.email || 'unknown',
  }

  const assetMutation = payload.sourceAssetId
    ? supabase
        .from('lead_assets')
        .update({
          name: payload.title,
          metadata: projectMetadata,
        } as any)
        .eq('id', payload.sourceAssetId)
        .eq('lead_id', payload.leadId)
        .eq('type', 'video')
        .select()
        .single()
    : supabase
        .from('lead_assets')
        .insert({
          lead_id: payload.leadId,
          name: payload.title,
          type: 'video',
          url: '',
          storage_path: '',
          slug,
          metadata: projectMetadata,
        } as any)
        .select()
        .single()

  const { data: asset, error } = await assetMutation

  if (error) {
    console.error('Editor project save error:', error)
    return { error: error.message }
  }

  await logLeadEvent(payload.leadId, 'Video Editor Project Saved', `Video project "${payload.title}" saved by ${user.user?.email || 'unknown'}`, {
    slug: asset.slug || slug,
    assetId: asset.id,
    duration: payload.duration,
    format: payload.format,
    sourceAssetId: payload.sourceAssetId || null,
  })

  revalidatePath('/dashboard/videos')
  revalidatePath('/dashboard/videos/editor')
  revalidatePath('/dashboard/emails')
  revalidatePath(`/dashboard/leads/${payload.leadId}`)
  return { success: true, asset, slug: asset.slug || slug }
}
