import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Download } from 'lucide-react'
import { fetchHubspotContacts, importHubspotContactToLead } from '@/lib/actions/hubspot-actions'

export default async function LeadsPage() {
  const supabase = await createClient()

  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return <div className="p-8 text-foreground">Error loading leads: {error.message}</div>
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'New': return 'bg-chart-1/20 text-chart-1'
      case 'Contacted': return 'bg-chart-5/20 text-chart-5'
      case 'Video Sent': return 'bg-chart-3/20 text-chart-3'
      case 'Follow-up Due': return 'bg-chart-4/20 text-chart-4'
      case 'Proposal Sent': return 'bg-chart-2/20 text-chart-2'
      case 'Won': return 'bg-primary/20 text-primary'
      case 'Lost': return 'bg-destructive/20 text-destructive'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground mt-1">Manage your outreach pipeline</p>
        </div>
        <div className="flex items-center gap-3">
          {/* In a real app this would be a client component triggering the server action */}
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors font-medium">
            <Download size={18} />
            <span>Sync Hubspot</span>
          </button>
          <Link href="/dashboard/leads/new" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium">
            <Plus size={18} />
            <span>New Lead</span>
          </Link>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="px-6 py-4 text-sm font-medium text-muted-foreground">Name / Company</th>
              <th className="px-6 py-4 text-sm font-medium text-muted-foreground">Contact</th>
              <th className="px-6 py-4 text-sm font-medium text-muted-foreground">Source</th>
              <th className="px-6 py-4 text-sm font-medium text-muted-foreground">Status</th>
              <th className="px-6 py-4 text-sm font-medium text-muted-foreground text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {leads?.map((lead) => (
              <tr key={lead.id} className="hover:bg-muted/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-card-foreground">{lead.name}</div>
                  <div className="text-sm text-muted-foreground">{lead.company || '-'}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-card-foreground">{lead.email}</div>
                  <div className="text-xs text-muted-foreground">{lead.phone || '-'}</div>
                </td>
                <td className="px-6 py-4 text-sm text-card-foreground">
                  {lead.source || '-'}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
                    {lead.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link href={`/dashboard/leads/${lead.id}`} className="text-primary hover:text-primary/80 text-sm font-medium">
                    View details
                  </Link>
                </td>
              </tr>
            ))}
            {(!leads || leads.length === 0) && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                  No leads found. Create your first lead to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
