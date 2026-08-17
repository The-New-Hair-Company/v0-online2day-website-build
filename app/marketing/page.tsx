import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Marketing", description: "Landing pages, campaigns, SEO foundations and conversion-focused digital marketing from online2day.com." };

export default function MarketingPage() {
  return (
    <>
      <section className="page-hero coral-hero">
        <div className="shell editorial-hero">
          <div><span className="kicker dark">Marketing that connects to the build</span><h1>Attention is nice.<br /><em>Action is better.</em></h1></div>
          <p>We combine landing pages, campaign creative, analytics and technical execution so marketing does not end at “send more traffic”.</p>
        </div>
      </section>
      <section className="section cream-section">
        <div className="shell marketing-grid">
          <article className="marketing-card giant"><span>01</span><h2>Campaign landing pages</h2><p>Focused pages built around one audience, one proposition and one useful next step — with tracking foundations ready.</p><div className="fake-funnel"><i /><i /><i /><b>CONVERT</b></div></article>
          <article className="marketing-card"><span>02</span><h2>SEO foundations</h2><p>Semantic structure, metadata, crawlability, performance and content architecture that give search engines fewer reasons to dislike the site.</p></article>
          <article className="marketing-card dark-card"><span>03</span><h2>Paid campaign support</h2><p>Creative and conversion infrastructure for paid search/social campaigns, structured around measurable actions.</p></article>
          <article className="marketing-card"><span>04</span><h2>Analytics & iteration</h2><p>Measure the behaviours that matter, identify friction and turn real usage into the next round of improvements.</p></article>
        </div>
      </section>
      <section className="section process-section"><div className="shell conversion-band compact"><div><span className="kicker">Need site + marketing?</span><h2>Build the journey as <em>one system.</em></h2></div><p>Tell us the acquisition channel and the website goal in the same brief.</p><Link href="/start?plan=growth" className="button button-lime">Brief the project <span>↗</span></Link></div></section>
    </>
  );
}
