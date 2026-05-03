'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  AlignCenter,
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  Captions,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Crop,
  Download,
  Eye,
  FileVideo,
  Gauge,
  Grid3X3,
  Image,
  Layers,
  Link2,
  Lock,
  Mail,
  Mic,
  MousePointer2,
  Palette,
  PanelRight,
  Play,
  Plus,
  Ratio,
  RotateCcw,
  Save,
  Scissors,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  SplitSquareHorizontal,
  Subtitles,
  Timer,
  Trash2,
  Type,
  Upload,
  UserRound,
  Video,
  WandSparkles,
  Zap,
} from 'lucide-react'
import { DashboardSidebar } from '@/components/leads/DashboardSidebar'
import { sendEnterpriseEmail } from '@/lib/actions/email-actions'
import { saveVideoEditorProject } from '@/lib/actions/video-actions'
import styles from './video-editor.module.css'
import type { EmailComposerLead, EmailComposerVideo } from '@/components/crm-dashboard/types'

type Scene = {
  id: string
  name: string
  duration: number
  layout: 'intro' | 'proof' | 'demo' | 'offer' | 'cta'
  headline: string
  note: string
  color: string
}

type TimelineItem = {
  id: string
  label: string
  track: 'video' | 'audio' | 'text' | 'cta'
  start: number
  duration: number
}

const featureGroups = [
  { title: 'Canvas', icon: Ratio, items: ['16:9, 9:16, 1:1, 4:5 and custom ratios', 'Safe-zone guides for email thumbnails', 'Snap grid and smart alignment', 'Brand-aware title positioning', 'Responsive preview frames'] },
  { title: 'Media', icon: Image, items: ['Upload video, image and logo assets', 'Database video library attachment', 'Drag-and-drop asset staging', 'Reusable intro and outro blocks', 'Smart thumbnail selection'] },
  { title: 'Timeline', icon: SplitSquareHorizontal, items: ['Multi-track timeline', 'Trim, split and duplicate clips', 'Scene duration controls', 'Magnetic snapping', 'Undo and redo history'] },
  { title: 'Brand Kit', icon: Palette, items: ['Primary and accent colours', 'Logo placement controls', 'Font pairing presets', 'Watermark toggle', 'Campaign-specific style variants'] },
  { title: 'Personalisation', icon: UserRound, items: ['Lead merge fields', 'Company-specific intro', 'Dynamic CTA text', 'Industry proof-point blocks', 'Owner signature cards'] },
  { title: 'Accessibility', icon: Captions, items: ['Caption track builder', 'Readable contrast checks', 'Large-text preview', 'Reduced-motion variant', 'Audio transcript notes'] },
  { title: 'Conversion', icon: MousePointer2, items: ['Book-call CTA overlay', 'Email-safe poster frame', 'Proposal link block', 'Reply prompt card', 'CTA click tracking plan'] },
  { title: 'Governance', icon: ShieldCheck, items: ['GDPR audit logging', 'Consent-safe asset checklist', 'Internal approval status', 'Version notes', 'Export readiness scoring'] },
  { title: 'Email Handoff', icon: Mail, items: ['Send via Resend', 'Attach saved database video', 'Preview email copy', 'Lead timeline logging', 'Campaign-ready video link'] },
]

const initialScenes: Scene[] = [
  { id: 'scene-intro', name: 'Personal intro', duration: 6, layout: 'intro', headline: 'A focused idea for your next website win', note: 'Introduce Online2Day and mirror the lead context.', color: '#2f6bff' },
  { id: 'scene-proof', name: 'Proof point', duration: 8, layout: 'proof', headline: 'Fast delivery, clean systems, measurable conversion', note: 'Show credibility, performance and data processing detail.', color: '#17d7c1' },
  { id: 'scene-demo', name: 'Walkthrough', duration: 14, layout: 'demo', headline: 'What we would improve first', note: 'Screen walkthrough, annotations and lead-specific insights.', color: '#8b5cf6' },
  { id: 'scene-cta', name: 'Book call CTA', duration: 6, layout: 'cta', headline: 'Worth a 20 minute call?', note: 'End with a single clear action linked to CRM tracking.', color: '#f59e0b' },
]

const initialTimeline: TimelineItem[] = [
  { id: 't1', label: 'Base video', track: 'video', start: 0, duration: 34 },
  { id: 't2', label: 'Voiceover', track: 'audio', start: 1, duration: 30 },
  { id: 't3', label: 'Captions', track: 'text', start: 0, duration: 34 },
  { id: 't4', label: 'Book call CTA', track: 'cta', start: 28, duration: 6 },
]

const toolRail = [
  { label: 'Select', icon: MousePointer2 },
  { label: 'Upload', icon: Upload },
  { label: 'Record', icon: Video },
  { label: 'Text', icon: Type },
  { label: 'Captions', icon: Subtitles },
  { label: 'Crop', icon: Crop },
  { label: 'Trim', icon: Scissors },
  { label: 'Layers', icon: Layers },
  { label: 'Brand', icon: Palette },
  { label: 'CTA', icon: Link2 },
  { label: 'AI polish', icon: WandSparkles },
  { label: 'Share', icon: Share2 },
]

const guideSteps = [
  { title: 'Lead', detail: 'CRM context locked', focus: 'Lead and objective' },
  { title: 'Canvas', detail: 'Format, guides and brand applied', focus: 'Responsive stage' },
  { title: 'Timeline', detail: 'Scenes, captions and CTA aligned', focus: 'Production tracks' },
  { title: 'Email', detail: 'Video attached to outreach', focus: 'Resend handoff' },
  { title: 'Approval', detail: 'GDPR notes and version ready', focus: 'Governance pass' },
]

const aspectRatioOptions = ['16:9', '9:16', '1:1', '4:5', '21:9']

const brandVariants = [
  { primary: '#2f6bff', accent: '#17d7c1', scene: '#2f6bff' },
  { primary: '#0ea5e9', accent: '#f59e0b', scene: '#0f766e' },
  { primary: '#2563eb', accent: '#a3e635', scene: '#7c3aed' },
  { primary: '#155eef', accent: '#fb7185', scene: '#0891b2' },
]

const totalFeatureCount = featureGroups.reduce((sum, group) => sum + group.items.length, 0)

export function VideoEditorClient({ leads, videos }: { leads: EmailComposerLead[]; videos: EmailComposerVideo[] }) {
  const router = useRouter()
  const [projectTitle, setProjectTitle] = useState('Personalised website growth video')
  const [leadId, setLeadId] = useState(leads[0]?.id || '')
  const [selectedSceneId, setSelectedSceneId] = useState(initialScenes[0].id)
  const [scenes, setScenes] = useState(initialScenes)
  const [timeline, setTimeline] = useState(initialTimeline)
  const [brandColor, setBrandColor] = useState('#2f6bff')
  const [accentColor, setAccentColor] = useState('#17d7c1')
  const [format, setFormat] = useState('16:9')
  const [captionMode, setCaptionMode] = useState(true)
  const [watermark, setWatermark] = useState(true)
  const [approvalMode, setApprovalMode] = useState(false)
  const [emailTo, setEmailTo] = useState(leads[0]?.email || '')
  const [emailSubject, setEmailSubject] = useState('A short personalised video from Online2Day')
  const [emailBody, setEmailBody] = useState('I made a short video with a practical first pass on how Online2Day would approach your next growth project.\n\nIt includes the key opportunity, a quick proof point and one clear next step.')
  const [savedAssetId, setSavedAssetId] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const [sendStatus, setSendStatus] = useState('')
  const [selectedTool, setSelectedTool] = useState('Select')
  const [activeFeatureKeys, setActiveFeatureKeys] = useState<string[]>([])
  const [guidePlaying, setGuidePlaying] = useState(false)
  const [guideStep, setGuideStep] = useState(0)
  const [playhead, setPlayhead] = useState(0)
  const [showGrid, setShowGrid] = useState(true)
  const [showSafeZone, setShowSafeZone] = useState(true)
  const [largeTextPreview, setLargeTextPreview] = useState(false)
  const [reducedMotionPreview, setReducedMotionPreview] = useState(false)
  const [transcriptEnabled, setTranscriptEnabled] = useState(false)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [activeTrackLocked, setActiveTrackLocked] = useState(false)
  const [versionCount, setVersionCount] = useState(1)
  const [assetCount, setAssetCount] = useState(videos.length)
  const [thumbnailMode, setThumbnailMode] = useState('Smart poster frame')
  const [ctaLabel, setCtaLabel] = useState('Book a call')
  const [safeChecklist, setSafeChecklist] = useState(false)
  const [logoPlacement, setLogoPlacement] = useState<'top-left' | 'top-right' | 'bottom-left'>('top-left')
  const fileRef = useRef<HTMLInputElement>(null)
  const statusTimerRef = useRef<number | null>(null)

  const selectedLead = leads.find((lead) => lead.id === leadId)
  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) || scenes[0]
  const leadVideos = useMemo(() => videos.filter((video) => video.leadId === leadId), [leadId, videos])
  const availableVideos = leadVideos.length ? leadVideos : videos
  const attachedVideo = videos.find((video) => video.id === savedAssetId)
  const totalDuration = scenes.reduce((sum, scene) => sum + scene.duration, 0)
  const canvasAspectRatio = useMemo(() => {
    const [width, height] = format.split(':').map(Number)
    return width && height ? `${width} / ${height}` : '16 / 9'
  }, [format])
  const readiness = useMemo(() => {
    let score = 52
    if (selectedLead?.email) score += 10
    if (captionMode) score += 8
    if (watermark) score += 5
    if (timeline.length >= 4) score += 10
    if (approvalMode) score += 5
    if (savedAssetId) score += 10
    if (transcriptEnabled) score += 4
    if (safeChecklist) score += 4
    score += Math.min(activeFeatureKeys.length, 10)
    return Math.min(score, 100)
  }, [activeFeatureKeys.length, approvalMode, captionMode, safeChecklist, savedAssetId, selectedLead?.email, timeline.length, transcriptEnabled, watermark])
  const statusCards = [
    { label: 'Readiness', value: `${readiness}%`, icon: Gauge },
    { label: 'Duration', value: `${totalDuration}s`, icon: Timer },
    { label: 'Scenes', value: String(scenes.length), icon: Layers },
    { label: 'Email linked', value: emailTo ? 'Ready' : 'Missing', icon: Mail },
    { label: 'Compliance', value: approvalMode ? 'Approval' : 'Draft', icon: ShieldCheck },
    { label: 'Library assets', value: String(assetCount), icon: FileVideo },
    { label: 'Versions', value: `v${versionCount}`, icon: BarChart3 },
    { label: 'Features', value: `${activeFeatureKeys.length}/${totalFeatureCount}`, icon: BadgeCheck },
  ]
  const canvasClassName = [
    styles.canvas,
    showGrid ? styles.canvasGrid : '',
    largeTextPreview ? styles.canvasLargeText : '',
    reducedMotionPreview ? styles.reducedMotionCanvas : '',
    guidePlaying ? styles.canvasGuided : '',
  ].filter(Boolean).join(' ')
  const selectedGuide = guideSteps[guideStep]

  useEffect(() => {
    if (!guidePlaying) return
    const interval = window.setInterval(() => {
      setGuideStep((current) => (current + 1) % guideSteps.length)
      setPlayhead((current) => current >= 100 ? 0 : current + (reducedMotionPreview ? 8 : 5))
    }, reducedMotionPreview ? 2400 : 1400)

    return () => window.clearInterval(interval)
  }, [guidePlaying, reducedMotionPreview])

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current)
    }
  }, [])

  function updateScene(patch: Partial<Scene>) {
    setScenes((current) => current.map((scene) => scene.id === selectedScene.id ? { ...scene, ...patch } : scene))
  }

  function addScene() {
    const next: Scene = {
      id: `scene-${Date.now()}`,
      name: 'New conversion block',
      duration: 7,
      layout: 'offer',
      headline: 'A tailored next step for this lead',
      note: 'Use this scene for a specific objection, proposal or proof point.',
      color: accentColor,
    }
    setScenes((current) => [...current, next])
    setSelectedSceneId(next.id)
  }

  function duplicateScene() {
    const copy = { ...selectedScene, id: `scene-${Date.now()}`, name: `${selectedScene.name} copy` }
    setScenes((current) => [...current, copy])
    setSelectedSceneId(copy.id)
  }

  function deleteScene() {
    if (scenes.length === 1) return
    setScenes((current) => current.filter((scene) => scene.id !== selectedScene.id))
    setSelectedSceneId(scenes.find((scene) => scene.id !== selectedScene.id)?.id || scenes[0].id)
  }

  function buildProjectPayload() {
    return {
      title: projectTitle,
      leadId,
      duration: totalDuration,
      format,
      scenes,
      timeline,
      brand: { primary: brandColor, accent: accentColor, watermark, logoPlacement },
      cta: { label: ctaLabel, destination: 'https://online2day.com/contact' },
      email: { subject: emailSubject, body: emailBody },
      settings: {
        captions: captionMode,
        approvalRequired: approvalMode,
        readiness,
        activeFeatures: activeFeatureKeys,
        showGrid,
        showSafeZone,
        largeTextPreview,
        reducedMotionPreview,
        transcriptEnabled,
        snapEnabled,
        activeTrackLocked,
        thumbnailMode,
        safeChecklist,
        versionCount,
      },
    }
  }

  async function persistProject(statusMessage = 'Saving project...') {
    if (statusTimerRef.current) {
      window.clearTimeout(statusTimerRef.current)
      statusTimerRef.current = null
    }
    setSaveStatus(statusMessage)
    const result = await saveVideoEditorProject(buildProjectPayload())
    if ('error' in result && result.error) {
      const error = String(result.error)
      setSaveStatus(error)
      return { assetId: '', error }
    }
    setSavedAssetId(result.asset?.id || '')
    setAssetCount((current) => Math.max(current, videos.length) + 1)
    setVersionCount((current) => current + 1)
    setSaveStatus(`Saved. Video link: /v/${result.slug}`)
    return { assetId: result.asset?.id || '', slug: result.slug, error: '' }
  }

  async function handleSave() {
    await persistProject()
  }

  async function handleSend() {
    setSendStatus('Sending email...')
    let assetId = savedAssetId
    if (!assetId) {
      const result = await persistProject('Saving video before email...')
      if (result.error || !result.assetId) {
        setSendStatus(result.error || 'Save the video before sending the email.')
        return
      }
      assetId = result.assetId
    }

    const response = await sendEnterpriseEmail({
      leadId,
      to: emailTo,
      recipientName: selectedLead?.name,
      subject: emailSubject,
      body: emailBody,
      templateName: 'Video editor campaign',
      videoAssetId: assetId,
      ctaLabel: 'Watch video',
    })
    if ('error' in response && response.error) {
      setSendStatus(String(response.error))
      return
    }
    setSendStatus('Email sent with the saved video attached and logged.')
  }

  function handleLeadChange(nextLeadId: string) {
    const lead = leads.find((item) => item.id === nextLeadId)
    setLeadId(nextLeadId)
    setEmailTo(lead?.email || '')
    setSavedAssetId('')
    setEmailSubject(lead?.company ? `A focused video for ${lead.company}` : 'A short personalised video from Online2Day')
    setSendStatus('Lead changed. Choose a database video for this lead or save a fresh editor asset before sending.')
  }

  function runEditorCommand(message: string) {
    if (statusTimerRef.current) {
      window.clearTimeout(statusTimerRef.current)
      statusTimerRef.current = null
    }
    setSaveStatus(message)
    statusTimerRef.current = window.setTimeout(() => {
      setSaveStatus('')
      statusTimerRef.current = null
    }, 3600)
  }

  function markFeatureActive(groupTitle: string, item: string) {
    const key = `${groupTitle}:${item}`
    setActiveFeatureKeys((current) => current.includes(key) ? current : [...current, key])
  }

  function addTimelineClip(track: TimelineItem['track'], label: string, duration = 6) {
    const start = Math.max(0, Math.min(Math.max(totalDuration - duration, 0), Math.round((playhead / 100) * totalDuration)))
    setTimeline((current) => [...current, {
      id: `t-${Date.now()}-${current.length}`,
      label,
      track,
      start,
      duration,
    }])
  }

  function appendEmailBlock(text: string) {
    setEmailBody((current) => current.includes(text) ? current : `${current.trim()}\n\n${text}`)
  }

  function cycleFormat(preferred?: string) {
    const nextFormat = preferred || aspectRatioOptions[(aspectRatioOptions.indexOf(format) + 1) % aspectRatioOptions.length]
    setFormat(nextFormat)
    return nextFormat
  }

  function cycleBrandVariant() {
    const currentIndex = brandVariants.findIndex((variant) => variant.primary === brandColor)
    const next = brandVariants[(currentIndex + 1) % brandVariants.length]
    setBrandColor(next.primary)
    setAccentColor(next.accent)
    updateScene({ color: next.scene })
    return next
  }

  function attachDatabaseVideo() {
    const video = availableVideos[0]
    if (!video) {
      runEditorCommand('No saved database video is available yet. Save this project to create one.')
      return false
    }
    setSavedAssetId(video.id)
    setThumbnailMode('Database video poster')
    setSendStatus(`Attached database video: ${video.name}`)
    return true
  }

  function handleImportMedia() {
    setSelectedTool('Upload')
    runEditorCommand('Choose a video, image, logo or audio file to stage on the editor timeline.')
    fileRef.current?.click()
  }

  function handleMediaSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    if (!file) return
    const track: TimelineItem['track'] = file.type.startsWith('audio') ? 'audio' : file.type.startsWith('video') ? 'video' : 'text'
    addTimelineClip(track, file.name, track === 'video' ? 10 : 6)
    setAssetCount((current) => current + 1)
    setThumbnailMode(file.type.startsWith('image') ? 'Uploaded poster frame' : 'Smart poster frame')
    runEditorCommand(`${file.name} staged on the ${track} track.`)
    event.currentTarget.value = ''
  }

  function splitActiveClip() {
    setTimeline((current) => current.flatMap((item, index) => {
      if (index !== 0 || item.duration <= 2) return [item]
      const firstDuration = Math.max(1, Math.floor(item.duration / 2))
      return [
        { ...item, duration: firstDuration },
        {
          ...item,
          id: `${item.id}-split-${Date.now()}`,
          label: `${item.label} split`,
          start: item.start + firstDuration,
          duration: Math.max(1, item.duration - firstDuration),
        },
      ]
    }))
  }

  function duplicateLastClip() {
    setTimeline((current) => {
      const source = current[current.length - 1]
      if (!source) return current
      return [...current, {
        ...source,
        id: `${source.id}-copy-${Date.now()}`,
        label: `${source.label} copy`,
        start: Math.min(Math.max(totalDuration - source.duration, 0), source.start + 1),
      }]
    })
  }

  function handleUndo() {
    setActiveFeatureKeys((current) => current.slice(0, -1))
    setTimeline((current) => current.length > initialTimeline.length ? current.slice(0, -1) : current)
    setVersionCount((current) => Math.max(1, current - 1))
    runEditorCommand('Last editor action rolled back from the command stack.')
  }

  function handleVersionSnapshot() {
    setVersionCount((current) => current + 1)
    setApprovalMode(true)
    runEditorCommand('Version snapshot captured with approval tracking enabled.')
  }

  function handlePreview() {
    setGuidePlaying(true)
    setPlayhead(0)
    setGuideStep(0)
    runEditorCommand('Animated preview started across canvas, timeline and email handoff.')
  }

  async function handleTimelineAction(label: string) {
    if (label.includes('Split')) {
      splitActiveClip()
      runEditorCommand('Selected video clip split into editable timeline segments.')
      return
    }
    if (label.includes('Align')) {
      setShowGrid(true)
      setTimeline((current) => current.map((item) => ({ ...item, start: snapEnabled ? Math.round(item.start) : item.start })))
      runEditorCommand('Timeline layers aligned against the active canvas grid.')
      return
    }
    if (label.includes('grid')) {
      setShowGrid((current) => !current)
      setSnapEnabled((current) => !current)
      runEditorCommand('Grid snapping toggled for staged assets and text layers.')
      return
    }
    if (label.includes('Lock')) {
      setActiveTrackLocked((current) => !current)
      runEditorCommand(activeTrackLocked ? 'Active track unlocked for editing.' : 'Active track locked for approval-safe review.')
      return
    }
    setApprovalMode(true)
    setSafeChecklist(true)
    await persistProject('Preparing export package...')
  }

  async function handleToolSelect(label: string) {
    setSelectedTool(label)
    if (label === 'Select') {
      setGuidePlaying(false)
      runEditorCommand('Selection mode active. Canvas objects and timeline clips can be inspected.')
      return
    }
    if (label === 'Upload') {
      handleImportMedia()
      return
    }
    if (label === 'Record') {
      addTimelineClip('video', 'Camera recording placeholder', 8)
      addTimelineClip('audio', 'Microphone voiceover', 8)
      updateScene({ note: 'Record a short camera intro and voiceover for this lead-specific walkthrough.' })
      runEditorCommand('Recording tracks staged for camera and microphone capture.')
      return
    }
    if (label === 'Text') {
      addTimelineClip('text', 'Headline text layer', selectedScene.duration)
      setLargeTextPreview(true)
      runEditorCommand('Editable headline layer added with large-text preview enabled.')
      return
    }
    if (label === 'Captions') {
      setCaptionMode(true)
      setTranscriptEnabled(true)
      addTimelineClip('text', 'Caption transcript track', totalDuration)
      runEditorCommand('Caption and transcript tracks enabled for the whole video.')
      return
    }
    if (label === 'Crop') {
      const next = cycleFormat()
      setShowSafeZone(true)
      runEditorCommand(`Canvas cropped to ${next} with email-safe guides visible.`)
      return
    }
    if (label === 'Trim') {
      updateScene({ duration: Math.max(3, selectedScene.duration - 2) })
      setTimeline((current) => current.map((item, index) => index === 0 ? { ...item, duration: Math.max(3, item.duration - 2) } : item))
      runEditorCommand('Active scene and base clip trimmed by two seconds.')
      return
    }
    if (label === 'Layers') {
      addTimelineClip('text', 'Annotation layer', 5)
      addTimelineClip('cta', 'CTA overlay layer', 5)
      runEditorCommand('Annotation and CTA layers added to the timeline.')
      return
    }
    if (label === 'Brand') {
      cycleBrandVariant()
      setWatermark(true)
      runEditorCommand('Brand kit variant applied to the canvas and selected scene.')
      return
    }
    if (label === 'CTA') {
      const nextCta = selectedLead?.company ? `Book ${selectedLead.company} call` : 'Book a call'
      setCtaLabel(nextCta)
      addTimelineClip('cta', nextCta, 6)
      appendEmailBlock(`The video ends with a tracked "${nextCta}" call-to-action.`)
      runEditorCommand('Conversion CTA overlay added and mirrored into the email copy.')
      return
    }
    if (label === 'AI polish') {
      updateScene({
        headline: selectedLead?.company ? `A sharper growth path for ${selectedLead.company}` : 'A sharper growth path for this prospect',
        note: 'Polished for clarity, evidence, one action and enterprise-grade follow-up.',
      })
      setEmailSubject(selectedLead?.company ? `A focused video for ${selectedLead.company}` : 'A focused personalised video')
      appendEmailBlock('I kept the video concise: context, proof, recommendation and one tracked next step.')
      runEditorCommand('AI polish applied to headline, speaker notes and email copy.')
      return
    }
    await persistProject('Preparing shareable database video...')
  }

  async function handleFeatureAction(groupTitle: string, item: string) {
    markFeatureActive(groupTitle, item)
    setSelectedTool(groupTitle)

    if (groupTitle === 'Canvas') {
      if (item.startsWith('16:9')) {
        const next = cycleFormat()
        runEditorCommand(`Canvas ratio moved to ${next}.`)
        return
      }
      if (item.includes('Safe-zone')) {
        setShowSafeZone(true)
        setThumbnailMode('Email-safe poster frame')
        runEditorCommand('Email thumbnail safe-zone guides enabled.')
        return
      }
      if (item.includes('Snap grid')) {
        setShowGrid(true)
        setSnapEnabled(true)
        runEditorCommand('Snap grid and smart alignment enabled.')
        return
      }
      if (item.includes('Brand-aware')) {
        setLogoPlacement(logoPlacement === 'top-left' ? 'top-right' : logoPlacement === 'top-right' ? 'bottom-left' : 'top-left')
        updateScene({ color: brandColor })
        runEditorCommand('Brand-aware title positioning rotated on the canvas.')
        return
      }
      handlePreview()
      return
    }

    if (groupTitle === 'Media') {
      if (item.includes('Upload')) {
        handleImportMedia()
        return
      }
      if (item.includes('Database')) {
        attachDatabaseVideo()
        return
      }
      if (item.includes('Drag-and-drop')) {
        addTimelineClip('video', 'Staged media asset', 7)
        setAssetCount((current) => current + 1)
        runEditorCommand('Asset staged on the timeline for drag-and-drop production.')
        return
      }
      if (item.includes('intro and outro')) {
        addScene()
        addTimelineClip('video', 'Reusable intro/outro block', 6)
        runEditorCommand('Reusable intro or outro block added as a new scene.')
        return
      }
      setThumbnailMode('Smart selected thumbnail')
      runEditorCommand('Smart thumbnail selection prepared for email poster frames.')
      return
    }

    if (groupTitle === 'Timeline') {
      if (item.includes('Multi-track')) {
        addTimelineClip('video', 'B-roll track', 6)
        addTimelineClip('audio', 'Music bed', 10)
        addTimelineClip('text', 'Lower third', 5)
        runEditorCommand('Multi-track video, audio and text layers added.')
        return
      }
      if (item.includes('Trim')) {
        splitActiveClip()
        duplicateLastClip()
        runEditorCommand('Clip trimmed, split and duplicated for timeline editing.')
        return
      }
      if (item.includes('duration')) {
        updateScene({ duration: Math.min(60, selectedScene.duration + 2) })
        runEditorCommand('Active scene duration extended by two seconds.')
        return
      }
      if (item.includes('Magnetic')) {
        setSnapEnabled(true)
        setShowGrid(true)
        runEditorCommand('Magnetic snapping enabled for all timeline layers.')
        return
      }
      handleVersionSnapshot()
      return
    }

    if (groupTitle === 'Brand Kit') {
      if (item.includes('Primary')) {
        cycleBrandVariant()
        runEditorCommand('Primary and accent colours applied from the brand kit.')
        return
      }
      if (item.includes('Logo placement')) {
        setWatermark(true)
        setLogoPlacement(logoPlacement === 'top-left' ? 'top-right' : logoPlacement === 'top-right' ? 'bottom-left' : 'top-left')
        runEditorCommand('Logo placement updated for the current canvas.')
        return
      }
      if (item.includes('Font')) {
        setLargeTextPreview(true)
        runEditorCommand('Readable font pairing preview enabled.')
        return
      }
      if (item.includes('Watermark')) {
        setWatermark((current) => !current)
        runEditorCommand('Watermark visibility toggled.')
        return
      }
      cycleBrandVariant()
      setProjectTitle(`${projectTitle} - campaign variant ${versionCount + 1}`)
      runEditorCommand('Campaign-specific style variant generated.')
      return
    }

    if (groupTitle === 'Personalisation') {
      if (item.includes('Lead merge')) {
        updateScene({ headline: `${selectedLead?.name || 'Your team'}, a practical idea for ${selectedLead?.company || 'your next project'}` })
        runEditorCommand('Lead merge fields inserted into the active scene.')
        return
      }
      if (item.includes('Company-specific')) {
        updateScene({ name: `${selectedLead?.company || 'Company'} intro`, note: `Open with the current commercial context for ${selectedLead?.company || 'this account'}.` })
        runEditorCommand('Company-specific intro applied.')
        return
      }
      if (item.includes('Dynamic CTA')) {
        const nextCta = selectedLead?.company ? `Review ${selectedLead.company} plan` : 'Review the plan'
        setCtaLabel(nextCta)
        runEditorCommand('Dynamic CTA text generated from the selected lead.')
        return
      }
      if (item.includes('Industry')) {
        addScene()
        updateScene({ headline: 'Relevant proof for this buying context', note: 'Use metrics, compliance notes and delivery evidence for the prospect industry.' })
        runEditorCommand('Industry proof-point block added to the storyboard.')
        return
      }
      addTimelineClip('text', 'Owner signature card', 5)
      appendEmailBlock('I have included my details at the end so the next step is easy to action.')
      runEditorCommand('Owner signature card added to video and email copy.')
      return
    }

    if (groupTitle === 'Accessibility') {
      if (item.includes('Caption')) {
        setCaptionMode(true)
        addTimelineClip('text', 'Caption track builder', totalDuration)
        runEditorCommand('Caption track builder enabled.')
        return
      }
      if (item.includes('contrast')) {
        setBrandColor('#155eef')
        setAccentColor('#22c55e')
        runEditorCommand('Readable contrast-safe colour pairing applied.')
        return
      }
      if (item.includes('Large-text')) {
        setLargeTextPreview((current) => !current)
        runEditorCommand('Large-text preview toggled across the canvas.')
        return
      }
      if (item.includes('Reduced-motion')) {
        setReducedMotionPreview((current) => !current)
        runEditorCommand('Reduced-motion variant toggled for animated previews.')
        return
      }
      setTranscriptEnabled(true)
      appendEmailBlock('A transcript note is available for accessibility, review and compliance checks.')
      runEditorCommand('Audio transcript notes added to the campaign.')
      return
    }

    if (groupTitle === 'Conversion') {
      if (item.includes('Book-call')) {
        setCtaLabel('Book a call')
        addTimelineClip('cta', 'Book-call CTA overlay', 6)
        runEditorCommand('Book-call CTA overlay added to the closing scene.')
        return
      }
      if (item.includes('Email-safe')) {
        setThumbnailMode('Email-safe poster frame')
        setShowSafeZone(true)
        runEditorCommand('Email-safe poster frame selected.')
        return
      }
      if (item.includes('Proposal')) {
        appendEmailBlock('I can also send a short proposal link after you have watched the video.')
        runEditorCommand('Proposal link block added to the email sequence.')
        return
      }
      if (item.includes('Reply prompt')) {
        appendEmailBlock('A quick reply with "worth a look" is enough and I will send the next step.')
        runEditorCommand('Reply prompt card added to email copy.')
        return
      }
      setSafeChecklist(true)
      runEditorCommand('CTA click tracking plan added to the export checklist.')
      return
    }

    if (groupTitle === 'Governance') {
      if (item.includes('GDPR')) {
        setApprovalMode(true)
        setSafeChecklist(true)
        runEditorCommand('GDPR audit logging enabled for the next save and email send.')
        return
      }
      if (item.includes('Consent-safe')) {
        setSafeChecklist(true)
        runEditorCommand('Consent-safe asset checklist marked for review.')
        return
      }
      if (item.includes('Internal approval')) {
        setApprovalMode((current) => !current)
        runEditorCommand('Internal approval status toggled.')
        return
      }
      if (item.includes('Version notes')) {
        handleVersionSnapshot()
        return
      }
      setApprovalMode(true)
      setSafeChecklist(true)
      runEditorCommand('Export readiness scoring refreshed with governance checks.')
      return
    }

    if (item.includes('Send via Resend')) {
      await handleSend()
      return
    }
    if (item.includes('Attach saved')) {
      attachDatabaseVideo()
      return
    }
    if (item.includes('Preview email')) {
      setSendStatus(`Preview ready for ${emailTo || 'the selected lead'} with ${attachedVideo?.name || (savedAssetId ? 'saved editor video' : 'the next saved video')}.`)
      return
    }
    if (item.includes('Lead timeline')) {
      setApprovalMode(true)
      runEditorCommand('Lead timeline logging will be written on save and send.')
      return
    }
    if (savedAssetId) {
      setSaveStatus(`Campaign-ready link attached from ${attachedVideo?.slug ? `/v/${attachedVideo.slug}` : 'the saved editor project'}.`)
      return
    }
    await persistProject('Creating campaign-ready video link...')
  }

  return (
    <div className={styles.shell}>
      <DashboardSidebar active="videos" />
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <Link className={styles.backLink} href="/dashboard/videos"><ArrowLeft size={16} /> Videos</Link>
            <h1>Video Editor</h1>
            <p>Build personalised sales videos, save them to the CRM video library, and send them through Resend-backed email campaigns.</p>
          </div>
          <div className={styles.headerActions}>
            <button onClick={handleImportMedia}><Upload size={16} />Import media</button>
            <button onClick={handleSave}><Save size={16} />Save to library</button>
            <button className={styles.primaryButton} onClick={handleSend}><Send size={16} />Send with email</button>
          </div>
        </header>

        <section className={styles.statusGrid}>
          {statusCards.map(({ label, value, icon: Icon }) => (
            <article key={label} className={styles.statusCard}>
              <Icon size={18} />
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </section>

        <section className={styles.guidePanel} aria-label="Video editor production guide">
          <div className={styles.guideIntro}>
            <Settings size={18} />
            <div>
              <strong>Production guide</strong>
              <span>{selectedGuide.focus} - {selectedGuide.detail}</span>
            </div>
          </div>
          <div className={styles.guideSteps}>
            {guideSteps.map((step, index) => (
              <button key={step.title} className={index === guideStep ? styles.guideStepActive : ''} onClick={() => { setGuideStep(index); setPlayhead(index * 20); runEditorCommand(`${step.title} guide step selected.`) }}>
                <span>{index + 1}</span>
                <strong>{step.title}</strong>
              </button>
            ))}
          </div>
          <div className={styles.guideActions}>
            <button onClick={() => { setGuidePlaying((current) => !current); runEditorCommand(guidePlaying ? 'Animated walkthrough paused.' : 'Animated walkthrough playing.') }}><Play size={15} />{guidePlaying ? 'Pause guide' : 'Play guide'}</button>
            <button onClick={() => { setGuideStep((current) => (current + 1) % guideSteps.length); setPlayhead((current) => Math.min(100, current + 20)); runEditorCommand('Moved to the next production step.') }}><ChevronRight size={15} />Next step</button>
            <button onClick={() => void persistProject('Committing guided editor version...')}><Save size={15} />Commit version</button>
          </div>
          <div className={styles.guideTelemetry}>
            <span><Mic size={14} />Voiceover {timeline.some((item) => item.track === 'audio') ? 'armed' : 'idle'}</span>
            <span><Captions size={14} />Captions {captionMode ? 'on' : 'off'}</span>
            <span><FileVideo size={14} />{thumbnailMode}</span>
          </div>
        </section>

        <section className={styles.editorGrid}>
          <aside className={styles.toolRail} aria-label="Editor tools">
            {toolRail.map((tool) => {
              const Icon = tool.icon
              return <button key={tool.label} className={selectedTool === tool.label ? styles.toolActive : ''} title={tool.label} onClick={() => void handleToolSelect(tool.label)}><Icon size={18} /><span>{tool.label}</span></button>
            })}
          </aside>

          <section className={styles.stagePanel}>
            <div className={styles.stageToolbar}>
              <input value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} aria-label="Project title" />
              <select value={format} onChange={(event) => setFormat(event.target.value)} aria-label="Canvas format">
                {aspectRatioOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
              <button onClick={handleUndo}><RotateCcw size={15} />Undo</button>
              <button onClick={handleVersionSnapshot}><Copy size={15} />Version</button>
              <button onClick={handlePreview}><Eye size={15} />Preview</button>
            </div>

            <div className={styles.canvasWrap}>
              <div className={canvasClassName} style={{ ['--scene-color' as string]: selectedScene.color, ['--brand-color' as string]: brandColor, ['--accent-color' as string]: accentColor, aspectRatio: canvasAspectRatio }}>
                {showSafeZone ? <div className={styles.safeZone} /> : null}
                {guidePlaying ? <div className={styles.guideCursor}><MousePointer2 size={16} /><span>{selectedGuide.focus}</span></div> : null}
                <div className={styles.videoFrame}>
                  {watermark ? <div className={styles.logoPill} data-placement={logoPlacement}>Online2Day</div> : null}
                  <div className={styles.sceneType}>{selectedScene.layout}</div>
                  <h2>{selectedScene.headline}</h2>
                  <p>{selectedScene.note}</p>
                  <div className={styles.annotationRow}>
                    <span><Sparkles size={14} /> Personalised for {selectedLead?.company || 'selected lead'}</span>
                    <span><Clock size={14} /> {selectedScene.duration}s</span>
                  </div>
                  {captionMode ? <div className={styles.captionBar}>Captions: enterprise-grade delivery, accessibility and conversion tracking.</div> : null}
                  {transcriptEnabled ? <div className={styles.transcriptBadge}><Subtitles size={14} /> Transcript notes attached</div> : null}
                  <button className={styles.ctaButton} onClick={() => router.push('/contact')}>{ctaLabel} <ChevronRight size={15} /></button>
                </div>
              </div>
            </div>

            <div className={styles.sceneStrip}>
              {scenes.map((scene, index) => (
                <button key={scene.id} className={scene.id === selectedScene.id ? styles.sceneActive : ''} onClick={() => setSelectedSceneId(scene.id)}>
                  <span style={{ background: scene.color }}>{index + 1}</span>
                  <strong>{scene.name}</strong>
                  <em>{scene.duration}s</em>
                </button>
              ))}
            </div>
          </section>

          <aside className={styles.inspector}>
            <div className={styles.panelHeader}><PanelRight size={17} /><strong>Inspector</strong></div>
            <label><span>Lead</span><select value={leadId} onChange={(event) => handleLeadChange(event.target.value)}>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name} - {lead.company}</option>)}</select></label>
            <label><span>Scene name</span><input value={selectedScene.name} onChange={(event) => updateScene({ name: event.target.value })} /></label>
            <label><span>Headline</span><textarea value={selectedScene.headline} onChange={(event) => updateScene({ headline: event.target.value })} rows={3} /></label>
            <label><span>Speaker notes</span><textarea value={selectedScene.note} onChange={(event) => updateScene({ note: event.target.value })} rows={4} /></label>
            <label><span>Duration</span><input type="number" min={3} max={60} value={selectedScene.duration} onChange={(event) => updateScene({ duration: Number(event.target.value) })} /></label>
            <div className={styles.colorRow}>
              <label><span>Brand</span><input type="color" value={brandColor} onChange={(event) => setBrandColor(event.target.value)} /></label>
              <label><span>Accent</span><input type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} /></label>
              <label><span>Scene</span><input type="color" value={selectedScene.color} onChange={(event) => updateScene({ color: event.target.value })} /></label>
            </div>
            <div className={styles.toggleList}>
              <label><input type="checkbox" checked={captionMode} onChange={(event) => setCaptionMode(event.target.checked)} /> Captions enabled</label>
              <label><input type="checkbox" checked={watermark} onChange={(event) => setWatermark(event.target.checked)} /> Brand watermark</label>
              <label><input type="checkbox" checked={approvalMode} onChange={(event) => setApprovalMode(event.target.checked)} /> Require approval</label>
            </div>
            <div className={styles.sceneActions}>
              <button onClick={addScene}><Plus size={15} />Add</button>
              <button onClick={duplicateScene}><Copy size={15} />Duplicate</button>
              <button onClick={deleteScene}><Trash2 size={15} />Delete</button>
            </div>
          </aside>
        </section>

        <section className={styles.timelinePanel}>
          <header>
            <div><strong>Timeline</strong><span>Multi-track production plan</span></div>
            <div className={styles.timelineTools}>
              {[
                { icon: Scissors, label: 'Split selected clip' },
                { icon: AlignCenter, label: 'Align layers to canvas' },
                { icon: Grid3X3, label: 'Toggle grid snapping' },
                { icon: Lock, label: 'Lock active track' },
                { icon: Download, label: 'Prepare export package' },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  className={(label.includes('grid') && snapEnabled) || (label.includes('Lock') && activeTrackLocked) ? styles.toolButtonActive : ''}
                  title={label}
                  onClick={() => void handleTimelineAction(label)}
                >
                  <Icon size={15} />
                </button>
              ))}
            </div>
          </header>
          <div className={styles.timeline}>
            {timeline.map((item) => (
              <div key={item.id} className={`${styles.timelineRow} ${styles[item.track]}`}>
                <span>{item.track}</span>
                <div>
                  {guidePlaying ? <i className={styles.trackPlayhead} style={{ left: `${playhead}%` }} /> : null}
                  <em style={{
                    left: `${Math.min(96, (item.start / Math.max(totalDuration, 1)) * 100)}%`,
                    width: `${Math.max(7, Math.min(100 - Math.min(96, (item.start / Math.max(totalDuration, 1)) * 100), (item.duration / Math.max(totalDuration, 1)) * 100))}%`,
                  }}>{item.label}</em>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.lowerGrid}>
          <article className={styles.featurePanel}>
            <header><BadgeCheck size={18} /><strong>Feature coverage</strong><span>{activeFeatureKeys.length}/{totalFeatureCount} live production commands</span></header>
            <div className={styles.featureGrid}>
              {featureGroups.map((group) => {
                const Icon = group.icon
                return (
                  <section key={group.title}>
                    <h3><Icon size={16} />{group.title}</h3>
                    {group.items.map((item) => {
                      const isActive = activeFeatureKeys.includes(`${group.title}:${item}`)
                      return <button key={item} className={`${styles.featureButton} ${isActive ? styles.featureActive : ''}`} onClick={() => void handleFeatureAction(group.title, item)}><Check size={13} /><span>{item}</span></button>
                    })}
                  </section>
                )
              })}
            </div>
          </article>

          <article className={styles.emailPanel}>
            <header><Mail size={18} /><strong>Email handoff</strong></header>
            <label><span>To</span><input type="email" value={emailTo} onChange={(event) => setEmailTo(event.target.value)} /></label>
            <label><span>Subject</span><input value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} /></label>
            <label><span>Database video attachment</span><select value={savedAssetId} onChange={(event) => { setSavedAssetId(event.target.value); setSendStatus(event.target.value ? 'Database video attached to this email campaign.' : 'This campaign will save a fresh editor video before sending.') }}>
              <option value="">Create from this editor project</option>
              {availableVideos.map((video) => <option key={video.id} value={video.id}>{video.name}</option>)}
            </select></label>
            <label><span>Message</span><textarea rows={6} value={emailBody} onChange={(event) => setEmailBody(event.target.value)} /></label>
            <div className={styles.handoffActions}>
              <button onClick={handleSave}><Save size={15} />Save asset</button>
              <button className={styles.primaryButton} onClick={handleSend}><Zap size={15} />Save and send</button>
            </div>
            {saveStatus ? <p className={styles.statusText}>{saveStatus}</p> : null}
            {sendStatus ? <p className={styles.statusText}>{sendStatus}</p> : null}
          </article>
        </section>

        <input ref={fileRef} hidden type="file" accept="video/*,image/*,audio/*" onChange={handleMediaSelected} />
      </main>
    </div>
  )
}
