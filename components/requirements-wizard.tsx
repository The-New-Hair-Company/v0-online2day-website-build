"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Data = {
  plan: string;
  projectType: string;
  pages: string;
  features: string[];
  timeline: string;
  budget: string;
  name: string;
  email: string;
  company: string;
  notes: string;
};

const featureOptions = [
  "Database", "Stripe payments", "Clerk login", "HubSpot / CRM", "AI features", "Admin area", "Booking", "Automations"
];

export function RequirementsWizard() {
  const params = useSearchParams();
  const initialPlan = params.get("plan") || "not-sure";
  const [step, setStep] = useState(1);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [website, setWebsite] = useState("");
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [data, setData] = useState<Data>({
    plan: initialPlan,
    projectType: "new-website",
    pages: "1-5",
    features: [],
    timeline: "4-8-weeks",
    budget: "not-sure",
    name: "",
    email: "",
    company: "",
    notes: "",
  });

  const progress = useMemo(() => `${(step / 4) * 100}%`, [step]);
  const toggleFeature = (feature: string) => setData((current) => ({
    ...current,
    features: current.features.includes(feature)
      ? current.features.filter((item) => item !== feature)
      : [...current.features, feature],
  }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError("");

    try {
      const response = await fetch("/api/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, website, startedAt }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "We could not send your brief.");
      setSent(true);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "We could not send your brief. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="wizard success-card">
        <span className="success-icon">✓</span>
        <p className="eyebrow">Brief sent securely</p>
        <h2>Thank you. We have your project outline.</h2>
        <p>Your brief has been sent into our project workflow. We will review it and reply to the email address you supplied.</p>
        <button className="button button-lime" type="button" onClick={() => { setSent(false); setStep(1); setStartedAt(Date.now()); }}>Send another brief</button>
      </div>
    );
  }

  return (
    <form className="wizard" onSubmit={submit} aria-busy={sending}>
      <label className="honeypot" aria-hidden="true">Website
        <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
      </label>
      <div className="wizard-head">
        <div>
          <span className="kicker">Project brief</span>
          <h2>Tell us what you’re building.</h2>
        </div>
        <span className="step-count">0{step} / 04</span>
      </div>
      <div className="progress-track"><span style={{ width: progress }} /></div>

      {step === 1 && (
        <section className="wizard-step">
          <p className="wizard-question">What best describes the project?</p>
          <div className="choice-grid">
            {[
              ["new-website", "A brand new website", "Starting fresh, from idea to launch."],
              ["redesign", "Redesign an existing site", "Keep what works. Upgrade what doesn’t."],
              ["webapp", "A web app or portal", "Accounts, data, payments or richer workflows."],
              ["marketing", "Marketing & growth", "Campaigns, landing pages, SEO and conversion."],
            ].map(([value, title, desc]) => (
              <button key={value} type="button" className={data.projectType === value ? "choice selected" : "choice"} aria-pressed={data.projectType === value} onClick={() => setData({ ...data, projectType: value })}>
                <span>{title}</span><small>{desc}</small>
              </button>
            ))}
          </div>
          <label className="field-label">Package in mind?
            <select value={data.plan} onChange={(e) => setData({ ...data, plan: e.target.value })}>
              <option value="not-sure">Not sure yet</option>
              <option value="launch">Launch</option>
              <option value="growth">Growth</option>
              <option value="bespoke">Bespoke</option>
            </select>
          </label>
        </section>
      )}

      {step === 2 && (
        <section className="wizard-step">
          <p className="wizard-question">What does the build need?</p>
          <label className="field-label">Approximate page / view count
            <select value={data.pages} onChange={(e) => setData({ ...data, pages: e.target.value })}>
              <option value="1-5">1–5 pages</option>
              <option value="6-12">6–12 pages</option>
              <option value="13-25">13–25 pages</option>
              <option value="25+">25+ / application</option>
            </select>
          </label>
          <div className="feature-picker">
            {featureOptions.map((feature) => (
              <button type="button" key={feature} onClick={() => toggleFeature(feature)} aria-pressed={data.features.includes(feature)} className={data.features.includes(feature) ? "selected" : ""}>
                <span>{data.features.includes(feature) ? "✓" : "+"}</span>{feature}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="wizard-step two-col-fields">
          <label className="field-label">Ideal timescale
            <select value={data.timeline} onChange={(e) => setData({ ...data, timeline: e.target.value })}>
              <option value="asap">As soon as practical</option>
              <option value="4-8-weeks">4–8 weeks</option>
              <option value="2-4-months">2–4 months</option>
              <option value="flexible">Flexible / exploring</option>
            </select>
          </label>
          <label className="field-label">Indicative budget
            <select value={data.budget} onChange={(e) => setData({ ...data, budget: e.target.value })}>
              <option value="not-sure">Not sure yet</option>
              <option value="under-1k">Under £1,000</option>
              <option value="1k-3k">£1,000–£3,000</option>
              <option value="3k-8k">£3,000–£8,000</option>
              <option value="8k+">£8,000+</option>
            </select>
          </label>
          <label className="field-label full">Anything we should know?
            <textarea rows={6} placeholder="Goals, inspiration, current site, must-haves, awkward integrations…" value={data.notes} onChange={(e) => setData({ ...data, notes: e.target.value })} />
          </label>
        </section>
      )}

      {step === 4 && (
        <section className="wizard-step two-col-fields">
          <label className="field-label">Your name
            <input required value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} placeholder="Alex Smith" />
          </label>
          <label className="field-label">Work email
            <input required type="email" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} placeholder="alex@company.co.uk" />
          </label>
          <label className="field-label full">Company / project
            <input value={data.company} onChange={(e) => setData({ ...data, company: e.target.value })} placeholder="Company name" />
          </label>
          <div className="brief-summary full">
            <span>Ready to send</span>
            <p>{data.projectType.replaceAll("-", " ")} · {data.pages} · {data.features.length || "No"} integrations selected</p>
          </div>
        </section>
      )}

      <div className="wizard-actions">
        <button type="button" className="button button-ghost" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))}>← Back</button>
        {step < 4 ? (
          <button type="button" className="button button-lime" onClick={() => setStep((current) => Math.min(4, current + 1))}>Continue <span>→</span></button>
        ) : (
          <button type="submit" className="button button-coral" disabled={sending}>{sending ? "Sending…" : "Finish brief"} <span>↗</span></button>
        )}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}
