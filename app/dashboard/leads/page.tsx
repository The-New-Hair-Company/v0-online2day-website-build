import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import LeadsTable from '@/components/dashboard/leads-table'

export default async function LeadsPage() {
  const supabase = await createClient()

  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return <div className="p-8 text-foreground">Error loading leads: {error.message}</div>
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground mt-1">Manage your outreach pipeline</p>
        </div>
        <Link
          href="/dashboard/leads/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
        >
          <Plus size={18} />
          New Lead
        </Link>
      </div>

      <LeadsTable leads={leads || []} />
    </div>
  )
}
