'use client'

import { Phone, Video, MessageSquare, Mail, Calendar, Blocks } from 'lucide-react'

const integrations = [
  {
    name: 'Zoom / Google Meet',
    description: 'Auto-generate video call links for booked appointments and add them directly to the lead timeline.',
    icon: <Video size={24} className="text-blue-500" />,
    status: 'Coming Soon',
    comingSoon: true,
  },
  {
    name: 'Twilio Dialer',
    description: 'Make calls directly from the CRM, record conversations, and auto-log call duration on the lead timeline.',
    icon: <Phone size={24} className="text-emerald-500" />,
    status: 'Planned',
    comingSoon: true,
  },
  {
    name: 'HubSpot',
    description: 'Two-way sync for leads, notes, and activity timeline events.',
    icon: <Blocks size={24} className="text-orange-500" />,
    status: 'Planned',
    comingSoon: true,
  },
  {
    name: 'Calendly / Cal.com',
    description: 'Sync your availability and automatically create leads when appointments are booked.',
    icon: <Calendar size={24} className="text-purple-500" />,
    status: 'Planned',
    comingSoon: true,
  },
]

export default function IntegrationsPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Integrations & Add-ons</h1>
        <p className="text-muted-foreground mt-1 text-lg">
          Connect your favorite tools to supercharge your CRM pipeline.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {integrations.map((integration, idx) => (
          <div key={idx} className="bg-card border border-border rounded-xl p-6 flex flex-col items-start shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mb-4 border border-border/50">
              {integration.icon}
            </div>
            <h3 className="text-lg font-semibold text-card-foreground mb-2 flex items-center gap-3">
              {integration.name}
              {integration.comingSoon && (
                <span className="text-[10px] uppercase tracking-wider font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {integration.status}
                </span>
              )}
            </h3>
            <p className="text-sm text-muted-foreground flex-1 mb-6 leading-relaxed">
              {integration.description}
            </p>
            <button
              disabled={integration.comingSoon}
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
                integration.comingSoon
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              {integration.comingSoon ? 'In Development' : 'Connect'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
