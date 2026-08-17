import type { Metadata } from "next";
import Link from "next/link";
import { PricingCards } from "@/components/pricing-cards";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Transparent website and web app packages from online2day.com.",
};

const faqs = [
  ["Why is there a setup fee?", "It covers discovery, structure, design and the initial build. The monthly or annual price then covers the ongoing package, hosting and support included in your plan."],
  ["Can I pay annually?", "Yes. The Launch and Growth plans show an annual option equivalent to two months free compared with paying monthly."],
  ["What if I need something between packages?", "Use the project wizard. We would rather scope the right solution transparently than force the wrong work into a fixed package."],
  ["How is payment handled?", "Launch and Growth use Stripe’s hosted checkout for the selected monthly or annual subscription plus the stated setup fee. Bespoke work is scoped and agreed before invoicing."],
];

export default function PricingPage() {
  return (
    <>
      <section className="page-hero section-dark blueprint-bg pricing-hero">
        <div className="shell centered-hero">
          <span className="kicker lime">Pricing without the detective work</span>
          <h1>Pick a starting point.<br /><em>Not a trap.</em></h1>
          <p>Clear packages for common needs, with bespoke scoping when your project genuinely needs more. No invented “enterprise” mystery box.</p>
          <div className="trust-strip"><span>✓ Responsive design</span><span>✓ Hosting options</span><span>✓ Support included</span><span>✓ Upgrade path</span></div>
        </div>
      </section>

      <section className="section pricing-section cream-section">
        <div className="shell"><PricingCards /></div>
      </section>

      <section className="section comparison-section">
        <div className="shell conversion-band">
          <div><span className="kicker">Not sure which fits?</span><h2>Answer four quick steps.<br /><em>Get a cleaner brief.</em></h2></div>
          <p>Our wizard captures project type, pages, integrations, budget and timescale — without making you write an essay.</p>
          <Link href="/start" className="button button-coral">Start the 4-step brief <span>↗</span></Link>
        </div>
      </section>

      <section className="section cream-section faq-section">
        <div className="shell faq-grid">
          <div><span className="kicker dark">Pricing FAQ</span><h2>Sensible questions.<br /><em>Straight answers.</em></h2></div>
          <div className="faq-list">
            {faqs.map(([q, a]) => <details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}
          </div>
        </div>
      </section>
    </>
  );
}
