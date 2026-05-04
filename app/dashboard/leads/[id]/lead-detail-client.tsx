'use client'

import Link from 'next/link'
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardSidebar } from '@/components/leads/DashboardSidebar'
import { Icon, Avatar, Score, StageBadge, getInitials } from '@/components/leads/DashboardComponents'
import styles from '@/components/leads/LeadsDashboard.module.css'
import type { Lead } from '@/components/leads/leads-types'
import type { LeadEventRow } from '@/app/actions/dashboard'
import { sendEnterpriseEmail } from '@/lib/actions/email-actions'
import { uploadLeadVideo } from '@/lib/actions/video-actions'
import { logAuditEntry } from '@/lib/actions/audit-actions'

type Props = {
  lead: Lead
  leadEvents: LeadEventRow[]
}

function logGdpr(action: string, resource: string, id: string, changes?: string) {
  logAuditEntry(action, resource, id, changes)
}

function relativeTime(isoString: string) {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function LeadDetailClient({ lead, leadEvents }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [subject, setSubject] = useState(`Quick idea for ${lead.company}`)
  const [body, setBody] = useState(`Hi ${lead.contactName.split(' ')[0]},\n\nI recorded a short walkthrough showing how Online2Day could help ${lead.company} move faster on this.\n\nWould you like me to send it over?`)
  const [sent, setSent] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [isPendingEmail, startEmailTransition] = useTransition()
  const [isPendingUpload, startUploadTransition] = useTransition()

  const initials = getInitials(lead.contactName)

  const timeline = leadEvents.length > 0
    ? leadEvents.map((ev) => ({
        title: ev.type,
        detail: ev.note || '',
        time: relativeTime(ev.created_at),
        icon: 'clock' as const,
      }))
    : [
        { title: 'Lead detail opened', detail: `${lead.contactName} from ${lead.company}`, time: 'Just now', icon: 'clock' as const },
        { title: lead.nextAction, detail: `Recommended next step while lead is in ${lead.stage}.`, time: lead.lastActivity, icon: 'check' as const },
      ]

  function handleVideoSelect(file: File) {
    setVideoFile(file)
    logGdpr('upload', 'lead_video', lead.id, `${file.name}:${file.size}`)
  }

  function handleSendEmail() {
    if (!lead.email) {
      setEmailError('No email address on file for this lead.')
      return
    }
    setEmailError('')
    logGdpr('send', 'lead_email', lead.id, JSON.stringify({ subject, length: body.length }))
    startEmailTransition(async () => {
      await sendEnterpriseEmail({ leadId: lead.id, to: lead.email!, recipientName: lead.contactName, subject, body })
      setSent(true)
      router.refresh()
    })
  }

  function handleUploadVideo() {
    if (!videoFile) return
    startUploadTransition(async () => {
      setUploadStatus('uploading')
      const formData = new FormData()
      formData.append('video', videoFile)
      formData.append('name', videoFile.name)
      const result = await uploadLeadVideo(lead.id, formData)
      if (result.error) {
        setUploadStatus('error')
      } else {
        setUploadStatus('done')
        setVideoFile(null)
        router.refresh()
      }
    })
  }

  return (
    <div className={styles.detailShell}>
      <DashboardSidebar active="leads" />
      <main className={styles.detailMain}>
        <nav className={styles.detailBreadcrumb} aria-label="Breadcrumb">
          <Link href="/dashboard/leads">Leads</Link>
          <span>/</span>
          <strong>{lead.company}</strong>
        </nav>

        <section className={styles.detailCard}>
          <div className={styles.leadHeroCard}>
            <Avatar initials={initials} size="lg" />
            <div className={styles.leadHeroInfo}>
              <h1>{lead.contactName}</h1>
              <p>{lead.role} at {lead.company}</p>
              <div className={styles.leadHeroActions}>
                <button className={styles.btnPrimary} onClick={handleSendEmail} disabled={isPendingEmail}><Icon name="mail" />{isPendingEmail ? 'Sending…' : 'Send email'}</button>
                <button className={styles.btnSecondary}><Icon name="phone" />Call</button>
                <button className={styles.btnSecondary}><Icon name="calendar" />Book call</button>
              </div>
            </div>
          </div>
          <div className={styles.detailMetaGrid}>
            <div className={styles.detailMetaItem}><span>Stage</span><StageBadge stage={lead.stage} /></div>
            <div className={styles.detailMetaItem}><span>Score</span><Score value={lead.score} /></div>
            <div className={styles.detailMetaItem}><span>Owner</span><strong>{lead.owner}</strong></div>
            <div className={styles.detailMetaItem}><span>Source</span><strong><Icon name="globe" />{lead.source}</strong></div>
            <div className={styles.detailMetaItem}><span>Value</span><strong>{lead.value}</strong></div>
            <div className={styles.detailMetaItem}><span>Engagement</span><strong>{lead.engagement}%</strong></div>
          </div>
        </section>

        <div className={styles.detailGrid}>
          <div>
            <section className={styles.detailCard}>
              <header className={styles.detailCardHeader}><Icon name="video" /><h2>Video upload</h2></header>
              <div className={styles.detailCardBody}>
                <div
                  className={styles.videoUploadZone}
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    const file = event.dataTransfer.files[0]
                    if (file) handleVideoSelect(file)
                  }}
                >
                  <Icon name="upload" size={30} />
                  <h3>{videoFile ? videoFile.name : 'Drop a personalised video here'}</h3>
                  <p>
                    {uploadStatus === 'uploading' ? 'Uploading…'
                      : uploadStatus === 'done' ? 'Upload complete!'
                      : uploadStatus === 'error' ? 'Upload failed — try again'
                      : videoFile ? `${(videoFile.size / 1024 / 1024).toFixed(2)} MB ready to attach`
                      : 'MP4, MOV or WebM up to your browser limit'}
                  </p>
                  <input ref={inputRef} type="file" accept="video/*" hidden onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) handleVideoSelect(file)
                  }} />
                </div>
                {videoFile && uploadStatus === 'idle' && (
                  <button className={styles.btnPrimary} style={{ marginTop: 12 }} onClick={handleUploadVideo} disabled={isPendingUpload}>
                    <Icon name="upload" />Upload to lead
                  </button>
                )}
              </div>
            </section>

            <section className={styles.detailCard}>
              <header className={styles.detailCardHeader}><Icon name="mail" /><h2>Email composer</h2>{sent ? <span className={styles.gdprBadge}><Icon name="check" />Sent</span> : null}</header>
              <div className={styles.detailCardBody}>
                <div className={styles.emailComposer}>
                  <div className={styles.emailBestPractice}><Icon name="paperclip" />Personalise the first two lines and include one clear next step. Sends are logged for GDPR audit review.</div>
                  {emailError ? <p style={{ color: 'var(--error, red)', fontSize: 13, marginBottom: 8 }}>{emailError}</p> : null}
                  <input className={styles.formInput} value={subject} onChange={(event) => setSubject(event.target.value)} />
                  <textarea className={styles.formTextarea} value={body} onChange={(event) => setBody(event.target.value)} rows={9} />
                  <button className={styles.btnPrimary} onClick={handleSendEmail} disabled={isPendingEmail}><Icon name="send" />{isPendingEmail ? 'Sending…' : 'Send and log email'}</button>
                </div>
              </div>
            </section>
          </div>

          <aside className={styles.detailCard}>
            <header className={styles.detailCardHeader}><Icon name="clock" /><h2>Activity timeline</h2></header>
            <div className={styles.detailCardBody}>
              <div className={styles.activityTimeline}>
                {timeline.map((item, idx) => {
                  return (
                    <div key={idx} className={styles.timelineItem}>
                      <div className={styles.timelineDot}><Icon name={item.icon} /></div>
                      <div className={styles.timelineContent}>
                        <strong>{item.title}</strong>
                        {item.detail ? <p>{item.detail}</p> : null}
                        <time>{item.time}</time>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
