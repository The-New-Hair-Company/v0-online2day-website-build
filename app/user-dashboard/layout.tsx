import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canUseSystem } from '@/app/actions/dashboard'
import Link from 'next/link'
import { MessageSquare, LogOut, Blocks } from 'lucide-react'

export default async function UserDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Check if user is logged in
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect('/auth/login')
  }

  const licensed = await canUseSystem()
  if (!licensed) {
    redirect('/auth/login')
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-card text-card-foreground flex flex-col border-r border-border">
        <div className="p-6">
          <h2 className="text-2xl font-bold font-serif text-primary">Online2Day</h2>
          <p className="text-sm text-muted-foreground">My Portal</p>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <Link
            href="/user-dashboard"
            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-muted text-muted-foreground hover:text-foreground`}
          >
            <MessageSquare size={20} />
            <span>Support Chat</span>
          </Link>
          <Link
            href="/user-dashboard/site-builder"
            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-muted text-muted-foreground hover:text-foreground`}
          >
            <Blocks size={20} />
            <span>Site Builder</span>
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

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background flex flex-col">
        {children}
      </main>
    </div>
  )
}
