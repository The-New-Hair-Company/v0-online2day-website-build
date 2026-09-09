import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, MessageSquareText, ShieldCheck } from 'lucide-react'
import styles from '../../tradewindows.module.css'

export const metadata: Metadata = {
  title: 'Private design preview | Trade Windows',
  description: 'A fictional Trade Windows property design demonstration.',
  robots: { index: false, follow: false },
}

export default function TradeWindowsDemoSharePage() {
  return (
    <main className={styles.rolePage} data-tradewindows-demo style={{ minHeight: '100svh' }}>
      <header className={styles.roleHeader}>
        <span className={styles.brand} aria-label="Trade Windows Derby"><span className={styles.brandWord}>TRADE</span><span className={styles.brandSub}>WINDOWS · DERBY</span></span>
        <span className={styles.demoBadge}><ShieldCheck /> Safe demonstration</span>
      </header>
      <section className={styles.roleIntro} style={{ marginBottom: 36 }}>
        <span className={styles.kicker}>Private design preview · Guest link</span>
        <h1 style={{ fontSize: 'clamp(42px, 6vw, 84px)' }}>A clearer view<br />of what comes next.</h1>
        <p>Maya and Daniel, compare the original fictional property with the prepared anthracite window and Trade red door concept.</p>
      </section>
      <section className={styles.mockupLayout}>
        <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
          <Image src="/tradewindows/property-after.jpg" alt="Prepared fictional property preview with anthracite windows and a red door" width={1440} height={960} sizes="(max-width: 900px) 96vw, 66vw" priority style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>
        <div className={`${styles.card} ${styles.mockupControls}`}>
          <span className={`${styles.statusPill} ${styles.tone_green}`}><CheckCircle2 /> Ready to review</span>
          <h2>Anthracite frames + Trade red door</h2>
          <p>This secure guest view contains only the intended fictional design preview and headline specification. Project records, communications, documents and files remain outside this view.</p>
          <Link className={styles.primaryButton} href="/tradewindows"><MessageSquareText /> Discuss in the demo</Link>
          <Link className={styles.secondaryButton} href="/tradewindows"><ArrowRight /> Continue with an account</Link>
          <small>Demonstration links are static and fictional. Production links would be revocable, expiring and validated by the authenticated Azure API.</small>
        </div>
      </section>
    </main>
  )
}
