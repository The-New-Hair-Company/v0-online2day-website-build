'use client'

import React, { ReactNode } from 'react'
import type { IconName, LeadStage } from './leads-types'
import styles from './LeadsDashboard.module.css'

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ')

// ─── HELPERS ──────────────────────────────────────────────────────────────────

export function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase()
}

export function initialsForOwner(owner: string) {
  return owner.split(' ').map(p => p[0]).join('').replace('.', '').toUpperCase()
}

// ─── ICON COMPONENT ──────────────────────────────────────────────────────────

export function Icon({ name, className, size = 18 }: { name: IconName; className?: string; size?: number }) {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className
  }
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    video: <><path d="M15 10l4.55-2.28A1 1 0 0 1 21 8.62v6.76a1 1 0 0 1-1.45.9L15 14" /><rect x="3" y="6" width="12" height="12" rx="2" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
    message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /></>,
    request: <><path d="M14 3l7 7-7 7" /><path d="M21 10H3" /><path d="M3 10l5-5" /><path d="M3 10l5 5" /></>,
    integrations: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 17h7" /><path d="M17.5 14v7" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></>,
    filter: <><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></>,
    export: <><path d="M12 3v12" /><path d="M7 8l5-5 5 5" /><path d="M5 21h14" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
    dollar: <><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" /></>,
    trend: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
    diamond: <><path d="M12 2l8 8-8 12L4 10z" /></>,
    star: <><path d="M12 2l2.8 6 6.5.8-4.8 4.5 1.2 6.4L12 16.5 6.3 19.7l1.2-6.4-4.8-4.5 6.5-.8z" /></>,
    task: <><path d="M9 11l2 2 4-4" /><rect x="4" y="3" width="16" height="18" rx="2" /></>,
    upload: <><path d="M12 15V3" /><path d="M7 8l5-5 5 5" /><path d="M5 21h14" /></>,
    owner: <><circle cx="12" cy="7" r="4" /><path d="M5.5 21a6.5 6.5 0 0 1 13 0" /></>,
    globe: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15 15 0 0 1 0 20" /><path d="M12 2a15 15 0 0 0 0 20" /></>,
    phone: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07A19.5 19.5 0 0 1 5.15 12 19.8 19.8 0 0 1 2.08 3.37 2 2 0 0 1 4.06 1.2h3a2 2 0 0 1 2 1.72c.12.9.32 1.78.58 2.63a2 2 0 0 1-.45 2.11L8 8.85a16 16 0 0 0 7.15 7.15l1.19-1.19a2 2 0 0 1 2.11-.45c.85.26 1.73.46 2.63.58A2 2 0 0 1 22 16.92z" /></>,
    linkedin: <><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></>,
    ellipsis: <><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>,
    chevron: <><path d="M9 18l6-6-6-6" /></>,
    external: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14L21 3" /></>,
    sparkle: <><path d="M12 2l1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6z" /></>,
    check: <><path d="M20 6L9 17l-5-5" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
    columns: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /><path d="M15 4v16" /></>,
    crown: <><path d="M3 8l4 4 5-8 5 8 4-4v11H3z" /><path d="M3 19h18" /></>,
    paperclip: <><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></>,
    send: <><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>,
  }
  return <svg {...props}>{paths[name] ?? null}</svg>
}

// ─── SHARED SUB-COMPONENTS ───────────────────────────────────────────────────

export function Score({ value }: { value: number }) {
  return <span className={styles.score}>{value}</span>
}

export function StageBadge({ stage }: { stage: LeadStage }) {
  return <span className={cx(styles.stageBadge, styles[`stage${stage.replaceAll(' ', '')}`])}>{stage}</span>
}

export function ProgressBar({ value }: { value: number }) {
  return <i className={styles.progressTrack}><em style={{ width: `${value}%` }} /></i>
}

export function Avatar({ initials, size = 'md' }: { initials: string; size?: 'sm' | 'md' | 'lg' }) {
  return <span className={cx(styles.avatar, size === 'sm' && styles.avatarSm, size === 'lg' && styles.avatarLg)}>{initials}</span>
}
