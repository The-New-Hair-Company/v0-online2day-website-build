# Online2Day CRM — Enterprise Leads Page

This ZIP contains a complete drop-in Next.js App Router implementation of the redesigned **Leads** page shown in the mockup.

## Files included

```txt
app/dashboard/leads/page.tsx
components/leads/LeadsDashboard.tsx
components/leads/LeadsDashboard.module.css
components/leads/leads-data.ts
components/leads/leads-types.ts
```

## How to install

1. Copy the `components/leads` folder into your project.
2. Copy `app/dashboard/leads/page.tsx` into your App Router structure.
   - If your existing route is different, move the file to your route, for example `app/leads/page.tsx`.
3. Make sure your `tsconfig.json` supports the `@/*` path alias. Most Next.js projects do.
   - If not, change this import in `page.tsx`:

```ts
import LeadsDashboard from '@/components/leads/LeadsDashboard'
```

to a relative import matching your folder structure.

## Dependencies

No extra packages are required. Icons are inline SVG components, and styling is handled via a CSS Module.

## Built-in interactions

- Search filters the lead table.
- Stage dropdown is functional and open by default to show development intent.
- Create/Add dropdown is open by default to show all menu actions.
- Lead rows are selectable and update the bottom command bar.
- Tabs filter by All leads, High intent, Follow-up due, At risk, and Won.

## Design intent

The page is built as a high-control CRM lead command centre: KPI cards, guided sales workflow, pipeline/source/owner insight panels, a dense lead table, AI recommendation rail, recent activity, goal progress, and a selected-lead command bar. It is intentionally data-rich while staying implementable in standard Next.js.
