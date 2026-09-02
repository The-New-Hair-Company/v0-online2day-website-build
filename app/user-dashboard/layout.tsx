import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canUseSystem } from '@/app/actions/dashboard'
import { MessageSquare, LogOut, Blocks, User, LayoutDashboard } from 'lucide-react'
import { UserNavLink } from '@/components/dashboard/UserNavLink'

export default async function UserDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect('/auth/login')
  }

  const licensed = await canUseSystem()
  if (!licensed) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, email, avatar_url')
    .eq('user_id', data.user.id)
    .single()

  const displayName = profile?.full_name || data.user.email?.split('@')[0] || 'User'
  const displayEmail = profile?.email || data.user.email || ''
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  const navItems = [
    { href: '/user-dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/user-dashboard/site-builder', label: 'My Website', icon: Blocks },
    { href: '/user-dashboard/chat', label: 'Support Chat', icon: MessageSquare },
    { href: '/user-dashboard/profile', label: 'Profile', icon: User },
  ]

  return (
    <div className="flex min-h-dvh flex-col bg-background md:h-dvh md:flex-row">
      {/* Sidebar */}
      <aside className="flex w-full shrink-0 flex-col border-b border-border bg-card text-card-foreground md:w-64 md:border-b-0 md:border-r">
        <div className="border-b border-border px-4 py-3 md:p-6">
          <h2 className="text-xl font-bold text-primary">Online2Day</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Client Portal</p>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 py-2 md:flex-1 md:flex-col md:space-y-1 md:overflow-y-auto md:py-4">
          {navItems.map(({ href, label, icon: Icon }) => (
            <UserNavLink key={href} href={href} label={label} icon={Icon} />
          ))}
        </nav>

        {/* User footer */}
        <div className="flex items-center gap-3 border-t border-border p-3 md:block md:space-y-3 md:p-4">
          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
            </div>
          </div>
          <form action="/auth/signout" method="post" className="ml-auto md:ml-0">
            <button
              type="submit"
              className="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:w-full"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto bg-background">
        {children}
      </main>
    </div>
  )
}
