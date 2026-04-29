import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import AuthRecoveryHandler from '@/components/auth-recovery-handler'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

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
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <AuthRecoveryHandler />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
