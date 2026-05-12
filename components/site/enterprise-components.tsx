import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  BadgeCheck,
  Code2,
  Gauge,
  GitBranch,
  Globe2,
  MailCheck,
  MonitorSmartphone,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

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

const services: Feature[] = [
  {
    title: 'Websites & landing pages',
    detail: 'Fast, server-rendered marketing surfaces built to convert — designed for clarity and built to rank.',
    icon: Globe2,
  },
  {
    title: 'CRM & lead workflows',
    detail: 'Lead capture, pipeline management, personalised video follow-up and email automation in one system.',
    icon: MailCheck,
  },
  {
    title: 'Dashboards & internal tools',
    detail: 'Operational screens that prioritise scanning, filtering, exports and governed action for your team.',
    icon: BarChart3,
  },
]

const process: Step[] = [
  { label: 'Discover', detail: 'We map your users, workflows and goals before a single line of code.', icon: Globe2 },
  { label: 'Design', detail: 'Screens, data contracts and delivery milestones shaped around your business.', icon: GitBranch },
  { label: 'Build', detail: 'Usable slices shipped with production-quality code and performance checks.', icon: Code2 },
  { label: 'Launch', detail: 'Monitored, iterated and handed over with tools that make daily work easier.', icon: BadgeCheck },
]

// ── Layout shells ─────────────────────────────────────────────────────────────

function Section({ children, tint = false }: { children: React.ReactNode; tint?: boolean }) {
  return (
    <section className={`px-4 py-16 md:py-24 ${tint ? 'bg-muted/40' : ''}`}>
      <div className="mx-auto max-w-5xl">{children}</div>
    </section>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">{children}</p>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────

export function ProductHero() {
  return (
    <section className="relative px-4 pt-32 pb-24 md:pt-40 md:pb-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,color-mix(in_oklch,var(--primary),transparent_82%),transparent)]" />
      <div className="relative mx-auto max-w-3xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-4 py-1.5 text-sm font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          Web development for growing businesses
        </div>
        <h1 className="text-4xl font-black tracking-tight text-balance sm:text-5xl md:text-6xl">
          Your website.<br className="hidden sm:block" /> Your workflows.<br className="hidden sm:block" /> Done right.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
          Online2Day builds websites, CRM systems and dashboards that are fast, polished and easy to operate from day one.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/contact">
              Start your project
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/work">See our work</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

// ── Services ──────────────────────────────────────────────────────────────────

function ServiceCard({ service }: { service: Feature }) {
  const Icon = service.icon
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h3 className="text-base font-bold">{service.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{service.detail}</p>
    </div>
  )
}

export function ServicesGrid() {
  return (
    <Section tint>
      <div className="mb-10 text-center">
        <SectionLabel>What we build</SectionLabel>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Everything your business needs online</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {services.map((s) => <ServiceCard key={s.title} service={s} />)}
      </div>
    </Section>
  )
}

// ── Process ───────────────────────────────────────────────────────────────────

function ProcessStep({ step, index }: { step: Step; index: number }) {
  const Icon = step.icon
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center gap-1">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        {index < process.length - 1 && (
          <div className="w-px flex-1 bg-border" />
        )}
      </div>
      <div className="pb-8">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">0{index + 1}</p>
        <h3 className="mt-0.5 font-bold">{step.label}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.detail}</p>
      </div>
    </div>
  )
}

export function ProcessSection() {
  return (
    <Section>
      <div className="grid gap-12 md:grid-cols-2 md:gap-16 md:items-start">
        <div>
          <SectionLabel>How we work</SectionLabel>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            A clear process, visible progress.
          </h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            Short feedback loops and production-minded delivery from the first sprint to launch day.
          </p>
          <div className="mt-6">
            <Button asChild variant="outline">
              <Link href="/contact">Talk to us <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
        <div className="mt-2">
          {process.map((step, i) => <ProcessStep key={step.label} step={step} index={i} />)}
        </div>
      </div>
    </Section>
  )
}

// ── CTA ───────────────────────────────────────────────────────────────────────

export function FinalCta() {
  return (
    <Section tint>
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-black tracking-tight text-balance sm:text-3xl">
          Ready to build something that works?
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-muted-foreground leading-relaxed">
          Tell us about your project and we'll come back with a clear plan and an honest timeline.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/contact">
              Get in touch
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/pricing">View pricing</Link>
          </Button>
        </div>
      </div>
    </Section>
  )
}

// ── Page composition ──────────────────────────────────────────────────────────

export function EnterpriseHomepage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <ProductHero />
      <ServicesGrid />
      <ProcessSection />
      <FinalCta />
    </main>
  )
}

// ── Shared utilities (used by other pages) ────────────────────────────────────

export function SitePageShell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-background text-foreground">{children}</main>
}

export function SiteSection({ children, tint = false }: { children: React.ReactNode; tint?: boolean }) {
  return (
    <section className={`px-4 py-16 md:py-24 ${tint ? 'bg-muted/40' : ''}`}>
      <div className="mx-auto max-w-5xl">{children}</div>
    </section>
  )
}

export function SectionHeading({ eyebrow, title, description }: { eyebrow?: string; title: React.ReactNode; description: string }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      {eyebrow ? <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">{eyebrow}</p> : null}
      <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{title}</h2>
      <p className="mt-3 leading-relaxed text-muted-foreground text-pretty">{description}</p>
    </div>
  )
}

export function EyebrowBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-4 py-1.5 text-sm font-medium text-primary">
      <Sparkles className="h-3.5 w-3.5" />
      {children}
    </div>
  )
}

export function HeroActions() {
  return (
    <div className="flex flex-col justify-center gap-3 pt-4 sm:flex-row">
      <Button size="lg" asChild>
        <Link href="/contact">
          Start your project
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
      <Button size="lg" variant="outline" asChild>
        <Link href="/work">See our work</Link>
      </Button>
    </div>
  )
}
