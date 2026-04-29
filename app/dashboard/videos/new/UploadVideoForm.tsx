'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { uploadLeadVideo } from '@/lib/actions/video-actions'
import { ArrowLeft, Upload, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface Lead {
  id: string
  name: string
  company: string | null
}

export default function UploadVideoForm({ leads }: { leads: Lead[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedLeadId = searchParams.get('leadId') || ''

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    const form = e.currentTarget
    const formData = new FormData(form)

    if (!selectedFile) {
      setError('Please select a video file')
      return
    }
    formData.set('video', selectedFile)

    const leadId = formData.get('lead_id') as string
    if (!leadId) {
      setError('Please select a lead')
      return
    }

    setLoading(true)
    const result = await uploadLeadVideo(leadId, formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push('/dashboard/videos')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file)
    } else {
      setError('Please drop a valid video file')
    }
  }

  const inputClass = 'w-full px-4 py-2.5 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all'

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/videos" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
          <ArrowLeft size={16} />
          Back to Videos
        </Link>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border p-8">
        <h1 className="text-2xl font-bold text-card-foreground mb-2">Upload Personalised Video</h1>
        <p className="text-muted-foreground text-sm mb-8">Upload a video for a lead — they'll receive a unique client link to watch it.</p>

        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6 text-sm border border-destructive/20">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="lead_id" className="block text-sm font-medium text-card-foreground mb-1.5">Lead *</label>
            <select id="lead_id" name="lead_id" required defaultValue={preselectedLeadId} className={inputClass}>
              <option value="">Select a lead…</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.name}{lead.company ? ` — ${lead.company}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-card-foreground mb-1.5">Video Title *</label>
            <input
              type="text"
              id="name"
              name="name"
              required
              placeholder="e.g. Personalised Intro for Acme Corp"
              className={inputClass}
            />
          </div>

          {/* Drop zone */}
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-1.5">Video File *</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
                dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
              }`}
              onClick={() => document.getElementById('videoFileInput')?.click()}
            >
              <input
                id="videoFileInput"
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              <Upload size={32} className={`mx-auto mb-3 ${dragOver ? 'text-primary' : 'text-muted-foreground'}`} />
              {selectedFile ? (
                <div>
                  <p className="font-semibold text-primary">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
              ) : (
                <div>
                  <p className="text-card-foreground font-medium">Drop your video here</p>
                  <p className="text-sm text-muted-foreground mt-1">or click to browse — MP4, MOV, WebM supported</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Link href="/dashboard/videos" className="px-6 py-2.5 text-muted-foreground font-medium hover:bg-muted rounded-lg transition-colors">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {loading ? 'Uploading…' : 'Upload Video'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
