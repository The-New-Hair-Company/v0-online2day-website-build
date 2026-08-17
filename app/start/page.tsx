import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirementsWizard } from "@/components/requirements-wizard";

export const metadata: Metadata = { title: "Start a project", description: "Create a project brief for online2day.com in four guided steps." };

export default function StartPage() {
  return (
    <section className="section-dark blueprint-bg wizard-page">
      <div className="shell wizard-layout">
        <div className="wizard-copy">
          <span className="kicker lime">Start somewhere useful</span>
          <h1>Four steps.<br /><em>Zero jargon.</em></h1>
          <p>Give us enough information to understand the shape of the job. You do not need a technical specification.</p>
          <div className="wizard-promise"><span>✓</span><p><strong>No automatic sales sequence.</strong><br />The form is designed to capture a useful brief, not manufacture urgency.</p></div>
        </div>
        <Suspense fallback={<div className="wizard"><p>Loading project wizard…</p></div>}>
          <RequirementsWizard />
        </Suspense>
      </div>
    </section>
  );
}
