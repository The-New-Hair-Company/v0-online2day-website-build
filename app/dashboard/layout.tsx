import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from './Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // 1. Check if user is logged in
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect('/auth/login')
  }

  // 2. Check if user has an 'admin' role
  const { data: roleData } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', data.user.id)
    .single()

  if (roleData?.role !== 'admin') {
    // If not an admin, redirect them to the landing page
    redirect('/')
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-background">
        {children}
      </main>
    </div>
  )
}
