import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Checkout complete',
  description: 'Your Online2Day package checkout has been completed.',
  robots: { index: false, follow: false },
}

export default function CheckoutSuccessPage() {
  return (
    <section className="section-dark blueprint-bg checkout-success">
      <div className="shell success-card">
        <span className="success-icon" aria-hidden="true">✓</span>
        <p className="eyebrow">Payment received</p>
        <h1>Welcome to Online2Day.</h1>
        <p>Stripe will email your receipt. We will review the order and contact you using the billing email to arrange the project kickoff.</p>
        <div className="hero-actions">
          <Link className="button button-lime" href="/start">Send the project brief <span>→</span></Link>
          <Link className="text-link" href="/">Back to homepage</Link>
        </div>
      </div>
    </section>
  )
}
