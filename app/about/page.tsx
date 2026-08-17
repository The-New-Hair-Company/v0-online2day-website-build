import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About", description: "Why online2day.com builds bespoke digital work around clarity, usefulness and transparent pricing." };

export default function AboutPage() {
  return (
    <>
      <section className="page-hero section-dark blueprint-bg">
        <div className="shell editorial-hero light">
          <div><span className="kicker lime">About online2day.com</span><h1>Good work is not<br /><em>supposed to feel mysterious.</em></h1></div>
          <p>We exist for businesses that want thoughtful design and serious engineering without the agency fog: unclear scopes, vague invoices and avoidable complexity.</p>
        </div>
      </section>
      <section className="section cream-section">
        <div className="shell manifesto-grid">
          <div className="manifesto-statement">Whether it is your <em>first website</em> or the latest of many, we go above and beyond to get the important details right.</div>
          <div className="manifesto-points">
            <article><span>01</span><h3>Bespoke should mean bespoke.</h3><p>We use reusable engineering where it makes sense, but the experience and information architecture are shaped around your business.</p></article>
            <article><span>02</span><h3>Affordable does not mean disposable.</h3><p>Good foundations reduce the cost of future changes. That matters more than squeezing the last pound out of day one.</p></article>
            <article><span>03</span><h3>Clarity is part of the product.</h3><p>Plain-English scopes, visible package inclusions and deliberate upgrade paths help everyone make better decisions.</p></article>
          </div>
        </div>
      </section>
      <section className="section process-section"><div className="shell story-band"><span className="giant-quote">“</span><h2>We would rather tell you a feature is unnecessary than invoice you for building it.</h2><Link href="/pricing" className="button button-coral">See how we price <span>↗</span></Link></div></section>
    </>
  );
}
