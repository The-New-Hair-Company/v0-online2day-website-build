'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Crown, Zap } from 'lucide-react'
import styles from '@/components/leads/LeadsDashboard.module.css'

const plans = [
  {
    name: 'Starter',
    monthly: 29,
    yearly: 24,
    features: ['250 tracked leads', '10 personalised videos', 'Email templates', 'Basic activity timeline'],
  },
  {
    name: 'Pro',
    monthly: 79,
    yearly: 64,
    popular: true,
    features: ['Unlimited leads', 'Unlimited personalised videos', 'GDPR audit log', 'Advanced filters and exports', 'Priority support'],
  },
  {
    name: 'Agency',
    monthly: 149,
    yearly: 119,
    features: ['Multi-client workspaces', 'White-label video pages', 'Team permissions', 'License management', 'Dedicated onboarding'],
  },
]

export function PricingClient() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')

  return (
    <main className={styles.pricingShell}>
      <section className={styles.pricingHero}>
        <Link href="/dashboard/leads" className={styles.btnSecondary}><ArrowLeft size={16} />Back to dashboard</Link>
        <h1>Online2Day pricing</h1>
        <p>Pick the CRM plan that matches your lead volume, personalised video workflow and reporting needs.</p>
        <div className={styles.pricingBillingToggle}>
          <button className={`${styles.pricingBillingBtn} ${billing === 'monthly' ? styles.pricingBillingActive : ''}`} onClick={() => setBilling('monthly')}>Monthly</button>
          <button className={`${styles.pricingBillingBtn} ${billing === 'yearly' ? styles.pricingBillingActive : ''}`} onClick={() => setBilling('yearly')}>Yearly</button>
        </div>
      </section>

      <section className={styles.trialBanner}>
        <div className={styles.trialBannerInner}>
          <div className={styles.trialBannerText}>
            <span className={styles.trialBadge}><Zap size={13} />14-day free trial</span>
            <h2 className={styles.trialHeading}>Try Online2Day free — no credit card needed</h2>
            <p className={styles.trialSub}>Get full access to your chosen plan for 14 days. Your data is completely isolated and GDPR-ready from day one.</p>
          </div>
          <Link href="/auth/trial-signup" className={styles.trialCTA}>
            Start free trial
          </Link>
        </div>
      </section>

      <section className={styles.pricingGrid} aria-label="Pricing plans">
        {plans.map((plan) => (
          <article key={plan.name} className={`${styles.pricingCard} ${plan.popular ? styles.pricingCardPro : ''}`}>
            {plan.popular ? <div className={styles.pricingPopular}>Most popular</div> : null}
            <div className={`${styles.pricingCardName} ${plan.popular ? styles.pricingCardProName : ''}`}>{plan.name}</div>
            <div className={styles.pricingPrice}>
              <strong>${billing === 'monthly' ? plan.monthly : plan.yearly}</strong>
              <span>/mo</span>
            </div>
            <div className={styles.pricingFeatures}>
              {plan.features.map((feature) => (
                <div key={feature} className={styles.pricingFeature}>
                  <span className={`${styles.pricingFeatureIcon} ${plan.popular ? styles.pricingFeatureIconPro : ''}`}><Check size={12} /></span>
                  {feature}
                </div>
              ))}
            </div>
            <Link
              className={`${styles.pricingCTA} ${plan.popular ? styles.pricingCTASolid : styles.pricingCTAOutline}`}
              href={`/auth/trial-signup?plan=${plan.name}`}
            >
              {plan.popular ? <Crown size={16} /> : null}
              Start {plan.name} trial
            </Link>
          </article>
        ))}
      </section>

      <section className={styles.pricingFaq}>
        <h2>Questions</h2>
        <details className={styles.faqItem}>
          <summary>Can I change plans later?</summary>
          <p>Yes. Use the settings page to update your license state, then move to the plan that fits your current pipeline.</p>
        </details>
        <details className={styles.faqItem}>
          <summary>Is GDPR logging included?</summary>
          <p>Pro and Agency include local GDPR audit logging for lead views, exports, contact attempts and activity logs.</p>
        </details>
      </section>
    </main>
  )
}
