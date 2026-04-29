'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Returns the count of unread messages for the admin.
 * Subscribes to real-time inserts on the messages table.
 */
export function useUnreadCount() {
  const [count, setCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    let isMounted = true

    const fetchCount = async () => {
      const { count: c } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false)
      if (isMounted) setCount(c || 0)
    }

    fetchCount()

    // Real-time subscription: increment on new INSERT, decrement on UPDATE (mark read)
    const channel = supabase
      .channel('unread_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        if (isMounted) setCount((prev) => prev + 1)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => {
        // Re-fetch to get accurate count after marking read
        fetchCount()
      })
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [])

  return count
}
