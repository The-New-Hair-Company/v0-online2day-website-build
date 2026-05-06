'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  Upload, Film, Copy, Check, Send, ArrowLeft,
  Loader2, User, ExternalLink, X
} from 'lucide-react'
import { DashboardSidebar } from '@/components/leads/DashboardSidebar'
import { uploadAdminVideo, sendVideoViaChat } from '@/lib/actions/video-actions'

type ClientUser = { user_id: string; full_name: string | null; email: string | null; role: string | null }

type Props = { clientUsers: ClientUser[] }

export default function VideoUploadClient({ clientUsers }: Props) {
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [slug, setSlug] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [sendOpen, setSendOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  const shareUrl = slug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/v/${slug}`
    : ''

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) { setFile(dropped); setTitle(t => t || dropped.name.replace(/\.[^.]+$/, '')) }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    if (picked) { setFile(picked); setTitle(t => t || picked.name.replace(/\.[^.]+$/, '')) }
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setUploadError('')

    const fd = new FormData()
    fd.append('video', file)
    fd.append('title', title || file.name)

    const result = await uploadAdminVideo(fd)
    setUploading(false)

    if (result.error) { setUploadError(result.error); return }
    if (result.slug) setSlug(result.slug)
  }

  async function handleCopy() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSend() {
    if (!slug || !selectedUser) return
    setSending(true)
    const result = await sendVideoViaChat(selectedUser, slug)
    setSending(false)
    if (result.error) {
      setSendResult({ ok: false, msg: result.error })
    } else {
      setSendResult({ ok: true, msg: 'Video link sent to user chat!' })
      setSendOpen(false)
    }
  }

  function reset() {
    setFile(null); setTitle(''); setSlug(null); setUploadError('')
    setSelectedUser(''); setSendResult(null); setSendOpen(false)
  }

  return (
    <div className="flex h-screen bg-background" style={{ fontFamily: 'Inter, sans-serif' }}>
      <DashboardSidebar active="videos" />

      <main className="flex-1 overflow-auto p-8 max-w-3xl mx-auto w-full">
        <div className="mb-8 flex items-center gap-4">
          <Link href="/dashboard/videos" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} /> Back to Videos
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Upload Video</h1>
          <p className="text-muted-foreground mt-1">Upload a video and get a shareable link to send to any client.</p>
        </div>

        {!slug ? (
          <div className="space-y-6">
            {/* Drop zone */}
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-primary bg-primary/5'
                  : file
                  ? 'border-green-500/50 bg-green-500/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/30'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                className="hidden"
                onChange={handleFileChange}
              />
              {file ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-400">
                    <Film size={28} />
                  </div>
                  <div>
                    <p className="font-semibold">{file.name}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {(file.size / 1024 / 1024).toFixed(1)} MB · Click to change
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <Upload size={28} />
                  </div>
                  <div>
                    <p className="font-semibold">Drop your video here</p>
                    <p className="text-sm text-muted-foreground mt-0.5">or click to browse · MP4, MOV, WebM</p>
                  </div>
                </div>
              )}
            </div>

            {/* Title input */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Video title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Introduction to Online2Day"
                className="w-full border border-border bg-background rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {uploadError && (
              <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">{uploadError}</p>
            )}

            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              {uploading ? 'Uploading...' : 'Upload Video'}
            </button>
          </div>
        ) : (
          /* Success state */
          <div className="space-y-6">
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 flex items-start gap-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center text-green-400 shrink-0">
                <Film size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-green-400">Video uploaded successfully!</p>
                <p className="text-sm text-muted-foreground mt-0.5 truncate">{title || file?.name}</p>
              </div>
            </div>

            {/* Share link */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h2 className="font-semibold">Shareable link</h2>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-xl px-4 py-3 text-sm font-mono text-muted-foreground truncate">
                  {shareUrl}
                </div>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-4 py-3 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors whitespace-nowrap"
                >
                  {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-3 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
                >
                  <ExternalLink size={16} />
                  Preview
                </a>
              </div>
            </div>

            {/* Send to client */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h2 className="font-semibold">Send to client via chat</h2>
              <p className="text-sm text-muted-foreground">
                Send the video link directly to a client&apos;s support chat. They&apos;ll see it instantly.
              </p>

              {sendResult && (
                <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-xl border ${
                  sendResult.ok
                    ? 'bg-green-500/10 border-green-500/20 text-green-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                  {sendResult.ok ? <Check size={14} /> : <X size={14} />}
                  {sendResult.msg}
                </div>
              )}

              {!sendOpen ? (
                <button
                  onClick={() => setSendOpen(true)}
                  className="flex items-center gap-2 bg-primary/10 text-primary px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/20 transition-colors"
                >
                  <Send size={16} /> Send to Client
                </button>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Select client</label>
                    <select
                      value={selectedUser}
                      onChange={e => setSelectedUser(e.target.value)}
                      className="w-full border border-border bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">— Choose a client —</option>
                      {clientUsers.map(u => (
                        <option key={u.user_id} value={u.user_id}>
                          {u.full_name || u.email || u.user_id}
                        </option>
                      ))}
                    </select>
                    {clientUsers.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-1">No client users found. Clients must have logged in at least once.</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSend}
                      disabled={!selectedUser || sending}
                      className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                      {sending ? 'Sending...' : 'Send Video Link'}
                    </button>
                    <button
                      onClick={() => setSendOpen(false)}
                      className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Upload another */}
            <button
              onClick={reset}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Upload size={15} /> Upload another video
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
