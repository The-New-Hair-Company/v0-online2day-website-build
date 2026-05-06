import { redirect } from 'next/navigation'
import { isAdmin } from '@/app/actions/dashboard'
import { getAdminPrefs } from '@/lib/actions/settings-actions'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const admin = await isAdmin()

  if (!admin) {
    redirect('/auth/login')
  }

  // Load persisted theme prefs from Supabase to apply before first paint
  let prefs: Record<string, string> = {}
  try {
    prefs = await getAdminPrefs(['theme', 'textSize', 'textScale', 'contrast', 'motion', 'font', 'lineHeight'])
  } catch {
    // Non-critical — fall through to defaults
  }

  const theme = prefs['theme'] || 'dark'
  const textSize = prefs['textSize'] || 'md'
  const contrast = prefs['contrast'] || 'standard'
  const motion = prefs['motion'] || 'standard'
  const font = prefs['font'] || 'standard'
  const lineHeight = prefs['lineHeight'] || 'standard'
  const textScale = Number(prefs['textScale'] || 100)

  // Inline script runs synchronously before React hydration — no FOUC
  const isDark = theme === 'dark'
  const themeScript = `(function(){var r=document.documentElement;r.dataset.theme=${JSON.stringify(theme)};r.dataset.textSize=${JSON.stringify(textSize)};r.dataset.contrast=${JSON.stringify(contrast)};r.dataset.motion=${JSON.stringify(motion)};r.dataset.font=${JSON.stringify(font)};r.dataset.lineHeight=${JSON.stringify(lineHeight)};r.style.setProperty('--accessibility-text-scale',String(${textScale}/100));r.classList.toggle('dark',${isDark});})()`

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      {children}
    </>
  )
}
