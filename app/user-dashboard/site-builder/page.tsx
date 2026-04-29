import { createClient } from '@/lib/supabase/server'
import SiteBuilderClient from './SiteBuilderClient'
import { redirect } from 'next/navigation'

export default async function SiteBuilderPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Fetch existing request
  const { data: request } = await supabase
    .from('site_build_requests')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return <SiteBuilderClient initialRequest={request} />
}
