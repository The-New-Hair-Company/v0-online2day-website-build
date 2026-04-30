'use client'

import { useState } from 'react'
import { deleteLead } from '@/lib/actions/lead-actions'
import { Trash2, Loader2 } from 'lucide-react'

export default function DeleteLeadButton({ leadId, leadName }: { leadId: string; leadName: string }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    await deleteLead(leadId)
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-1.5">
        <span className="text-sm text-destructive font-medium">Delete "{leadName}"?</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-3 py-1 bg-destructive text-destructive-foreground text-xs font-semibold rounded-md hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          {deleting ? <Loader2 size={12} className="animate-spin" /> : null}
          Yes, Delete
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 transition-colors font-medium text-sm border border-destructive/20"
    >
      <Trash2 size={15} />
      Delete
    </button>
  )
}
