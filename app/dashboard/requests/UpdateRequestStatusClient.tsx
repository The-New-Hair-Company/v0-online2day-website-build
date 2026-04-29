'use client'

import { useState } from 'react'
import { updateSiteBuildStatus } from '@/lib/actions/site-builder-actions'
import { Loader2 } from 'lucide-react'

export default function UpdateRequestStatusClient({ request }: { request: any }) {
  const [loading, setLoading] = useState(false)

  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value
    let stagingUrl = request.staging_url

    if (newStatus === 'Ready for Review') {
      const url = prompt('Enter the Staging URL for the client to review:')
      if (url === null) return // User cancelled
      stagingUrl = url
    }

    setLoading(true)
    await updateSiteBuildStatus(request.id, newStatus, stagingUrl)
    setLoading(false)
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {loading && <Loader2 className="animate-spin text-muted-foreground" size={14} />}
      <select
        className="text-sm border border-border bg-background rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-primary"
        value={request.status}
        onChange={handleStatusChange}
        disabled={loading}
      >
        <option value="Requirements Submitted">Requirements Submitted</option>
        <option value="Design & Build">Design & Build</option>
        <option value="Ready for Review">Ready for Review</option>
        <option value="Launched">Launched</option>
      </select>
    </div>
  )
}
