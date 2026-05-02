'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
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
  { title: 'Media', icon: FileVideo, items: ['Upload video, image and logo assets', 'Database video library attachment', 'Drag-and-drop asset staging', 'Reusable intro and outro blocks', 'Smart thumbnail selection'] },
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
  const fileRef = useRef<HTMLInputElement>(null)

  const selectedLead = leads.find((lead) => lead.id === leadId)
  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) || scenes[0]
  const totalDuration = scenes.reduce((sum, scene) => sum + scene.duration, 0)
  const readiness = useMemo(() => {
    let score = 52
    if (selectedLead?.email) score += 10
    if (captionMode) score += 8
    if (watermark) score += 5
    if (timeline.length >= 4) score += 10
    if (approvalMode) score += 5
    if (savedAssetId) score += 10
    return Math.min(score, 100)
  }, [selectedLead?.email, captionMode, watermark, timeline.length, approvalMode, savedAssetId])
  const statusCards = [
    { label: 'Readiness', value: `${readiness}%`, icon: Gauge },
    { label: 'Duration', value: `${totalDuration}s`, icon: Timer },
    { label: 'Scenes', value: String(scenes.length), icon: Layers },
    { label: 'Email linked', value: emailTo ? 'Ready' : 'Missing', icon: Mail },
    { label: 'Compliance', value: approvalMode ? 'Approval' : 'Draft', icon: ShieldCheck },
    { label: 'Library assets', value: String(videos.length), icon: FileVideo },
  ]

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

  async function handleSave() {
    setSaveStatus('Saving project...')
    const result = await saveVideoEditorProject({
      title: projectTitle,
      leadId,
      duration: totalDuration,
      format,
      scenes,
      timeline,
      brand: { primary: brandColor, accent: accentColor, watermark },
      cta: { label: 'Book a call', destination: 'https://online2day.com/contact' },
      email: { subject: emailSubject, body: emailBody },
      settings: { captions: captionMode, approvalRequired: approvalMode, readiness },
    })
    if ('error' in result && result.error) {
      setSaveStatus(String(result.error))
      return
    }
    setSavedAssetId(result.asset?.id || '')
    setSaveStatus(`Saved. Video link: /v/${result.slug}`)
  }

  async function handleSend() {
    setSendStatus('Sending email...')
    let assetId = savedAssetId
    if (!assetId) {
      const result = await saveVideoEditorProject({
        title: projectTitle,
        leadId,
        duration: totalDuration,
        format,
        scenes,
        timeline,
        brand: { primary: brandColor, accent: accentColor, watermark },
        cta: { label: 'Book a call', destination: 'https://online2day.com/contact' },
        email: { subject: emailSubject, body: emailBody },
        settings: { captions: captionMode, approvalRequired: approvalMode, readiness },
      })
      if ('error' in result && result.error) {
        setSendStatus(String(result.error))
        return
      }
      assetId = result.asset?.id || ''
      setSavedAssetId(assetId)
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
  }

  function runEditorCommand(message: string) {
    setSaveStatus(message)
    window.setTimeout(() => setSaveStatus(''), 3600)
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
            <button onClick={() => fileRef.current?.click()}><Upload size={16} />Import media</button>
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

        <section className={styles.editorGrid}>
          <aside className={styles.toolRail} aria-label="Editor tools">
            {toolRail.map((tool) => {
              const Icon = tool.icon
              return <button key={tool.label} className={selectedTool === tool.label ? styles.toolActive : ''} title={tool.label} onClick={() => { setSelectedTool(tool.label); runEditorCommand(`${tool.label} tool selected.`) }}><Icon size={18} /><span>{tool.label}</span></button>
            })}
          </aside>

          <section className={styles.stagePanel}>
            <div className={styles.stageToolbar}>
              <input value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} aria-label="Project title" />
              <select value={format} onChange={(event) => setFormat(event.target.value)} aria-label="Canvas format">
                {['16:9', '9:16', '1:1', '4:5', '21:9'].map((item) => <option key={item}>{item}</option>)}
              </select>
              <button onClick={() => runEditorCommand('Undo applied to the active scene.')}><RotateCcw size={15} />Undo</button>
              <button onClick={() => runEditorCommand('Version snapshot captured for this project.')}><Copy size={15} />Version</button>
              <button onClick={() => runEditorCommand('Preview refreshed with the current canvas, captions and CTA.')}><Eye size={15} />Preview</button>
            </div>

            <div className={styles.canvasWrap}>
              <div className={styles.canvas} style={{ ['--scene-color' as string]: selectedScene.color, ['--brand-color' as string]: brandColor, ['--accent-color' as string]: accentColor }}>
                <div className={styles.safeZone} />
                <div className={styles.videoFrame}>
                  <div className={styles.logoPill}>Online2Day</div>
                  <div className={styles.sceneType}>{selectedScene.layout}</div>
                  <h2>{selectedScene.headline}</h2>
                  <p>{selectedScene.note}</p>
                  <div className={styles.annotationRow}>
                    <span><Sparkles size={14} /> Personalised for {selectedLead?.company || 'selected lead'}</span>
                    <span><Clock size={14} /> {selectedScene.duration}s</span>
                  </div>
                  {captionMode ? <div className={styles.captionBar}>Captions: enterprise-grade delivery, accessibility and conversion tracking.</div> : null}
                  <button className={styles.ctaButton} onClick={() => router.push('/contact')}>Book a call <ChevronRight size={15} /></button>
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
              ].map(({ icon: Icon, label }) => <button key={label} title={label} onClick={() => runEditorCommand(`${label} completed.`)}><Icon size={15} /></button>)}
            </div>
          </header>
          <div className={styles.timeline}>
            {timeline.map((item) => (
              <div key={item.id} className={`${styles.timelineRow} ${styles[item.track]}`}>
                <span>{item.track}</span>
                <div><em style={{ left: `${item.start * 2}%`, width: `${item.duration * 2}%` }}>{item.label}</em></div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.lowerGrid}>
          <article className={styles.featurePanel}>
            <header><BadgeCheck size={18} /><strong>Feature coverage</strong><span>{featureGroups.reduce((sum, group) => sum + group.items.length, 0)} production capabilities</span></header>
            <div className={styles.featureGrid}>
              {featureGroups.map((group) => {
                const Icon = group.icon
                return (
                  <section key={group.title}>
                    <h3><Icon size={16} />{group.title}</h3>
                    {group.items.map((item) => <p key={item}><Check size={13} />{item}</p>)}
                  </section>
                )
              })}
            </div>
          </article>

          <article className={styles.emailPanel}>
            <header><Mail size={18} /><strong>Email handoff</strong></header>
            <label><span>To</span><input type="email" value={emailTo} onChange={(event) => setEmailTo(event.target.value)} /></label>
            <label><span>Subject</span><input value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} /></label>
            <label><span>Message</span><textarea rows={6} value={emailBody} onChange={(event) => setEmailBody(event.target.value)} /></label>
            <div className={styles.handoffActions}>
              <button onClick={handleSave}><Save size={15} />Save asset</button>
              <button className={styles.primaryButton} onClick={handleSend}><Zap size={15} />Save and send</button>
            </div>
            {saveStatus ? <p className={styles.statusText}>{saveStatus}</p> : null}
            {sendStatus ? <p className={styles.statusText}>{sendStatus}</p> : null}
          </article>
        </section>

        <input ref={fileRef} hidden type="file" accept="video/*,image/*,audio/*" />
      </main>
    </div>
  )
}
