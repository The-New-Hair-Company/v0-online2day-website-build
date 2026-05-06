import { SettingsClient } from './settings-client'
import { getDashboardAccessProfile } from '@/app/actions/dashboard'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Settings | Online2Day CRM Dashboard',
  description: 'Online2Day dashboard preferences and license settings.',
}

export default function DashboardSettingsPage() {
  return <SettingsGate />
}

async function SettingsGate() {
  const access = await getDashboardAccessProfile()
  if (!access.canUseSystem || !access.modules.settings) {
    redirect('/dashboard/overview')
  }
  return <SettingsClient />
}
