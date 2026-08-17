export const site = {
  name: "online2day.com",
  shortName: "online2day",
  email: "hello@online2day.com",
  description:
    "Bespoke websites, web apps and digital marketing with transparent pricing and thoughtful support.",
};

export type Plan = {
  id: string;
  name: string;
  eyebrow: string;
  monthly: string;
  annual: string;
  setup: string;
  bestFor: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
};

export const plans: Plan[] = [
  {
    id: "launch",
    name: "Launch",
    eyebrow: "For simple, polished websites",
    monthly: "£69",
    annual: "£690",
    setup: "£249 setup",
    bestFor: "Start-ups, trades, consultants and first websites.",
    features: [
      "Up to 5 bespoke pages",
      "Domain setup & managed hosting",
      "Responsive design",
      "Core technical SEO",
      "Contact/enquiry forms",
      "SSL, updates & ongoing support",
      "Analytics-ready",
      "1 round of monthly content edits",
    ],
    cta: "Choose Launch",
  },
  {
    id: "growth",
    name: "Growth",
    eyebrow: "For businesses that need connected systems",
    monthly: "£189",
    annual: "£1,890",
    setup: "from £749 setup",
    bestFor: "Growing teams that need data, automation and integrations.",
    features: [
      "Everything in Launch",
      "Up to 12 core pages/views",
      "Database integration",
      "HubSpot or CRM integration",
      "Clerk authentication option",
      "Stripe-ready architecture",
      "Automations & webhooks",
      "Priority support",
    ],
    highlighted: true,
    cta: "Choose Growth",
  },
  {
    id: "bespoke",
    name: "Bespoke",
    eyebrow: "For products, portals and ambitious builds",
    monthly: "Custom",
    annual: "Custom",
    setup: "scoped transparently",
    bestFor: "Web apps, customer portals, AI workflows and complex builds.",
    features: [
      "Custom UX & application architecture",
      "Advanced database design",
      "Stripe billing & subscriptions",
      "Role-based authentication",
      "AI integrations & assistants",
      "Third-party APIs",
      "Admin dashboards",
      "Deployment, observability & support plan",
    ],
    cta: "Scope my build",
  },
];
