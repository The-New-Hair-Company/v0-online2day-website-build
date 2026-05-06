'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logLeadEvent } from './lead-actions'

// ─── ADMIN STANDALONE VIDEO UPLOAD ───────────────────────────────────────────

export async function uploadAdminVideo(formData: FormData) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated' }

  const file = formData.get('video') as File
  const title = ((formData.get('title') as string) || file?.name || 'Untitled Video').trim()

  if (!file || file.size === 0) return { error: 'No video file selected' }
  if (!['video/mp4', 'video/quicktime', 'video/webm', 'video/mov'].includes(file.type)) {
    return { error: 'Unsupported file type. Use MP4, MOV or WebM.' }
  }

  const slug = `shared-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const filePath = `shared/${slug}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from('lead-videos')
    .upload(filePath, file, { contentType: file.type, upsert: false })

  if (uploadError) return { error: uploadError.message }

  const { data: asset, error: assetError } = await supabase
    .from('lead_assets')
    .insert({
      lead_id: null,
      name: title,
      type: 'video',
      url: '',
      storage_path: filePath,
      slug,
      metadata: {
        uploadedVideo: true,
        sharedVideo: true,
        uploadedBy: userData.user.email,
        fileName: file.name,
        size: file.size,
        contentType: file.type,
      },
    })
    .select()
    .single()

  if (assetError) {
    await supabase.storage.from('lead-videos').remove([filePath])
    return { error: assetError.message }
  }

  revalidatePath('/dashboard/videos')
  return { success: true, slug, assetId: asset.id }
}

export async function sendVideoViaChat(conversationUserId: string, videoSlug: string) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated' }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
  const videoUrl = `${baseUrl}/v/${videoSlug}`
  const content = `📹 Here is your video: ${videoUrl}`

  const { error } = await supabase.from('messages').insert({
    conversation_user_id: conversationUserId,
    sender_id: userData.user.id,
    content,
  })

  if (error) return { error: error.message }
  return { success: true }
}

export async function getClientUsers() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('user_profiles')
    .select('user_id, full_name, email, role')
    .order('full_name', { ascending: true })
  return (data || []).filter(u => u.role !== 'admin')
}

export async function getVideoSignedUrl(storagePath: string) {
  const supabase = await createClient()
  const { data } = await supabase.storage
    .from('lead-videos')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7)
  return data?.signedUrl ?? null
}

// ─── AGREEMENT DOWNLOAD ───────────────────────────────────────────────────────

export async function getLeadAgreements(leadId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lead_agreements')
    .select('id, title, storage_path, public_url, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  if (error) return []
  return (data || []).map(a => ({
    id: a.id as string,
    title: a.title as string,
    storagePath: a.storage_path as string | null,
    publicUrl: a.public_url as string | null,
    createdAt: a.created_at as string,
  }))
}

export async function getAgreementDownloadUrl(storagePath: string) {
  const supabase = await createClient()
  const { data } = await supabase.storage
    .from('agreements')
    .createSignedUrl(storagePath, 60 * 60) // 1-hour download link
  return data?.signedUrl ?? null
}

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
