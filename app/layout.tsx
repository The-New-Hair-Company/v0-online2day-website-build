import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import Script from 'next/script'
import './globals.css'
import AuthRecoveryHandler from '@/components/auth-recovery-handler'
import { AccessibilitySettingsButton } from '@/components/accessibility-settings'

export const metadata: Metadata = {
  title: 'online2day - Bespoke Web Development | UK',
  description: 'UK-based bespoke web development company. Whatever the requirement, we have the skills and dedication to get clients online 2day. Technical excellence, modern thinking.',
  keywords: ['web development', 'bespoke software', 'UK web agency', 'custom development', 'SaaS development'],
  authors: [{ name: 'online2day' }],
  openGraph: {
    title: 'online2day - Bespoke Web Development',
    description: 'Whatever the requirement, we have the skills and dedication to get clients online 2day.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Script src="/accessibility-init.js" strategy="beforeInteractive" />
        <AuthRecoveryHandler />
        {children}
        <AccessibilitySettingsButton />
        <Analytics />
      </body>
    </html>
  )
}
