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

  // 2. Check if user has an 'admin' role (optional - if table doesn't exist, allow access)
  try {
    const { data: roleData } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', data.user.id)
      .single()

    // Only redirect if we successfully queried and user is NOT admin
    if (roleData && roleData.role !== 'admin') {
      redirect('/')
    }
  } catch {
    // If user_profiles table doesn't exist or query fails, allow access
    // This prevents redirect loops for admin users who don't have a profile entry yet
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
