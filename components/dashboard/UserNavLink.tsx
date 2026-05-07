'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentType } from 'react'

type Props = {
  href: string
  label: string
  icon: ComponentType<{ size?: number; className?: string }>
}

export function UserNavLink({ href, label, icon: Icon }: Props) {
  const pathname = usePathname()
  const isActive =
    href === '/user-dashboard'
      ? pathname === '/user-dashboard'
      : pathname.startsWith(href)

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm ${
        isActive
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </Link>
  )
}
