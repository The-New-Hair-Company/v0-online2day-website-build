# online2day.com — Next.js frontend

A deployment-ready frontend for **online2day.com**, built with the Next.js App Router, React and TypeScript. The visual system is bespoke: deep-ink blueprint surfaces, electric citrus/coral accents, editorial typography and conversion-led pricing interactions.

## Included routes

- `/` — Homepage
- `/pricing` — Conversion-focused pricing with monthly/annual switch
- `/start` — Four-step project requirements wizard
- `/marketing` — Marketing services
- `/about` — Brand and operating principles
- `/contact` — Contact routes
- `/terms` — Terms & conditions
- `/privacy` — UK-GDPR-oriented privacy notice
- `/complaints` — Complaints charter
- Custom 404, robots and sitemap

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Production build

```bash
npm install
npm run typecheck
npm run build
npm start
```

For Vercel, import the repository/project and use the standard Next.js defaults. No custom build configuration is required.

## Project brief integration

The requirements wizard submits a validated same-origin request to:

`app/api/requirements/route.ts`

The route applies payload limits, rate limiting and bot checks, then sends the brief to the existing Supabase/HubSpot workflow. No privileged credential is exposed to the browser.

## Stripe checkout

The pricing cards already have stable plan IDs:

- `launch`
- `growth`
- `bespoke`

Launch and Growth create Stripe Checkout Sessions server-side using allow-listed plan and billing-period mappings. Bespoke enquiries continue through the project wizard. Stripe secret keys and Price IDs are server-only environment variables.

## Legal / privacy launch note

The privacy notice reflects the current Vercel, Supabase, HubSpot, Resend and Stripe workflow. The controller identity, retention periods, international transfers and cookie position should still receive legal review before launch.

## Design notes

- No third-party UI kit or icon dependency.
- No remote fonts, making deploys more deterministic.
- Responsive navigation and mobile layouts.
- Reduced-motion preference respected.
- Semantic page structure and skip navigation included.
- No fabricated client logos, reviews or performance claims.

## Environment

See `.env.example` for the required server-side integration variables.
