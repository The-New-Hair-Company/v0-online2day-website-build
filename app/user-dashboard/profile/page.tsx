import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileClient from './profile-client'

export const metadata = {
  title: 'Profile | Online2Day',
  description: 'Manage your Online2Day profile',
}

export default async function ProfilePage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, email, avatar_url, role')
    .eq('user_id', data.user.id)
    .single()

  return (
    <ProfileClient
      userId={data.user.id}
      authEmail={data.user.email ?? ''}
      initialName={profile?.full_name ?? ''}
      initialEmail={profile?.email ?? data.user.email ?? ''}
      role={profile?.role ?? 'user'}
    />
  )
}
