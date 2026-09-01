import { createReadStream } from 'node:fs'
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { finished } from 'node:stream/promises'
import { spawn } from 'node:child_process'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { escapeDrawText, formatCanvas, normaliseMediaCuts, outputTimeForSource, retainedSegments, type MediaCaption } from './media-utils.js'

type SupabaseRequest = <T>(path: string, init?: RequestInit) => Promise<T>
type MediaDeps = {
  config: { supabaseUrl: string; supabaseServiceRoleKey: string }
  requireAdmin: (request: FastifyRequest) => Promise<Record<string, unknown>>
  supabaseFetch: SupabaseRequest
  supabaseStorageFetch: SupabaseRequest
}

type AssetRow = { id: string; name: string; storage_path: string | null; metadata: Record<string, unknown> | string | null }
type JobRow = { id: string; owner_user_id: string; video_asset_id: string; status: string; instructions: MediaInstructions }
type BrandingRow = { owner_user_id: string; intro_enabled: boolean; intro_storage_path: string | null; intro_filename: string | null; intro_mime_type: string | null; intro_size_bytes: number | null; intro_duration_seconds: number | null; intro_metadata: Record<string, unknown> }

const cut = z.object({ start: z.number().finite().min(0).max(14_400), end: z.number().finite().positive().max(14_400) }).refine((value) => value.end > value.start)
const caption = z.object({ text: z.string().trim().min(1).max(500), start: z.number().finite().min(0).max(14_400), end: z.number().finite().positive().max(14_400), position: z.enum(['top', 'middle', 'bottom']).default('bottom') }).refine((value) => value.end > value.start)
const processingSchema = z.object({
  trimStart: z.number().finite().min(0).max(14_400), trimEnd: z.number().finite().positive().max(14_400),
  cuts: z.array(cut).max(200).default([]), format: z.enum(['16:9', '9:16', '1:1', '4:5', '21:9']).default('16:9'),
  transform: z.object({ fit: z.enum(['contain', 'cover']).default('contain'), scale: z.number().min(0.25).max(4), x: z.number().min(-100).max(100), y: z.number().min(-100).max(100), rotation: z.number().min(-180).max(180), flipX: z.boolean(), flipY: z.boolean() }),
  captionsEnabled: z.boolean().default(true), captions: z.array(caption).max(500).default([]),
  captionStyle: z.object({ color: z.string().regex(/^#[0-9a-f]{6}$/i), background: z.string().max(32), fontSize: z.number().int().min(16).max(72), fontWeight: z.number().int().min(100).max(900), uppercase: z.boolean() }),
  watermark: z.boolean().default(false), playbackRate: z.number().min(0.5).max(2), volume: z.number().min(0).max(1),
  applyDefaultIntro: z.boolean().default(true),
}).refine((value) => value.trimEnd > value.trimStart, 'Trim end must be after trim start.')
type MediaInstructions = z.infer<typeof processingSchema>

const introUploadSchema = z.object({ filename: z.string().trim().min(1).max(220), mimeType: z.enum(['video/mp4', 'video/quicktime', 'video/webm']), sizeBytes: z.number().int().positive().max(250 * 1024 * 1024) })
const introSaveSchema = introUploadSchema.extend({ storagePath: z.string().trim().min(1).max(700), enabled: z.boolean().default(true) })

function encodeStoragePath(value: string) { return value.split('/').map(encodeURIComponent).join('/') }
function storageHeaders(deps: MediaDeps, additional?: HeadersInit) {
  const headers = new Headers(additional); headers.set('apikey', deps.config.supabaseServiceRoleKey); headers.set('Authorization', `Bearer ${deps.config.supabaseServiceRoleKey}`); return headers
}
async function storageFetch(deps: MediaDeps, bucket: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${deps.config.supabaseUrl}/storage/v1/object/${bucket}/${encodeStoragePath(path)}`, { ...init, headers: storageHeaders(deps, init.headers), signal: AbortSignal.timeout(120_000), ...(init.body ? { duplex: 'half' } : {}) } as RequestInit)
  if (!response.ok) throw Object.assign(new Error(`Media storage operation failed (${response.status}).`), { statusCode: response.status === 404 ? 404 : 502 })
  return response
}
async function downloadObject(deps: MediaDeps, bucket: string, path: string, destination: string) {
  const response = await storageFetch(deps, bucket, path)
  if (!response.body) throw new Error('Media storage returned no content.')
  await finished(Readable.fromWeb(response.body as never).pipe((await import('node:fs')).createWriteStream(destination)))
}
async function uploadObject(deps: MediaDeps, bucket: string, path: string, source: string, contentType: string) {
  const body = Readable.toWeb(createReadStream(source))
  await storageFetch(deps, bucket, path, { method: 'POST', headers: { 'Content-Type': contentType, 'x-upsert': 'false' }, body: body as never })
}

async function command(binary: string, args: string[], timeoutMs = 7_200_000) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'ignore', 'pipe'] }); let stderr = ''
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`${binary} timed out.`)) }, timeoutMs)
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${String(chunk)}`.slice(-12_000) })
    child.on('error', (error) => { clearTimeout(timer); reject(error) })
    child.on('close', (code) => { clearTimeout(timer); if (code === 0) resolve(); else reject(new Error(`${binary} failed (${code}): ${stderr.slice(-2_000)}`)) })
  })
}

async function probe(path: string) {
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size,format_name:stream=codec_type,width,height,r_frame_rate,sample_rate,channels', '-of', 'json', path], { stdio: ['ignore', 'pipe', 'pipe'] }); let stdout = ''; let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += String(chunk) }); child.stderr.on('data', (chunk) => { stderr += String(chunk) })
    child.on('error', reject); child.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(`Unable to inspect video: ${stderr.slice(-600)}`)))
  })
  const parsed = JSON.parse(output) as { format?: { duration?: string; size?: string; format_name?: string }; streams?: Array<Record<string, unknown>> }
  const duration = Number(parsed.format?.duration || 0)
  if (!Number.isFinite(duration) || duration <= 0 || duration > 14_400 || !parsed.streams?.some((stream) => stream.codec_type === 'video')) throw Object.assign(new Error('The media file is invalid or longer than four hours.'), { statusCode: 400 })
  return { duration, size: Number(parsed.format?.size || 0), format: parsed.format?.format_name || '', hasAudio: parsed.streams.some((stream) => stream.codec_type === 'audio'), streams: parsed.streams }
}

function colour(value: string) { return value.replace('#', '0x') }
function captionFilters(captions: MediaCaption[], instructions: MediaInstructions) {
  if (!instructions.captionsEnabled) return ''
  const cuts = normaliseMediaCuts(instructions.cuts, instructions.trimStart, instructions.trimEnd)
  return captions.flatMap((caption) => {
    const start = outputTimeForSource(Math.max(caption.start, instructions.trimStart), instructions.trimStart, cuts, instructions.playbackRate)
    const end = outputTimeForSource(Math.min(caption.end, instructions.trimEnd), instructions.trimStart, cuts, instructions.playbackRate)
    if (end <= start) return []
    const y = caption.position === 'top' ? 'h*0.08' : caption.position === 'middle' ? '(h-text_h)/2' : 'h-text_h-h*0.08'
    const text = escapeDrawText(instructions.captionStyle.uppercase ? caption.text.toUpperCase() : caption.text)
    return [`drawtext=fontfile=/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf:text='${text}':fontcolor=${colour(instructions.captionStyle.color)}:fontsize=${instructions.captionStyle.fontSize}:borderw=2:bordercolor=black@0.65:box=1:boxcolor=black@0.58:boxborderw=12:x=(w-text_w)/2:y=${y}:enable='between(t,${start.toFixed(3)},${end.toFixed(3)})'`]
  }).join(',')
}

async function renderBody(source: string, output: string, sourceHasAudio: boolean, instructions: MediaInstructions) {
  const segments = retainedSegments(instructions.trimStart, instructions.trimEnd, instructions.cuts)
  if (!segments.length) throw Object.assign(new Error('The trim and cuts remove the entire video.'), { statusCode: 400 })
  const graph: string[] = []
  segments.forEach((segment, index) => {
    graph.push(`[0:v]trim=start=${segment.start.toFixed(3)}:end=${segment.end.toFixed(3)},setpts=PTS-STARTPTS[v${index}]`)
    graph.push(sourceHasAudio
      ? `[0:a]atrim=start=${segment.start.toFixed(3)}:end=${segment.end.toFixed(3)},asetpts=PTS-STARTPTS[a${index}]`
      : `anullsrc=r=48000:cl=stereo,atrim=duration=${(segment.end - segment.start).toFixed(3)},asetpts=PTS-STARTPTS[a${index}]`)
  })
  graph.push(`${segments.map((_, index) => `[v${index}][a${index}]`).join('')}concat=n=${segments.length}:v=1:a=1[joinedv][joineda]`)
  const { width, height } = formatCanvas[instructions.format]
  const transforms = [`setpts=PTS/${instructions.playbackRate.toFixed(3)}`]
  if (instructions.transform.flipX) transforms.push('hflip')
  if (instructions.transform.flipY) transforms.push('vflip')
  if (Math.abs(instructions.transform.rotation) >= 0.01) transforms.push(`rotate=${(instructions.transform.rotation * Math.PI / 180).toFixed(6)}:ow=rotw(iw):oh=roth(ih):c=black@0`)
  transforms.push(`scale=${width}:${height}:force_original_aspect_ratio=${instructions.transform.fit === 'cover' ? 'increase' : 'decrease'}`)
  transforms.push(`scale=trunc(iw*${instructions.transform.scale.toFixed(4)}/2)*2:trunc(ih*${instructions.transform.scale.toFixed(4)}/2)*2`)
  graph.push(`[joinedv]${transforms.join(',')}[scaled]`)
  graph.push(`color=c=black:s=${width}x${height}:r=30[base]`)
  let finalFilters = `overlay=x='(W-w)/2+${(instructions.transform.x * width / 200).toFixed(2)}':y='(H-h)/2+${(instructions.transform.y * height / 200).toFixed(2)}':shortest=1`
  if (instructions.watermark) finalFilters += `,drawtext=fontfile=/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf:text='Online2Day':fontcolor=white@0.85:fontsize=${Math.max(18, Math.round(width / 54))}:x=24:y=24`
  const captions = captionFilters(instructions.captions, instructions)
  if (captions) finalFilters += `,${captions}`
  graph.push(`[base][scaled]${finalFilters},fps=30,format=yuv420p[finalv]`)
  graph.push(`[joineda]atempo=${instructions.playbackRate.toFixed(3)},volume=${instructions.volume.toFixed(3)},aresample=48000[finala]`)
  await command('ffmpeg', ['-hide_banner', '-nostdin', '-y', '-i', source, '-filter_complex', graph.join(';'), '-map', '[finalv]', '-map', '[finala]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-profile:v', 'high', '-level', '4.1', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', output])
}

async function normaliseIntro(source: string, output: string, metadata: Awaited<ReturnType<typeof probe>>, width: number, height: number) {
  const video = `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,fps=30,format=yuv420p[introv]`
  const audio = metadata.hasAudio ? '[0:a]aresample=48000,aformat=channel_layouts=stereo[introa]' : `anullsrc=r=48000:cl=stereo,atrim=duration=${metadata.duration.toFixed(3)}[introa]`
  await command('ffmpeg', ['-hide_banner', '-nostdin', '-y', '-i', source, '-filter_complex', `${video};${audio}`, '-map', '[introv]', '-map', '[introa]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-profile:v', 'high', '-level', '4.1', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', output])
}

function jsonMetadata(value: AssetRow['metadata']) {
  if (value && typeof value === 'object') return value
  try { return value ? JSON.parse(value) as Record<string, unknown> : {} } catch { return {} }
}

export function registerMediaRoutes(app: FastifyInstance, deps: MediaDeps) {
  const running = new Set<string>()

  async function patchJob(id: string, patch: Record<string, unknown>) {
    await deps.supabaseFetch(`media_processing_jobs?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) })
  }

  async function processJob(job: JobRow) {
    if (running.has(job.id)) return
    running.add(job.id); const folder = await mkdtemp(join(tmpdir(), 'o2d-media-'))
    try {
      await patchJob(job.id, { status: 'processing', progress: 5, started_at: new Date().toISOString(), attempts: 1 })
      const assets = await deps.supabaseFetch<AssetRow[]>(`lead_assets?id=eq.${encodeURIComponent(job.video_asset_id)}&type=eq.video&select=id,name,storage_path,metadata&limit=1`, { headers: { Accept: 'application/json' } })
      const asset = assets[0]; if (!asset?.storage_path) throw Object.assign(new Error('The source video file is missing.'), { statusCode: 404 })
      const metadata = jsonMetadata(asset.metadata); const sourcePath = typeof metadata.originalStoragePath === 'string' ? metadata.originalStoragePath : asset.storage_path
      const source = join(folder, 'source'); const body = join(folder, 'body.mp4'); const output = join(folder, 'final.mp4')
      await downloadObject(deps, 'lead-videos', sourcePath, source); const sourceInfo = await probe(source)
      if (job.instructions.trimEnd > sourceInfo.duration + 0.15) throw Object.assign(new Error('Trim end exceeds the source video duration.'), { statusCode: 400 })
      await patchJob(job.id, { progress: 20 })
      await renderBody(source, body, sourceInfo.hasAudio, job.instructions)
      let finalPath = body
      if (job.instructions.applyDefaultIntro) {
        const branding = await deps.supabaseFetch<BrandingRow[]>(`video_branding_profiles?owner_user_id=eq.${encodeURIComponent(job.owner_user_id)}&intro_enabled=eq.true&select=*&limit=1`, { headers: { Accept: 'application/json' } })
        if (branding[0]?.intro_storage_path) {
          const introSource = join(folder, 'intro-source'); const intro = join(folder, 'intro.mp4')
          await downloadObject(deps, 'video-branding', branding[0].intro_storage_path, introSource)
          await normaliseIntro(introSource, intro, await probe(introSource), formatCanvas[job.instructions.format].width, formatCanvas[job.instructions.format].height)
          const list = join(folder, 'concat.txt'); await writeFile(list, `file '${intro.replaceAll("'", "'\\''")}'\nfile '${body.replaceAll("'", "'\\''")}'\n`)
          await command('ffmpeg', ['-hide_banner', '-nostdin', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', output])
          finalPath = output
        }
      }
      await patchJob(job.id, { progress: 88 })
      const outputPath = `${job.owner_user_id}/processed/${job.id}.mp4`; await uploadObject(deps, 'lead-videos', outputPath, finalPath, 'video/mp4')
      const details = await stat(finalPath); const completedAt = new Date().toISOString()
      await deps.supabaseFetch(`lead_assets?id=eq.${encodeURIComponent(asset.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ storage_path: outputPath, metadata: { ...metadata, originalStoragePath: sourcePath, processedStoragePath: outputPath, processedJobId: job.id, processedAt: completedAt, processingInstructions: job.instructions } }) })
      if (asset.storage_path !== sourcePath && asset.storage_path !== outputPath && asset.storage_path.includes('/processed/')) await storageFetch(deps, 'lead-videos', asset.storage_path, { method: 'DELETE' }).catch(() => undefined)
      await patchJob(job.id, { status: 'completed', progress: 100, output_storage_path: outputPath, output_mime_type: 'video/mp4', output_size_bytes: details.size, completed_at: completedAt, error_code: null, error_message: null })
      app.log.info({ mediaJobId: job.id, videoAssetId: asset.id, outputSizeBytes: details.size }, 'Video processing completed')
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1_000) : 'Video processing failed.'
      await patchJob(job.id, { status: 'failed', error_code: 'PROCESSING_FAILED', error_message: message, completed_at: new Date().toISOString() }).catch(() => undefined)
      app.log.error({ err: error, mediaJobId: job.id, videoAssetId: job.video_asset_id }, 'Video processing failed')
    } finally { running.delete(job.id); await rm(folder, { recursive: true, force: true }) }
  }

  async function resumeQueued() {
    const jobs = await deps.supabaseFetch<JobRow[]>('media_processing_jobs?status=eq.queued&select=id,owner_user_id,video_asset_id,status,instructions&order=created_at.asc&limit=2', { headers: { Accept: 'application/json' } }).catch(() => [])
    for (const job of jobs) void processJob(job)
  }
  const timer = setInterval(() => void resumeQueued(), 30_000); timer.unref(); void resumeQueued()

  app.get('/api/v1/online2day/video-branding', { preHandler: deps.requireAdmin }, async (request) => {
    const user = await deps.requireAdmin(request); const rows = await deps.supabaseFetch<BrandingRow[]>(`video_branding_profiles?owner_user_id=eq.${encodeURIComponent(String(user.sub))}&select=*&limit=1`, { headers: { Accept: 'application/json' } })
    const profile = rows[0]; if (!profile) return { introEnabled: false, intro: null }
    let previewUrl: string | null = null
    if (profile.intro_storage_path) { const signed = await deps.supabaseStorageFetch<{ signedURL?: string; signedUrl?: string }>(`object/sign/video-branding/${encodeStoragePath(profile.intro_storage_path)}`, { method: 'POST', body: JSON.stringify({ expiresIn: 900 }) }); const path = signed.signedURL || signed.signedUrl; previewUrl = path ? `${deps.config.supabaseUrl}/storage/v1${path}` : null }
    return { introEnabled: profile.intro_enabled, intro: profile.intro_storage_path ? { filename: profile.intro_filename, mimeType: profile.intro_mime_type, sizeBytes: profile.intro_size_bytes, durationSeconds: profile.intro_duration_seconds, metadata: profile.intro_metadata, previewUrl } : null }
  })

  app.post('/api/v1/online2day/video-branding/intro/uploads', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const user = await deps.requireAdmin(request); const body = introUploadSchema.parse(request.body); const safe = body.filename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '').slice(-160) || 'intro'; const storagePath = `${String(user.sub)}/intro/${crypto.randomUUID()}-${safe}`
    const signed = await deps.supabaseStorageFetch<{ url: string }>(`object/upload/sign/video-branding/${encodeStoragePath(storagePath)}`, { method: 'POST', body: '{}' })
    return reply.code(201).send({ storagePath, uploadUrl: new URL(signed.url, `${deps.config.supabaseUrl}/storage/v1/`).toString(), expiresIn: 7_200 })
  })

  app.put('/api/v1/online2day/video-branding/intro', { preHandler: deps.requireAdmin }, async (request) => {
    const user = await deps.requireAdmin(request); const ownerId = String(user.sub); const body = introSaveSchema.parse(request.body)
    if (!body.storagePath.startsWith(`${ownerId}/intro/`)) throw Object.assign(new Error('Intro path is not authorised.'), { statusCode: 403 })
    const folder = await mkdtemp(join(tmpdir(), 'o2d-intro-'))
    try {
      const local = join(folder, 'intro'); await downloadObject(deps, 'video-branding', body.storagePath, local); const details = await stat(local)
      if (details.size !== body.sizeBytes || details.size > 250 * 1024 * 1024) throw Object.assign(new Error('Uploaded intro size does not match the declared file.'), { statusCode: 400 })
      const inspected = await probe(local)
      const existing = await deps.supabaseFetch<BrandingRow[]>(`video_branding_profiles?owner_user_id=eq.${encodeURIComponent(ownerId)}&select=*&limit=1`, { headers: { Accept: 'application/json' } })
      await deps.supabaseFetch('video_branding_profiles?on_conflict=owner_user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ owner_user_id: ownerId, intro_enabled: body.enabled, intro_storage_path: body.storagePath, intro_filename: body.filename, intro_mime_type: body.mimeType, intro_size_bytes: details.size, intro_duration_seconds: inspected.duration, intro_metadata: inspected }) })
      const previous = existing[0]?.intro_storage_path
      if (previous && previous !== body.storagePath) await storageFetch(deps, 'video-branding', previous, { method: 'DELETE' }).catch(() => undefined)
      request.log.info({ ownerId, durationSeconds: inspected.duration, sizeBytes: details.size }, 'Default video intro configured')
      return { introEnabled: body.enabled, intro: { filename: body.filename, mimeType: body.mimeType, sizeBytes: details.size, durationSeconds: inspected.duration, metadata: inspected } }
    } finally { await rm(folder, { recursive: true, force: true }) }
  })

  app.patch('/api/v1/online2day/video-branding/intro', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const user = await deps.requireAdmin(request); const body = z.object({ enabled: z.boolean() }).parse(request.body)
    const rows = await deps.supabaseFetch<Array<{ id: string; intro_storage_path: string | null }>>(`video_branding_profiles?owner_user_id=eq.${encodeURIComponent(String(user.sub))}&select=id,intro_storage_path&limit=1`, { headers: { Accept: 'application/json' } })
    if (!rows[0]?.intro_storage_path && body.enabled) return reply.code(400).send({ error: 'Upload an intro before enabling it.' })
    if (!rows[0]) await deps.supabaseFetch('video_branding_profiles', { method: 'POST', body: JSON.stringify({ owner_user_id: String(user.sub), intro_enabled: false }) })
    else await deps.supabaseFetch(`video_branding_profiles?id=eq.${rows[0].id}`, { method: 'PATCH', body: JSON.stringify({ intro_enabled: body.enabled }) })
    return { introEnabled: body.enabled }
  })

  app.delete('/api/v1/online2day/video-branding/intro', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const user = await deps.requireAdmin(request); const rows = await deps.supabaseFetch<BrandingRow[]>(`video_branding_profiles?owner_user_id=eq.${encodeURIComponent(String(user.sub))}&select=*&limit=1`, { headers: { Accept: 'application/json' } })
    if (rows[0]) await deps.supabaseFetch(`video_branding_profiles?owner_user_id=eq.${encodeURIComponent(String(user.sub))}`, { method: 'PATCH', body: JSON.stringify({ intro_enabled: false, intro_storage_path: null, intro_filename: null, intro_mime_type: null, intro_size_bytes: null, intro_duration_seconds: null, intro_metadata: {} }) })
    if (rows[0]?.intro_storage_path) await storageFetch(deps, 'video-branding', rows[0].intro_storage_path, { method: 'DELETE' }).catch((error) => request.log.warn({ err: error }, 'Intro file cleanup failed'))
    return reply.code(204).send()
  })

  app.post('/api/v1/online2day/video-assets/:id/process', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const user = await deps.requireAdmin(request); const params = z.object({ id: z.string().uuid() }).parse(request.params); const instructions = processingSchema.parse(request.body)
    const assets = await deps.supabaseFetch<AssetRow[]>(`lead_assets?id=eq.${params.id}&type=eq.video&select=id,name,storage_path,metadata&limit=1`, { headers: { Accept: 'application/json' } })
    if (!assets[0]?.storage_path) return reply.code(404).send({ error: 'Video source file not found.' })
    const existing = await deps.supabaseFetch<JobRow[]>(`media_processing_jobs?video_asset_id=eq.${params.id}&status=in.(queued,processing)&select=id,owner_user_id,video_asset_id,status,instructions&limit=1`, { headers: { Accept: 'application/json' } })
    if (existing[0]) return reply.code(202).send(existing[0])
    const jobs = await deps.supabaseFetch<JobRow[]>('media_processing_jobs?select=id,owner_user_id,video_asset_id,status,instructions', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ owner_user_id: String(user.sub), video_asset_id: params.id, operation: instructions.applyDefaultIntro ? 'compose' : 'render', status: 'queued', instructions }) })
    const job = jobs[0]; if (!job) throw new Error('Video processing job could not be created.')
    request.log.info({ mediaJobId: job.id, videoAssetId: params.id, withIntro: instructions.applyDefaultIntro }, 'Video processing queued'); void processJob(job)
    return reply.code(202).send(job)
  })

  app.get('/api/v1/online2day/media-jobs/:id', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const user = await deps.requireAdmin(request); const params = z.object({ id: z.string().uuid() }).parse(request.params)
    const jobs = await deps.supabaseFetch<Array<Record<string, unknown>>>(`media_processing_jobs?id=eq.${params.id}&owner_user_id=eq.${encodeURIComponent(String(user.sub))}&select=id,video_asset_id,operation,status,progress,error_code,error_message,output_storage_path,output_mime_type,output_size_bytes,started_at,completed_at,created_at&limit=1`, { headers: { Accept: 'application/json' } })
    if (!jobs[0]) return reply.code(404).send({ error: 'Media job not found.' })
    return jobs[0]
  })
}
