import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import Script from 'next/script'
import './globals.css'
import './marketing.css'
import AuthRecoveryHandler from '@/components/auth-recovery-handler'
import { AccessibilitySettingsButton } from '@/components/accessibility-settings'
import { SiteChrome } from '@/components/site-chrome'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.online2day.com'),
  title: {
    default: 'online2day.com — Bespoke websites without the mystery pricing',
    template: '%s | online2day.com',
  },
  description: site.description,
  applicationName: site.name,
  keywords: ['web development', 'bespoke software', 'UK web agency', 'custom development', 'SaaS development'],
  authors: [{ name: 'online2day' }],
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'online2day.com — Useful websites, built properly',
    description: site.description,
    type: 'website',
    url: 'https://www.online2day.com',
    siteName: site.name,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'online2day.com — Useful websites, built properly.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'online2day.com — Useful websites, built properly',
    description: site.description,
    images: ['/og.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en-GB" className="dark" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Script src="/accessibility-init.js" strategy="beforeInteractive" />
        <AuthRecoveryHandler />
        <SiteChrome>{children}</SiteChrome>
        <AccessibilitySettingsButton />
        <Analytics />
      </body>
    </html>
  )
}
