import Link from "next/link";

const services = [
  ["01", "Websites", "Fast, expressive websites shaped around what customers actually need to do — not a recycled theme."],
  ["02", "Web apps", "Portals, dashboards, data, authentication and payments designed as one coherent experience."],
  ["03", "Growth", "Campaigns, landing pages, SEO foundations and conversion work that connect attention to action."],
  ["04", "AI & automation", "Useful AI features and operational automations where they genuinely save time or improve service."],
];

export default function HomePage() {
  return (
    <>
      <section className="hero section-dark blueprint-bg">
        <div className="hero-orb orb-one" /><div className="hero-orb orb-two" />
        <div className="shell hero-grid">
          <div className="hero-copy">
            <span className="availability"><i /> Taking on new projects</span>
            <h1>A website should do more than <em>exist.</em></h1>
            <p className="hero-lead">We design and build bespoke websites and web apps at transparent prices — whether this is your first site or the latest of many.</p>
            <div className="hero-actions">
              <Link href="/start" className="button button-lime">Build my brief <span>↗</span></Link>
              <Link href="/pricing" className="text-link">See transparent pricing <span>→</span></Link>
            </div>
            <div className="hero-proof">
              <div><strong>01</strong><span>No template dependency</span></div>
              <div><strong>02</strong><span>Clear scope & pricing</span></div>
              <div><strong>03</strong><span>Support after launch</span></div>
            </div>
          </div>
          <div className="hero-art" aria-label="Abstract preview of a web project dashboard">
            <div className="browser-card">
              <div className="browser-bar"><span /><span /><span /><b>online2day / project</b></div>
              <div className="browser-body">
                <aside>
                  <div className="mini-logo">o2d</div>
                  <i className="active" /><i /><i /><i />
                </aside>
                <div className="mock-content">
                  <span className="micro-label">YOUR NEXT SITE</span>
                  <div className="mock-title">Built around<br />the <em>job.</em></div>
                  <div className="mock-row"><span /><span /><span /></div>
                  <div className="mock-panel">
                    <span>Plan → design → build → launch</span><b>04</b>
                  </div>
                </div>
              </div>
            </div>
            <div className="floating-note note-a">No mystery invoices <span>✓</span></div>
            <div className="floating-note note-b"><span className="spark">✦</span> Bespoke by default</div>
          </div>
        </div>
        <div className="shell hero-ticker" aria-hidden="true">
          <span>DESIGN</span><i>✦</i><span>DEVELOPMENT</span><i>✦</i><span>AUTOMATION</span><i>✦</i><span>MARKETING</span><i>✦</i><span>SUPPORT</span>
        </div>
      </section>

      <section className="section cream-section" id="work">
        <div className="shell split-heading">
          <span className="kicker dark">What we build</span>
          <h2>Small enough to care.<br /><em>Technical enough to scale.</em></h2>
          <p>We deliberately bridge the gap between cheap page-builders and expensive agency retainers. Start with what you need now; leave the architecture ready for what comes next.</p>
        </div>
        <div className="shell service-grid">
          {services.map(([num, title, copy]) => (
            <article className="service-card" key={title}>
              <span>{num}</span><h3>{title}</h3><p>{copy}</p><Link href={title === "Growth" ? "/marketing" : "/start"}>Explore <b>↗</b></Link>
            </article>
          ))}
        </div>
      </section>

      <section className="section process-section">
        <div className="shell process-grid">
          <div className="process-intro">
            <span className="kicker">No theatre. Just a clear process.</span>
            <h2>From vague idea to <em>useful product.</em></h2>
            <p>You should always know what is happening, what comes next and what it costs.</p>
            <Link className="button button-coral" href="/about">How we work <span>↗</span></Link>
          </div>
          <div className="process-list">
            <article><span>01</span><div><h3>Brief it</h3><p>Use our guided wizard or talk to us. We turn “I need a website” into a practical scope.</p></div></article>
            <article><span>02</span><div><h3>Shape it</h3><p>Structure, journeys, visual direction and technical choices are agreed before the build runs away.</p></div></article>
            <article><span>03</span><div><h3>Build it</h3><p>Responsive, accessible code with the integrations your business actually needs.</p></div></article>
            <article><span>04</span><div><h3>Keep improving it</h3><p>Launch is the start of useful data. Support and growth options remain available afterwards.</p></div></article>
          </div>
        </div>
      </section>

      <section className="section pricing-teaser cream-section">
        <div className="shell pricing-teaser-card">
          <div>
            <span className="kicker dark">Transparent by design</span>
            <h2>Know the shape of the bill <em>before</em> the build.</h2>
            <p>Simple sites can run on a predictable monthly package. More connected builds step up only when the requirements do.</p>
          </div>
          <div className="teaser-price">
            <span>Simple sites from</span><strong>£69</strong><small>/ month</small>
            <Link className="button button-dark" href="/pricing">Compare all packages <span>→</span></Link>
          </div>
        </div>
      </section>
    </>
  );
}
