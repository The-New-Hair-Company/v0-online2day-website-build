'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createLead } from '@/lib/actions/lead-actions'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NewLeadPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError('')
    
    const result = await createLead(formData)
    
    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else if (result.data) {
      router.push(`/dashboard/leads/${result.data.id}`)
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/leads" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
          <ArrowLeft size={16} />
          Back to Leads
        </Link>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border p-8">
        <h1 className="text-2xl font-bold text-card-foreground mb-6">Add New Lead</h1>

        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-6 text-sm">
            {error}
          </div>
        )}

        <form action={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-card-foreground mb-1">Name *</label>
              <input type="text" id="name" name="name" required className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground focus:ring-primary focus:border-primary outline-none" />
            </div>
            <div>
              <label htmlFor="company" className="block text-sm font-medium text-card-foreground mb-1">Company</label>
              <input type="text" id="company" name="company" className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground focus:ring-primary focus:border-primary outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-card-foreground mb-1">Email</label>
              <input type="email" id="email" name="email" className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground focus:ring-primary focus:border-primary outline-none" />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-card-foreground mb-1">Phone</label>
              <input type="tel" id="phone" name="phone" className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground focus:ring-primary focus:border-primary outline-none" />
            </div>
          </div>

          <div>
            <label htmlFor="source" className="block text-sm font-medium text-card-foreground mb-1">Lead Source</label>
            <input type="text" id="source" name="source" placeholder="e.g. Website, Referral, Cold Outreach" className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground focus:ring-primary focus:border-primary outline-none" />
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-card-foreground mb-1">Initial Notes</label>
            <textarea id="notes" name="notes" rows={4} className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground focus:ring-primary focus:border-primary outline-none"></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Link href="/dashboard/leads" className="px-6 py-2 text-muted-foreground font-medium hover:bg-muted rounded-md transition-colors">
              Cancel
            </Link>
            <button disabled={loading} type="submit" className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50">
              {loading ? 'Creating...' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
