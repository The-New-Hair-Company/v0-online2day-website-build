import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Terms & conditions", description: "Website terms and customer service terms for online2day.com." };

export default function TermsPage() {
  return (
    <article className="legal-page cream-section"><div className="shell legal-shell">
      <header><span className="kicker dark">Legal</span><h1>Terms & conditions</h1><p>Last updated: 17 August 2026</p></header>
      <section><h2>1. About these terms</h2><p>These terms govern use of online2day.com and provide the baseline terms for services supplied under the online2day.com trading identity. A project proposal, order form or statement of work may add or replace terms for a particular project. If there is a conflict, the signed project-specific document takes priority.</p></section>
      <section><h2>2. Quotes, scope and acceptance</h2><p>Prices and timescales shown on this website are starting points unless expressly described as fixed. A project becomes binding when we accept an order or both parties approve the applicable proposal or statement of work. Material work outside the agreed scope may be quoted separately before it is undertaken.</p></section>
      <section><h2>3. Customer responsibilities</h2><p>You are responsible for providing timely access, content, approvals and information reasonably required for delivery, and for ensuring content you provide can lawfully be used. Delays in those dependencies may move delivery dates.</p></section>
      <section><h2>4. Fees and recurring services</h2><p>Setup fees, recurring fees, payment dates and minimum terms will be stated before purchase. Where a service includes hosting, support, domains or third-party services, the exact inclusions will be set out in the order. We will not add chargeable out-of-scope work without agreement.</p></section>
      <section><h2>5. Third-party services</h2><p>Projects may integrate services such as hosting providers, domain registrars, Stripe, Clerk, HubSpot, analytics products or AI providers. Their own terms, availability and charges may apply. We are not responsible for outages or changes wholly outside our reasonable control, but we will provide reasonable assistance where covered by your support plan.</p></section>
      <section><h2>6. Intellectual property</h2><p>Unless a project agreement says otherwise, pre-existing tools, reusable components, know-how and third-party materials remain owned by their respective owners. On payment of all undisputed fees, rights in bespoke deliverables created specifically for the customer will be licensed or assigned as stated in the project agreement.</p></section>
      <section><h2>7. Cancellations and termination</h2><p>Cancellation rights, notice periods and any minimum term for recurring packages will be confirmed at checkout or in the applicable order. Nothing in these terms limits statutory consumer rights where they apply.</p></section>
      <section><h2>8. Liability</h2><p>Nothing excludes liability that cannot lawfully be excluded. Subject to that, liability for a project will be governed by the limits in the applicable project agreement. Website information is provided in good faith but is not a substitute for professional legal, financial or regulatory advice.</p></section>
      <section><h2>9. Acceptable use</h2><p>You must not misuse the site, attempt unauthorised access, introduce malicious code, interfere with availability, or use our services for unlawful content or activity.</p></section>
      <section><h2>10. Governing law</h2><p>Unless mandatory law requires otherwise or a project agreement states differently, these terms are governed by the laws of England and Wales and disputes are subject to the jurisdiction of the courts of England and Wales.</p></section>
      <section><h2>11. Contact</h2><p>Questions about these terms can be sent to <a href={`mailto:${site.email}`}>{site.email}</a>. Complaints are handled under our published Complaints Charter.</p></section>
    </div></article>
  );
}
