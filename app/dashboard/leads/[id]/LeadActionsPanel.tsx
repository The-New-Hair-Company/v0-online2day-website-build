'use client'

import { useState } from 'react'
import { updateLeadStatus } from '@/lib/actions/lead-actions'
import { sendVideoFollowUpEmail } from '@/lib/actions/email-actions'
import { Mail, Settings, Check, Loader2 } from 'lucide-react'

const STATUSES = ['New', 'Contacted', 'Video Sent', 'Follow-up Due', 'Proposal Sent', 'Won', 'Lost']

export default function LeadActionsPanel({ lead }: { lead: any }) {
  const [updating, setUpdating] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    setUpdating(true)
    await updateLeadStatus(lead.id, e.target.value)
    setUpdating(false)
  }

  const handleSendVideoEmail = async () => {
    if (!lead.email) return alert('Lead has no email')
    
    // In a real app, you would have uploaded a video and generated a slug. 
    // Here we use the lead id as a dummy slug.
    const videoSlug = lead.id
    
    setSendingEmail(true)
    await sendVideoFollowUpEmail(lead.id, lead.email, lead.name, videoSlug)
    setSendingEmail(false)
  }

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6">
      <h2 className="text-lg font-bold text-card-foreground mb-6 flex items-center gap-2">
        <Settings size={20} className="text-muted-foreground" />
        Quick Actions
      </h2>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-card-foreground mb-2">Change Status</label>
          <div className="relative">
            <select 
              value={lead.status || 'New'} 
              onChange={handleStatusChange}
              disabled={updating}
              className="w-full px-4 py-2 bg-background border border-border rounded-md focus:ring-primary focus:border-primary outline-none appearance-none text-foreground"
            >
              {STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {updating && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Loader2 size={16} className="animate-spin" />
              </div>
            )}
          </div>
        </div>

        <div className="pt-6 border-t border-border">
          <label className="block text-sm font-medium text-card-foreground mb-2">Send Emails</label>
          <div className="space-y-3">
            <button 
              onClick={handleSendVideoEmail}
              disabled={sendingEmail || !lead.email}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-md hover:bg-primary/20 transition-colors disabled:opacity-50 font-medium"
            >
              {sendingEmail ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              Send Video Follow-up
            </button>
            <button 
              disabled={!lead.email}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground border border-border rounded-md hover:bg-secondary/80 transition-colors disabled:opacity-50 font-medium"
            >
              <Mail size={16} />
              Send Proposal
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
