import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, Mail, Phone, Globe, Calendar, Pencil, ExternalLink } from 'lucide-react'
import { notFound } from 'next/navigation'
import LeadActionsPanel from './LeadActionsPanel'
import DeleteLeadButton from './DeleteLeadButton'
import AddNoteForm from './AddNoteForm'

const statusColors: Record<string, string> = {
  'New': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Contacted': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  'Video Sent': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Follow-up Due': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Proposal Sent': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  'Won': 'bg-green-500/10 text-green-400 border-green-500/20',
  'Lost': 'bg-red-500/10 text-red-400 border-red-500/20',
}

const eventIcons: Record<string, string> = {
  'Lead Created': '✦',
  'Status Updated': '⟳',
  'Note Added': '✎',
  'Video Uploaded': '▶',
  'Email Sent': '✉',
  'Video Page Viewed': '👁',
  'Lead Updated': '✏',
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !lead) {
    notFound()
  }

  // Fetch events with creator email via join
  const { data: events } = await supabase
    .from('lead_events')
    .select('*, creator:user_profiles!lead_events_created_by_fkey(email)')
    .eq('lead_id', lead.id)
    .order('created_at', { ascending: false })

  // Fetch videos for this lead
  const { data: videos } = await supabase
    .from('lead_assets')
    .select('*')
    .eq('lead_id', lead.id)
    .eq('type', 'video')
    .order('created_at', { ascending: false })

  const statusClass = statusColors[lead.status || ''] || 'bg-muted text-muted-foreground border-border'

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/dashboard/leads"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
        >
          <ArrowLeft size={16} />
          Back to Leads
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/leads/${lead.id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors font-medium text-sm"
          >
            <Pencil size={15} />
            Edit Contact
          </Link>
          <DeleteLeadButton leadId={lead.id} leadName={lead.name} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-1 space-y-6">
          {/* Contact Card */}
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center text-2xl font-bold">
                {lead.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-bold text-card-foreground">{lead.name}</h1>
                <p className="text-muted-foreground text-sm">{lead.company || 'No Company'}</p>
                <span className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusClass}`}>
                  {lead.status}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {lead.email && (
                <div className="flex items-center gap-3 text-sm text-card-foreground">
                  <Mail size={15} className="text-muted-foreground shrink-0" />
                  <a href={`mailto:${lead.email}`} className="hover:text-primary truncate">{lead.email}</a>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-3 text-sm text-card-foreground">
                  <Phone size={15} className="text-muted-foreground shrink-0" />
                  <a href={`tel:${lead.phone}`} className="hover:text-primary">{lead.phone}</a>
                </div>
              )}
              {lead.website && (
                <div className="flex items-center gap-3 text-sm text-card-foreground">
                  <Globe size={15} className="text-muted-foreground shrink-0" />
                  <a href={lead.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary flex items-center gap-1 truncate">
                    {lead.website.replace(/^https?:\/\//, '')}
                    <ExternalLink size={11} />
                  </a>
                </div>
              )}
              {lead.source && (
                <div className="flex items-center gap-3 text-sm text-card-foreground">
                  <span className="text-muted-foreground text-xs font-medium w-[15px] text-center">◎</span>
                  <span className="text-muted-foreground">Source: <span className="text-card-foreground">{lead.source}</span></span>
                </div>
              )}
              {lead.follow_up_date && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar size={15} className="text-orange-400 shrink-0" />
                  <span className="text-orange-400 font-medium">
                    Follow-up: {new Date(lead.follow_up_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm text-card-foreground">
                <Calendar size={15} className="text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Added {new Date(lead.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            {lead.notes && (
              <div className="mt-5 pt-5 border-t border-border">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg leading-relaxed">{lead.notes}</p>
              </div>
            )}
          </div>

          {/* Videos Card */}
          {videos && videos.length > 0 && (
            <div className="bg-card rounded-xl shadow-sm border border-border p-6">
              <h2 className="text-sm font-semibold text-card-foreground mb-4 flex items-center gap-2">
                <span className="text-primary">▶</span> Videos
              </h2>
              <div className="space-y-3">
                {videos.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm">
                      <p className="font-medium text-card-foreground truncate">{v.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(v.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {v.slug && (
                      <Link
                        href={`/v/${v.slug}`}
                        target="_blank"
                        className="text-xs text-primary hover:underline shrink-0 flex items-center gap-1"
                      >
                        View <ExternalLink size={11} />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
              <Link
                href={`/dashboard/videos/new?leadId=${lead.id}`}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors text-sm font-medium"
              >
                + Upload New Video
              </Link>
            </div>
          )}

          {(!videos || videos.length === 0) && (
            <div className="bg-card rounded-xl shadow-sm border border-border p-6">
              <h2 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
                <span className="text-primary">▶</span> Videos
              </h2>
              <Link
                href={`/dashboard/videos/new?leadId=${lead.id}`}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors text-sm font-medium"
              >
                + Upload Video for This Lead
              </Link>
            </div>
          )}

          <LeadActionsPanel lead={lead} />
        </div>

        {/* Right Column: Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Add Note */}
          <AddNoteForm leadId={lead.id} />

          {/* Timeline */}
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <h2 className="text-lg font-bold text-card-foreground mb-6">Activity Timeline</h2>

            <div className="space-y-6">
              {events?.map((event) => (
                <div
                  key={event.id}
                  className="relative pl-10 before:content-[''] before:absolute before:left-[18px] before:top-7 before:bottom-[-24px] before:w-px before:bg-border last:before:hidden"
                >
                  <div className="absolute left-0 top-1 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center border-2 border-card text-sm">
                    {eventIcons[event.type] || '●'}
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-card-foreground">{event.type}</h4>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(event.created_at).toLocaleString('en-GB', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>
                    {event.note && (
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{event.note}</p>
                    )}
                    {(event as any).creator?.email && (
                      <p className="text-xs text-muted-foreground/60 mt-2">
                        by {(event as any).creator.email}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {(!events || events.length === 0) && (
                <p className="text-muted-foreground text-sm text-center py-8">No activity recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
