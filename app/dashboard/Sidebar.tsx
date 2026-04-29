'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LogOut, LayoutDashboard, Users, MessageSquare, Video, Mail } from 'lucide-react'
import { useInactivityLogout } from '@/hooks/use-inactivity-logout'

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/leads', label: 'Leads', icon: Users, exact: false },
  { href: '/dashboard/videos', label: 'Videos', icon: Video, exact: false },
  { href: '/dashboard/emails', label: 'Emails', icon: Mail, exact: false },
  { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare, exact: false },
]

export function Sidebar() {
  const pathname = usePathname()
  useInactivityLogout(5) // 5 minutes

  const isActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <aside className="w-64 bg-card text-card-foreground flex flex-col border-r border-border h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <Link href="/dashboard">
          <h2 className="text-2xl font-bold font-serif text-primary">Online2Day</h2>
          <p className="text-xs text-muted-foreground mt-0.5">CRM Dashboard</p>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${
                active
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              <Icon size={18} className={active ? 'text-primary' : ''} />
              {label}
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all text-sm font-medium"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  )
}
