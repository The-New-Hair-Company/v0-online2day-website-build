'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Auto-logs out the user after `minutes` of inactivity.
 * Resets on any mouse move, key press, click, or scroll.
 */
export function useInactivityLogout(minutes: number = 5) {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/auth?reason=inactivity')
    }, minutes * 60 * 1000)
  }, [minutes, router])

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer() // Start timer on mount

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [resetTimer])
}
