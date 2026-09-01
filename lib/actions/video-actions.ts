'use server'

import { createClient } from '@/lib/supabase/server'
import { agreementsApi, videoAssetsApi } from '@/lib/api/client'
import { revalidatePath } from 'next/cache'
import { logLeadEvent } from './lead-actions'
import { logAsyncActionFailure } from './reliability-actions'
import { z } from 'zod'

async function getToken(): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return token
}

const allowedVideoTypes = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/mov'])
const hexColour = z.string().regex(/^#[0-9a-f]{6}$/i)
const editorProjectSchema = z.object({
  title: z.string().trim().min(1).max(160),
  leadId: z.string().uuid().nullable(),
  sourceAssetId: z.string().uuid().optional().or(z.literal('')),
  sourceSlug: z.string().max(160).optional(),
  duration: z.number().finite().min(1).max(14_400),
  format: z.enum(['16:9', '9:16', '1:1', '4:5', '21:9']),
  scenes: z.array(z.object({
    id: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(120),
    duration: z.number().finite().min(1).max(900),
    layout: z.enum(['intro', 'proof', 'demo', 'offer', 'cta']),
    headline: z.string().max(240),
    note: z.string().max(2_000),
    color: hexColour,
  })).min(1).max(50),
  timeline: z.array(z.object({
    id: z.string().min(1).max(120),
    label: z.string().trim().min(1).max(180),
    track: z.enum(['video', 'audio', 'text', 'cta']),
    start: z.number().finite().min(0).max(14_400),
    duration: z.number().finite().min(0.1).max(14_400),
  })).max(200),
  brand: z.object({
    primary: hexColour,
    accent: hexColour,
    watermark: z.boolean(),
    logoPlacement: z.enum(['top-left', 'top-right', 'bottom-left']),
  }),
  cta: z.object({ label: z.string().trim().max(100), destination: z.string().trim().url().max(2_000) }),
  email: z.object({ subject: z.string().max(240), body: z.string().max(10_000) }),
  recording: z.record(z.string(), z.unknown()).nullable().optional(),
  settings: z.record(z.string(), z.unknown()),
})

// ─── ADMIN STANDALONE VIDEO UPLOAD ───────────────────────────────────────────

export async function uploadAdminVideo(formData: FormData) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated' }

  const file = formData.get('video') as File
  const title = ((formData.get('title') as string) || file?.name || 'Untitled Video').trim()

  if (!file || file.size === 0) return { error: 'No video file selected' }
  if (!allowedVideoTypes.has(file.type)) {
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

  try {
    const token = await getToken()
    const asset = await videoAssetsApi.create(token, {
      leadId: null,
      name: title,
      storagePath: filePath,
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
    revalidatePath('/dashboard/videos')
    return { success: true, slug, assetId: asset.id }
  } catch (error) {
    await logAsyncActionFailure({
      action: 'upload_admin_video_asset_insert',
      payload: { title, filePath },
      error,
      recoverable: true,
    })
    await supabase.storage.from('lead-videos').remove([filePath])
    return { error: error instanceof Error ? error.message : 'Video metadata could not be saved.' }
  }
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
  leadId: string | null
  sourceAssetId?: string
  sourceSlug?: string
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

const uploadedVideoSchema = z.object({
  assetId: z.string().uuid().optional(),
  leadId: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(160),
  storagePath: z.string().trim().min(1).max(700),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{2,159}$/),
  contentType: z.string().refine((value) => allowedVideoTypes.has(value), 'Unsupported video type.'),
  size: z.number().int().positive().max(2 * 1024 * 1024 * 1024),
  duration: z.number().finite().min(0).max(14_400),
})

export async function registerUploadedVideo(input: z.infer<typeof uploadedVideoSchema>) {
  const parsed = uploadedVideoSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Invalid video upload.' }
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) return { error: 'Your session has expired. Sign in again before uploading.' }

  try {
    const token = await getToken()
    const video = parsed.data
    const uploadMetadata = {
      uploadedVideo: true,
      sharedVideo: video.leadId === null,
      uploadedBy: user.user.email || 'unknown',
      size: video.size,
      contentType: video.contentType,
      duration: video.duration,
    }
    const asset = video.assetId
      ? await videoAssetsApi.update(token, video.assetId, {
          leadId: video.leadId,
          name: video.name,
          storagePath: video.storagePath,
          metadata: uploadMetadata,
        })
      : await videoAssetsApi.create(token, {
          leadId: video.leadId,
          name: video.name,
          storagePath: video.storagePath,
          slug: video.slug,
          metadata: uploadMetadata,
        })
    if (video.leadId) {
      await logLeadEvent(video.leadId, 'Video Uploaded', `Video "${video.name}" uploaded by ${user.user.email || 'unknown'}`)
      revalidatePath(`/dashboard/leads/${video.leadId}`)
    }
    revalidatePath('/dashboard/videos')
    revalidatePath('/dashboard/videos/editor')
    return { success: true, asset }
  } catch (error) {
    await supabase.storage.from('lead-videos').remove([parsed.data.storagePath])
    await logAsyncActionFailure({
      action: 'register_uploaded_video',
      payload: { leadId: parsed.data.leadId, storagePath: parsed.data.storagePath },
      error,
      recoverable: true,
    })
    return { error: error instanceof Error ? error.message : 'Video metadata could not be saved.' }
  }
}

export async function getVideoPlaybackUrl(assetId: string) {
  if (!z.string().uuid().safeParse(assetId).success) return { error: 'Invalid video asset.' }
  try {
    const token = await getToken()
    return await videoAssetsApi.playback(token, assetId)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Video preview is unavailable.' }
  }
}

export async function deleteVideoAsset(assetId: string) {
  if (!z.string().uuid().safeParse(assetId).success) return { error: 'Invalid video asset.' }
  try {
    const token = await getToken()
    await videoAssetsApi.delete(token, assetId)
    revalidatePath('/dashboard/videos')
    revalidatePath('/dashboard/videos/editor')
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Video could not be deleted.' }
  }
}

export async function uploadLeadVideo(leadId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()

  const file = formData.get('video') as File
  const videoName = formData.get('name') as string

  if (!file || file.size === 0) return { error: 'Please select a video file' }
  if (!allowedVideoTypes.has(file.type)) return { error: 'Unsupported file type. Use MP4, MOV or WebM.' }

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

  try {
    const token = await getToken()
    const asset = await videoAssetsApi.create(token, {
      leadId,
      name: videoName || file.name,
      storagePath: filePath,
      slug,
      metadata: {
        uploadedVideo: true,
        uploadedBy: user.user?.email || 'unknown',
        fileName: file.name,
        size: file.size,
        contentType: file.type,
      },
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
  try {
    const token = await getToken()
    await videoAssetsApi.delete(token, assetId)
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
  if (!user.user) return { error: 'Your session has expired. Sign in again before saving.' }

  const parsed = editorProjectSchema.safeParse(payload)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'The video project contains invalid data.' }
  const project = parsed.data
  const slug = project.sourceSlug || `${project.leadId?.slice(0, 8) || 'shared'}-editor-${Date.now()}`
  const projectMetadata = {
    editorProject: true,
    schemaVersion: 3,
    duration: project.duration,
    format: project.format,
    scenes: project.scenes,
    timeline: project.timeline,
    brand: project.brand,
    cta: project.cta,
    email: project.email,
    recording: project.recording || null,
    settings: project.settings,
    createdBy: user.user?.email || 'unknown',
    updatedAt: new Date().toISOString(),
  }

  try {
    const token = await getToken()
    let asset

    if (project.sourceAssetId) {
      asset = await videoAssetsApi.update(token, project.sourceAssetId, {
        leadId: project.leadId,
        name: project.title,
        metadata: projectMetadata,
      })
    } else {
      asset = await videoAssetsApi.create(token, {
        leadId: project.leadId,
        name: project.title,
        slug,
        metadata: projectMetadata,
      })
    }

    if (project.leadId) {
      await logLeadEvent(project.leadId, 'Video Editor Project Saved',
        `Video project "${project.title}" saved by ${user.user?.email || 'unknown'}`,
        { slug: asset.slug || slug, sourceAssetId: project.sourceAssetId || null, duration: project.duration, format: project.format })
    }

    revalidatePath('/dashboard/videos')
    revalidatePath('/dashboard/videos/editor')
    revalidatePath('/dashboard/emails')
    if (project.leadId) revalidatePath(`/dashboard/leads/${project.leadId}`)
    return { success: true, slug: asset.slug || slug, asset, assetId: asset.id }
  } catch (e) {
    await logAsyncActionFailure({
      action: 'save_video_editor_project',
      payload: { leadId: project.leadId, title: project.title },
      error: e,
      recoverable: true,
    })
    return { error: (e as Error).message }
  }
}
