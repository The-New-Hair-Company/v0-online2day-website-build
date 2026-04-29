'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateLead } from '@/lib/actions/lead-actions'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const STATUSES = ['New', 'Contacted', 'Video Sent', 'Follow-up Due', 'Proposal Sent', 'Won', 'Lost']
const SOURCES = ['Website', 'Cold Outreach', 'Referral', 'HubSpot', 'LinkedIn', 'Phone', 'Event', 'Other']

interface Lead {
  id: string
  name: string
  company: string | null
  email: string
  phone: string | null
  source: string | null
  status: string | null
  notes: string | null
  website: string | null
  follow_up_date: string | null
}

export default function EditLeadForm({ lead }: { lead: Lead }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError('')
    setSuccess(false)

    const result = await updateLead(lead.id, formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
      setTimeout(() => router.push(`/dashboard/leads/${lead.id}`), 800)
    }
  }

  const inputClass =
    'w-full px-4 py-2.5 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all'
  const labelClass = 'block text-sm font-medium text-card-foreground mb-1.5'

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/dashboard/leads/${lead.id}`}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
        >
          <ArrowLeft size={16} />
          Back to Contact
        </Link>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xl font-bold">
            {lead.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-card-foreground">Edit Contact</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{lead.name}</p>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6 text-sm border border-destructive/20">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-primary/10 text-primary p-4 rounded-lg mb-6 text-sm border border-primary/20">
            ✓ Contact updated successfully — redirecting…
          </div>
        )}

        <form action={handleSubmit} className="space-y-6">
          {/* Section: Personal Info */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Personal Info</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="name" className={labelClass}>Full Name *</label>
                <input type="text" id="name" name="name" required defaultValue={lead.name} className={inputClass} />
              </div>
              <div>
                <label htmlFor="company" className={labelClass}>Company</label>
                <input type="text" id="company" name="company" defaultValue={lead.company || ''} className={inputClass} />
              </div>
              <div>
                <label htmlFor="email" className={labelClass}>Email</label>
                <input type="email" id="email" name="email" defaultValue={lead.email} className={inputClass} />
              </div>
              <div>
                <label htmlFor="phone" className={labelClass}>Phone</label>
                <input type="tel" id="phone" name="phone" defaultValue={lead.phone || ''} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="website" className={labelClass}>Website</label>
                <input type="url" id="website" name="website" defaultValue={lead.website || ''} placeholder="https://" className={inputClass} />
              </div>
            </div>
          </div>

          {/* Section: CRM Fields */}
          <div className="pt-6 border-t border-border">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">CRM Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="status" className={labelClass}>Status</label>
                <select id="status" name="status" defaultValue={lead.status || 'New'} className={inputClass}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="source" className={labelClass}>Lead Source</label>
                <select id="source" name="source" defaultValue={lead.source || ''} className={inputClass}>
                  <option value="">Select source…</option>
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="follow_up_date" className={labelClass}>Follow-up Date</label>
                <input
                  type="datetime-local"
                  id="follow_up_date"
                  name="follow_up_date"
                  defaultValue={lead.follow_up_date ? new Date(lead.follow_up_date).toISOString().slice(0, 16) : ''}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Section: Notes */}
          <div className="pt-6 border-t border-border">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Notes</h2>
            <textarea
              id="notes"
              name="notes"
              rows={5}
              defaultValue={lead.notes || ''}
              placeholder="Add any notes about this contact…"
              className={inputClass}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Link
              href={`/dashboard/leads/${lead.id}`}
              className="px-6 py-2.5 text-muted-foreground font-medium hover:bg-muted rounded-lg transition-colors"
            >
              Cancel
            </Link>
            <button
              disabled={loading}
              type="submit"
              className="px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
