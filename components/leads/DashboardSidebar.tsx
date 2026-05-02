import Link from 'next/link'
import type { ComponentType } from 'react'
import {
  Crown,
  FileInput,
  Grid3X3,
  LogOut,
  Mail,
  MessageCircle,
  Plug,
  Settings,
  Users,
  Video,
} from 'lucide-react'
import styles from './LeadsDashboard.module.css'

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ')

type NavItem = {
  label: string
  href: string
  icon: ComponentType<{ size?: number }>
  active?: boolean
  badge?: string
}

type ActiveDashboardSection = 'overview' | 'leads' | 'videos' | 'emails' | 'messages' | 'site-requests' | 'integrations' | 'settings'

export function DashboardSidebar({ active }: { active?: ActiveDashboardSection }) {
  const navItems: NavItem[] = [
    { label: 'Overview', href: '/dashboard/overview', icon: Grid3X3, active: active === 'overview' },
    { label: 'Leads', href: '/dashboard/leads', icon: Users, active: active === 'leads' },
    { label: 'Videos', href: '/dashboard/videos', icon: Video, active: active === 'videos' },
    { label: 'Emails', href: '/dashboard/emails', icon: Mail, active: active === 'emails' },
    { label: 'Messages', href: '/dashboard/messages', icon: MessageCircle, badge: '4', active: active === 'messages' },
    { label: 'Site Requests', href: '/dashboard/site-requests', icon: FileInput, active: active === 'site-requests' },
    { label: 'Integrations', href: '/dashboard/integrations', icon: Plug, active: active === 'integrations' },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings, active: active === 'settings' },
  ]

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span>Online2Day</span>
        <p>CRM Dashboard</p>
      </div>
      <nav className={styles.nav} aria-label="CRM navigation">
        <p className={styles.navSection}>MAIN</p>
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.label} className={cx(styles.navItem, item.active && styles.navItemActive)} href={item.href}>
              <Icon size={18} />
              <span>{item.label}</span>
              {item.badge ? <strong>{item.badge}</strong> : null}
              {item.active ? <em /> : null}
            </Link>
          )
        })}
      </nav>
      <div className={styles.proCard}>
        <div className={styles.proIcon}><Crown size={18} /></div>
        <h3>Pro Plan</h3>
        <p>Unlimited videos, advanced analytics and more.</p>
        <Link href="/pricing"><button>View Plans</button></Link>
      </div>
      <a className={styles.signOut} href="/auth/login"><LogOut size={18} /> Sign Out</a>
    </aside>
  )
}
