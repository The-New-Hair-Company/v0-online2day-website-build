'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthRecoveryHandler() {
  const router = useRouter()
  
  useEffect(() => {
    const supabase = createClient()
    
    // Listen for password recovery event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.push('/auth/reset-password')
      }
    })
    
    // Check if URL has recovery token in hash
    const hash = window.location.hash
    if (hash && hash.includes('access_token') && hash.includes('type=recovery')) {
      // Supabase client will automatically handle the hash and trigger PASSWORD_RECOVERY
      // If not automatically redirected, manually set session
      setTimeout(() => {
        const checkSession = async () => {
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            router.push('/auth/reset-password')
          }
        }
        checkSession()
      }, 500)
    }
    
    return () => subscription.unsubscribe()
  }, [router])
  
  return null
}
