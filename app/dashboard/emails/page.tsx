import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Mail, Send, FileText } from 'lucide-react'

const emailTypes = [
  { label: 'Initial Outreach', icon: '✉', desc: 'First contact with a new lead', color: 'text-blue-400' },
  { label: 'Video Follow-up', icon: '▶', desc: 'Share a personalised video link', color: 'text-purple-400' },
  { label: 'Proposal Sent', icon: '📄', desc: 'Send a formal proposal or quote', color: 'text-cyan-400' },
  { label: 'Chase-up 1', icon: '⏰', desc: 'First follow-up nudge after no reply', color: 'text-yellow-400' },
  { label: 'Chase-up 2', icon: '🔔', desc: 'Second chase before marking lost', color: 'text-orange-400' },
  { label: 'Won / Lost', icon: '✦', desc: 'Deal closure confirmation email', color: 'text-green-400' },
]

export default async function EmailsPage() {
  const supabase = await createClient()

  // Get recent email events from timeline
  const { data: recentEmails } = await supabase
    .from('lead_events')
    .select('*, lead:leads(name, company)')
    .ilike('type', '%email%')
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Emails</h1>
          <p className="text-muted-foreground mt-1">Send and track emails for your leads</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Email Templates */}
        <div>
          <h2 className="text-lg font-bold text-card-foreground mb-4">Email Templates</h2>
          <div className="space-y-3">
            {emailTypes.map((et) => (
              <div
                key={et.label}
                className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 transition-colors flex items-center gap-4"
              >
                <div className={`text-2xl ${et.color}`}>{et.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-card-foreground">{et.label}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{et.desc}</p>
                </div>
                <Link
                  href="/dashboard/leads"
                  className="text-xs font-medium text-primary hover:underline shrink-0"
                >
                  Send →
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Email Activity */}
        <div>
          <h2 className="text-lg font-bold text-card-foreground mb-4">Recent Email Activity</h2>
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {recentEmails && recentEmails.length > 0 ? (
              recentEmails.map((event) => (
                <div key={event.id} className="p-4 flex items-start gap-4">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <Mail size={14} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-card-foreground">{event.type}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {(event as any).lead?.name} — {(event as any).lead?.company || 'No company'}
                    </p>
                    {event.note && <p className="text-xs text-muted-foreground/70 mt-1 truncate">{event.note}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(event.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-12 text-center">
                <Send size={28} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No emails sent yet.</p>
                <p className="text-muted-foreground/60 text-xs mt-1">Open a lead and use the Quick Actions panel to send emails.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
