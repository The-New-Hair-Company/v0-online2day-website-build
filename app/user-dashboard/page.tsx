import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Blocks, MessageSquare, ArrowRight, Globe, Clock, CheckCircle2, AlertCircle } from 'lucide-react'

export const metadata = {
  title: 'Dashboard | Online2Day',
  description: 'Your Online2Day client portal',
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  'Submitted':        { label: 'Requirements received',  icon: CheckCircle2, color: 'text-blue-400' },
  'Design & Build':   { label: 'Build in progress',       icon: Clock,        color: 'text-amber-400' },
  'Ready for Review': { label: 'Ready to review',         icon: AlertCircle,  color: 'text-green-400' },
  'Launched':         { label: 'Live',                    icon: Globe,        color: 'text-green-500' },
}

export default async function UserDashboardPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) redirect('/auth/login')

  const [{ data: profile }, { data: siteRequest }, { data: conversations }] = await Promise.all([
    supabase.from('user_profiles').select('full_name').eq('user_id', data.user.id).single(),
    supabase.from('site_build_requests').select('*').eq('user_id', data.user.id).single(),
    supabase
      .from('conversations')
      .select('id, unread_count, last_message_at')
      .eq('user_id', data.user.id)
      .order('last_message_at', { ascending: false })
      .limit(1),
  ])

  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const siteStatus = siteRequest?.status || null
  const statusConf = siteStatus ? STATUS_CONFIG[siteStatus] : null
  const StatusIcon = statusConf?.icon ?? Blocks
  const unread = (conversations || []).reduce((s: number, c: any) => s + (c.unread_count || 0), 0)

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {firstName}</h1>
        <p className="text-muted-foreground mt-1">Here&apos;s what&apos;s happening with your project.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Site Build Card */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Your Website</p>
              <h2 className="text-lg font-semibold">
                {siteRequest?.business_name || 'Website Build'}
              </h2>
            </div>
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
              <Blocks size={20} />
            </div>
          </div>

          {siteStatus && statusConf ? (
            <div className="flex items-center gap-2 mb-4">
              <StatusIcon size={16} className={statusConf.color} />
              <span className={`text-sm font-medium ${statusConf.color}`}>{statusConf.label}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-4">No website request submitted yet.</p>
          )}

          {siteRequest?.staging_url && (
            <a
              href={siteRequest.staging_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mb-4"
            >
              <Globe size={14} />
              View staging site
            </a>
          )}

          <Link
            href="/user-dashboard/site-builder"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {siteRequest ? 'View full details' : 'Start your website'}
            <ArrowRight size={14} />
          </Link>
        </div>

        {/* Support Chat Card */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Support</p>
              <h2 className="text-lg font-semibold">Team Chat</h2>
            </div>
            <div className="relative w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
              <MessageSquare size={20} />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white text-xs rounded-full flex items-center justify-center font-medium">
                  {unread}
                </span>
              )}
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            {unread > 0
              ? `You have ${unread} unread message${unread === 1 ? '' : 's'} from the team.`
              : 'Chat directly with our team. We typically respond within a few hours.'}
          </p>

          <Link
            href="/user-dashboard/chat"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {unread > 0 ? 'Read messages' : 'Open chat'}
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-semibold mb-4">Quick actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/user-dashboard/site-builder"
            className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            <Blocks size={18} className="text-primary" />
            <span className="text-sm">{siteRequest ? 'View website build' : 'Start website build'}</span>
          </Link>
          <Link
            href="/user-dashboard/chat"
            className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            <MessageSquare size={18} className="text-primary" />
            <span className="text-sm">Message the team</span>
          </Link>
          <Link
            href="/user-dashboard/profile"
            className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            <Globe size={18} className="text-primary" />
            <span className="text-sm">Edit profile</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
