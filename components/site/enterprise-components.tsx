import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  Code2,
  Database,
  Gauge,
  GitBranch,
  Globe2,
  Layers3,
  LockKeyhole,
  MailCheck,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
  Timer,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

type Metric = {
  label: string
  value: string
  detail: string
}

type Feature = {
  title: string
  detail: string
  icon: LucideIcon
}

type Step = {
  label: string
  detail: string
  icon: LucideIcon
}

const metrics: Metric[] = [
  { label: 'Mobile performance target', value: '90+', detail: 'Lean pages, server-rendered sections and lighter public navigation.' },
  { label: 'Delivery cadence', value: '2x', detail: 'Discovery, build and review loops designed around visible progress.' },
  { label: 'Operational coverage', value: '24/7', detail: 'Monitoring, support readiness and clear ownership after launch.' },
  { label: 'Accessibility controls', value: 'Sitewide', detail: 'Theme, contrast, text scale, motion and readability preferences.' },
]

const outcomes: Feature[] = [
  { title: 'Lead conversion systems', detail: 'Forms, CRM workflows, email handoff and personalised video pages built as one journey.', icon: MailCheck },
  { title: 'Enterprise dashboards', detail: 'Operational screens that prioritise scanning, filtering, exports and governed action.', icon: BarChart3 },
  { title: 'Fast marketing surfaces', detail: 'Static-first pages, careful component boundaries and lean interaction patterns.', icon: Gauge },
]

const capabilities: Feature[] = [
  { title: 'Product strategy', detail: 'Scope the smallest useful release and protect the work from vague requirements.', icon: Sparkles },
  { title: 'SaaS architecture', detail: 'Authentication, billing, roles, data models and reporting foundations.', icon: Layers3 },
  { title: 'CRM workflows', detail: 'Lead stages, notes, activity logging, exports and email/video follow-up.', icon: Workflow },
  { title: 'Performance budgets', detail: 'Core Web Vitals, bundle discipline, image strategy and route-level review.', icon: Timer },
  { title: 'Security posture', detail: 'Access control, audit trails, storage rules and safe operational defaults.', icon: LockKeyhole },
  { title: 'Design systems', detail: 'Reusable patterns that keep light and dark modes consistently polished.', icon: MonitorSmartphone },
]

const process: Step[] = [
  { label: 'Map', detail: 'Clarify users, workflows, risks and success measures before build pressure takes over.', icon: Globe2 },
  { label: 'Shape', detail: 'Turn the work into screens, data contracts and delivery milestones.', icon: GitBranch },
  { label: 'Build', detail: 'Ship usable slices with production-minded code, tests and performance checks.', icon: Code2 },
  { label: 'Operate', detail: 'Monitor, iterate and hand the team tools that make daily work easier.', icon: BadgeCheck },
]

const stack = ['Next.js', 'TypeScript', 'Supabase', 'Resend', 'Tailwind', 'Vercel', 'Postgres', 'Audit logs']
const proofItems = ['GDPR-aware activity logging', 'Accessible text controls', 'Video and email workflows', 'Role-aware dashboard surfaces']
const integrations = ['CRM', 'Email', 'Storage', 'Analytics', 'Billing', 'Calendar']

export function SitePageShell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-background text-foreground">{children}</main>
}

export function SiteSection({ children, tint = false }: { children: React.ReactNode; tint?: boolean }) {
  return (
    <section className={`px-4 py-16 md:py-20 ${tint ? 'bg-card/45 border-y border-border/70' : ''}`}>
      <div className="container mx-auto max-w-6xl">{children}</div>
    </section>
  )
}

export function EyebrowBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
      <Sparkles className="h-4 w-4" />
      {children}
    </div>
  )
}

export function SectionHeading({ eyebrow, title, description }: { eyebrow?: string; title: React.ReactNode; description: string }) {
  return (
    <div className="mx-auto mb-10 max-w-3xl text-center">
      {eyebrow ? <div className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-primary">{eyebrow}</div> : null}
      <h2 className="text-3xl font-bold tracking-tight text-balance md:text-4xl">{title}</h2>
      <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty">{description}</p>
    </div>
  )
}

export function HeroActions() {
  return (
    <div className="flex flex-col justify-center gap-3 pt-4 sm:flex-row">
      <Button size="lg" asChild>
        <Link href="/contact">
          Start your project
          <ArrowRight className="ml-2 h-5 w-5" />
        </Link>
      </Button>
      <Button size="lg" variant="outline" asChild>
        <Link href="/work">View delivery examples</Link>
      </Button>
    </div>
  )
}

export function ProductPreview() {
  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-0 mx-auto hidden max-w-5xl translate-y-1/2 rounded-xl border border-border bg-card/95 p-3 shadow-2xl shadow-primary/10 md:block">
      <div className="grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-border bg-background/70 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Pipeline</div>
              <div className="mt-1 text-xl font-black">Enterprise lead workspace</div>
            </div>
            <Badge variant="outline" className="bg-primary/10 text-primary">Live</Badge>
          </div>
          <div className="grid gap-2">
            {['Discovery call booked', 'Personalised video sent', 'Proposal ready'].map((item, index) => (
              <div key={item} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                <span className="text-sm font-semibold">{item}</span>
                <span className="text-xs text-muted-foreground">{82 + index * 5}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-background/70 p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-primary"><Zap className="h-4 w-4" /> Performance budget</div>
          <div className="space-y-3">
            {['Server components', 'Static marketing pages', 'No auth client on public nav'].map((item) => (
              <div key={item}>
                <div className="mb-1 flex justify-between text-xs"><span>{item}</span><span className="text-muted-foreground">ready</span></div>
                <div className="h-2 rounded-full bg-muted"><div className="h-full w-[88%] rounded-full bg-primary" /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ProductHero() {
  return (
    <section className="relative overflow-hidden px-4 pb-32 pt-32 md:pb-44">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_oklch,var(--primary),transparent_76%),transparent_34%)]" />
      <ProductPreview />
      <div className="container relative mx-auto max-w-6xl text-center">
        <EyebrowBadge>Bespoke web development for serious operators</EyebrowBadge>
        <h1 className="mx-auto mt-6 max-w-5xl text-5xl font-black tracking-tight text-balance md:text-7xl">
          Build fast, polished systems that make growth easier to run.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-xl leading-relaxed text-muted-foreground text-pretty">
          Online2Day designs and builds SaaS, CRM, automation and conversion workflows with enterprise detail and a light, fast user experience.
        </p>
        <HeroActions />
      </div>
    </section>
  )
}

export function MetricTile({ metric }: { metric: Metric }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-3xl font-black text-primary">{metric.value}</div>
      <div className="mt-2 font-bold">{metric.label}</div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{metric.detail}</p>
    </div>
  )
}

export function MetricsStrip() {
  return (
    <SiteSection tint>
      <div className="grid gap-4 md:grid-cols-4">
        {metrics.map((metric) => <MetricTile key={metric.label} metric={metric} />)}
      </div>
    </SiteSection>
  )
}

export function OutcomeCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon
  return (
    <Card className="p-6">
      <Icon className="mb-4 h-7 w-7 text-primary" />
      <h3 className="text-xl font-bold">{feature.title}</h3>
      <p className="mt-3 leading-relaxed text-muted-foreground">{feature.detail}</p>
    </Card>
  )
}

export function OutcomeGrid() {
  return (
    <SiteSection>
      <SectionHeading
        eyebrow="Outcomes"
        title="The site, product and operating layer should feel like one system."
        description="The build needs public pages that convert, private tools that reduce effort, and data workflows that keep the business honest."
      />
      <div className="grid gap-5 md:grid-cols-3">
        {outcomes.map((feature) => <OutcomeCard key={feature.title} feature={feature} />)}
      </div>
    </SiteSection>
  )
}

export function CapabilityCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-bold">{feature.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.detail}</p>
    </div>
  )
}

export function CapabilityMatrix() {
  return (
    <SiteSection tint>
      <SectionHeading
        eyebrow="Capability"
        title="Useful pieces, built with production discipline."
        description="The work should be modular enough to maintain and cohesive enough that users never see the joins."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {capabilities.map((feature) => <CapabilityCard key={feature.title} feature={feature} />)}
      </div>
    </SiteSection>
  )
}

export function ProcessStep({ step, index }: { step: Step; index: number }) {
  const Icon = step.icon
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-sm font-black text-muted-foreground">0{index + 1}</span>
      </div>
      <h3 className="font-bold">{step.label}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.detail}</p>
    </div>
  )
}

export function ProcessTimeline() {
  return (
    <SiteSection>
      <SectionHeading
        eyebrow="Delivery"
        title="A process that keeps quality visible."
        description="Short feedback loops, clear milestones and a constant eye on speed, accessibility and maintainability."
      />
      <div className="grid gap-4 md:grid-cols-4">
        {process.map((step, index) => <ProcessStep key={step.label} step={step} index={index} />)}
      </div>
    </SiteSection>
  )
}

export function ProofChecklist() {
  return (
    <div className="grid gap-3">
      {proofItems.map((item) => (
        <div key={item} className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <span className="text-sm font-semibold">{item}</span>
        </div>
      ))}
    </div>
  )
}

export function PerformancePanel() {
  return (
    <Card className="p-6">
      <Gauge className="mb-4 h-7 w-7 text-primary" />
      <h3 className="text-xl font-bold">Performance guardrails</h3>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        Public surfaces now favour server-rendered composition, lightweight navigation and token-based styling to keep mobile pages nimble.
      </p>
    </Card>
  )
}

export function SecurityPanel() {
  return (
    <Card className="p-6">
      <ShieldCheck className="mb-4 h-7 w-7 text-primary" />
      <h3 className="text-xl font-bold">Governed data handling</h3>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        CRM actions, email sends and video assets are designed around approval state, audit notes and clear ownership.
      </p>
    </Card>
  )
}

export function DataFlowPanel() {
  return (
    <Card className="p-6">
      <Database className="mb-4 h-7 w-7 text-primary" />
      <h3 className="text-xl font-bold">Connected data flows</h3>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        Leads, videos, email content and activity timelines stay linked so teams can act without re-entering context.
      </p>
    </Card>
  )
}

export function AssuranceGrid() {
  return (
    <SiteSection tint>
      <SectionHeading
        eyebrow="Assurance"
        title="Enterprise detail without enterprise drag."
        description="The product should feel calm, quick and dependable, even when the underlying workflow is doing serious work."
      />
      <div className="grid gap-5 md:grid-cols-[1fr_1fr]">
        <ProofChecklist />
        <div className="grid gap-5">
          <PerformancePanel />
          <SecurityPanel />
          <DataFlowPanel />
        </div>
      </div>
    </SiteSection>
  )
}

export function IntegrationPill({ label }: { label: string }) {
  return <span className="rounded-full border border-border bg-card px-4 py-2 text-sm font-bold text-muted-foreground">{label}</span>
}

export function IntegrationCloud() {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {integrations.map((item) => <IntegrationPill key={item} label={item} />)}
    </div>
  )
}

export function StackBadge({ label }: { label: string }) {
  return <Badge variant="secondary" className="px-3 py-1 text-xs">{label}</Badge>
}

export function DeliveryStack() {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {stack.map((item) => <StackBadge key={item} label={item} />)}
    </div>
  )
}

export function TestimonialQuote() {
  return (
    <blockquote className="mx-auto max-w-3xl text-center">
      <p className="text-2xl font-bold leading-snug text-balance">
        "The best build partner is the one that makes the complicated parts feel ordinary for the people using them every day."
      </p>
      <footer className="mt-4 text-sm font-semibold text-muted-foreground">Online2Day delivery principle</footer>
    </blockquote>
  )
}

export function TrustSection() {
  return (
    <SiteSection>
      <SectionHeading
        eyebrow="Connected"
        title="Built to sit in the middle of real work."
        description="The stack choices, integrations and interface decisions are shaped around the work that happens after launch."
      />
      <IntegrationCloud />
      <div className="mt-6">
        <DeliveryStack />
      </div>
      <div className="mt-12">
        <TestimonialQuote />
      </div>
    </SiteSection>
  )
}

export function FinalCta() {
  return (
    <SiteSection tint>
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-black tracking-tight text-balance md:text-4xl">Ready for a site that feels lighter and works harder?</h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          We can turn the public website, dashboard and follow-up workflows into a single polished product.
        </p>
        <HeroActions />
      </div>
    </SiteSection>
  )
}

export function EnterpriseHomepage() {
  return (
    <SitePageShell>
      <ProductHero />
      <MetricsStrip />
      <OutcomeGrid />
      <CapabilityMatrix />
      <ProcessTimeline />
      <AssuranceGrid />
      <TrustSection />
      <FinalCta />
    </SitePageShell>
  )
}
