import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ProtectedPage() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Check if user has admin role
  const { data: roleData } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  // Redirect based on role
  if (roleData?.role === 'admin') {
    redirect('/dashboard')
  } else {
    // Regular users stay on landing page
    redirect('/')
  }
}
