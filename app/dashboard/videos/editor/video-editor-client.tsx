'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlignCenter, ArrowDown, ArrowLeft, ArrowUp, Captions, Check, CircleStop,
  Copy, Crop, Download, Film, FlipHorizontal2, FlipVertical2, Gauge, Loader2,
  Mail, Maximize2, Mic, Minimize2, Move, Pause, Play, Plus, RotateCcw,
  Save, Scissors, Send, Sparkles, Trash2, Upload, Video, X,
} from 'lucide-react'
import { DashboardSidebar } from '@/components/leads/DashboardSidebar'
import type { CrmSetupConfig, EmailComposerLead, EmailComposerVideo } from '@/components/crm-dashboard/types'
import { sendEnterpriseEmail } from '@/lib/actions/email-actions'
import { getVideoPlaybackUrl, registerUploadedVideo, saveVideoEditorProject } from '@/lib/actions/video-actions'
import {
  activeCaptionAt, clampNumber, defaultCaptionStyle, defaultVideoTransform,
  formatRatios, normalizeCuts, playableDuration,
  type CaptionStyle, type VideoCaption, type VideoCut, type VideoFormat, type VideoTransform,
} from '@/lib/video/editor-project'
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

type InspectorTool = 'transform' | 'cut' | 'captions' | 'brand'

type Draft = {
  title: string
  leadId: string
  scenes: Scene[]
  format: VideoFormat
  brandColor: string
  accentColor: string
  watermark: boolean
  captionsEnabled: boolean
  ctaLabel: string
  ctaUrl: string
  emailTo: string
  emailSubject: string
  emailBody: string
  trimStart: number
  trimEnd: number
  transform: VideoTransform
  cuts: VideoCut[]
  captionItems: VideoCaption[]
  captionStyle: CaptionStyle
  playbackRate: number
  volume: number
}

const formats: VideoFormat[] = ['16:9', '9:16', '1:1', '4:5', '21:9']
const allowedTypes = new Set(['video/mp4', 'video/quicktime', 'video/webm'])
const maxSize = 2 * 1024 * 1024 * 1024
const starterScenes: Scene[] = [
  { id: 'intro', name: 'Personal intro', duration: 6, layout: 'intro', headline: 'A focused idea for your next website win', note: 'Open with the lead context and one clear promise.', color: '#2f6bff' },
  { id: 'proof', name: 'Proof point', duration: 8, layout: 'proof', headline: 'Fast delivery. Clean systems. Measurable conversion.', note: 'Show the evidence that supports your recommendation.', color: '#16b8a6' },
  { id: 'walkthrough', name: 'Walkthrough', duration: 14, layout: 'demo', headline: 'What we would improve first', note: 'Use the source video to demonstrate the opportunity.', color: '#8b5cf6' },
  { id: 'cta', name: 'Next step', duration: 6, layout: 'cta', headline: 'Worth a 20 minute call?', note: 'End with one action.', color: '#f59e0b' },
]

const uid = () => globalThis.crypto?.randomUUID?.() || `item-${Date.now()}-${Math.random().toString(36).slice(2)}`
const asObject = (value: unknown): Record<string, any> => value && typeof value === 'object' ? value as Record<string, any> : {}
const seconds = (value: number) => `${Math.floor(Math.max(0, value) / 60).toString().padStart(2, '0')}:${Math.floor(Math.max(0, value) % 60).toString().padStart(2, '0')}`
const preciseSeconds = (value: number) => `${Math.max(0, value).toFixed(1)}s`

function safeTransform(value: unknown): VideoTransform {
  const input = asObject(value)
  return {
    fit: input.fit === 'cover' ? 'cover' : 'contain',
    scale: clampNumber(Number(input.scale ?? 1), 0.25, 4),
    x: clampNumber(Number(input.x ?? 0), -100, 100),
    y: clampNumber(Number(input.y ?? 0), -100, 100),
    rotation: clampNumber(Number(input.rotation ?? 0), -180, 180),
    flipX: Boolean(input.flipX), flipY: Boolean(input.flipY),
  }
}

function safeCaptionStyle(value: unknown): CaptionStyle {
  const input = asObject(value)
  const weight = [600, 700, 800, 900].includes(Number(input.fontWeight)) ? Number(input.fontWeight) as CaptionStyle['fontWeight'] : 800
  return {
    color: typeof input.color === 'string' ? input.color : defaultCaptionStyle.color,
    background: typeof input.background === 'string' ? input.background : defaultCaptionStyle.background,
    fontSize: clampNumber(Number(input.fontSize ?? 34), 16, 72),
    fontWeight: weight, uppercase: Boolean(input.uppercase),
  }
}

function safeCuts(value: unknown): VideoCut[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const row = asObject(item); const start = Number(row.start); const end = Number(row.end)
    return Number.isFinite(start) && Number.isFinite(end) && end > start
      ? [{ id: typeof row.id === 'string' ? row.id : uid(), start, end }] : []
  })
}

function safeCaptions(value: unknown): VideoCaption[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const row = asObject(item); const start = Number(row.start); const end = Number(row.end)
    if (typeof row.text !== 'string' || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return []
    const position = ['top', 'middle', 'bottom'].includes(row.position) ? row.position as VideoCaption['position'] : 'bottom'
    return [{ id: typeof row.id === 'string' ? row.id : uid(), text: row.text, start, end, position }]
  })
}

function projectFromVideo(video: EmailComposerVideo | undefined): Partial<Draft> {
  const metadata = asObject(video?.metadata); const brand = asObject(metadata.brand); const cta = asObject(metadata.cta)
  const email = asObject(metadata.email); const settings = asObject(metadata.settings)
  return {
    title: video?.name, leadId: video?.leadId || '',
    scenes: Array.isArray(metadata.scenes) && metadata.scenes.length ? metadata.scenes : undefined,
    format: formats.includes(metadata.format) ? metadata.format : undefined,
    brandColor: typeof brand.primary === 'string' ? brand.primary : undefined,
    accentColor: typeof brand.accent === 'string' ? brand.accent : undefined,
    watermark: typeof brand.watermark === 'boolean' ? brand.watermark : undefined,
    captionsEnabled: typeof settings.captions === 'boolean' ? settings.captions : undefined,
    ctaLabel: typeof cta.label === 'string' ? cta.label : undefined,
    ctaUrl: typeof cta.destination === 'string' ? cta.destination : undefined,
    emailSubject: typeof email.subject === 'string' ? email.subject : undefined,
    emailBody: typeof email.body === 'string' ? email.body : undefined,
    trimStart: Number.isFinite(settings.trimStart) ? Number(settings.trimStart) : undefined,
    trimEnd: Number.isFinite(settings.trimEnd) ? Number(settings.trimEnd) : undefined,
    transform: safeTransform(settings.transform), cuts: safeCuts(settings.cuts),
    captionItems: safeCaptions(settings.captionItems), captionStyle: safeCaptionStyle(settings.captionStyle),
    playbackRate: clampNumber(Number(settings.playbackRate ?? 1), 0.5, 2),
    volume: clampNumber(Number(settings.volume ?? 1), 0, 1),
  }
}

function canvasSize(format: VideoFormat) {
  if (format === '9:16') return { width: 720, height: 1280 }
  if (format === '1:1') return { width: 1080, height: 1080 }
  if (format === '4:5') return { width: 864, height: 1080 }
  if (format === '21:9') return { width: 1400, height: 600 }
  return { width: 1280, height: 720 }
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/); const lines: string[] = []; let line = ''
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word
    if (line && context.measureText(candidate).width > maxWidth) { lines.push(line); line = word } else line = candidate
  })
  if (line) lines.push(line)
  return lines.slice(0, 4)
}

export function VideoEditorClient({ leads, videos, setupConfig }: { leads: EmailComposerLead[]; videos: EmailComposerVideo[]; setupConfig: CrmSetupConfig }) {
  const searchParams = useSearchParams(); const requestedAsset = searchParams.get('asset') || ''; const requestedLead = searchParams.get('lead') || ''
  const initialVideo = videos.find((video) => video.id === requestedAsset); const initial = projectFromVideo(initialVideo)
  const requestedLeadRecord = leads.find((lead) => lead.id === requestedLead)
  const defaultLead = leads.find((lead) => lead.id === initial.leadId) || requestedLeadRecord || (!initialVideo ? leads[0] : undefined)
  const [title, setTitle] = useState(initial.title || 'Personalised website growth video')
  const [leadId, setLeadId] = useState(initialVideo ? (initial.leadId || '') : (requestedLeadRecord?.id || defaultLead?.id || ''))
  const [scenes, setScenes] = useState<Scene[]>(initial.scenes || starterScenes)
  const [selectedSceneId, setSelectedSceneId] = useState((initial.scenes || starterScenes)[0]?.id || '')
  const [format, setFormat] = useState<VideoFormat>(initial.format || '16:9')
  const [brandColor, setBrandColor] = useState(initial.brandColor || '#2f6bff'); const [accentColor, setAccentColor] = useState(initial.accentColor || '#17d7c1')
  const [watermark, setWatermark] = useState(initial.watermark ?? true); const [captionsEnabled, setCaptionsEnabled] = useState(initial.captionsEnabled ?? true)
  const [captionItems, setCaptionItems] = useState<VideoCaption[]>(initial.captionItems || []); const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(initial.captionStyle || defaultCaptionStyle)
  const [selectedCaptionId, setSelectedCaptionId] = useState(initial.captionItems?.[0]?.id || ''); const [transform, setTransform] = useState<VideoTransform>(initial.transform || defaultVideoTransform)
  const [cuts, setCuts] = useState<VideoCut[]>(initial.cuts || []); const [cutIn, setCutIn] = useState<number | null>(null)
  const [playbackRate, setPlaybackRate] = useState(initial.playbackRate || 1); const [volume, setVolume] = useState(initial.volume ?? 1); const [tool, setTool] = useState<InspectorTool>('transform')
  const [ctaLabel, setCtaLabel] = useState(initial.ctaLabel || setupConfig.defaultCtaLabel); const [ctaUrl, setCtaUrl] = useState(initial.ctaUrl || setupConfig.defaultCtaUrl)
  const [emailTo, setEmailTo] = useState(defaultLead?.email || ''); const [emailSubject, setEmailSubject] = useState(initial.emailSubject || `A short personalised video from ${setupConfig.companyName}`)
  const [emailBody, setEmailBody] = useState(initial.emailBody || 'I made a short video with a practical first pass on your next growth opportunity.\n\nIt includes the key opportunity, a proof point and one clear next step.')
  const [assetId, setAssetId] = useState(initialVideo?.id || ''); const [assetSlug, setAssetSlug] = useState(initialVideo?.slug || ''); const [storagePath, setStoragePath] = useState(initialVideo?.storagePath || '')
  const [sourceUrl, setSourceUrl] = useState(initialVideo?.previewUrl || ''); const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [sourceDuration, setSourceDuration] = useState(Number(asObject(initialVideo?.metadata).duration || 0)); const [trimStart, setTrimStart] = useState(initial.trimStart || 0); const [trimEnd, setTrimEnd] = useState(initial.trimEnd || 0)
  const [playing, setPlaying] = useState(false); const [currentTime, setCurrentTime] = useState(0); const [uploadProgress, setUploadProgress] = useState(0); const [exportProgress, setExportProgress] = useState(0)
  const [busy, setBusy] = useState<'save' | 'send' | 'record' | 'export' | ''>(''); const [message, setMessage] = useState<{ kind: 'ok' | 'error' | 'info'; text: string } | null>(null); const [dirty, setDirty] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null); const videoRef = useRef<HTMLVideoElement>(null); const stageRef = useRef<HTMLDivElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null); const streamRef = useRef<MediaStream | null>(null); const chunksRef = useRef<Blob[]>([])
  const uploadAbortRef = useRef<AbortController | null>(null); const previewObjectUrlRef = useRef(''); const initializedRef = useRef(false)
  const dragRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null)
  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) || scenes[0]
  const selectedCaption = captionItems.find((caption) => caption.id === selectedCaptionId) || captionItems[0]
  const projectDuration = useMemo(() => scenes.reduce((total, scene) => total + scene.duration, 0), [scenes]); const activeLead = leads.find((lead) => lead.id === leadId)
  const shareUrl = assetSlug && typeof window !== 'undefined' ? `${window.location.origin}/v/${assetSlug}` : ''; const aspect = formatRatios[format]
  const normalizedCuts = useMemo(() => normalizeCuts(cuts, sourceDuration, trimStart, trimEnd || sourceDuration), [cuts, sourceDuration, trimStart, trimEnd])
  const editedDuration = useMemo(() => playableDuration(sourceDuration, trimStart, trimEnd || sourceDuration, normalizedCuts), [sourceDuration, trimStart, trimEnd, normalizedCuts])
  const activeCaption = captionsEnabled ? activeCaptionAt(captionItems, currentTime) : null
  const stageCaption = activeCaption?.text || (captionsEnabled && captionItems.length === 0 ? selectedScene?.headline : '')
  const draft = useMemo<Draft>(() => ({ title, leadId, scenes, format, brandColor, accentColor, watermark, captionsEnabled, ctaLabel, ctaUrl, emailTo, emailSubject, emailBody, trimStart, trimEnd, transform, cuts, captionItems, captionStyle, playbackRate, volume }), [title, leadId, scenes, format, brandColor, accentColor, watermark, captionsEnabled, ctaLabel, ctaUrl, emailTo, emailSubject, emailBody, trimStart, trimEnd, transform, cuts, captionItems, captionStyle, playbackRate, volume])

  useEffect(() => { if (!requestedAsset || initialVideo?.previewUrl || !initialVideo?.storagePath) return; void getVideoPlaybackUrl(requestedAsset).then((result) => { if ('url' in result && result.url) setSourceUrl(result.url) }) }, [initialVideo, requestedAsset])
  useEffect(() => { if (!initializedRef.current) { initializedRef.current = true; return }; setDirty(true); const timer = window.setTimeout(() => localStorage.setItem('o2d-video-studio-draft-v3', JSON.stringify(draft)), 450); return () => window.clearTimeout(timer) }, [draft])
  useEffect(() => () => { if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current); streamRef.current?.getTracks().forEach((track) => track.stop()); uploadAbortRef.current?.abort() }, [])
  useEffect(() => { function onKeyDown(event: KeyboardEvent) { const target = event.target as HTMLElement | null; if (target?.matches('input, textarea, select, [contenteditable="true"]')) return; if (event.code === 'Space') { event.preventDefault(); togglePlayback() }; if (event.key === 'ArrowLeft') seekTo(currentTime - (event.shiftKey ? 5 : 1)); if (event.key === 'ArrowRight') seekTo(currentTime + (event.shiftKey ? 5 : 1)) }; window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown) })

  function applyDraft(next: Partial<Draft>) {
    if (next.title) setTitle(next.title); if (typeof next.leadId === 'string' && (next.leadId === '' || leads.some((lead) => lead.id === next.leadId))) setLeadId(next.leadId)
    if (next.scenes?.length) { setScenes(next.scenes); setSelectedSceneId(next.scenes[0].id) }; if (next.format) setFormat(next.format)
    if (next.brandColor) setBrandColor(next.brandColor); if (next.accentColor) setAccentColor(next.accentColor); if (typeof next.watermark === 'boolean') setWatermark(next.watermark)
    if (typeof next.captionsEnabled === 'boolean') setCaptionsEnabled(next.captionsEnabled); if (next.ctaLabel) setCtaLabel(next.ctaLabel); if (next.ctaUrl) setCtaUrl(next.ctaUrl)
    if (next.emailTo) setEmailTo(next.emailTo); if (next.emailSubject) setEmailSubject(next.emailSubject); if (next.emailBody) setEmailBody(next.emailBody)
    if (typeof next.trimStart === 'number') setTrimStart(next.trimStart); if (typeof next.trimEnd === 'number') setTrimEnd(next.trimEnd)
    if (next.transform) setTransform(safeTransform(next.transform)); if (next.cuts) setCuts(safeCuts(next.cuts)); if (next.captionItems) { setCaptionItems(safeCaptions(next.captionItems)); setSelectedCaptionId(next.captionItems[0]?.id || '') }
    if (next.captionStyle) setCaptionStyle(safeCaptionStyle(next.captionStyle)); if (typeof next.playbackRate === 'number') setPlaybackRate(clampNumber(next.playbackRate, 0.5, 2)); if (typeof next.volume === 'number') setVolume(clampNumber(next.volume, 0, 1))
  }
  function restoreLocalDraft() { try { const value = localStorage.getItem('o2d-video-studio-draft-v3') || localStorage.getItem('o2d-video-studio-draft-v2'); if (!value) return setMessage({ kind: 'info', text: 'There is no local draft to restore.' }); applyDraft(JSON.parse(value)); setMessage({ kind: 'ok', text: 'Local draft restored.' }) } catch { setMessage({ kind: 'error', text: 'The local draft could not be restored.' }) } }
  const inspectFile = useCallback((file: File) => { if (!allowedTypes.has(file.type)) return setMessage({ kind: 'error', text: 'Choose an MP4, MOV or WebM video.' }); if (file.size > maxSize) return setMessage({ kind: 'error', text: 'Videos must be 2 GB or smaller.' }); if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current); const url = URL.createObjectURL(file); previewObjectUrlRef.current = url; setSourceFile(file); setSourceUrl(url); setStoragePath(''); setUploadProgress(0); setDirty(true); setMessage({ kind: 'info', text: `${file.name} is staged. Edit it now, then save when ready.` }) }, [])
  function onMetadata() { const video = videoRef.current; const duration = video?.duration || 0; if (!video || !Number.isFinite(duration)) return; setSourceDuration(duration); setTrimStart((current) => clampNumber(current, 0, Math.max(0, duration - 0.1))); setTrimEnd((current) => current > 0 ? clampNumber(current, 0.1, duration) : duration); video.playbackRate = playbackRate; video.volume = volume }
  function seekTo(value: number) { const video = videoRef.current; if (!video || !sourceDuration) return; let next = clampNumber(value, trimStart, trimEnd || sourceDuration); const hidden = normalizedCuts.find((cut) => next >= cut.start && next < cut.end); if (hidden) next = hidden.end; video.currentTime = next; setCurrentTime(next) }
  function togglePlayback() { const video = videoRef.current; if (!video || !sourceUrl) return; if (video.paused) { const end = trimEnd || sourceDuration; if (video.currentTime < trimStart || video.currentTime >= end) seekTo(trimStart); void video.play() } else video.pause() }
  function onTimeUpdate() { const video = videoRef.current; if (!video) return; const end = trimEnd || sourceDuration; const hidden = normalizedCuts.find((cut) => video.currentTime >= cut.start && video.currentTime < cut.end); if (hidden) { video.currentTime = hidden.end; setCurrentTime(hidden.end); return }; if (end && video.currentTime >= end) { video.pause(); video.currentTime = trimStart; setCurrentTime(trimStart); return }; setCurrentTime(video.currentTime) }

  function updatePlaybackRate(value: number) { const next = clampNumber(value, 0.5, 2); setPlaybackRate(next); if (videoRef.current) videoRef.current.playbackRate = next }
  function updateVolume(value: number) { const next = clampNumber(value, 0, 1); setVolume(next); if (videoRef.current) videoRef.current.volume = next }
  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) return setMessage({ kind: 'error', text: 'Camera recording is not supported in this browser.' })
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); const preferred = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(MediaRecorder.isTypeSupported)
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined); chunksRef.current = []; streamRef.current = stream; recorderRef.current = recorder
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.muted = true; void videoRef.current.play() }
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.onstop = () => { const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' }); const file = new File([blob], `recording-${Date.now()}.webm`, { type: blob.type }); stream.getTracks().forEach((track) => track.stop()); streamRef.current = null; if (videoRef.current) { videoRef.current.srcObject = null; videoRef.current.muted = false }; inspectFile(file); setBusy('') }
      recorder.start(1_000); setBusy('record'); setMessage({ kind: 'info', text: 'Recording camera and microphone…' })
    } catch (error) { setBusy(''); setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Camera permission was not granted.' }) }
  }
  function stopRecording() { if (recorderRef.current?.state === 'recording') recorderRef.current.stop() }
  function updateScene(patch: Partial<Scene>) { setScenes((current) => current.map((scene) => scene.id === selectedScene?.id ? { ...scene, ...patch } : scene)) }
  function addScene() { const scene: Scene = { id: uid(), name: 'New scene', duration: 6, layout: 'offer', headline: 'Add a clear message', note: '', color: accentColor }; setScenes((current) => [...current, scene]); setSelectedSceneId(scene.id) }
  function duplicateScene() { if (!selectedScene) return; const scene = { ...selectedScene, id: uid(), name: `${selectedScene.name} copy` }; setScenes((current) => [...current, scene]); setSelectedSceneId(scene.id) }
  function removeScene() { if (!selectedScene || scenes.length === 1) return; const index = scenes.findIndex((scene) => scene.id === selectedScene.id); const next = scenes.filter((scene) => scene.id !== selectedScene.id); setScenes(next); setSelectedSceneId(next[Math.min(index, next.length - 1)].id) }
  function moveScene(direction: -1 | 1) { const index = scenes.findIndex((scene) => scene.id === selectedScene?.id); const target = index + direction; if (index < 0 || target < 0 || target >= scenes.length) return; setScenes((current) => { const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next }) }
  function setTransformPatch(patch: Partial<VideoTransform>) { setTransform((current) => ({ ...current, ...patch })) }
  function resetTransform(fit: VideoTransform['fit'] = 'contain') { setTransform({ ...defaultVideoTransform, fit }) }
  function beginDrag(event: React.PointerEvent<HTMLDivElement>) { if (tool !== 'transform' || !sourceUrl) return; event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { x: event.clientX, y: event.clientY, originX: transform.x, originY: transform.y } }
  function dragVideo(event: React.PointerEvent<HTMLDivElement>) { const drag = dragRef.current; const stage = stageRef.current; if (!drag || !stage) return; const bounds = stage.getBoundingClientRect(); setTransformPatch({ x: clampNumber(drag.originX + ((event.clientX - drag.x) / bounds.width) * 200, -100, 100), y: clampNumber(drag.originY + ((event.clientY - drag.y) / bounds.height) * 200, -100, 100) }) }
  function addCut(start: number, end: number) { if (!sourceDuration) return; const next = normalizeCuts([...cuts, { id: uid(), start, end }], sourceDuration, trimStart, trimEnd || sourceDuration); if (playableDuration(sourceDuration, trimStart, trimEnd || sourceDuration, next) < 0.25) return setMessage({ kind: 'error', text: 'Keep at least 0.25 seconds of playable video.' }); setCuts(next) }
  function markCutOut() { if (cutIn === null) return setMessage({ kind: 'info', text: 'Set the cut start first.' }); if (currentTime <= cutIn + 0.05) return setMessage({ kind: 'error', text: 'Move the playhead after the cut start.' }); addCut(cutIn, currentTime); setCutIn(null); setMessage({ kind: 'ok', text: `Removed ${preciseSeconds(currentTime - cutIn)} from playback.` }) }
  function updateCut(id: string, patch: Partial<VideoCut>) { setCuts((current) => normalizeCuts(current.map((cut) => cut.id === id ? { ...cut, ...patch } : cut), sourceDuration, trimStart, trimEnd || sourceDuration)) }
  function addCaption() { if (!sourceDuration) return setMessage({ kind: 'info', text: 'Import a video before adding timed captions.' }); const start = clampNumber(currentTime || trimStart, trimStart, Math.max(trimStart, (trimEnd || sourceDuration) - 0.2)); const caption: VideoCaption = { id: uid(), text: 'Type your caption', start, end: Math.min(trimEnd || sourceDuration, start + 3), position: 'bottom' }; setCaptionItems((current) => [...current, caption].sort((a, b) => a.start - b.start)); setSelectedCaptionId(caption.id); setCaptionsEnabled(true) }
  function generateSceneCaptions() { if (!sourceDuration) return setMessage({ kind: 'info', text: 'Import a video before generating captions.' }); const start = trimStart; const end = trimEnd || sourceDuration; const totalWeight = scenes.reduce((sum, scene) => sum + scene.duration, 0) || scenes.length; let cursor = start; const generated = scenes.map((scene, index) => { const duration = index === scenes.length - 1 ? end - cursor : ((end - start) * scene.duration) / totalWeight; const item: VideoCaption = { id: uid(), text: scene.headline || scene.name, start: cursor, end: Math.min(end, cursor + duration), position: 'bottom' }; cursor = item.end; return item }).filter((caption) => caption.end - caption.start >= 0.1); setCaptionItems(generated); setSelectedCaptionId(generated[0]?.id || ''); setCaptionsEnabled(true); setMessage({ kind: 'ok', text: `${generated.length} timed captions created from the scene outline.` }) }
  function updateCaption(id: string, patch: Partial<VideoCaption>) { setCaptionItems((current) => current.map((caption) => caption.id === id ? { ...caption, ...patch, start: patch.start === undefined ? caption.start : clampNumber(patch.start, trimStart, trimEnd || sourceDuration), end: patch.end === undefined ? caption.end : clampNumber(patch.end, trimStart, trimEnd || sourceDuration) } : caption).filter((caption) => caption.end > caption.start).sort((a, b) => a.start - b.start)) }
  function splitCaption() { if (!selectedCaption || currentTime <= selectedCaption.start + 0.05 || currentTime >= selectedCaption.end - 0.05) return setMessage({ kind: 'info', text: 'Place the playhead inside the selected caption to split it.' }); const next: VideoCaption = { ...selectedCaption, id: uid(), start: currentTime }; setCaptionItems((current) => [...current.map((caption) => caption.id === selectedCaption.id ? { ...caption, end: currentTime } : caption), next].sort((a, b) => a.start - b.start)); setSelectedCaptionId(next.id) }

  function drawExportFrame(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, video: HTMLVideoElement) {
    const { width, height } = canvas; context.fillStyle = '#000000'; context.fillRect(0, 0, width, height)
    const mediaRatio = video.videoWidth / video.videoHeight; const frameRatio = width / height
    const baseScale = transform.fit === 'cover' ? (mediaRatio > frameRatio ? height / video.videoHeight : width / video.videoWidth) : (mediaRatio > frameRatio ? width / video.videoWidth : height / video.videoHeight)
    const renderedWidth = video.videoWidth * baseScale * transform.scale; const renderedHeight = video.videoHeight * baseScale * transform.scale
    context.save(); context.translate(width / 2 + (transform.x / 100) * width / 2, height / 2 + (transform.y / 100) * height / 2); context.rotate((transform.rotation * Math.PI) / 180); context.scale(transform.flipX ? -1 : 1, transform.flipY ? -1 : 1); context.drawImage(video, -renderedWidth / 2, -renderedHeight / 2, renderedWidth, renderedHeight); context.restore()
    context.strokeStyle = brandColor; context.lineWidth = Math.max(3, width * 0.003); context.strokeRect(12, 12, width - 24, height - 24)
    if (watermark) { context.fillStyle = '#ffffffcc'; context.textAlign = 'right'; context.textBaseline = 'top'; context.font = `800 ${Math.max(18, width * 0.018)}px Inter, Arial, sans-serif`; context.fillText('Online2Day', width - 28, 26) }
    const caption = captionsEnabled ? activeCaptionAt(captionItems, video.currentTime) : null; const text = caption?.text || (captionsEnabled && captionItems.length === 0 ? selectedScene?.headline : '')
    if (!text) return
    const fontSize = captionStyle.fontSize * (width / 1280); context.font = `${captionStyle.fontWeight} ${fontSize}px Inter, Arial, sans-serif`; context.textAlign = 'center'; context.textBaseline = 'middle'
    const lines = wrapCanvasText(context, captionStyle.uppercase ? text.toUpperCase() : text, width * 0.78); const lineHeight = fontSize * 1.25; const blockHeight = lines.length * lineHeight
    const centerY = caption?.position === 'top' ? height * 0.16 : caption?.position === 'middle' ? height * 0.5 : height * 0.84; const widest = Math.max(...lines.map((line) => context.measureText(line).width), 0)
    context.fillStyle = captionStyle.background; context.fillRect((width - widest) / 2 - 22, centerY - blockHeight / 2 - 12, widest + 44, blockHeight + 24); context.fillStyle = captionStyle.color
    lines.forEach((line, index) => context.fillText(line, width / 2, centerY - blockHeight / 2 + lineHeight * (index + 0.5)))
  }

  async function exportVideo() {
    const video = videoRef.current; if (!video || !sourceUrl || !sourceDuration) return setMessage({ kind: 'error', text: 'Import a playable video before exporting.' })
    const canvas = document.createElement('canvas'); Object.assign(canvas, canvasSize(format)); const context = canvas.getContext('2d'); const capture = (canvas as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }).captureStream
    if (!context || !capture || !globalThis.MediaRecorder) return setMessage({ kind: 'error', text: 'Edited download is not supported in this browser.' })
    setBusy('export'); setExportProgress(0); setMessage({ kind: 'info', text: 'Rendering the edited video in real time. Keep this tab open.' }); const original = { time: video.currentTime, muted: video.muted, volume: video.volume, rate: video.playbackRate }
    try {
      video.pause(); video.currentTime = trimStart; video.playbackRate = playbackRate; video.volume = volume; video.muted = volume === 0
      await new Promise<void>((resolve) => { if (Math.abs(video.currentTime - trimStart) < 0.05) resolve(); else video.addEventListener('seeked', () => resolve(), { once: true }) }); drawExportFrame(canvas, context, video)
      const output = capture.call(canvas, 30); const mediaCapture = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.(); mediaCapture?.getAudioTracks().forEach((track) => output.addTrack(track))
      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(MediaRecorder.isTypeSupported); const recorder = new MediaRecorder(output, mimeType ? { mimeType, videoBitsPerSecond: 6_000_000 } : undefined); const chunks: BlobPart[] = []
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }; const finished = new Promise<Blob>((resolve) => { recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' })) }); recorder.start(1_000); await video.play()
      await new Promise<void>((resolve, reject) => { let animation = 0; const render = () => { try { const hidden = normalizedCuts.find((cut) => video.currentTime >= cut.start && video.currentTime < cut.end); if (hidden) video.currentTime = hidden.end; drawExportFrame(canvas, context, video); setExportProgress(Math.round(((video.currentTime - trimStart) / Math.max(0.1, (trimEnd || sourceDuration) - trimStart)) * 100)); if (video.currentTime >= (trimEnd || sourceDuration) - 0.04 || video.ended) { window.cancelAnimationFrame(animation); video.pause(); resolve(); return }; animation = window.requestAnimationFrame(render) } catch (error) { window.cancelAnimationFrame(animation); reject(error) } }; animation = window.requestAnimationFrame(render) })
      await new Promise((resolve) => window.setTimeout(resolve, 180)); recorder.stop(); const blob = await finished; output.getTracks().forEach((track) => track.stop()); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${safeVideoObjectName(title || 'online2day-video').replace(/\.[^.]+$/, '')}-edited.webm`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 10_000); setExportProgress(100); setMessage({ kind: 'ok', text: 'Edited WebM downloaded with cuts, framing, captions and branding.' })
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? `Export failed: ${error.message}` : 'The edited video could not be exported.' }) }
    finally { video.pause(); video.currentTime = original.time; video.muted = original.muted; video.volume = original.volume; video.playbackRate = original.rate; setBusy('') }
  }

  async function persist() {
    if (!title.trim()) { setMessage({ kind: 'error', text: 'Enter a project title.' }); return null }; try { new URL(ctaUrl) } catch { setMessage({ kind: 'error', text: 'Enter a complete CTA URL, including https://.' }); return null }
    setBusy('save'); setMessage({ kind: 'info', text: sourceFile ? 'Uploading the source video…' : 'Saving project…' })
    try {
      let currentAssetId = assetId; let currentSlug = assetSlug; let currentStoragePath = storagePath
      if (sourceFile) { const ownerPath = leadId || 'shared'; const slug = currentSlug || `${ownerPath.slice(0, 8)}-${Date.now()}`; const path = `${ownerPath}/${slug}-${safeVideoObjectName(sourceFile.name)}`; const controller = new AbortController(); uploadAbortRef.current = controller; await uploadVideoResumable({ file: sourceFile, objectPath: path, onProgress: setUploadProgress, signal: controller.signal }); const registered = await registerUploadedVideo({ assetId: currentAssetId || undefined, leadId: leadId || null, name: title.trim(), storagePath: path, slug, contentType: sourceFile.type, size: sourceFile.size, duration: sourceDuration }); if ('error' in registered && registered.error) throw new Error(registered.error); if (!registered.asset) throw new Error('The uploaded video could not be registered.'); currentAssetId = registered.asset.id; currentSlug = registered.asset.slug || slug; currentStoragePath = registered.asset.storage_path || path; setAssetId(currentAssetId); setAssetSlug(currentSlug); setStoragePath(currentStoragePath); setSourceFile(null) }
      const duration = Math.max(1, editedDuration || sourceDuration || projectDuration); const timeline = scenes.map((scene, index) => ({ id: `scene-track-${scene.id}`, label: scene.name, track: 'video' as const, start: scenes.slice(0, index).reduce((sum, item) => sum + item.duration, 0), duration: scene.duration }))
      const result = await saveVideoEditorProject({ title: title.trim(), leadId: leadId || null, sourceAssetId: currentAssetId, sourceSlug: currentSlug, duration, format, scenes, timeline, brand: { primary: brandColor, accent: accentColor, watermark, logoPlacement: 'top-left' }, cta: { label: ctaLabel, destination: ctaUrl }, email: { subject: emailSubject, body: emailBody }, recording: currentStoragePath ? { storagePath: currentStoragePath, duration: sourceDuration } : null, settings: { captions: captionsEnabled, captionItems, captionStyle, trimStart, trimEnd: trimEnd || sourceDuration, cuts: normalizedCuts, transform, playbackRate, volume, nonDestructive: true } })
      if ('error' in result && result.error) throw new Error(result.error); if (!result.assetId) throw new Error('The API did not return the saved project.'); setAssetId(result.assetId); setAssetSlug(result.slug || currentSlug); setDirty(false); localStorage.removeItem('o2d-video-studio-draft-v3'); localStorage.removeItem('o2d-video-studio-draft-v2'); window.history.replaceState(null, '', `/dashboard/videos/editor?asset=${result.assetId}`); setMessage({ kind: 'ok', text: 'Project saved. The share page now uses these exact edits.' }); return { assetId: result.assetId, slug: result.slug || currentSlug }
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'The project could not be saved.' }); return null }
    finally { setBusy(''); uploadAbortRef.current = null }
  }
  async function sendEmail() { if (!/^\S+@\S+\.\S+$/.test(emailTo)) return setMessage({ kind: 'error', text: 'Enter a valid recipient email.' }); setBusy('send'); const saved = dirty || !assetId ? await persist() : { assetId, slug: assetSlug }; if (!saved) { setBusy(''); return }; setBusy('send'); const result = await sendEnterpriseEmail({ leadId: leadId || undefined, to: emailTo, recipientName: activeLead?.name, subject: emailSubject, body: emailBody, videoAssetId: saved.assetId, videoSlug: saved.slug, ctaLabel }); setBusy(''); setMessage(result.error ? { kind: 'error', text: result.error } : { kind: 'ok', text: 'Email sent and logged against the lead.' }) }
  const previewStyle = { objectFit: transform.fit, transform: `translate(${transform.x / 2}%, ${transform.y / 2}%) rotate(${transform.rotation}deg) scale(${transform.scale * (transform.flipX ? -1 : 1)}, ${transform.scale * (transform.flipY ? -1 : 1)})` } as const

  return <div className={styles.shell}>
    <DashboardSidebar active="videos" />
    <main className={styles.main}>
      <header className={styles.header}>
        <div><Link href="/dashboard/videos" className={styles.backLink}><ArrowLeft size={15} /> Video library</Link><div className={styles.eyebrow}>VIDEO STUDIO 3.0</div><h1>Edit without limits</h1><p>Frame the source precisely, remove unwanted sections, add timed captions, brand the result and publish one consistent playback experience.</p></div>
        <div className={styles.headerActions}><button type="button" onClick={restoreLocalDraft}><RotateCcw size={16} /> Restore local</button>{shareUrl ? <a href={shareUrl} target="_blank" rel="noreferrer">Preview page</a> : null}<button type="button" disabled={!sourceUrl || Boolean(busy)} onClick={() => void exportVideo()}>{busy === 'export' ? <Loader2 className={styles.spin} size={16} /> : <Download size={16} />} Download edit</button><button type="button" className={styles.primary} disabled={Boolean(busy)} onClick={() => void persist()}>{busy === 'save' ? <Loader2 className={styles.spin} size={16} /> : <Save size={16} />} {dirty ? 'Save changes' : 'Saved'}</button></div>
      </header>
      {message ? <div role="status" className={`${styles.notice} ${styles[message.kind]}`}><span>{message.text}</span><button aria-label="Dismiss message" onClick={() => setMessage(null)}><X size={15} /></button></div> : null}
      <section className={styles.setupBar}>
        <label><span>Project title</span><input value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} /></label>
        <label><span>CRM lead <em>optional</em></span><select value={leadId} onChange={(event) => { const id = event.target.value; const lead = leads.find((item) => item.id === id); setLeadId(id); if (lead?.email) setEmailTo(lead.email) }}><option value="">Shared / no lead</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name} · {lead.company}</option>)}</select></label>
        <label><span>Canvas</span><select value={format} onChange={(event) => setFormat(event.target.value as VideoFormat)}>{formats.map((item) => <option key={item}>{item}</option>)}</select></label>
        <div className={styles.savedState}><span>{assetId ? 'Library project' : 'Unsaved project'}</span><strong>{dirty ? 'Changes pending' : 'Up to date'}</strong><small>{sourceDuration ? `${seconds(editedDuration)} final` : 'Add media'}</small></div>
      </section>
      <nav className={styles.toolRail} aria-label="Video editing tools">{([['transform', Move, 'Frame & crop'], ['cut', Scissors, 'Cut'], ['captions', Captions, 'Captions'], ['brand', Sparkles, 'Story & brand']] as const).map(([id, Icon, label]) => <button key={id} className={tool === id ? styles.toolActive : ''} onClick={() => setTool(id)}><Icon size={17} /><span>{label}</span></button>)}</nav>

      <div className={styles.workspace}>
        <section className={styles.mediaPanel}>
          <div className={styles.panelHeading}><div><span>LIVE CANVAS</span><h2>Video preview</h2></div><strong>{sourceDuration ? `${seconds(currentTime)} / ${seconds(sourceDuration)}` : 'No media'}</strong></div>
          <div ref={stageRef} className={`${styles.stage} ${tool === 'transform' && sourceUrl ? styles.stageMovable : ''}`} style={{ aspectRatio: aspect }} onPointerDown={beginDrag} onPointerMove={dragVideo} onPointerUp={() => { dragRef.current = null }} onPointerCancel={() => { dragRef.current = null }}>
            {sourceUrl ? <video ref={videoRef} src={sourceUrl} crossOrigin="anonymous" playsInline preload="metadata" style={previewStyle} onLoadedMetadata={onMetadata} onTimeUpdate={onTimeUpdate} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} /> : <button className={styles.emptyStage} onClick={() => fileInputRef.current?.click()}><Film size={34} /><strong>Import your source video</strong><span>MP4, MOV or WebM · up to 2 GB</span></button>}
            {sourceUrl ? <div className={styles.videoOverlay} style={{ borderColor: brandColor }}><span>{activeLead?.company || 'Shared video'}</span>{watermark ? <b>Online2Day</b> : null}</div> : null}
            {sourceUrl && stageCaption ? <p className={`${styles.caption} ${styles[`caption${activeCaption?.position || 'bottom'}`]}`} style={{ color: captionStyle.color, background: captionStyle.background, fontWeight: captionStyle.fontWeight, textTransform: captionStyle.uppercase ? 'uppercase' : 'none', fontSize: `clamp(14px, ${(captionStyle.fontSize / 22).toFixed(2)}vw, ${captionStyle.fontSize}px)` }}>{stageCaption}</p> : null}
            {tool === 'transform' && sourceUrl ? <div className={styles.dragHint}><Move size={14} /> Drag to reposition</div> : null}
          </div>
          <input ref={fileInputRef} hidden type="file" accept="video/mp4,video/quicktime,video/webm" onChange={(event) => { const file = event.target.files?.[0]; if (file) inspectFile(file); event.target.value = '' }} />
          <div className={styles.transport}><button disabled={!sourceUrl} onClick={togglePlayback} aria-label={playing ? 'Pause video' : 'Play video'}>{playing ? <Pause size={18} /> : <Play size={18} />}</button><span>{seconds(currentTime)} / {seconds(trimEnd || sourceDuration)}</span><input aria-label="Video position" disabled={!sourceDuration} type="range" min={trimStart} max={trimEnd || sourceDuration || 1} step="0.05" value={clampNumber(currentTime, trimStart, trimEnd || sourceDuration || 1)} onChange={(event) => seekTo(Number(event.target.value))} /></div>
          <div className={styles.mediaActions}><button onClick={() => fileInputRef.current?.click()}><Upload size={16} /> Import video</button>{busy === 'record' ? <button className={styles.danger} onClick={stopRecording}><CircleStop size={16} /> Stop recording</button> : <button disabled={Boolean(busy)} onClick={() => void startRecording()}><Video size={16} /><Mic size={14} /> Record</button>}{sourceFile ? <span>{sourceFile.name} · {(sourceFile.size / 1024 / 1024).toFixed(1)} MB</span> : storagePath ? <span><Check size={14} /> Stored securely</span> : null}<span className={styles.shortcutHint}>Space play · ←/→ seek · Shift 5s</span></div>
          {busy === 'save' && sourceFile ? <div className={styles.progress}><div style={{ width: `${uploadProgress}%` }} /><span>{uploadProgress}% uploaded</span><button onClick={() => uploadAbortRef.current?.abort()}>Cancel</button></div> : null}
          {busy === 'export' ? <div className={styles.progress}><div style={{ width: `${exportProgress}%` }} /><span>{exportProgress}% rendered</span><span>Real-time export</span></div> : null}
          {sourceDuration ? <div className={styles.editTimeline} aria-label="Edit timeline" onClick={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); seekTo(((event.clientX - bounds.left) / bounds.width) * sourceDuration) }}><div className={styles.trimmedBefore} style={{ width: `${(trimStart / sourceDuration) * 100}%` }} /><div className={styles.trimmedAfter} style={{ left: `${((trimEnd || sourceDuration) / sourceDuration) * 100}%` }} />{normalizedCuts.map((cut) => <div key={cut.id} className={styles.cutRange} style={{ left: `${(cut.start / sourceDuration) * 100}%`, width: `${((cut.end - cut.start) / sourceDuration) * 100}%` }} />)}{captionItems.map((caption) => <div key={caption.id} className={styles.captionRange} style={{ left: `${(caption.start / sourceDuration) * 100}%`, width: `${((caption.end - caption.start) / sourceDuration) * 100}%` }} />)}<div className={styles.playhead} style={{ left: `${(currentTime / sourceDuration) * 100}%` }} /></div> : null}
        </section>

        <aside className={styles.inspector}>
          {tool === 'transform' ? <><div className={styles.panelHeading}><div><span>FRAME & CROP</span><h2>Position the video</h2></div><Crop size={19} /></div><div className={styles.quickGrid}><button onClick={() => resetTransform('contain')}><Minimize2 size={15} /> Fit</button><button onClick={() => resetTransform('cover')}><Maximize2 size={15} /> Fill</button><button onClick={() => setTransformPatch({ x: 0, y: 0 })}><AlignCenter size={15} /> Centre</button><button onClick={() => setTransformPatch({ rotation: 0, flipX: false, flipY: false })}><RotateCcw size={15} /> Reset angle</button></div><div className={styles.fields}><RangeField label="Size" value={transform.scale} min={0.25} max={4} step={0.01} display={`${Math.round(transform.scale * 100)}%`} onChange={(scale) => setTransformPatch({ scale })} /><RangeField label="Horizontal" value={transform.x} min={-100} max={100} step={1} display={`${Math.round(transform.x)}%`} onChange={(x) => setTransformPatch({ x })} /><RangeField label="Vertical" value={transform.y} min={-100} max={100} step={1} display={`${Math.round(transform.y)}%`} onChange={(y) => setTransformPatch({ y })} /><RangeField label="Rotation" value={transform.rotation} min={-180} max={180} step={1} display={`${Math.round(transform.rotation)}°`} onChange={(rotation) => setTransformPatch({ rotation })} /><div className={styles.quickGrid}><button className={transform.flipX ? styles.controlActive : ''} onClick={() => setTransformPatch({ flipX: !transform.flipX })}><FlipHorizontal2 size={15} /> Flip X</button><button className={transform.flipY ? styles.controlActive : ''} onClick={() => setTransformPatch({ flipY: !transform.flipY })}><FlipVertical2 size={15} /> Flip Y</button></div><RangeField label="Playback speed" value={playbackRate} min={0.5} max={2} step={0.25} display={`${playbackRate}×`} onChange={updatePlaybackRate} icon={<Gauge size={14} />} /><RangeField label="Volume" value={volume} min={0} max={1} step={0.05} display={`${Math.round(volume * 100)}%`} onChange={updateVolume} /></div></> : null}

          {tool === 'cut' ? <><div className={styles.panelHeading}><div><span>NON-DESTRUCTIVE CUTS</span><h2>Remove unwanted sections</h2></div><Scissors size={19} /></div><div className={styles.cutSummary}><div><span>Source</span><strong>{seconds(sourceDuration)}</strong></div><div><span>Final</span><strong>{seconds(editedDuration)}</strong></div><div><span>Removed</span><strong>{seconds(Math.max(0, (trimEnd || sourceDuration) - trimStart - editedDuration))}</strong></div></div><div className={styles.fields}><div className={styles.boundaryGrid}><button onClick={() => { setTrimStart(Math.min(currentTime, (trimEnd || sourceDuration) - 0.1)); setMessage({ kind: 'ok', text: 'Project starts at the playhead.' }) }}>Set project start</button><button onClick={() => { setTrimEnd(Math.max(currentTime, trimStart + 0.1)); setMessage({ kind: 'ok', text: 'Project ends at the playhead.' }) }}>Set project end</button></div><div className={styles.trimNumeric}><label><span>Start</span><input type="number" min={0} max={trimEnd || sourceDuration} step="0.1" value={trimStart.toFixed(1)} onChange={(event) => setTrimStart(clampNumber(Number(event.target.value), 0, Math.max(0, (trimEnd || sourceDuration) - 0.1)))} /></label><label><span>End</span><input type="number" min={trimStart} max={sourceDuration} step="0.1" value={(trimEnd || sourceDuration).toFixed(1)} onChange={(event) => setTrimEnd(clampNumber(Number(event.target.value), trimStart + 0.1, sourceDuration))} /></label></div><div className={styles.markCut}><button className={cutIn !== null ? styles.controlActive : ''} onClick={() => { setCutIn(currentTime); setMessage({ kind: 'info', text: `Cut starts at ${preciseSeconds(currentTime)}. Move the playhead and set the end.` }) }}>Mark cut start</button><button disabled={cutIn === null} onClick={markCutOut}>Mark cut end</button></div>{cutIn !== null ? <div className={styles.markerNotice}>Cut start: {preciseSeconds(cutIn)} · playhead: {preciseSeconds(currentTime)}</div> : null}<div className={styles.itemList}>{normalizedCuts.length ? normalizedCuts.map((cut, index) => <div key={cut.id} className={styles.timeItem}><button className={styles.itemMain} onClick={() => seekTo(cut.start)}><strong>Cut {index + 1}</strong><span>{preciseSeconds(cut.start)} – {preciseSeconds(cut.end)} · {preciseSeconds(cut.end - cut.start)}</span></button><div className={styles.timeInputs}><input aria-label={`Cut ${index + 1} start`} type="number" step="0.1" value={cut.start.toFixed(1)} onChange={(event) => updateCut(cut.id, { start: Number(event.target.value) })} /><input aria-label={`Cut ${index + 1} end`} type="number" step="0.1" value={cut.end.toFixed(1)} onChange={(event) => updateCut(cut.id, { end: Number(event.target.value) })} /></div><button aria-label={`Delete cut ${index + 1}`} onClick={() => setCuts((current) => current.filter((item) => item.id !== cut.id))}><Trash2 size={15} /></button></div>) : <div className={styles.emptyInspector}>No internal cuts yet. Mark a start and end around anything you want removed.</div>}</div></div></> : null}

          {tool === 'captions' ? <><div className={styles.panelHeading}><div><span>TIMED CAPTIONS</span><h2>Write and time captions</h2></div><Captions size={19} /></div><div className={styles.inspectorActions}><button onClick={addCaption}><Plus size={15} /> Add at playhead</button><button onClick={generateSceneCaptions}><Sparkles size={15} /> From scenes</button></div><label className={styles.toggle}><input type="checkbox" checked={captionsEnabled} onChange={(event) => setCaptionsEnabled(event.target.checked)} /><span>Show captions in playback</span></label><div className={styles.captionList}>{captionItems.map((caption, index) => <button key={caption.id} className={caption.id === selectedCaption?.id ? styles.captionItemActive : ''} onClick={() => { setSelectedCaptionId(caption.id); seekTo(caption.start) }}><span>{String(index + 1).padStart(2, '0')}</span><strong>{caption.text || 'Empty caption'}</strong><em>{preciseSeconds(caption.start)}–{preciseSeconds(caption.end)}</em></button>)}</div>{selectedCaption ? <div className={styles.fields}><label><span>Caption text</span><textarea rows={4} value={selectedCaption.text} maxLength={500} onChange={(event) => updateCaption(selectedCaption.id, { text: event.target.value })} /></label><div className={styles.trimNumeric}><label><span>Start</span><input type="number" step="0.1" value={selectedCaption.start.toFixed(1)} onChange={(event) => updateCaption(selectedCaption.id, { start: Number(event.target.value) })} /></label><label><span>End</span><input type="number" step="0.1" value={selectedCaption.end.toFixed(1)} onChange={(event) => updateCaption(selectedCaption.id, { end: Number(event.target.value) })} /></label></div><label><span>Position</span><select value={selectedCaption.position} onChange={(event) => updateCaption(selectedCaption.id, { position: event.target.value as VideoCaption['position'] })}><option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option></select></label><div className={styles.inspectorActions}><button onClick={splitCaption}><Scissors size={15} /> Split at playhead</button><button className={styles.danger} onClick={() => { setCaptionItems((current) => current.filter((item) => item.id !== selectedCaption.id)); setSelectedCaptionId('') }}><Trash2 size={15} /> Delete</button></div><div className={styles.fieldRow}><label><span>Text</span><input type="color" value={captionStyle.color.slice(0, 7)} onChange={(event) => setCaptionStyle((current) => ({ ...current, color: event.target.value }))} /></label><label><span>Background</span><input type="color" value={captionStyle.background.slice(0, 7)} onChange={(event) => setCaptionStyle((current) => ({ ...current, background: `${event.target.value}dd` }))} /></label></div><RangeField label="Caption size" value={captionStyle.fontSize} min={16} max={72} step={1} display={`${captionStyle.fontSize}px`} onChange={(fontSize) => setCaptionStyle((current) => ({ ...current, fontSize }))} /><label className={styles.toggle}><input type="checkbox" checked={captionStyle.uppercase} onChange={(event) => setCaptionStyle((current) => ({ ...current, uppercase: event.target.checked }))} /><span>Uppercase captions</span></label></div> : <div className={styles.emptyInspector}>Add a caption at the playhead or generate a timed set from the scene outline.</div>}</> : null}

          {tool === 'brand' ? <><div className={styles.panelHeading}><div><span>STORY & BRAND</span><h2>Selected scene</h2></div><span>{scenes.length} scenes</span></div>{selectedScene ? <div className={styles.fields}><label><span>Scene name</span><input value={selectedScene.name} maxLength={120} onChange={(event) => updateScene({ name: event.target.value })} /></label><label><span>Headline</span><textarea value={selectedScene.headline} maxLength={240} rows={3} onChange={(event) => updateScene({ headline: event.target.value })} /></label><label><span>Production note</span><textarea value={selectedScene.note} maxLength={2000} rows={3} onChange={(event) => updateScene({ note: event.target.value })} /></label><div className={styles.fieldRow}><label><span>Duration</span><input type="number" min={1} max={900} value={selectedScene.duration} onChange={(event) => updateScene({ duration: clampNumber(Number(event.target.value) || 1, 1, 900) })} /></label><label><span>Scene colour</span><input type="color" value={selectedScene.color} onChange={(event) => updateScene({ color: event.target.value })} /></label></div><div className={styles.iconActions}><button title="Move earlier" onClick={() => moveScene(-1)}><ArrowUp size={16} /></button><button title="Move later" onClick={() => moveScene(1)}><ArrowDown size={16} /></button><button title="Duplicate scene" onClick={duplicateScene}><Copy size={16} /></button><button title="Delete scene" disabled={scenes.length === 1} onClick={removeScene}><Trash2 size={16} /></button></div></div> : null}<div className={styles.divider} /><div className={styles.panelHeading}><div><span>PRESENTATION</span><h2>Brand and CTA</h2></div></div><div className={styles.fields}><div className={styles.fieldRow}><label><span>Primary</span><input type="color" value={brandColor} onChange={(event) => setBrandColor(event.target.value)} /></label><label><span>Accent</span><input type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} /></label></div><label className={styles.toggle}><input type="checkbox" checked={watermark} onChange={(event) => setWatermark(event.target.checked)} /><span>Show Online2Day watermark</span></label><label><span>CTA label</span><input value={ctaLabel} maxLength={100} onChange={(event) => setCtaLabel(event.target.value)} /></label><label><span>CTA destination</span><input type="url" value={ctaUrl} maxLength={2000} onChange={(event) => setCtaUrl(event.target.value)} /></label></div></> : null}
        </aside>
      </div>

      <section className={styles.timelinePanel}><div className={styles.panelHeading}><div><span>STORYBOARD</span><h2>Scene outline</h2></div><button onClick={addScene}><Plus size={15} /> Add scene</button></div><div className={styles.timeline} style={{ gridTemplateColumns: scenes.map((scene) => `${Math.max(scene.duration, 3)}fr`).join(' ') }}>{scenes.map((scene, index) => <button key={scene.id} className={scene.id === selectedSceneId ? styles.sceneActive : ''} style={{ borderTopColor: scene.color }} onClick={() => { setSelectedSceneId(scene.id); setTool('brand') }}><span>{String(index + 1).padStart(2, '0')}</span><strong>{scene.name}</strong><em>{scene.duration}s</em></button>)}</div><div className={styles.timelineSummary}><span>{scenes.length} scenes</span><span>{seconds(projectDuration)} planned story</span>{sourceDuration ? <span>{seconds(editedDuration)} edited video</span> : null}<span>{normalizedCuts.length} cuts</span><span>{captionItems.length} captions</span></div></section>
      <section className={styles.emailPanel}><div className={styles.panelHeading}><div><span>PUBLISH & HANDOFF</span><h2>Email the saved video</h2></div><Mail size={20} /></div><div className={styles.emailGrid}><div className={styles.fields}><label><span>Recipient</span><input type="email" value={emailTo} onChange={(event) => setEmailTo(event.target.value)} /></label><label><span>Subject</span><input value={emailSubject} maxLength={240} onChange={(event) => setEmailSubject(event.target.value)} /></label><label><span>Message</span><textarea rows={6} value={emailBody} maxLength={10000} onChange={(event) => setEmailBody(event.target.value)} /></label></div><div className={styles.emailPreview}><span>PERSONALISED VIDEO</span><strong>{title || 'Untitled video'}</strong><p>{emailBody.split('\n')[0]}</p><div style={{ background: brandColor }}>{ctaLabel || 'Watch video'}</div><small>{shareUrl || 'The secure share link is created when you save.'}</small></div></div><div className={styles.handoffActions}><span>Saving publishes the exact framing, cuts and captions to the secure video page. Sending is delivered through the Online2Day API and logged against the CRM lead when selected.</span><button className={styles.primary} disabled={Boolean(busy)} onClick={() => void sendEmail()}>{busy === 'send' ? <Loader2 className={styles.spin} size={16} /> : <Send size={16} />} Save and send</button></div></section>
    </main>
  </div>
}

function RangeField({ label, value, min, max, step, display, onChange, icon }: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (value: number) => void; icon?: React.ReactNode }) {
  return <label className={styles.rangeField}><span>{icon}{label}<b>{display}</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>
}
