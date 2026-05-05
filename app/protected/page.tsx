import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canUseSystem, isAdmin } from '@/app/actions/dashboard'

export default async function ProtectedPage() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  if (await isAdmin()) {
    redirect('/dashboard')
  }

  if (await canUseSystem()) {
    redirect('/user-dashboard')
  }

  redirect('/')
}
