import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import AuthRecoveryHandler from '@/components/auth-recovery-handler'
import { AccessibilitySettingsButton } from '@/components/accessibility-settings'

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
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var settings = JSON.parse(localStorage.getItem('o2d_accessibility_settings') || '{}');
                var root = document.documentElement;
                var theme = settings.theme || localStorage.getItem('crm_theme') || 'dark';
                root.dataset.theme = theme;
                root.dataset.textSize = settings.textSize || localStorage.getItem('crm_textsize') || 'md';
                root.dataset.contrast = settings.contrast || 'standard';
                root.dataset.motion = settings.motion || 'standard';
                root.dataset.font = settings.font || 'standard';
                root.dataset.lineHeight = settings.lineHeight || 'standard';
                root.classList.toggle('dark', theme === 'dark');
              } catch (error) {}
            `,
          }}
        />
        <AuthRecoveryHandler />
        {children}
        <AccessibilitySettingsButton />
        <Analytics />
      </body>
    </html>
  )
}
