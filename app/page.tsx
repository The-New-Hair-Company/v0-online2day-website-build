import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { ArrowRight, Code2, Zap, Shield, Sparkles, CheckCircle2, Terminal } from 'lucide-react'

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="min-h-screen">
        {/* Hero Section */}
        <section className="pt-32 pb-20 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary mb-4">
                <Sparkles className="h-4 w-4" />
                <span className="font-medium">Bespoke Web Development</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-balance">
                Whatever the requirement,{' '}
                <span className="text-primary">we deliver</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-pretty leading-relaxed">
                UK-based development company with the skills and dedication to get clients online 2day. 
                Technical authority meets modern product thinking.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button size="lg" asChild>
                  <Link href="/contact">
                    Start Your Project
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/work">View Our Work</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Indicators */}
        <section className="py-12 px-4 border-y border-border bg-card/50">
          <div className="container mx-auto max-w-6xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-4xl font-bold text-primary mb-2">50+</div>
                <div className="text-sm text-muted-foreground">Projects Delivered</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary mb-2">98%</div>
                <div className="text-sm text-muted-foreground">Client Satisfaction</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary mb-2">5★</div>
                <div className="text-sm text-muted-foreground">Average Rating</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary mb-2">24/7</div>
                <div className="text-sm text-muted-foreground">Support Available</div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Values */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">
                Why Choose online2day
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
                We combine technical excellence with modern development practices to deliver solutions that scale.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <Card className="p-6 bg-card hover:bg-card/80 transition-colors border-border">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Lightning Fast</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Performance-first architecture. We optimize for speed, targeting Lighthouse scores of 90+ on all metrics.
                </p>
              </Card>

              <Card className="p-6 bg-card hover:bg-card/80 transition-colors border-border">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Code2 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Modern Stack</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Built with Next.js, TypeScript, and Tailwind CSS. Clean, maintainable code that stands the test of time.
                </p>
              </Card>

              <Card className="p-6 bg-card hover:bg-card/80 transition-colors border-border">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Enterprise Security</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Security best practices baked in. From authentication to data protection, we take security seriously.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Services Overview */}
        <section className="py-20 px-4 bg-card/30">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">
                Our Services
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
                From concept to deployment, we handle every aspect of your web project.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-8 bg-card border-border hover:border-primary/50 transition-colors">
                <Terminal className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-2xl font-semibold mb-3">Web Applications</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Custom web applications built with modern frameworks. From MVPs to enterprise solutions.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">Full-stack development with Next.js</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">API design and integration</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">Database architecture and optimization</span>
                  </li>
                </ul>
              </Card>

              <Card className="p-8 bg-card border-border hover:border-primary/50 transition-colors">
                <Sparkles className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-2xl font-semibold mb-3">SaaS Development</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Complete SaaS platforms with authentication, billing, and user management.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">Multi-tenant architecture</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">Subscription and payment integration</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">Analytics and reporting dashboards</span>
                  </li>
                </ul>
              </Card>
            </div>

            <div className="text-center mt-8">
              <Button size="lg" variant="outline" asChild>
                <Link href="/services">
                  View All Services
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-4xl">
            <Card className="p-12 bg-gradient-to-br from-card to-card/50 border-primary/20 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">
                Ready to Start Your Project?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 text-pretty max-w-2xl mx-auto">
                Let's discuss your requirements and create something exceptional together.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" asChild>
                  <Link href="/contact">
                    Get in Touch
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/dashboard">Try Project Builder</Link>
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
