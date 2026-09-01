'use client'

import { useEffect, useRef } from 'react'

export default function VideoTracker({ assetId }: { assetId: string }) {
  const tracked = useRef(false)

  useEffect(() => {
    if (tracked.current) return
    tracked.current = true

    // Fire and forget tracking
    fetch('/api/track/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId })
    }).catch(console.error)
  }, [assetId])

  return null
}
