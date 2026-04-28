'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LogOut, LayoutDashboard, Users } from 'lucide-react'

export function Sidebar() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard'
    }
    return pathname.startsWith(path)
  }

  return (
    <aside className="w-64 bg-card text-card-foreground flex flex-col border-r border-border">
      <div className="p-6">
        <h2 className="text-2xl font-bold font-serif text-primary">Online2Day</h2>
        <p className="text-sm text-muted-foreground">Lead Dashboard</p>
      </div>
      <nav className="flex-1 px-4 space-y-2">
        <Link
          href="/dashboard"
          className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
            isActive('/dashboard') && pathname === '/dashboard'
              ? 'bg-primary/10 text-primary'
              : 'hover:bg-accent hover:text-accent-foreground'
          }`}
        >
          <LayoutDashboard size={20} />
          <span>Overview</span>
        </Link>
        <Link
          href="/dashboard/leads"
          className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
            isActive('/dashboard/leads')
              ? 'bg-primary/10 text-primary'
              : 'hover:bg-accent hover:text-accent-foreground'
          }`}
        >
          <Users size={20} />
          <span>Leads</span>
        </Link>
      </nav>
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
          <LogOut size={20} />
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-sm">Sign Out</button>
          </form>
        </div>
      </div>
    </aside>
  )
}
