'use client'

import Link from 'next/link'
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Ban, Edit2, Mail, Phone, Calendar, Send, Plus } from 'lucide-react'
import { DashboardSidebar } from '@/components/leads/DashboardSidebar'
import { Icon, Avatar, Score, StageBadge, getInitials } from '@/components/leads/DashboardComponents'
import styles from '@/components/leads/LeadsDashboard.module.css'
import type { Lead } from '@/components/leads/leads-types'
import type { LeadEventRow } from '@/app/actions/dashboard'
import { sendEnterpriseEmail } from '@/lib/actions/email-actions'
import { uploadLeadVideo } from '@/lib/actions/video-actions'
import { logAuditEntry } from '@/lib/actions/audit-actions'
import {
  addLeadNote,
  updateLeadFields,
  scheduleLeadAction,
  setDoNotContact,
} from '@/lib/actions/lead-actions'

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

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const STATUSES = ['New', 'Contacted', 'Video Sent', 'Follow-up Due', 'Proposal Sent', 'Won', 'Lost']
const SOURCES = ['Website', 'Cold Outreach', 'Referral', 'HubSpot', 'LinkedIn', 'Phone', 'Event', 'Other']

export function LeadDetailClient({ lead, leadEvents }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  // ── edit ──────────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState(lead.contactName)
  const [editEmail, setEditEmail] = useState(lead.email || '')
  const [editPhone, setEditPhone] = useState(lead.phone || '')
  const [editCompany, setEditCompany] = useState(lead.company)
  const [editWebsite, setEditWebsite] = useState(lead.website || '')
  const [editStatus, setEditStatus] = useState(lead.stage as string)
  const [editSource, setEditSource] = useState(lead.source as string)
  const [editNotes, setEditNotes] = useState(lead.notes || '')
  const [editError, setEditError] = useState('')
  const [isPendingEdit, startEditTransition] = useTransition()

  // ── notes ─────────────────────────────────────────────────────────
  const [noteText, setNoteText] = useState('')
  const [noteError, setNoteError] = useState('')
  const [isPendingNote, startNoteTransition] = useTransition()

  // ── schedule ──────────────────────────────────────────────────────
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleType, setScheduleType] = useState<'Callback Scheduled' | 'Follow-up Scheduled'>('Callback Scheduled')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('09:00')
  const [scheduleNote, setScheduleNote] = useState('')
  const [scheduleError, setScheduleError] = useState('')
  const [isPendingSchedule, startScheduleTransition] = useTransition()

  // ── do not contact ────────────────────────────────────────────────
  const [dncConfirm, setDncConfirm] = useState(false)
  const [isPendingDnc, startDncTransition] = useTransition()

  // ── email composer ────────────────────────────────────────────────
  const [emailTo, setEmailTo] = useState(lead.email || '')
  const [emailCc, setEmailCc] = useState('')
  const [subject, setSubject] = useState(`Quick idea for ${lead.company}`)
  const [body, setBody] = useState(`Hi ${lead.contactName.split(' ')[0]},\n\nI recorded a short walkthrough showing how Online2Day could help ${lead.company} move faster on this.\n\nWould you like me to send it over?`)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [isPendingEmail, startEmailTransition] = useTransition()

  // ── video ─────────────────────────────────────────────────────────
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [isPendingUpload, startUploadTransition] = useTransition()

  // ── derived ───────────────────────────────────────────────────────
  const initials = getInitials(lead.contactName)
  const isDnc = leadEvents.some(e => e.type === 'Do Not Contact')
  const notes = leadEvents.filter(e => e.type === 'Note Added')
  const emailHistory = leadEvents.filter(e => e.type === 'Email Sent')
  const scheduledActions = leadEvents.filter(e => e.type === 'Callback Scheduled' || e.type === 'Follow-up Scheduled')
  const timeline = leadEvents.filter(e => !['Note Added'].includes(e.type))

  // ── handlers ──────────────────────────────────────────────────────

  function handleSaveEdit() {
    if (!editName.trim()) { setEditError('Name is required.'); return }
    setEditError('')
    startEditTransition(async () => {
      const result = await updateLeadFields(lead.id, {
        name: editName.trim(),
        email: editEmail.trim() || undefined,
        phone: editPhone.trim() || undefined,
        company: editCompany.trim() || undefined,
        website: editWebsite.trim() || undefined,
        status: editStatus || undefined,
        source: editSource || undefined,
        notes: editNotes.trim() || undefined,
      })
      if (result?.error) { setEditError(result.error); return }
      logGdpr('update', 'lead', lead.id, `name,email,phone,company,website,status,source`)
      setEditOpen(false)
      router.refresh()
    })
  }

  function handleAddNote() {
    if (!noteText.trim()) { setNoteError('Note cannot be empty.'); return }
    setNoteError('')
    startNoteTransition(async () => {
      const result = await addLeadNote(lead.id, noteText.trim())
      if (result?.error) { setNoteError(result.error); return }
      logGdpr('note', 'lead', lead.id)
      setNoteText('')
      router.refresh()
    })
  }

  function handleSchedule() {
    if (!scheduleDate) { setScheduleError('Please select a date.'); return }
    setScheduleError('')
    const scheduledAt = `${scheduleDate}T${scheduleTime}:00`
    startScheduleTransition(async () => {
      const result = await scheduleLeadAction(lead.id, lead.contactName, scheduleType, scheduledAt, scheduleNote)
      if (result?.error) { setScheduleError(result.error); return }
      logGdpr('schedule', 'lead', lead.id, scheduleType)
      setScheduleDate('')
      setScheduleTime('09:00')
      setScheduleNote('')
      setScheduleOpen(false)
      router.refresh()
    })
  }

  function handleDnc() {
    startDncTransition(async () => {
      await setDoNotContact(lead.id)
      logGdpr('dnc', 'lead', lead.id)
      setDncConfirm(false)
      router.refresh()
    })
  }

  function handleSendEmail() {
    const toAddr = emailTo.trim()
    if (!toAddr) { setEmailError('Recipient email is required.'); return }
    setEmailError('')
    logGdpr('send', 'lead_email', lead.id, JSON.stringify({ subject, length: body.length }))
    startEmailTransition(async () => {
      await sendEnterpriseEmail({ leadId: lead.id, to: toAddr, recipientName: lead.contactName, subject, body })
      setEmailSent(true)
      router.refresh()
    })
  }

  function handleVideoSelect(file: File) {
    setVideoFile(file)
    logGdpr('upload', 'lead_video', lead.id, `${file.name}:${file.size}`)
  }

  function handleUploadVideo() {
    if (!videoFile) return
    startUploadTransition(async () => {
      setUploadStatus('uploading')
      const formData = new FormData()
      formData.append('video', videoFile)
      formData.append('name', videoFile.name)
      const result = await uploadLeadVideo(lead.id, formData)
      if (result.error) { setUploadStatus('error') } else {
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

        {/* DNC banner */}
        {isDnc && (
          <div className={styles.dncBanner}>
            <AlertTriangle size={16} />
            <strong>Do Not Contact</strong>
            <span>This lead has been marked as Do Not Contact. No outreach should be made.</span>
          </div>
        )}

        {/* Hero */}
        <section className={styles.detailCard}>
          <div className={styles.leadHeroCard}>
            <Avatar initials={initials} size="lg" />
            <div className={styles.leadHeroInfo}>
              <h1>{lead.contactName}</h1>
              <p>{lead.role} at {lead.company}</p>
              <div className={styles.leadHeroActions}>
                <button className={styles.btnPrimary} onClick={() => setEditOpen(v => !v)}>
                  <Edit2 size={14} />{editOpen ? 'Cancel editing' : 'Edit lead'}
                </button>
                <button className={styles.btnSecondary} onClick={() => setScheduleOpen(v => !v)}>
                  <Calendar size={14} />Schedule action
                </button>
                {lead.phone && (
                  <a className={styles.btnSecondary} href={`tel:${lead.phone}`}>
                    <Phone size={14} />Call
                  </a>
                )}
                {!isDnc ? (
                  <button
                    className={styles.dncBtn}
                    onClick={() => setDncConfirm(true)}
                    title="Mark as Do Not Contact"
                  >
                    <Ban size={14} />Do not contact
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className={styles.detailMetaGrid}>
            <div className={styles.detailMetaItem}><span>Stage</span><StageBadge stage={lead.stage} /></div>
            <div className={styles.detailMetaItem}><span>Score</span><Score value={lead.score} /></div>
            <div className={styles.detailMetaItem}><span>Owner</span><strong>{lead.owner}</strong></div>
            <div className={styles.detailMetaItem}><span>Source</span><strong><Icon name="globe" />{lead.source}</strong></div>
            <div className={styles.detailMetaItem}><span>Email</span><strong>{lead.email || '—'}</strong></div>
            <div className={styles.detailMetaItem}><span>Phone</span><strong>{lead.phone || '—'}</strong></div>
          </div>
        </section>

        {/* DNC confirm */}
        {dncConfirm && (
          <div className={styles.dncConfirm}>
            <AlertTriangle size={18} />
            <div>
              <strong>Mark as Do Not Contact?</strong>
              <p>This will be logged permanently on the lead's timeline. No emails or calls should be made after this.</p>
            </div>
            <div className={styles.dncConfirmActions}>
              <button className={styles.dncConfirmYes} onClick={handleDnc} disabled={isPendingDnc}>
                {isPendingDnc ? 'Saving…' : 'Confirm DNC'}
              </button>
              <button className={styles.btnSecondary} onClick={() => setDncConfirm(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Inline edit form */}
        {editOpen && (
          <section className={styles.detailCard}>
            <header className={styles.detailCardHeader}><Edit2 size={16} /><h2>Edit lead details</h2></header>
            <div className={styles.detailCardBody}>
              {editError && <p className={styles.fieldError}>{editError}</p>}
              <div className={styles.editFormGrid}>
                <div className={styles.editField}>
                  <label>Full name *</label>
                  <input className={styles.formInput} value={editName} onChange={e => setEditName(e.target.value)} />
                </div>
                <div className={styles.editField}>
                  <label>Company</label>
                  <input className={styles.formInput} value={editCompany} onChange={e => setEditCompany(e.target.value)} />
                </div>
                <div className={styles.editField}>
                  <label>Email</label>
                  <input className={styles.formInput} type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
                </div>
                <div className={styles.editField}>
                  <label>Phone</label>
                  <input className={styles.formInput} type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                </div>
                <div className={styles.editField}>
                  <label>Website</label>
                  <input className={styles.formInput} type="url" value={editWebsite} onChange={e => setEditWebsite(e.target.value)} />
                </div>
                <div className={styles.editField}>
                  <label>Status</label>
                  <select className={styles.formInput} value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className={styles.editField}>
                  <label>Source</label>
                  <select className={styles.formInput} value={editSource} onChange={e => setEditSource(e.target.value)}>
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className={`${styles.editField} ${styles.editFieldFull}`}>
                  <label>Internal notes</label>
                  <textarea className={styles.formTextarea} value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} />
                </div>
              </div>
              <div className={styles.editFormActions}>
                <button className={styles.btnPrimary} onClick={handleSaveEdit} disabled={isPendingEdit}>
                  {isPendingEdit ? 'Saving…' : 'Save changes'}
                </button>
                <button className={styles.btnSecondary} onClick={() => setEditOpen(false)}>Cancel</button>
              </div>
            </div>
          </section>
        )}

        {/* Schedule action panel */}
        {scheduleOpen && (
          <section className={styles.detailCard}>
            <header className={styles.detailCardHeader}><Calendar size={16} /><h2>Schedule an action</h2></header>
            <div className={styles.detailCardBody}>
              {scheduleError && <p className={styles.fieldError}>{scheduleError}</p>}
              <div className={styles.scheduleFormGrid}>
                <div className={styles.editField}>
                  <label>Action type</label>
                  <select
                    className={styles.formInput}
                    value={scheduleType}
                    onChange={e => setScheduleType(e.target.value as typeof scheduleType)}
                  >
                    <option value="Callback Scheduled">Callback</option>
                    <option value="Follow-up Scheduled">Follow-up email</option>
                  </select>
                </div>
                <div className={styles.editField}>
                  <label>Date</label>
                  <input
                    className={styles.formInput}
                    type="date"
                    value={scheduleDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setScheduleDate(e.target.value)}
                  />
                </div>
                <div className={styles.editField}>
                  <label>Time</label>
                  <input
                    className={styles.formInput}
                    type="time"
                    value={scheduleTime}
                    onChange={e => setScheduleTime(e.target.value)}
                  />
                </div>
                <div className={`${styles.editField} ${styles.editFieldFull}`}>
                  <label>Note (optional)</label>
                  <input
                    className={styles.formInput}
                    value={scheduleNote}
                    onChange={e => setScheduleNote(e.target.value)}
                    placeholder="e.g. Call to discuss pricing proposal"
                  />
                </div>
              </div>
              <p className={styles.scheduleHint}>This action will also appear in the Enterprise Calendar.</p>
              <div className={styles.editFormActions}>
                <button className={styles.btnPrimary} onClick={handleSchedule} disabled={isPendingSchedule}>
                  <Calendar size={14} />{isPendingSchedule ? 'Saving…' : 'Book action'}
                </button>
                <button className={styles.btnSecondary} onClick={() => setScheduleOpen(false)}>Cancel</button>
              </div>
            </div>
          </section>
        )}

        {/* Upcoming scheduled actions bar */}
        {scheduledActions.length > 0 && (
          <div className={styles.scheduledBar}>
            {scheduledActions.slice(0, 3).map(a => (
              <div key={a.id} className={styles.scheduledBarItem}>
                <Calendar size={13} />
                <strong>{a.type === 'Callback Scheduled' ? 'Callback' : 'Follow-up'}</strong>
                {a.metadata?.scheduled_at ? (
                  <span>{fmtDateTime(a.metadata.scheduled_at as string)}</span>
                ) : null}
                {a.note ? <span className={styles.scheduledBarNote}>{a.note}</span> : null}
              </div>
            ))}
          </div>
        )}

        <div className={styles.detailGrid}>
          {/* LEFT COLUMN */}
          <div>
            {/* Email composer */}
            <section className={styles.detailCard}>
              <header className={styles.detailCardHeader}>
                <Mail size={16} />
                <h2>Email composer</h2>
                {emailSent ? <span className={styles.gdprBadge}><Icon name="check" />Sent</span> : null}
                {isDnc ? <span className={styles.dncWarningBadge}><Ban size={12} />DNC active</span> : null}
              </header>
              <div className={styles.detailCardBody}>
                <div className={styles.emailComposer}>
                  <div className={styles.emailBestPractice}>
                    <Icon name="paperclip" />Personalise the opening lines. All sends are GDPR-logged.
                  </div>
                  {emailError ? <p className={styles.fieldError}>{emailError}</p> : null}
                  <div className={styles.emailFieldRow}>
                    <span className={styles.emailFieldLabel}>To</span>
                    <input
                      className={styles.formInput}
                      value={emailTo}
                      onChange={e => setEmailTo(e.target.value)}
                      placeholder="recipient@company.com"
                      disabled={isDnc}
                    />
                  </div>
                  <div className={styles.emailFieldRow}>
                    <span className={styles.emailFieldLabel}>CC</span>
                    <input
                      className={styles.formInput}
                      value={emailCc}
                      onChange={e => setEmailCc(e.target.value)}
                      placeholder="Optional CC"
                      disabled={isDnc}
                    />
                  </div>
                  <div className={styles.emailFieldRow}>
                    <span className={styles.emailFieldLabel}>Subject</span>
                    <input className={styles.formInput} value={subject} onChange={e => setSubject(e.target.value)} disabled={isDnc} />
                  </div>
                  <textarea className={styles.formTextarea} value={body} onChange={e => setBody(e.target.value)} rows={8} disabled={isDnc} />
                  <button
                    className={styles.btnPrimary}
                    onClick={handleSendEmail}
                    disabled={isPendingEmail || isDnc}
                    title={isDnc ? 'Cannot send — lead is marked Do Not Contact' : undefined}
                  >
                    <Send size={14} />{isPendingEmail ? 'Sending…' : 'Send and log email'}
                  </button>
                </div>
              </div>
            </section>

            {/* Email history */}
            {emailHistory.length > 0 && (
              <section className={styles.detailCard}>
                <header className={styles.detailCardHeader}><Icon name="mail" /><h2>Email history ({emailHistory.length})</h2></header>
                <div className={styles.detailCardBody}>
                  <div className={styles.emailHistoryList}>
                    {emailHistory.map(e => (
                      <div key={e.id} className={styles.emailHistoryItem}>
                        <div className={styles.emailHistoryMeta}>
                          <strong>{(e.metadata?.subject as string) || 'No subject'}</strong>
                          <span>{relativeTime(e.created_at)}</span>
                        </div>
                        {e.note ? <p>{e.note}</p> : null}
                        {e.creator_name ? <em>Sent by {e.creator_name}</em> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Video upload */}
            <section className={styles.detailCard}>
              <header className={styles.detailCardHeader}><Icon name="video" /><h2>Video upload</h2></header>
              <div className={styles.detailCardBody}>
                <div
                  className={styles.videoUploadZone}
                  onClick={() => inputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault()
                    const file = e.dataTransfer.files[0]
                    if (file) handleVideoSelect(file)
                  }}
                >
                  <Icon name="upload" size={30} />
                  <h3>{videoFile ? videoFile.name : 'Drop a personalised video here'}</h3>
                  <p>
                    {uploadStatus === 'uploading' ? 'Uploading…'
                      : uploadStatus === 'done' ? 'Upload complete!'
                      : uploadStatus === 'error' ? 'Upload failed — try again'
                      : videoFile ? `${(videoFile.size / 1024 / 1024).toFixed(2)} MB ready`
                      : 'MP4, MOV or WebM'}
                  </p>
                  <input ref={inputRef} type="file" accept="video/*" hidden onChange={e => {
                    const file = e.target.files?.[0]
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
          </div>

          {/* RIGHT COLUMN */}
          <aside>
            {/* Notes */}
            <section className={styles.detailCard}>
              <header className={styles.detailCardHeader}><Icon name="paperclip" /><h2>Notes ({notes.length})</h2></header>
              <div className={styles.detailCardBody}>
                <div className={styles.noteInputRow}>
                  <textarea
                    className={styles.formTextarea}
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Add a note visible to your team…"
                    rows={3}
                  />
                  {noteError && <p className={styles.fieldError}>{noteError}</p>}
                  <button className={styles.btnPrimary} onClick={handleAddNote} disabled={isPendingNote}>
                    <Plus size={14} />{isPendingNote ? 'Saving…' : 'Add note'}
                  </button>
                </div>
                {notes.length > 0 && (
                  <div className={styles.noteList}>
                    {notes.map(n => (
                      <div key={n.id} className={styles.noteItem}>
                        <div className={styles.noteItemMeta}>
                          <strong>{n.creator_name || 'Team member'}</strong>
                          <time>{relativeTime(n.created_at)}</time>
                        </div>
                        <p>{n.note}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Activity timeline */}
            <section className={styles.detailCard}>
              <header className={styles.detailCardHeader}><Icon name="clock" /><h2>Activity timeline</h2></header>
              <div className={styles.detailCardBody}>
                <div className={styles.activityTimeline}>
                  {timeline.length === 0 ? (
                    <p className={styles.emptyTimeline}>No activity yet.</p>
                  ) : timeline.map((item, idx) => (
                    <div key={idx} className={styles.timelineItem}>
                      <div className={styles.timelineDot}><Icon name={item.type === 'Email Sent' ? 'mail' : item.type === 'Callback Scheduled' || item.type === 'Follow-up Scheduled' ? 'calendar' : item.type === 'Do Not Contact' ? 'warning' : 'clock'} /></div>
                      <div className={styles.timelineContent}>
                        <strong>{item.type}</strong>
                        {item.note ? <p>{item.note}</p> : null}
                        {item.creator_name ? <em className={styles.timelineAuthor}>{item.creator_name}</em> : null}
                        <time>{relativeTime(item.created_at)}</time>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  )
}
