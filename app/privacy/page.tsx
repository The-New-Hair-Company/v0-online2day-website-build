import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy policy", description: "Privacy information for visitors and customers of online2day.com." };

export default function PrivacyPage() {
  return (
    <article className="legal-page cream-section"><div className="shell legal-shell">
      <header><span className="kicker dark">UK GDPR privacy notice</span><h1>Privacy policy</h1><p>Last updated: 17 August 2026</p></header>
      <section><h2>1. Who is responsible for your data?</h2><p>online2day.com is the trading identity responsible for the personal data described in this notice when acting as controller. Privacy enquiries and data-rights requests can be sent to <a href={`mailto:${site.email}`}>{site.email}</a>. Where we process data solely on a customer’s instructions for a hosted or integrated service, that customer may instead be the controller.</p></section>
      <section><h2>2. What we collect</h2><p>Depending on how you interact with us, we may collect identity and contact information, business details, enquiry and project information, correspondence, billing and transaction references, technical device/log information, and preferences you choose to provide. We aim not to collect information we do not need.</p></section>
      <section><h2>3. Why we use it and our lawful bases</h2><p>We may process information to respond to enquiries and take steps before a contract; deliver and administer contracted services; operate, secure and improve our website and services based on legitimate interests; comply with legal obligations; and send optional marketing where consent or another lawful basis permits it. We assess and balance legitimate interests against individual rights where required.</p></section>
      <section><h2>4. Project wizard and contact data</h2><p>When you send a project brief, we process the contact details and requirements you provide so we can respond, assess the work and manage the enquiry. The submission is handled by our website and may be recorded in our Supabase-backed workflow and HubSpot CRM. Please do not include special-category personal data or confidential credentials in the notes field.</p></section>
      <section><h2>5. Payments, cookies and analytics</h2><p>Launch and Growth checkout is hosted by Stripe, which processes payment and billing information under its own privacy terms. We use Vercel Analytics to understand aggregate site usage. The public site does not require advertising cookies; if non-essential tracking is added, we will update the cookie information and request consent where required.</p></section>
      <section><h2>6. Sharing and processors</h2><p>We use vetted providers including Vercel for hosting and analytics, Supabase for data and authentication, HubSpot for customer relationship management, Resend for operational email and Stripe for payments. We disclose personal data only where reasonably necessary, contractually appropriate or legally required.</p></section>
      <section><h2>7. International transfers</h2><p>Some service providers may process data outside the UK. Where UK data-protection law requires safeguards, we will use an approved transfer mechanism or rely on another lawful basis for the transfer and apply appropriate supplementary measures where necessary.</p></section>
      <section><h2>8. Retention</h2><p>We retain personal data only for as long as reasonably necessary for the purpose collected, including contractual, accounting, security and legal requirements. Retention periods vary by record type and relationship.</p></section>
      <section><h2>9. Your rights</h2><p>Subject to the circumstances and applicable exemptions, you may have rights of access, rectification, erasure, restriction, objection, portability and rights relating to solely automated decisions. Where processing relies on consent, you can withdraw that consent without affecting earlier lawful processing.</p></section>
      <section><h2>10. Complaints</h2><p>Please contact us first if you have a privacy concern so we can investigate. You also have the right to complain to the UK Information Commissioner’s Office (ICO) where you believe data-protection law has been breached.</p></section>
      <section><h2>11. Changes</h2><p>We may update this notice when our services, suppliers or legal obligations change. The date at the top shows the latest published revision.</p></section>
    </div></article>
  );
}
