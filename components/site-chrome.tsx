'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { SiteMotion } from '@/components/site-motion'

const marketingRoutes = new Set([
  '/',
  '/about',
  '/complaints',
  '/contact',
  '/marketing',
  '/pricing',
  '/privacy',
  '/start',
  '/terms',
])

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isMarketingRoute = marketingRoutes.has(pathname) || pathname.startsWith('/checkout/')

  if (!isMarketingRoute) return children

  return (
    <div className="marketing-site">
      <SiteMotion />
      <a className="skip-link" href="#main">Skip to content</a>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  )
}
