import { redirect } from 'next/navigation'
import { isAdmin } from '@/app/actions/dashboard'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const admin = await isAdmin()

  if (!admin) {
    redirect('/auth/login')
  }

  return <>{children}</>
}
