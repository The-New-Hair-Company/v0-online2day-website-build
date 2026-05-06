import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canUseSystem } from '@/app/actions/dashboard'
import Link from 'next/link'
import { MessageSquare, LogOut, Blocks, User, LayoutDashboard } from 'lucide-react'

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
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-card text-card-foreground flex flex-col border-r border-border">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold text-primary">Online2Day</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Client Portal</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-muted text-muted-foreground hover:text-foreground text-sm"
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-border space-y-3">
          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
            </div>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background flex flex-col">
        {children}
      </main>
    </div>
  )
}
