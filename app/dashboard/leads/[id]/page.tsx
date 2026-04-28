import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, User, Mail, Phone, Globe, Calendar, Send, FileVideo } from 'lucide-react'
import { notFound } from 'next/navigation'
import LeadActionsPanel from './LeadActionsPanel'

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !lead) {
    notFound()
  }

  const { data: events } = await supabase
    .from('lead_events')
    .select('*')
    .eq('lead_id', lead.id)
    .order('created_at', { ascending: false })

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/leads" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
          <ArrowLeft size={16} />
          Back to Leads
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Lead Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xl font-bold">
                {lead.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-xl font-bold text-card-foreground">{lead.name}</h1>
                <p className="text-muted-foreground">{lead.company || 'No Company'}</p>
              </div>
            </div>

            <div className="space-y-4">
              {lead.email && (
                <div className="flex items-center gap-3 text-sm text-card-foreground">
                  <Mail size={16} className="text-muted-foreground" />
                  <a href={`mailto:${lead.email}`} className="hover:text-primary">{lead.email}</a>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-3 text-sm text-card-foreground">
                  <Phone size={16} className="text-muted-foreground" />
                  <a href={`tel:${lead.phone}`} className="hover:text-primary">{lead.phone}</a>
                </div>
              )}
              {lead.source && (
                <div className="flex items-center gap-3 text-sm text-card-foreground">
                  <Globe size={16} className="text-muted-foreground" />
                  <span>Source: {lead.source}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm text-card-foreground">
                <Calendar size={16} className="text-muted-foreground" />
                <span>Added {new Date(lead.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            
            {lead.notes && (
              <div className="mt-6 pt-6 border-t border-border">
                <h3 className="text-sm font-medium text-card-foreground mb-2">Initial Notes</h3>
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">{lead.notes}</p>
              </div>
            )}
          </div>
          
          <LeadActionsPanel lead={lead} />
        </div>

        {/* Right Column: Timeline */}
        <div className="lg:col-span-2">
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <h2 className="text-lg font-bold text-card-foreground mb-6">Activity Timeline</h2>
            
            <div className="space-y-6">
              {events?.map((event) => (
                <div key={event.id} className="relative pl-8 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-[-24px] before:w-px before:bg-border last:before:hidden">
                  <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center border-4 border-card">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-medium text-card-foreground">{event.type}</h4>
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.created_at).toLocaleString()}
                      </span>
                    </div>
                    {event.note && (
                      <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md mt-2">
                        {event.note}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              
              {(!events || events.length === 0) && (
                <p className="text-muted-foreground text-sm text-center py-4">No activity recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
