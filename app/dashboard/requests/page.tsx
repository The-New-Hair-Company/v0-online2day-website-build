import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Paintbrush, ExternalLink } from 'lucide-react'
import UpdateRequestStatusClient from './UpdateRequestStatusClient'

export default async function SiteRequestsPage() {
  const supabase = await createClient()

  // Verify Admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/user-dashboard')

  // Fetch Requests
  const { data: requests, error } = await supabase
    .from('site_build_requests')
    .select(`
      *,
      user:user_id (
        email
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching requests:', error)
  }

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Site Build Requests</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage incoming website build requests from your clients.
          </p>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        {(!requests || requests.length === 0) ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Paintbrush className="text-muted-foreground" size={24} />
            </div>
            <h3 className="text-lg font-semibold text-card-foreground">No requests found</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              When a client submits a site builder request, it will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
                  <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Business Name</th>
                  <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</th>
                  <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Submitted</th>
                  <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-foreground">{(req as any).user?.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-foreground">{req.business_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-muted-foreground max-w-[200px] truncate" title={req.style_description}>
                        {req.style_description}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        req.status === 'Requirements Submitted' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' :
                        req.status === 'Design & Build' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                        'bg-green-500/10 text-green-600 border-green-500/20'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(req.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <UpdateRequestStatusClient request={req} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
