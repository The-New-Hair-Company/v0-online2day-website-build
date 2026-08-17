"use client";

import Link from "next/link";
import { useState } from "react";
import { plans } from "@/lib/site";

export function PricingCards() {
  const [annual, setAnnual] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState("");

  async function startCheckout(plan: "launch" | "growth") {
    setCheckoutPlan(plan);
    setCheckoutError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billing: annual ? "annual" : "monthly" }),
      });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "Checkout could not be started.");
      window.location.assign(result.url);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Checkout could not be started.");
      setCheckoutPlan(null);
    }
  }

  return (
    <>
      <div className="billing-switch" role="group" aria-label="Billing frequency">
        <button type="button" aria-pressed={!annual} className={!annual ? "selected" : ""} onClick={() => setAnnual(false)}>Monthly</button>
        <button type="button" aria-pressed={annual} className={annual ? "selected" : ""} onClick={() => setAnnual(true)}>
          Annually <span>2 months free</span>
        </button>
      </div>
      <div className="pricing-grid">
        {plans.map((plan) => (
          <article key={plan.id} className={`price-card ${plan.highlighted ? "featured" : ""}`}>
            {plan.highlighted && <span className="popular-chip">Most popular</span>}
            <div className="price-card-top">
              <span className="plan-number">0{plans.indexOf(plan) + 1}</span>
              <div>
                <p className="eyebrow">{plan.eyebrow}</p>
                <h3>{plan.name}</h3>
              </div>
            </div>
            <div className="price-row">
              <strong>{annual ? plan.annual : plan.monthly}</strong>
              {plan.monthly !== "Custom" && <span>{annual ? "/ year" : "/ month"}</span>}
            </div>
            <p className="setup-copy">{plan.setup}</p>
            <p className="best-for">{plan.bestFor}</p>
            <ul className="feature-list">
              {plan.features.map((feature) => <li key={feature}><span>✓</span>{feature}</li>)}
            </ul>
            {plan.id === "bespoke" ? (
              <Link className={`button ${plan.highlighted ? "button-lime" : "button-dark"}`} href={`/start?plan=${plan.id}`}>
                {plan.cta} <span>↗</span>
              </Link>
            ) : (
              <button
                className={`button ${plan.highlighted ? "button-lime" : "button-dark"}`}
                type="button"
                disabled={checkoutPlan !== null}
                onClick={() => void startCheckout(plan.id as "launch" | "growth")}
              >
                {checkoutPlan === plan.id ? "Opening secure checkout…" : plan.cta} <span>↗</span>
              </button>
            )}
            <p className="stripe-slot">{plan.id === "bespoke" ? "Scoped and agreed before invoicing" : "Secure subscription checkout powered by Stripe"}</p>
          </article>
        ))}
      </div>
      {checkoutError && <p className="checkout-error" role="alert" aria-live="polite">{checkoutError}</p>}
    </>
  );
}
