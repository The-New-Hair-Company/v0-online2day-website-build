import type { Metadata } from "next";
import Link from "next/link";
import styles from "./marketing.module.css";

export const metadata: Metadata = {
  title: { absolute: "Digital Marketing Agency UK | online2day.com" },
  description: "Commercial digital marketing for UK businesses: sharp strategy, SEO, paid campaigns, landing pages, CRM and conversion optimisation built as one growth system.",
  alternates: { canonical: "/marketing" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Marketing that earns its keep | online2day.com",
    description: "Strategy, search, paid media, conversion and CRM working as one measurable growth system for UK businesses.",
    url: "https://www.online2day.com/marketing",
    type: "website",
    locale: "en_GB",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "online2day.com — marketing that earns its keep." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Marketing that earns its keep | online2day.com",
    description: "A sharper growth system for UK businesses: strategy, search, paid media, conversion and CRM.",
    images: ["/og.png"],
  },
};

const growthSteps = [
  { number: "01", verb: "Find", title: "Locate real demand", copy: "Search behaviour, audience signals, competitors and commercial data show us where worthwhile attention already exists.", output: "Market and demand map" },
  { number: "02", verb: "Frame", title: "Make the choice obvious", copy: "We sharpen the offer, positioning and message until the right customer can quickly see why you — and why now.", output: "Offer and message system" },
  { number: "03", verb: "Reach", title: "Earn the right attention", copy: "SEO, paid search, paid social and useful content are chosen for the buying journey, not because a channel is fashionable.", output: "Channel plan and campaigns" },
  { number: "04", verb: "Convince", title: "Turn interest into intent", copy: "Landing pages, proof, UX and calls to action remove uncertainty and make the next sensible step feel easy.", output: "Conversion journey" },
  { number: "05", verb: "Follow", title: "Keep good leads warm", copy: "CRM capture, attribution and thoughtful follow-up stop strong enquiries vanishing into a spreadsheet or an overflowing inbox.", output: "Lead and CRM workflow" },
  { number: "06", verb: "Compound", title: "Learn what pays", copy: "We read the whole journey, improve the weak link and invest harder where qualified demand becomes pipeline and revenue.", output: "Commercial learning loop" },
];

const services = [
  { number: "01", title: "Strategy & positioning", copy: "Audience, category, offer, pricing logic, message and channel roles — the thinking that stops every campaign becoming an expensive guess.", tags: ["Research", "Positioning", "Go-to-market"] },
  { number: "02", title: "SEO & useful content", copy: "Technical SEO, search intent, content architecture and genuinely useful pages designed to be found, understood and chosen.", tags: ["Technical SEO", "Content strategy", "On-page SEO"] },
  { number: "03", title: "Paid search & social", copy: "Tightly structured campaigns, sharp creative and sensible testing across the channels where your buyers actually pay attention.", tags: ["Google Ads", "Paid social", "Creative testing"] },
  { number: "04", title: "Landing pages & CRO", copy: "Focused pages, clearer journeys and conversion experiments that turn more of the right visits into meaningful action.", tags: ["Landing pages", "UX", "Experimentation"] },
  { number: "05", title: "CRM & lifecycle", copy: "Lead routing, useful automation and human follow-up designed around the sale — without turning your brand into a nagging robot.", tags: ["HubSpot", "Lead nurture", "Automation"] },
  { number: "06", title: "Measurement & insight", copy: "A measurement plan that connects channel activity to qualified enquiries and commercial outcomes, not a weekly avalanche of charts.", tags: ["Attribution", "Dashboards", "Optimisation"] },
];

const faqs = [
  ["What does a digital marketing agency actually do?", "The useful answer: it finds profitable demand, makes your offer easier to choose, builds the path to action and learns from what happens. For us that can include strategy, SEO, paid media, landing pages, CRM, analytics and conversion optimisation — joined up around one commercial goal."],
  ["Can you work with our existing website and brand?", "Yes. We can improve the journey you already have, build dedicated campaign pages or recommend a deeper change where the current site is genuinely holding growth back. We keep what earns its place."],
  ["Do you offer SEO for UK businesses?", "Yes. Our SEO work covers technical foundations, search intent, content architecture, on-page improvements and measurement. The aim is relevant visibility that can become business, not traffic for traffic’s sake."],
  ["Do you manage Google Ads and paid social?", "We can plan and support paid search and paid social campaigns, including account structure, audience logic, creative, landing pages and conversion measurement. Channel choice follows the customer and the economics."],
  ["How quickly will marketing produce results?", "Paid campaigns can produce learning quickly; SEO and brand demand usually compound over longer periods. We set sensible leading and commercial indicators at the start, then report what the evidence actually says — no fortune-telling dressed as a forecast."],
  ["How do you approach UK GDPR and PECR?", "We design data capture, tracking and lifecycle activity with privacy, clarity and consent in mind. The precise setup depends on your channels, data and legal basis, so specialist legal advice may still be appropriate."],
  ["What should we budget?", "That depends on the market, ambition, media spend and what needs building. Our Growth package is a useful starting point; larger or more competitive programmes are scoped around the commercial opportunity. You will see the shape and price before committing."],
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://www.online2day.com/" },
        { "@type": "ListItem", position: 2, name: "Digital marketing", item: "https://www.online2day.com/marketing" },
      ],
    },
    {
      "@type": "Service",
      name: "Digital marketing services",
      serviceType: "Digital marketing strategy, SEO, paid media, conversion optimisation and CRM",
      description: metadata.description,
      areaServed: { "@type": "Country", name: "United Kingdom" },
      provider: { "@type": "Organization", name: "online2day.com", url: "https://www.online2day.com" },
      url: "https://www.online2day.com/marketing",
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Digital marketing services",
        itemListElement: services.map((service) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: service.title, description: service.copy } })),
      },
    },
  ],
};

export default function MarketingPage() {
  return (
    <div className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <section className={styles.hero} aria-labelledby="marketing-heading">
        <div className={`shell ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Digital marketing for ambitious UK businesses</span>
            <h1 id="marketing-heading">Marketing should make the till ring. <em>Not just the dashboard blink.</em></h1>
            <p className={styles.heroLead}>We join strategy, search, paid media, landing pages, CRM and conversion into one commercial system — so every click has somewhere useful to go.</p>
            <div className={styles.heroActions}>
              <Link href="/start?plan=growth&utm_source=website&utm_medium=marketing_page&utm_campaign=marketing_services" className={`button button-lime ${styles.primaryAction}`}>Build my growth plan <span aria-hidden="true">↗</span></Link>
              <a href="#growth-system" className={styles.secondaryAction}>See the system <span aria-hidden="true">↓</span></a>
            </div>
            <p className={styles.microcopy}>No hard sell. No mystery retainers. Start with the commercial truth.</p>
          </div>

          <div className={styles.signalBoard} aria-label="The Online2Day growth system">
            <div className={styles.signalTopline}><span>Commercial signal</span><strong>LIVE</strong></div>
            <div className={styles.signalStatement}>Right people<br /><em>→</em> right message<br /><em>→</em> right action</div>
            <div className={styles.signalMetrics}>
              <div><span>01</span><strong>Demand</strong><small>Find it</small></div>
              <div><span>02</span><strong>Decision</strong><small>Earn it</small></div>
              <div><span>03</span><strong>Revenue</strong><small>Prove it</small></div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.proofStrip} aria-label="Marketing principles">
        <div className={`shell ${styles.proofGrid}`}>
          <p><strong>One joined-up system</strong><span>Not five suppliers blaming each other.</span></p>
          <p><strong>Built for UK buyers</strong><span>Plain English. Proper measurement. No Silicon Valley theatre.</span></p>
          <p><strong>Commercial by design</strong><span>Attention is the start. Action is the point.</span></p>
        </div>
      </section>

      <nav className={styles.jumpNav} aria-label="On this page">
        <div className="shell">
          <span>Skip to the useful bit</span>
          <a href="#growth-system">The growth system</a>
          <a href="#services">What we do</a>
          <a href="#uk-market">UK thinking</a>
          <a href="#questions">Straight answers</a>
        </div>
      </nav>

      <section className={styles.truthSection} aria-labelledby="truth-heading">
        <div className={`shell ${styles.truthGrid}`}>
          <div className={styles.sectionIntro}>
            <span className={styles.darkEyebrow}>The commercial truth</span>
            <h2 id="truth-heading">You probably do not need <em>more marketing.</em></h2>
            <p>You need the bits you already pay for to stop behaving like strangers. We fix the joins between message, media, website, follow-up and sale.</p>
          </div>
          <div className={styles.problemStack}>
            <article><span>01</span><div><h3>More channels. Same muddle.</h3><p>Activity multiplies while the offer stays fuzzy. We make the commercial argument clear before amplifying it.</p></div></article>
            <article><span>02</span><div><h3>Clicks without conviction.</h3><p>Traffic arrives, meets a generic page and quietly leaves. We design the decision, not just the advert.</p></div></article>
            <article><span>03</span><div><h3>Reports without decisions.</h3><p>Everyone knows the click-through rate. Nobody knows what to do on Monday. We turn evidence into priorities.</p></div></article>
          </div>
        </div>
      </section>

      <section id="growth-system" className={styles.systemSection} aria-labelledby="system-heading">
        <div className="shell">
          <header className={styles.systemHeader}>
            <div><span className={styles.lightEyebrow}>The Online2Day demand-to-revenue loop</span><h2 id="system-heading">The funnel is not a funnel.<br /><em>It is a learning system.</em></h2></div>
            <p>People move forwards, backwards, disappear, compare and return. Our job is to make every useful signal improve the next decision.</p>
          </header>
          <ol className={styles.growthSteps}>
            {growthSteps.map((step) => (
              <li key={step.number}>
                <div className={styles.stepMarker}><span>{step.number}</span><strong>{step.verb}</strong></div>
                <div className={styles.stepCopy}><h3>{step.title}</h3><p>{step.copy}</p></div>
                <div className={styles.stepOutput}><span>Useful output</span><strong>{step.output}</strong></div>
              </li>
            ))}
          </ol>
          <div className={styles.systemCta}>
            <p><strong>Already have traffic?</strong> Good. We can start where the journey is leaking rather than rebuilding for sport.</p>
            <Link href="/start?plan=growth&utm_source=website&utm_medium=marketing_page&utm_campaign=marketing_funnel_mid" className="button button-coral">Find my weakest link <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </section>

      <section id="services" className={styles.servicesSection} aria-labelledby="services-heading">
        <div className="shell">
          <header className={styles.servicesHeader}>
            <div><span className={styles.darkEyebrow}>Senior marketing, properly connected</span><h2 id="services-heading">One commercial brain.<br /><em>Every useful lever.</em></h2></div>
            <p>Use the whole system or the part that is holding it back. Strategy leads; channels follow.</p>
          </header>
          <div className={styles.servicesGrid}>
            {services.map((service) => (
              <article key={service.number}>
                <span className={styles.serviceNumber}>{service.number}</span>
                <h3>{service.title}</h3>
                <p>{service.copy}</p>
                <ul aria-label={`${service.title} includes`}>{service.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="uk-market" className={styles.ukSection} aria-labelledby="uk-heading">
        <div className={`shell ${styles.ukGrid}`}>
          <div className={styles.ukStatement}>
            <span className={styles.darkEyebrow}>Built for the UK market</span>
            <h2 id="uk-heading">Less razzmatazz.<br /><em>More reason to believe.</em></h2>
            <p>British buyers can smell inflated claims at twenty paces. We favour relevance, evidence, useful detail and a confident lack of nonsense.</p>
          </div>
          <div className={styles.ukPoints}>
            <article><span>01</span><h3>Local intent, not local clichés</h3><p>We account for region, language, seasonality and how UK customers actually search and compare.</p></article>
            <article><span>02</span><h3>Privacy that keeps its manners</h3><p>Clear data capture and sensible measurement choices, with UK GDPR and PECR considerations designed in rather than bolted on.</p></article>
            <article><span>03</span><h3>Proof before puff</h3><p>Specific claims, useful evidence and honest limits build more confidence than a wall of “industry-leading” adjectives.</p></article>
            <article><span>04</span><h3>Pounds, pipeline, priorities</h3><p>We discuss budget in GBP and performance in commercial terms your team can use.</p></article>
          </div>
        </div>
      </section>

      <section className={styles.operatingSection} aria-labelledby="operating-heading">
        <div className="shell">
          <header className={styles.operatingHeader}>
            <div><span className={styles.lightEyebrow}>How the work moves</span><h2 id="operating-heading">Sharp thinking.<br /><em>Short feedback loops.</em></h2></div>
            <p>No quarterly reveal. No deck that needs a translator. You see the decisions, the work and what the market taught us.</p>
          </header>
          <div className={styles.operatingGrid}>
            <article><span>Week 01</span><h3>Diagnose</h3><p>Commercial goal, audience, offer, journey, evidence and measurement.</p></article>
            <article><span>Week 02+</span><h3>Build</h3><p>Message, campaigns, pages, tracking and CRM foundations.</p></article>
            <article><span>Launch</span><h3>Learn</h3><p>Real behaviour replaces opinions. We protect spend while signals mature.</p></article>
            <article><span>Ongoing</span><h3>Compound</h3><p>Improve the constraint, document the lesson and scale what earns it.</p></article>
          </div>
          <div className={styles.scorecard}>
            <div><span>The grown-up scorecard</span><h3>What we watch when vanity leaves the room.</h3></div>
            <ul>
              <li>Qualified enquiries</li><li>Cost per qualified enquiry</li><li>Journey conversion</li><li>Pipeline value</li><li>Revenue influence</li>
            </ul>
          </div>
        </div>
      </section>

      <section className={styles.fitSection} aria-labelledby="fit-heading">
        <div className={`shell ${styles.fitGrid}`}>
          <div><span className={styles.darkEyebrow}>A quick fit check</span><h2 id="fit-heading">We will get on brilliantly if…</h2></div>
          <ul className={styles.fitList}>
            <li><span>✓</span>You want qualified demand, not a prettier graph.</li>
            <li><span>✓</span>You are willing to sharpen the offer, not only the adverts.</li>
            <li><span>✓</span>You value plain speaking, fast learning and shared evidence.</li>
          </ul>
          <aside><strong>Probably not us:</strong><p>If you need a guaranteed number-one ranking by next Tuesday, the internet contains braver liars.</p></aside>
        </div>
      </section>

      <section id="questions" className={styles.faqSection} aria-labelledby="faq-heading">
        <div className={`shell ${styles.faqGrid}`}>
          <div className={styles.faqIntro}><span className={styles.darkEyebrow}>Useful questions</span><h2 id="faq-heading">Straight answers.<br /><em>No agency fog.</em></h2><p>Still weighing it up? Good. Careful buyers tend to make better partners.</p></div>
          <div className={styles.faqList}>
            {faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}
          </div>
        </div>
      </section>

      <section className={styles.finalCta} aria-labelledby="final-heading">
        <div className={`shell ${styles.finalCtaGrid}`}>
          <div><span className={styles.lightEyebrow}>Ready when the ambition is</span><h2 id="final-heading">Let’s make marketing<br /><em>earn its keep.</em></h2></div>
          <div className={styles.finalCtaCopy}>
            <p>Tell us what you sell, who should care and where growth currently gets stuck. Four steps. Zero interpretive dance.</p>
            <div><Link href="/start?plan=growth&utm_source=website&utm_medium=marketing_page&utm_campaign=marketing_funnel_bottom" className="button button-lime">Start the marketing brief <span aria-hidden="true">↗</span></Link><Link href="/pricing" className={styles.pricingLink}>See pricing</Link></div>
          </div>
        </div>
      </section>
    </div>
  );
}
