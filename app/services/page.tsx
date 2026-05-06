import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Code2, Database, Layout, Paintbrush, Rocket, Shield, Users, Zap } from 'lucide-react'

export default function ServicesPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen pt-24">
        <section className="pt-8 pb-16 px-4 md:pb-20">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-10 md:mb-16">
              <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 md:mb-6 text-balance">
                Services That <span className="text-primary">Scale</span>
              </h1>
              <p className="text-base sm:text-xl text-muted-foreground max-w-3xl mx-auto text-pretty leading-relaxed">
                Comprehensive web development services designed for modern businesses.
                From initial concept to ongoing support, we&apos;re with you every step of the way.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-5 md:gap-8 mb-12 md:mb-16">
              <Card id="web" className="p-5 sm:p-8 bg-card border-border">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4 md:mb-6">
                  <Code2 className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4">Web Development</h2>
                <p className="text-sm md:text-base text-muted-foreground mb-4 md:mb-6 leading-relaxed">
                  Modern, responsive websites built with cutting-edge technologies.
                  We create fast, secure, and scalable web applications that users love.
                </p>
                <ul className="space-y-2 md:space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <Zap className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0 mt-0.5" />
                    <span>Next.js &amp; React applications</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Zap className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0 mt-0.5" />
                    <span>Progressive Web Apps (PWA)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Zap className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0 mt-0.5" />
                    <span>E-commerce platforms</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Zap className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0 mt-0.5" />
                    <span>Content management systems</span>
                  </li>
                </ul>
              </Card>

              <Card id="saas" className="p-5 sm:p-8 bg-card border-border">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4 md:mb-6">
                  <Rocket className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4">SaaS Development</h2>
                <p className="text-sm md:text-base text-muted-foreground mb-4 md:mb-6 leading-relaxed">
                  End-to-end SaaS solutions with authentication, billing, and analytics.
                  Launch your software business with a solid technical foundation.
                </p>
                <ul className="space-y-2 md:space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <Zap className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0 mt-0.5" />
                    <span>Multi-tenant architecture</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Zap className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0 mt-0.5" />
                    <span>Subscription management</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Zap className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0 mt-0.5" />
                    <span>User analytics &amp; reporting</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Zap className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0 mt-0.5" />
                    <span>API development</span>
                  </li>
                </ul>
              </Card>

              <Card id="design" className="p-5 sm:p-8 bg-card border-border">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4 md:mb-6">
                  <Paintbrush className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4">UI/UX Design</h2>
                <p className="text-sm md:text-base text-muted-foreground mb-4 md:mb-6 leading-relaxed">
                  Beautiful, intuitive interfaces that users love. We design with accessibility,
                  performance, and conversion in mind.
                </p>
                <ul className="space-y-2 md:space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <Layout className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0 mt-0.5" />
                    <span>Responsive design systems</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Layout className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0 mt-0.5" />
                    <span>User research &amp; testing</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Layout className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0 mt-0.5" />
                    <span>Wireframing &amp; prototyping</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Layout className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0 mt-0.5" />
                    <span>Brand identity design</span>
                  </li>
                </ul>
              </Card>

              <Card id="consulting" className="p-5 sm:p-8 bg-card border-border">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4 md:mb-6">
                  <Users className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4">Technical Consulting</h2>
                <p className="text-sm md:text-base text-muted-foreground mb-4 md:mb-6 leading-relaxed">
                  Expert guidance on architecture, technology choices, and best practices.
                  We help you make informed decisions that save time and money.
                </p>
                <ul className="space-y-2 md:space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <Database className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0 mt-0.5" />
                    <span>Architecture review &amp; planning</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Database className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0 mt-0.5" />
                    <span>Performance optimization</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Database className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0 mt-0.5" />
                    <span>Security audits</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Database className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0 mt-0.5" />
                    <span>Team training &amp; workshops</span>
                  </li>
                </ul>
              </Card>
            </div>

            <Card className="p-6 sm:p-10 md:p-12 bg-linear-to-br from-card to-card/50 border-primary/20 text-center">
              <Shield className="h-10 w-10 md:h-12 md:w-12 text-primary mx-auto mb-4 md:mb-6" />
              <h2 className="text-2xl md:text-3xl font-bold mb-3 md:mb-4 text-balance">
                Our Process
              </h2>
              <p className="text-base md:text-lg text-muted-foreground mb-6 md:mb-8 max-w-2xl mx-auto text-pretty">
                We follow a proven methodology that ensures quality, transparency, and on-time delivery.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-8 text-left">
                <div>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 md:mb-4 text-primary font-bold text-sm">
                    1
                  </div>
                  <h3 className="font-semibold mb-1 md:mb-2 text-sm md:text-base">Discovery</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Understanding your requirements and defining project scope
                  </p>
                </div>
                <div>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 md:mb-4 text-primary font-bold text-sm">
                    2
                  </div>
                  <h3 className="font-semibold mb-1 md:mb-2 text-sm md:text-base">Design</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Creating wireframes, mockups, and interactive prototypes
                  </p>
                </div>
                <div>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 md:mb-4 text-primary font-bold text-sm">
                    3
                  </div>
                  <h3 className="font-semibold mb-1 md:mb-2 text-sm md:text-base">Development</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Building your application with best practices and testing
                  </p>
                </div>
                <div>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 md:mb-4 text-primary font-bold text-sm">
                    4
                  </div>
                  <h3 className="font-semibold mb-1 md:mb-2 text-sm md:text-base">Launch</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Deployment, monitoring, and ongoing support
                  </p>
                </div>
              </div>
              <div className="mt-8 md:mt-12">
                <Button size="lg" asChild>
                  <Link href="/contact">Start a Project</Link>
                </Button>
              </div>
            </Card>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
