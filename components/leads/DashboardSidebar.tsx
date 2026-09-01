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
  Menu,
  MessageCircle,
  Newspaper,
  Plug,
  RefreshCw,
  Settings,
  ShieldCheck,
  Users,
  Video,
  X,
} from 'lucide-react'
import styles from './LeadsDashboard.module.css'
import { getDashboardAccessProfile, type DashboardAccessProfile } from '@/app/actions/dashboard'
import { getUserNotifications, markAllNotificationsRead, markNotificationRead, type UserNotification } from '@/lib/actions/enterprise-actions'

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ')

type NavItem = {
  label: string
  href: string
  icon: ComponentType<{ size?: number }>
  active?: boolean
  badge?: string
}

type ActiveDashboardSection = 'overview' | 'leads' | 'videos' | 'emails' | 'messages' | 'site-requests' | 'integrations' | 'settings' | 'enterprise' | 'reports' | 'blog'

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
    blog: false,
  },
}

export function DashboardSidebar({ active }: { active?: ActiveDashboardSection }) {
  const [access, setAccess] = useState<DashboardAccessProfile>(defaultAccess)
  const [loadingAccess, setLoadingAccess] = useState(true)
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [openNotifications, setOpenNotifications] = useState(false)
  const [notificationsError, setNotificationsError] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    getDashboardAccessProfile()
      .then(setAccess)
      .finally(() => setLoadingAccess(false))
    refreshNotifications()
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [mobileOpen])

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

  async function readNotification(id: string) {
    await markNotificationRead(id)
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
    { label: 'Blog', href: '/dashboard/blog', icon: Newspaper, active: active === 'blog' },
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
    if (item.href.endsWith('/blog')) return access.modules.blog
    if (item.href.endsWith('/reports')) return access.modules.reports
    if (item.href.endsWith('/site-requests')) return access.modules.siteRequests
    if (item.href.endsWith('/integrations')) return access.modules.integrations
    if (item.href.endsWith('/settings')) return access.modules.settings
    return true
  })

  function sidebarContents(isMobile = false) {
    return <>
      <div className={styles.brand}>
        <span>Online2Day</span>
        <p>CRM Dashboard</p>
      </div>
      <nav className={styles.nav} aria-label="CRM navigation">
        <p className={styles.navSection}>MAIN</p>
        {visibleNav.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.label} className={cx(styles.navItem, item.active && styles.navItemActive)} href={item.href} onClick={() => isMobile && setMobileOpen(false)}>
              <Icon size={18} />
              <span>{item.label}</span>
              {item.badge ? <strong>{item.badge}</strong> : null}
              {item.active ? <em /> : null}
            </Link>
          )
        })}
      </nav>
      {!isMobile ? <section className={styles.sidebarNotif}>
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
              <article key={item.id} className={cx(styles.notifItem, !item.readAt && styles.notifUnread)} onClick={() => void readNotification(item.id)}>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                <em>{item.source}</em>
                <span>{new Date(item.createdAt).toLocaleString()}</span>
              </article>
            ))}
          </div>
        ) : null}
      </section> : null}
      <div className={styles.proCard}>
        <div className={styles.proIcon}><Crown size={18} /></div>
        <h3>Pro Plan</h3>
        <p>Unlimited videos, advanced analytics and more.</p>
        <Link href="/pricing" onClick={() => isMobile && setMobileOpen(false)}>View plans</Link>
      </div>
      <form action="/auth/signout" method="post" style={{ display: 'contents' }}>
        <button type="submit" className={styles.signOut}><LogOut size={18} /> Sign Out</button>
      </form>
    </>
  }

  const activeLabel = navItems.find((item) => item.active)?.label || 'Dashboard'

  return (
    <>
      <header className={styles.mobileDashboardHeader}>
        <Link href="/dashboard/overview" className={styles.mobileBrand}>Online2Day</Link>
        <span>{activeLabel}</span>
        <button
          type="button"
          aria-label="Open dashboard navigation"
          aria-expanded={mobileOpen}
          aria-controls="mobile-dashboard-navigation"
          onClick={() => setMobileOpen(true)}
        >
          <Menu size={21} />
        </button>
      </header>
      {mobileOpen ? (
        <div className={styles.mobileNavBackdrop} onClick={() => setMobileOpen(false)}>
          <aside
            id="mobile-dashboard-navigation"
            className={styles.mobileNavDrawer}
            aria-label="Dashboard navigation"
            onClick={(event) => event.stopPropagation()}
          >
            <button className={styles.mobileNavClose} type="button" onClick={() => setMobileOpen(false)} aria-label="Close dashboard navigation"><X size={20} /></button>
            {sidebarContents(true)}
          </aside>
        </div>
      ) : null}
      <aside className={styles.sidebar}>{sidebarContents()}</aside>
    </>
  )
}
