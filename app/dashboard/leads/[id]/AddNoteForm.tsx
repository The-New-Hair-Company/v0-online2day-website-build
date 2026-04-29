'use client'

import { useState } from 'react'
import { addLeadNote } from '@/lib/actions/lead-actions'
import { MessageSquarePlus, Loader2 } from 'lucide-react'
import dynamic from 'next/dynamic'

const RichEditor = dynamic(() => import('@/components/ui/rich-editor'), { ssr: false })

export default function AddNoteForm({ leadId }: { leadId: string }) {
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const stripped = note.replace(/<[^>]*>/g, '').trim()
    if (!stripped) return
    setLoading(true)
    setSuccess(false)
    await addLeadNote(leadId, note)
    setNote('')
    setLoading(false)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 2000)
  }

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6">
      <h2 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
        <MessageSquarePlus size={16} className="text-primary" />
        Add a Note
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <RichEditor
          value={note}
          onChange={setNote}
          placeholder="Add a note, call summary, or reminder… Supports **bold**, lists, links and more."
          minHeight="120px"
        />
        <div className="flex items-center justify-between">
          {success
            ? <span className="text-xs text-green-400 font-medium">✓ Note saved</span>
            : <span className="text-xs text-muted-foreground">Supports rich formatting</span>
          }
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            Save Note
          </button>
        </div>
      </form>
    </div>
  )
}
