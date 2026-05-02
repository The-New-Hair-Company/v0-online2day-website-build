import { SettingsClient } from './settings-client'

export const metadata = {
  title: 'Settings | Online2Day CRM Dashboard',
  description: 'Online2Day dashboard preferences and license settings.',
}

export default function DashboardSettingsPage() {
  return <SettingsClient />
}
