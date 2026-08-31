import 'server-only'

import { platformServerFetch } from '@/lib/api/platform-server'

export type Online2DayBrief = {
  submissionId: string
  plan: string
  projectType: string
  pages: string
  features: string[]
  timeline: string
  budget: string
  name: string
  email: string
  company: string
  notes: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  referrer?: string
}

/**
 * Compatibility adapter for older server modules. Provider credentials and
 * HubSpot orchestration live exclusively in the Azure gateway.
 */
export function syncOnline2DayBrief(brief: Online2DayBrief) {
  return platformServerFetch<{ contactId: string; companyId?: string; dealId: string }>(
    '/api/v1/integrations/hubspot/enquiries',
    {
      method: 'POST',
      serviceRequest: true,
      body: JSON.stringify({ ...brief, email: brief.email.trim().toLowerCase() }),
    },
  )
}
