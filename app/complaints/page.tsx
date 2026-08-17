import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Complaints charter", description: "How online2day.com receives, investigates and responds to complaints." };

export default function ComplaintsPage() {
  return (
    <article className="legal-page cream-section"><div className="shell legal-shell">
      <header><span className="kicker dark">Customer care</span><h1>Complaints charter</h1><p>Our aim is to resolve problems early, fairly and in plain English.</p></header>
      <section><h2>1. Tell us what went wrong</h2><p>Email <a href={`mailto:${site.email}`}>{site.email}</a> with the subject “Complaint”. Include your name, project or account reference where available, what happened, the outcome you are seeking and any relevant evidence.</p></section>
      <section><h2>2. We will acknowledge it</h2><p>We aim to acknowledge a formal complaint within two working days. If the issue can be fixed immediately, we may resolve it at the same time.</p></section>
      <section><h2>3. A fair review</h2><p>The complaint will be reviewed against the agreed scope, communications, service records and any relevant technical information. Where practical, a person not responsible for the disputed decision will review the complaint or its proposed resolution.</p></section>
      <section><h2>4. Our response</h2><p>We aim to provide a substantive written response within 10 working days. If the issue is unusually complex or depends on a third party, we will explain the reason for delay and provide an updated position rather than leaving you without information.</p></section>
      <section><h2>5. Possible outcomes</h2><p>Depending on the circumstances, an outcome may include an explanation, correction, re-performance of work, practical remediation, service credit, refund where appropriate, or confirmation that the original position is maintained with reasons.</p></section>
      <section><h2>6. Escalation</h2><p>If you remain dissatisfied, reply and request an internal escalation. We will review the unresolved points and provide a final response. Any statutory or contractual rights you may have are unaffected by this process.</p></section>
      <section><h2>7. Learning from complaints</h2><p>We use complaint themes to improve specifications, communication, testing and support processes. A complaint is not treated as an inconvenience; it is evidence that something deserves examination.</p></section>
    </div></article>
  );
}
