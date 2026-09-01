'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown, ArrowLeft, ArrowUp, Check, CircleStop, Copy, Film, Loader2,
  Mail, Mic, Pause, Play, Plus, RotateCcw, Save, Scissors, Send, Trash2,
  Upload, Video, X,
} from 'lucide-react'
import { DashboardSidebar } from '@/components/leads/DashboardSidebar'
import type { CrmSetupConfig, EmailComposerLead, EmailComposerVideo } from '@/components/crm-dashboard/types'
import { sendEnterpriseEmail } from '@/lib/actions/email-actions'
import { getVideoPlaybackUrl, registerUploadedVideo, saveVideoEditorProject } from '@/lib/actions/video-actions'
import { safeVideoObjectName, uploadVideoResumable } from '@/lib/video/resumable-upload'
import styles from './video-editor.module.css'

type Scene = {
  id: string
  name: string
  duration: number
  layout: 'intro' | 'proof' | 'demo' | 'offer' | 'cta'
  headline: string
  note: string
  color: string
}

type Draft = {
  title: string
  leadId: string
  scenes: Scene[]
  format: '16:9' | '9:16' | '1:1' | '4:5' | '21:9'
  brandColor: string
  accentColor: string
  watermark: boolean
  captions: boolean
  ctaLabel: string
  ctaUrl: string
  emailTo: string
  emailSubject: string
  emailBody: string
  trimStart: number
  trimEnd: number
}

const formats: Draft['format'][] = ['16:9', '9:16', '1:1', '4:5', '21:9']
const allowedTypes = new Set(['video/mp4', 'video/quicktime', 'video/webm'])
const maxSize = 2 * 1024 * 1024 * 1024
const starterScenes: Scene[] = [
  { id: 'intro', name: 'Personal intro', duration: 6, layout: 'intro', headline: 'A focused idea for your next website win', note: 'Open with the lead context and one clear promise.', color: '#2f6bff' },
  { id: 'proof', name: 'Proof point', duration: 8, layout: 'proof', headline: 'Fast delivery. Clean systems. Measurable conversion.', note: 'Show the evidence that supports your recommendation.', color: '#16b8a6' },
  { id: 'walkthrough', name: 'Walkthrough', duration: 14, layout: 'demo', headline: 'What we would improve first', note: 'Use the source video to demonstrate the opportunity.', color: '#8b5cf6' },
  { id: 'cta', name: 'Next step', duration: 6, layout: 'cta', headline: 'Worth a 20 minute call?', note: 'End with one action.', color: '#f59e0b' },
]

const uid = () => globalThis.crypto?.randomUUID?.() || `scene-${Date.now()}-${Math.random().toString(36).slice(2)}`
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const asObject = (value: unknown): Record<string, any> => value && typeof value === 'object' ? value as Record<string, any> : {}
const seconds = (value: number) => `${Math.floor(value / 60).toString().padStart(2, '0')}:${Math.floor(value % 60).toString().padStart(2, '0')}`

function projectFromVideo(video: EmailComposerVideo | undefined): Partial<Draft> {
  const metadata = asObject(video?.metadata)
  const brand = asObject(metadata.brand)
  const cta = asObject(metadata.cta)
  const email = asObject(metadata.email)
  const settings = asObject(metadata.settings)
  return {
    title: video?.name,
    leadId: video?.leadId || undefined,
    scenes: Array.isArray(metadata.scenes) && metadata.scenes.length ? metadata.scenes : undefined,
    format: formats.includes(metadata.format) ? metadata.format : undefined,
    brandColor: typeof brand.primary === 'string' ? brand.primary : undefined,
    accentColor: typeof brand.accent === 'string' ? brand.accent : undefined,
    watermark: typeof brand.watermark === 'boolean' ? brand.watermark : undefined,
    captions: typeof settings.captions === 'boolean' ? settings.captions : undefined,
    ctaLabel: typeof cta.label === 'string' ? cta.label : undefined,
    ctaUrl: typeof cta.destination === 'string' ? cta.destination : undefined,
    emailSubject: typeof email.subject === 'string' ? email.subject : undefined,
    emailBody: typeof email.body === 'string' ? email.body : undefined,
    trimStart: Number.isFinite(settings.trimStart) ? settings.trimStart : undefined,
    trimEnd: Number.isFinite(settings.trimEnd) ? settings.trimEnd : undefined,
  }
}

export function VideoEditorClient({ leads, videos, setupConfig }: {
  leads: EmailComposerLead[]
  videos: EmailComposerVideo[]
  setupConfig: CrmSetupConfig
}) {
  const searchParams = useSearchParams()
  const requestedAsset = searchParams.get('asset') || ''
  const initialVideo = videos.find((video) => video.id === requestedAsset)
  const initial = projectFromVideo(initialVideo)
  const defaultLead = leads.find((lead) => lead.id === initial.leadId) || leads[0]
  const [title, setTitle] = useState(initial.title || 'Personalised website growth video')
  const [leadId, setLeadId] = useState(initial.leadId || defaultLead?.id || '')
  const [scenes, setScenes] = useState<Scene[]>(initial.scenes || starterScenes)
  const [selectedSceneId, setSelectedSceneId] = useState((initial.scenes || starterScenes)[0]?.id || '')
  const [format, setFormat] = useState<Draft['format']>(initial.format || '16:9')
  const [brandColor, setBrandColor] = useState(initial.brandColor || '#2f6bff')
  const [accentColor, setAccentColor] = useState(initial.accentColor || '#17d7c1')
  const [watermark, setWatermark] = useState(initial.watermark ?? true)
  const [captions, setCaptions] = useState(initial.captions ?? true)
  const [ctaLabel, setCtaLabel] = useState(initial.ctaLabel || setupConfig.defaultCtaLabel)
  const [ctaUrl, setCtaUrl] = useState(initial.ctaUrl || setupConfig.defaultCtaUrl)
  const [emailTo, setEmailTo] = useState(defaultLead?.email || '')
  const [emailSubject, setEmailSubject] = useState(initial.emailSubject || `A short personalised video from ${setupConfig.companyName}`)
  const [emailBody, setEmailBody] = useState(initial.emailBody || 'I made a short video with a practical first pass on your next growth opportunity.\n\nIt includes the key opportunity, a proof point and one clear next step.')
  const [assetId, setAssetId] = useState(initialVideo?.id || '')
  const [assetSlug, setAssetSlug] = useState(initialVideo?.slug || '')
  const [storagePath, setStoragePath] = useState(initialVideo?.storagePath || '')
  const [sourceUrl, setSourceUrl] = useState(initialVideo?.previewUrl || '')
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [sourceDuration, setSourceDuration] = useState(Number(asObject(initialVideo?.metadata).duration || 0))
  const [trimStart, setTrimStart] = useState(initial.trimStart || 0)
  const [trimEnd, setTrimEnd] = useState(initial.trimEnd || 0)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [busy, setBusy] = useState<'save' | 'send' | 'record' | ''>('')
  const [message, setMessage] = useState<{ kind: 'ok' | 'error' | 'info'; text: string } | null>(null)
  const [dirty, setDirty] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const uploadAbortRef = useRef<AbortController | null>(null)
  const previewObjectUrlRef = useRef('')
  const initializedRef = useRef(false)

  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) || scenes[0]
  const projectDuration = useMemo(() => scenes.reduce((total, scene) => total + scene.duration, 0), [scenes])
  const activeLead = leads.find((lead) => lead.id === leadId)
  const shareUrl = assetSlug && typeof window !== 'undefined' ? `${window.location.origin}/v/${assetSlug}` : ''
  const aspect = format.replace(':', ' / ')
  const draft = useMemo<Draft>(() => ({
    title, leadId, scenes, format, brandColor, accentColor, watermark, captions,
    ctaLabel, ctaUrl, emailTo, emailSubject, emailBody, trimStart, trimEnd,
  }), [title, leadId, scenes, format, brandColor, accentColor, watermark, captions, ctaLabel, ctaUrl, emailTo, emailSubject, emailBody, trimStart, trimEnd])

  useEffect(() => {
    if (!requestedAsset || initialVideo?.previewUrl || !initialVideo?.storagePath) return
    void getVideoPlaybackUrl(requestedAsset).then((result) => {
      if ('url' in result && result.url) setSourceUrl(result.url)
    })
  }, [initialVideo, requestedAsset])

  useEffect(() => {
    if (!initializedRef.current) { initializedRef.current = true; return }
    setDirty(true)
    const timer = window.setTimeout(() => localStorage.setItem('o2d-video-studio-draft-v2', JSON.stringify(draft)), 500)
    return () => window.clearTimeout(timer)
  }, [draft])

  useEffect(() => () => {
    if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    uploadAbortRef.current?.abort()
  }, [])

  function applyDraft(next: Partial<Draft>) {
    if (next.title) setTitle(next.title)
    if (next.leadId && leads.some((lead) => lead.id === next.leadId)) setLeadId(next.leadId)
    if (next.scenes?.length) { setScenes(next.scenes); setSelectedSceneId(next.scenes[0].id) }
    if (next.format) setFormat(next.format)
    if (next.brandColor) setBrandColor(next.brandColor)
    if (next.accentColor) setAccentColor(next.accentColor)
    if (typeof next.watermark === 'boolean') setWatermark(next.watermark)
    if (typeof next.captions === 'boolean') setCaptions(next.captions)
    if (next.ctaLabel) setCtaLabel(next.ctaLabel)
    if (next.ctaUrl) setCtaUrl(next.ctaUrl)
    if (next.emailTo) setEmailTo(next.emailTo)
    if (next.emailSubject) setEmailSubject(next.emailSubject)
    if (next.emailBody) setEmailBody(next.emailBody)
    if (typeof next.trimStart === 'number') setTrimStart(next.trimStart)
    if (typeof next.trimEnd === 'number') setTrimEnd(next.trimEnd)
  }

  function restoreLocalDraft() {
    try {
      const value = localStorage.getItem('o2d-video-studio-draft-v2')
      if (!value) return setMessage({ kind: 'info', text: 'There is no local draft to restore.' })
      applyDraft(JSON.parse(value))
      setMessage({ kind: 'ok', text: 'Local draft restored.' })
    } catch { setMessage({ kind: 'error', text: 'The local draft could not be restored.' }) }
  }

  const inspectFile = useCallback((file: File) => {
    if (!allowedTypes.has(file.type)) return setMessage({ kind: 'error', text: 'Choose an MP4, MOV or WebM video.' })
    if (file.size > maxSize) return setMessage({ kind: 'error', text: 'Videos must be 2 GB or smaller.' })
    if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current)
    const url = URL.createObjectURL(file)
    previewObjectUrlRef.current = url
    setSourceFile(file); setSourceUrl(url); setStoragePath(''); setUploadProgress(0); setDirty(true)
    setMessage({ kind: 'info', text: `${file.name} is staged. Save to upload it.` })
  }, [])

  function onMetadata() {
    const duration = videoRef.current?.duration || 0
    if (!Number.isFinite(duration)) return
    setSourceDuration(duration)
    setTrimEnd((current) => current > 0 ? Math.min(current, duration) : duration)
  }

  function togglePlayback() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) { video.currentTime = clamp(video.currentTime, trimStart, trimEnd || sourceDuration); void video.play() }
    else video.pause()
  }

  function onTimeUpdate() {
    const video = videoRef.current
    if (!video) return
    const end = trimEnd || sourceDuration
    if (end && video.currentTime >= end) { video.pause(); video.currentTime = trimStart }
    setCurrentTime(video.currentTime)
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) return setMessage({ kind: 'error', text: 'Camera recording is not supported in this browser.' })
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      const preferred = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(MediaRecorder.isTypeSupported)
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined)
      chunksRef.current = []; streamRef.current = stream; recorderRef.current = recorder
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.muted = true; void videoRef.current.play() }
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' })
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: blob.type })
        stream.getTracks().forEach((track) => track.stop()); streamRef.current = null
        if (videoRef.current) videoRef.current.srcObject = null
        inspectFile(file); setBusy('')
      }
      recorder.start(1_000); setBusy('record'); setMessage({ kind: 'info', text: 'Recording camera and microphone…' })
    } catch (error) {
      setBusy(''); setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Camera permission was not granted.' })
    }
  }

  function stopRecording() { if (recorderRef.current?.state === 'recording') recorderRef.current.stop() }
  function updateScene(patch: Partial<Scene>) { setScenes((current) => current.map((scene) => scene.id === selectedScene?.id ? { ...scene, ...patch } : scene)) }
  function addScene() {
    const scene: Scene = { id: uid(), name: 'New scene', duration: 6, layout: 'offer', headline: 'Add a clear message', note: '', color: accentColor }
    setScenes((current) => [...current, scene]); setSelectedSceneId(scene.id)
  }
  function duplicateScene() {
    if (!selectedScene) return
    const scene = { ...selectedScene, id: uid(), name: `${selectedScene.name} copy` }
    setScenes((current) => [...current, scene]); setSelectedSceneId(scene.id)
  }
  function removeScene() {
    if (!selectedScene || scenes.length === 1) return
    const index = scenes.findIndex((scene) => scene.id === selectedScene.id)
    const next = scenes.filter((scene) => scene.id !== selectedScene.id)
    setScenes(next); setSelectedSceneId(next[Math.min(index, next.length - 1)].id)
  }
  function moveScene(direction: -1 | 1) {
    const index = scenes.findIndex((scene) => scene.id === selectedScene?.id); const target = index + direction
    if (index < 0 || target < 0 || target >= scenes.length) return
    setScenes((current) => { const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next })
  }

  async function persist() {
    if (!leadId) { setMessage({ kind: 'error', text: 'Choose a CRM lead before saving.' }); return null }
    if (!title.trim()) { setMessage({ kind: 'error', text: 'Enter a project title.' }); return null }
    try { new URL(ctaUrl) } catch { setMessage({ kind: 'error', text: 'Enter a complete CTA URL, including https://.' }); return null }
    setBusy('save'); setMessage({ kind: 'info', text: sourceFile ? 'Uploading the source video…' : 'Saving project…' })
    try {
      let currentAssetId = assetId; let currentSlug = assetSlug; let currentStoragePath = storagePath
      if (sourceFile) {
        const slug = currentSlug || `${leadId.slice(0, 8)}-${Date.now()}`
        const path = `${leadId}/${slug}-${safeVideoObjectName(sourceFile.name)}`
        const controller = new AbortController(); uploadAbortRef.current = controller
        await uploadVideoResumable({ file: sourceFile, objectPath: path, onProgress: setUploadProgress, signal: controller.signal })
        const registered = await registerUploadedVideo({ assetId: currentAssetId || undefined, leadId, name: title.trim(), storagePath: path, slug, contentType: sourceFile.type, size: sourceFile.size, duration: sourceDuration })
        if ('error' in registered && registered.error) throw new Error(registered.error)
        if (!registered.asset) throw new Error('The uploaded video could not be registered.')
        currentAssetId = registered.asset.id; currentSlug = registered.asset.slug || slug; currentStoragePath = registered.asset.storage_path || path
        setAssetId(currentAssetId); setAssetSlug(currentSlug); setStoragePath(currentStoragePath); setSourceFile(null)
      }
      const duration = Math.max(1, trimEnd > trimStart ? trimEnd - trimStart : sourceDuration || projectDuration)
      const timeline = scenes.map((scene, index) => ({ id: `scene-track-${scene.id}`, label: scene.name, track: 'video' as const, start: scenes.slice(0, index).reduce((sum, item) => sum + item.duration, 0), duration: scene.duration }))
      const result = await saveVideoEditorProject({
        title: title.trim(), leadId, sourceAssetId: currentAssetId, sourceSlug: currentSlug, duration, format, scenes, timeline,
        brand: { primary: brandColor, accent: accentColor, watermark, logoPlacement: 'top-left' }, cta: { label: ctaLabel, destination: ctaUrl }, email: { subject: emailSubject, body: emailBody },
        recording: currentStoragePath ? { storagePath: currentStoragePath, duration: sourceDuration } : null,
        settings: { captions, trimStart, trimEnd: trimEnd || sourceDuration, nonDestructive: true },
      })
      if ('error' in result && result.error) throw new Error(result.error)
      if (!result.assetId) throw new Error('The API did not return the saved project.')
      setAssetId(result.assetId); setAssetSlug(result.slug || currentSlug); setDirty(false); localStorage.removeItem('o2d-video-studio-draft-v2')
      setMessage({ kind: 'ok', text: 'Project saved to the video library.' })
      return { assetId: result.assetId, slug: result.slug || currentSlug }
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'The project could not be saved.' }); return null
    } finally { setBusy(''); uploadAbortRef.current = null }
  }

  async function sendEmail() {
    if (!/^\S+@\S+\.\S+$/.test(emailTo)) return setMessage({ kind: 'error', text: 'Enter a valid recipient email.' })
    setBusy('send')
    const saved = dirty || !assetId ? await persist() : { assetId, slug: assetSlug }
    if (!saved) { setBusy(''); return }
    setBusy('send')
    const result = await sendEnterpriseEmail({ leadId, to: emailTo, recipientName: activeLead?.name, subject: emailSubject, body: emailBody, videoAssetId: saved.assetId, videoSlug: saved.slug, ctaLabel })
    setBusy(''); setMessage(result.error ? { kind: 'error', text: result.error } : { kind: 'ok', text: 'Email sent and logged against the lead.' })
  }

  return <div className={styles.shell}>
    <DashboardSidebar active="videos" />
    <main className={styles.main}>
      <header className={styles.header}><div><Link href="/dashboard/videos" className={styles.backLink}><ArrowLeft size={15} /> Video library</Link><div className={styles.eyebrow}>VIDEO STUDIO</div><h1>Build a personalised video</h1><p>Import or record once, then shape the story, brand, CTA and email handoff without altering the source file.</p></div><div className={styles.headerActions}><button type="button" onClick={restoreLocalDraft}><RotateCcw size={16} /> Restore local</button>{shareUrl ? <a href={shareUrl} target="_blank" rel="noreferrer">Preview page</a> : null}<button type="button" className={styles.primary} disabled={Boolean(busy)} onClick={() => void persist()}>{busy === 'save' ? <Loader2 className={styles.spin} size={16} /> : <Save size={16} />} {dirty ? 'Save changes' : 'Saved'}</button></div></header>
      {message ? <div role="status" className={`${styles.notice} ${styles[message.kind]}`}><span>{message.text}</span><button aria-label="Dismiss message" onClick={() => setMessage(null)}><X size={15} /></button></div> : null}
      <section className={styles.setupBar}><label><span>Project title</span><input value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} /></label><label><span>CRM lead</span><select value={leadId} onChange={(event) => { const id = event.target.value; const lead = leads.find((item) => item.id === id); setLeadId(id); if (lead?.email) setEmailTo(lead.email) }}><option value="">Choose a lead</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name} · {lead.company}</option>)}</select></label><label><span>Canvas</span><select value={format} onChange={(event) => setFormat(event.target.value as Draft['format'])}>{formats.map((item) => <option key={item}>{item}</option>)}</select></label><div className={styles.savedState}><span>{assetId ? 'Library project' : 'Unsaved project'}</span><strong>{dirty ? 'Changes pending' : 'Up to date'}</strong></div></section>
      <div className={styles.workspace}>
        <section className={styles.mediaPanel}><div className={styles.panelHeading}><div><span>01 · SOURCE</span><h2>Video preview</h2></div><strong>{sourceDuration ? seconds(sourceDuration) : 'No media'}</strong></div><div className={styles.stage} style={{ aspectRatio: aspect }}>{sourceUrl ? <video ref={videoRef} src={sourceUrl} playsInline onLoadedMetadata={onMetadata} onTimeUpdate={onTimeUpdate} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} /> : <button className={styles.emptyStage} onClick={() => fileInputRef.current?.click()}><Film size={34} /><strong>Import your source video</strong><span>MP4, MOV or WebM · up to 2 GB</span></button>}{sourceUrl ? <div className={styles.videoOverlay} style={{ borderColor: brandColor }}><span>{activeLead?.company || 'Personalised video'}</span>{watermark ? <b>Online2Day</b> : null}</div> : null}{sourceUrl && captions && selectedScene ? <p className={styles.caption}>{selectedScene.headline}</p> : null}</div>
          <input ref={fileInputRef} hidden type="file" accept="video/mp4,video/quicktime,video/webm" onChange={(event) => { const file = event.target.files?.[0]; if (file) inspectFile(file); event.target.value = '' }} />
          <div className={styles.transport}><button disabled={!sourceUrl} onClick={togglePlayback} aria-label={playing ? 'Pause video' : 'Play video'}>{playing ? <Pause size={18} /> : <Play size={18} />}</button><span>{seconds(currentTime)} / {seconds(sourceDuration)}</span><input aria-label="Video position" disabled={!sourceDuration} type="range" min={0} max={sourceDuration || 1} step="0.05" value={currentTime} onChange={(event) => { const value = Number(event.target.value); setCurrentTime(value); if (videoRef.current) videoRef.current.currentTime = value }} /></div>
          <div className={styles.mediaActions}><button onClick={() => fileInputRef.current?.click()}><Upload size={16} /> Import video</button>{busy === 'record' ? <button className={styles.danger} onClick={stopRecording}><CircleStop size={16} /> Stop recording</button> : <button disabled={Boolean(busy)} onClick={() => void startRecording()}><Video size={16} /><Mic size={14} /> Record</button>}{sourceFile ? <span>{sourceFile.name} · {(sourceFile.size / 1024 / 1024).toFixed(1)} MB</span> : storagePath ? <span><Check size={14} /> Stored securely</span> : null}</div>
          {busy === 'save' && sourceFile ? <div className={styles.progress}><div style={{ width: `${uploadProgress}%` }} /><span>{uploadProgress}% uploaded</span><button onClick={() => uploadAbortRef.current?.abort()}>Cancel</button></div> : null}
          <div className={styles.trimBox}><div><Scissors size={16} /><strong>Playback range</strong><span>Non-destructive</span></div><label><span>Start · {seconds(trimStart)}</span><input disabled={!sourceDuration} type="range" min={0} max={Math.max(0, (trimEnd || sourceDuration) - 0.1)} step="0.1" value={trimStart} onChange={(event) => setTrimStart(Number(event.target.value))} /></label><label><span>End · {seconds(trimEnd || sourceDuration)}</span><input disabled={!sourceDuration} type="range" min={Math.min(sourceDuration, trimStart + 0.1)} max={sourceDuration || 1} step="0.1" value={trimEnd || sourceDuration} onChange={(event) => setTrimEnd(Number(event.target.value))} /></label></div>
        </section>
        <aside className={styles.inspector}><div className={styles.panelHeading}><div><span>02 · SCENE</span><h2>Selected scene</h2></div><span>{scenes.length} scenes</span></div>{selectedScene ? <div className={styles.fields}><label><span>Scene name</span><input value={selectedScene.name} maxLength={120} onChange={(event) => updateScene({ name: event.target.value })} /></label><label><span>Headline / caption</span><textarea value={selectedScene.headline} maxLength={240} rows={3} onChange={(event) => updateScene({ headline: event.target.value })} /></label><label><span>Production note</span><textarea value={selectedScene.note} maxLength={2000} rows={3} onChange={(event) => updateScene({ note: event.target.value })} /></label><div className={styles.fieldRow}><label><span>Duration</span><input type="number" min={1} max={900} value={selectedScene.duration} onChange={(event) => updateScene({ duration: clamp(Number(event.target.value) || 1, 1, 900) })} /></label><label><span>Scene colour</span><input type="color" value={selectedScene.color} onChange={(event) => updateScene({ color: event.target.value })} /></label></div><div className={styles.iconActions}><button title="Move earlier" onClick={() => moveScene(-1)}><ArrowUp size={16} /></button><button title="Move later" onClick={() => moveScene(1)}><ArrowDown size={16} /></button><button title="Duplicate scene" onClick={duplicateScene}><Copy size={16} /></button><button title="Delete scene" disabled={scenes.length === 1} onClick={removeScene}><Trash2 size={16} /></button></div></div> : null}<div className={styles.divider} /><div className={styles.panelHeading}><div><span>03 · BRAND</span><h2>Presentation</h2></div></div><div className={styles.fields}><div className={styles.fieldRow}><label><span>Primary</span><input type="color" value={brandColor} onChange={(event) => setBrandColor(event.target.value)} /></label><label><span>Accent</span><input type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} /></label></div><label className={styles.toggle}><input type="checkbox" checked={captions} onChange={(event) => setCaptions(event.target.checked)} /><span>Show headline captions</span></label><label className={styles.toggle}><input type="checkbox" checked={watermark} onChange={(event) => setWatermark(event.target.checked)} /><span>Show Online2Day watermark</span></label><label><span>CTA label</span><input value={ctaLabel} maxLength={100} onChange={(event) => setCtaLabel(event.target.value)} /></label><label><span>CTA destination</span><input type="url" value={ctaUrl} maxLength={2000} onChange={(event) => setCtaUrl(event.target.value)} /></label></div></aside>
      </div>
      <section className={styles.timelinePanel}><div className={styles.panelHeading}><div><span>04 · STORY</span><h2>Scene timeline</h2></div><button onClick={addScene}><Plus size={15} /> Add scene</button></div><div className={styles.timeline} style={{ gridTemplateColumns: scenes.map((scene) => `${Math.max(scene.duration, 3)}fr`).join(' ') }}>{scenes.map((scene, index) => <button key={scene.id} className={scene.id === selectedSceneId ? styles.sceneActive : ''} style={{ borderTopColor: scene.color }} onClick={() => setSelectedSceneId(scene.id)}><span>{String(index + 1).padStart(2, '0')}</span><strong>{scene.name}</strong><em>{scene.duration}s</em></button>)}</div><div className={styles.timelineSummary}><span>{scenes.length} scenes</span><span>{seconds(projectDuration)} planned story</span>{sourceDuration ? <span>{seconds(Math.max(0, (trimEnd || sourceDuration) - trimStart))} source range</span> : null}</div></section>
      <section className={styles.emailPanel}><div className={styles.panelHeading}><div><span>05 · HANDOFF</span><h2>Email the saved video</h2></div><Mail size={20} /></div><div className={styles.emailGrid}><div className={styles.fields}><label><span>Recipient</span><input type="email" value={emailTo} onChange={(event) => setEmailTo(event.target.value)} /></label><label><span>Subject</span><input value={emailSubject} maxLength={240} onChange={(event) => setEmailSubject(event.target.value)} /></label><label><span>Message</span><textarea rows={6} value={emailBody} maxLength={10000} onChange={(event) => setEmailBody(event.target.value)} /></label></div><div className={styles.emailPreview}><span>PERSONALISED VIDEO</span><strong>{title || 'Untitled video'}</strong><p>{emailBody.split('\n')[0]}</p><div style={{ background: brandColor }}>{ctaLabel || 'Watch video'}</div><small>{shareUrl || 'The secure share link is created when you save.'}</small></div></div><div className={styles.handoffActions}><span>Sending uses the configured Resend account and logs the activity against the CRM lead.</span><button className={styles.primary} disabled={Boolean(busy)} onClick={() => void sendEmail()}>{busy === 'send' ? <Loader2 className={styles.spin} size={16} /> : <Send size={16} />} Save and send</button></div></section>
    </main>
  </div>
}
