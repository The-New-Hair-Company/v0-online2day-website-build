'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { Calendar, Check, Clock, Mail, Paperclip, Phone, Send, Upload, Video } from 'lucide-react'
import { DashboardSidebar } from '@/components/leads/DashboardSidebar'
import styles from '@/components/leads/LeadsDashboard.module.css'
import type { ActivityItem, Lead } from '@/components/leads/leads-types'

type Props = {
  lead: Lead
  recentActivity: ActivityItem[]
}

function logGdpr(action: string, resource: string, id: string, changes?: string) {
  const entry = { ts: new Date().toISOString(), action, resource, id, changes }
  const existing = JSON.parse(localStorage.getItem('gdpr_audit') || '[]')
  localStorage.setItem('gdpr_audit', JSON.stringify([entry, ...existing].slice(0, 500)))
}

export function LeadDetailClient({ lead, recentActivity }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [subject, setSubject] = useState(`Quick idea for ${lead.company}`)
  const [body, setBody] = useState(`Hi ${lead.contactName.split(' ')[0]},\n\nI recorded a short walkthrough showing how Online2Day could help ${lead.company} move faster on this.\n\nWould you like me to send it over?`)
  const [sent, setSent] = useState(false)

  const initials = lead.contactName.split(' ').map((part) => part[0]).join('')
  const timeline = [
    { title: 'Lead detail opened', detail: `${lead.contactName} from ${lead.company}`, time: 'Just now', icon: Clock },
    { title: lead.nextAction, detail: `Recommended next step while lead is in ${lead.stage}.`, time: lead.lastActivity, icon: Check },
    ...recentActivity.slice(0, 4).map((item) => ({ title: item.title, detail: 'Synced from CRM activity feed.', time: item.time, icon: Calendar })),
  ]

  function handleVideo(file: File) {
    setVideoFile(file)
    logGdpr('upload', 'lead_video', lead.id, `${file.name}:${file.size}`)
  }

  function handleSendEmail() {
    logGdpr('send', 'lead_email', lead.id, JSON.stringify({ subject, length: body.length }))
    setSent(true)
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
            <div className={styles.leadHeroAvatar}>{initials}</div>
            <div className={styles.leadHeroInfo}>
              <h1>{lead.contactName}</h1>
              <p>{lead.role} at {lead.company}</p>
              <div className={styles.leadHeroActions}>
                <button className={styles.btnPrimary} onClick={handleSendEmail}><Mail size={16} />Send email</button>
                <button className={styles.btnSecondary}><Phone size={16} />Call</button>
                <button className={styles.btnSecondary}><Calendar size={16} />Book call</button>
              </div>
            </div>
          </div>
          <div className={styles.detailMetaGrid}>
            <div className={styles.detailMetaItem}><span>Stage</span><strong>{lead.stage}</strong></div>
            <div className={styles.detailMetaItem}><span>Score</span><strong>{lead.score}</strong></div>
            <div className={styles.detailMetaItem}><span>Owner</span><strong>{lead.owner}</strong></div>
            <div className={styles.detailMetaItem}><span>Source</span><strong>{lead.source}</strong></div>
            <div className={styles.detailMetaItem}><span>Value</span><strong>{lead.value}</strong></div>
            <div className={styles.detailMetaItem}><span>Engagement</span><strong>{lead.engagement}%</strong></div>
          </div>
        </section>

        <div className={styles.detailGrid}>
          <div>
            <section className={styles.detailCard}>
              <header className={styles.detailCardHeader}><Video size={18} /><h2>Video upload</h2></header>
              <div className={styles.detailCardBody}>
                <div
                  className={styles.videoUploadZone}
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    const file = event.dataTransfer.files[0]
                    if (file) handleVideo(file)
                  }}
                >
                  <Upload size={30} />
                  <h3>{videoFile ? videoFile.name : 'Drop a personalised video here'}</h3>
                  <p>{videoFile ? `${(videoFile.size / 1024 / 1024).toFixed(2)} MB ready to attach` : 'MP4, MOV or WebM up to your browser limit'}</p>
                  <input ref={inputRef} type="file" accept="video/*" hidden onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) handleVideo(file)
                  }} />
                </div>
              </div>
            </section>

            <section className={styles.detailCard}>
              <header className={styles.detailCardHeader}><Mail size={18} /><h2>Email composer</h2>{sent ? <span className={styles.gdprBadge}><Check size={13} />Logged</span> : null}</header>
              <div className={styles.detailCardBody}>
                <div className={styles.emailComposer}>
                  <div className={styles.emailBestPractice}><Paperclip size={16} />Personalise the first two lines and include one clear next step. Sends are logged locally for GDPR audit review.</div>
                  <input className={styles.formInput} value={subject} onChange={(event) => setSubject(event.target.value)} />
                  <textarea className={styles.formTextarea} value={body} onChange={(event) => setBody(event.target.value)} rows={9} />
                  <button className={styles.btnPrimary} onClick={handleSendEmail}><Send size={16} />Send and log email</button>
                </div>
              </div>
            </section>
          </div>

          <aside className={styles.detailCard}>
            <header className={styles.detailCardHeader}><Clock size={18} /><h2>Activity timeline</h2></header>
            <div className={styles.detailCardBody}>
              <div className={styles.activityTimeline}>
                {timeline.map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={`${item.title}-${item.time}`} className={styles.timelineItem}>
                      <div className={styles.timelineDot}><Icon size={18} /></div>
                      <div className={styles.timelineContent}>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
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
