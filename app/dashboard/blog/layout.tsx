import { DashboardSidebar } from '@/components/leads/DashboardSidebar'
import styles from '@/components/leads/LeadsDashboard.module.css'

export default function BlogDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <DashboardSidebar active="blog" />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}
