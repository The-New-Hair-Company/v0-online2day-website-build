'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ComponentType } from 'react'
import {
  Bell,
  Crown,
  FileInput,
  Grid3X3,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageCircle,
  Plug,
  RefreshCw,
  Settings,
  ShieldCheck,
  Users,
  Video,
} from 'lucide-react'
import styles from './LeadsDashboard.module.css'
import { getDashboardAccessProfile, type DashboardAccessProfile } from '@/app/actions/dashboard'
import { getUserNotifications, markAllNotificationsRead, type UserNotification } from '@/lib/actions/enterprise-actions'

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ')

type NavItem = {
  label: string
  href: string
  icon: ComponentType<{ size?: number }>
  active?: boolean
  badge?: string
}

type ActiveDashboardSection = 'overview' | 'leads' | 'videos' | 'emails' | 'messages' | 'site-requests' | 'integrations' | 'settings' | 'enterprise' | 'reports'

const defaultAccess: DashboardAccessProfile = {
  isAdmin: false,
  canUseSystem: true,
  modules: {
    overview: true,
    leads: true,
    videos: true,
    emails: true,
    messages: true,
    enterprise: false,
    reports: false,
    siteRequests: true,
    integrations: false,
    settings: false,
  },
}

export function DashboardSidebar({ active }: { active?: ActiveDashboardSection }) {
  const [access, setAccess] = useState<DashboardAccessProfile>(defaultAccess)
  const [loadingAccess, setLoadingAccess] = useState(true)
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [openNotifications, setOpenNotifications] = useState(false)
  const [notificationsError, setNotificationsError] = useState('')

  useEffect(() => {
    getDashboardAccessProfile()
      .then(setAccess)
      .finally(() => setLoadingAccess(false))
    refreshNotifications()
  }, [])

  async function refreshNotifications() {
    try {
      const rows = await getUserNotifications()
      setNotifications(rows)
      setNotificationsError('')
    } catch {
      setNotificationsError('Notifications are temporarily unavailable.')
    }
  }

  async function readNotifications() {
    await markAllNotificationsRead()
    await refreshNotifications()
  }

  const unread = useMemo(() => notifications.filter((item) => !item.readAt).length, [notifications])

  const navItems: NavItem[] = [
    { label: 'Overview', href: '/dashboard/overview', icon: Grid3X3, active: active === 'overview' },
    { label: 'Leads', href: '/dashboard/leads', icon: Users, active: active === 'leads' },
    { label: 'Videos', href: '/dashboard/videos', icon: Video, active: active === 'videos' },
    { label: 'Emails', href: '/dashboard/emails', icon: Mail, active: active === 'emails' },
    { label: 'Messages', href: '/dashboard/messages', icon: MessageCircle, badge: unread ? String(unread) : undefined, active: active === 'messages' },
    { label: 'Enterprise', href: '/dashboard/enterprise', icon: LayoutDashboard, active: active === 'enterprise' },
    { label: 'Reports', href: '/dashboard/reports', icon: ShieldCheck, active: active === 'reports' },
    { label: 'Site Requests', href: '/dashboard/site-requests', icon: FileInput, active: active === 'site-requests' },
    { label: 'Integrations', href: '/dashboard/integrations', icon: Plug, active: active === 'integrations' },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings, active: active === 'settings' },
  ]
  const visibleNav = navItems.filter((item) => {
    if (loadingAccess) return true
    if (item.href.endsWith('/overview')) return access.modules.overview
    if (item.href.endsWith('/leads')) return access.modules.leads
    if (item.href.endsWith('/videos')) return access.modules.videos
    if (item.href.endsWith('/emails')) return access.modules.emails
    if (item.href.endsWith('/messages')) return access.modules.messages
    if (item.href.endsWith('/enterprise')) return access.modules.enterprise
    if (item.href.endsWith('/reports')) return access.modules.reports
    if (item.href.endsWith('/site-requests')) return access.modules.siteRequests
    if (item.href.endsWith('/integrations')) return access.modules.integrations
    if (item.href.endsWith('/settings')) return access.modules.settings
    return true
  })

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span>Online2Day</span>
        <p>CRM Dashboard</p>
      </div>
      <nav className={styles.nav} aria-label="CRM navigation">
        <p className={styles.navSection}>MAIN</p>
        {visibleNav.map((item) => {
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
      <section className={styles.sidebarNotif}>
        <button className={styles.notifTrigger} onClick={() => setOpenNotifications((open) => !open)}>
          <Bell size={16} />
          <span>Activity</span>
          {unread ? <strong>{unread}</strong> : null}
        </button>
        {openNotifications ? (
          <div className={styles.notifPanel}>
            <div className={styles.notifPanelHeader}>
              <strong>Notifications</strong>
              <div>
                <button onClick={() => void refreshNotifications()} aria-label="Refresh"><RefreshCw size={13} /></button>
                <button onClick={() => void readNotifications()}>Mark all read</button>
              </div>
            </div>
            {notificationsError ? <p className={styles.notifState}>{notificationsError}</p> : null}
            {!notifications.length && !notificationsError ? <p className={styles.notifState}>No notifications yet.</p> : null}
            {notifications.slice(0, 8).map((item) => (
              <article key={item.id} className={cx(styles.notifItem, !item.readAt && styles.notifUnread)}>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                <span>{new Date(item.createdAt).toLocaleString()}</span>
              </article>
            ))}
          </div>
        ) : null}
      </section>
      <div className={styles.proCard}>
        <div className={styles.proIcon}><Crown size={18} /></div>
        <h3>Pro Plan</h3>
        <p>Unlimited videos, advanced analytics and more.</p>
        <Link href="/pricing"><button>View Plans</button></Link>
      </div>
      <form action="/auth/signout" method="post" style={{ display: 'contents' }}>
        <button type="submit" className={styles.signOut}><LogOut size={18} /> Sign Out</button>
      </form>
    </aside>
  )
}
