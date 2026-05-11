'use server'

import { createClient } from '@/lib/supabase/server'
import { assetsApi, agreementsApi } from '@/lib/api/client'
import { revalidatePath } from 'next/cache'
import { logLeadEvent } from './lead-actions'
import { logAsyncActionFailure } from './reliability-actions'

async function getToken(): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return token
}

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

  // Storage upload stays direct — binary upload not routed through .NET
  const { error: uploadError } = await supabase.storage
    .from('lead-videos')
    .upload(filePath, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    await logAsyncActionFailure({
      action: 'upload_admin_video_storage',
      payload: { filePath, contentType: file.type, size: file.size },
      error: new Error(uploadError.message),
      recoverable: true,
    })
    return { error: uploadError.message }
  }

  // DB record goes through .NET API (lead_id=null for shared videos not supported by repo — fallback to direct)
  // Since lead_id is required by the .NET schema, shared (no-lead) videos go direct
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
    await logAsyncActionFailure({
      action: 'upload_admin_video_asset_insert',
      payload: { title, filePath },
      error: new Error(assetError.message),
      recoverable: true,
    })
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
  const content = `📹 Here is your video: ${baseUrl}/v/${videoSlug}`

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
  return (data || []).filter((u) => u.role !== 'admin')
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
  try {
    const token = await getToken()
    const agreements = await agreementsApi.list(token, leadId)
    return agreements.map((a) => ({
      id: a.id,
      title: a.name,
      storagePath: a.storagePath ?? null,
      publicUrl: null,
      createdAt: a.createdAt,
    }))
  } catch {
    return []
  }
}

export async function getAgreementDownloadUrl(storagePath: string) {
  const supabase = await createClient()
  const { data } = await supabase.storage
    .from('agreements')
    .createSignedUrl(storagePath, 60 * 60)
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

  if (!file || file.size === 0) return { error: 'Please select a video file' }

  const slug = `${leadId.slice(0, 8)}-${Date.now()}`
  const filePath = `${leadId}/${slug}-${file.name}`

  // Storage upload stays direct
  const { error: uploadError } = await supabase.storage
    .from('lead-videos')
    .upload(filePath, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    await logAsyncActionFailure({
      action: 'upload_lead_video_storage',
      payload: { leadId, filePath },
      error: new Error(uploadError.message),
      recoverable: true,
    })
    return { error: uploadError.message }
  }

  const { data: signedUrlData } = await supabase.storage
    .from('lead-videos')
    .createSignedUrl(filePath, 60 * 60 * 24 * 7)

  // DB record via .NET API
  try {
    const token = await getToken()
    const asset = await assetsApi.create(token, leadId, {
      name: videoName || file.name,
      type: 'video',
      url: signedUrlData?.signedUrl || '',
      storagePath: filePath,
      slug,
    })

    await logLeadEvent(leadId, 'Video Uploaded',
      `Video "${videoName || file.name}" uploaded by ${user.user?.email || 'unknown'}`)

    revalidatePath(`/dashboard/leads/${leadId}`)
    revalidatePath('/dashboard/videos')
    return { success: true, asset }
  } catch (e) {
    await logAsyncActionFailure({
      action: 'upload_lead_video_asset_insert',
      payload: { leadId, filePath },
      error: e,
      recoverable: true,
    })
    return { error: (e as Error).message }
  }
}

export async function deleteLeadVideo(assetId: string, leadId: string, storagePath: string) {
  const supabase = await createClient()

  if (storagePath) {
    await supabase.storage.from('lead-videos').remove([storagePath])
  }

  try {
    const token = await getToken()
    await assetsApi.delete(token, leadId, assetId)
  } catch (e) {
    return { error: (e as Error).message }
  }

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
  const projectMetadata = JSON.stringify({
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
  })

  try {
    const token = await getToken()
    let assetId: string = payload.sourceAssetId || ''

    if (payload.sourceAssetId) {
      // Update existing — fallback to direct since .NET doesn't have a metadata-only update
      const { error } = await supabase
        .from('lead_assets')
        .update({ name: payload.title, metadata: JSON.parse(projectMetadata) } as any)
        .eq('id', payload.sourceAssetId)
        .eq('lead_id', payload.leadId)

      if (error) throw new Error(error.message)
    } else {
      const created = await assetsApi.create(token, payload.leadId, {
        name: payload.title,
        type: 'video',
        url: '',
        storagePath: '',
        slug,
      })
      assetId = created.id
    }

    const asset = { id: assetId, slug, name: payload.title }

    await logLeadEvent(payload.leadId, 'Video Editor Project Saved',
      `Video project "${payload.title}" saved by ${user.user?.email || 'unknown'}`,
      { slug, sourceAssetId: payload.sourceAssetId || null, duration: payload.duration, format: payload.format })

    revalidatePath('/dashboard/videos')
    revalidatePath('/dashboard/videos/editor')
    revalidatePath('/dashboard/emails')
    revalidatePath(`/dashboard/leads/${payload.leadId}`)
    return { success: true, slug, asset, assetId }
  } catch (e) {
    await logAsyncActionFailure({
      action: 'save_video_editor_project',
      payload: { leadId: payload.leadId, title: payload.title },
      error: e,
      recoverable: true,
    })
    return { error: (e as Error).message }
  }
}
