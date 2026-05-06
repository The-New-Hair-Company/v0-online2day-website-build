import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Target, Heart, Zap, Code2, Shield } from 'lucide-react'
import { TeamSection } from '@/components/about/TeamSection'

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen pt-24">
        <section className="pt-8 pb-16 px-4 md:pb-20">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-10 md:mb-16">
              <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 md:mb-6 text-balance">
                About <span className="text-primary">online2day</span>
              </h1>
              <p className="text-base sm:text-xl text-muted-foreground max-w-3xl mx-auto text-pretty leading-relaxed">
                We&apos;re a UK-based development company passionate about creating exceptional
                web experiences. Whatever your requirement, we have the skills and dedication
                to deliver.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-5 md:gap-8 mb-12 md:mb-20">
              <Card className="p-5 sm:p-8 bg-card border-border text-center">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 md:mb-6">
                  <Target className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                </div>
                <h3 className="text-lg md:text-xl font-bold mb-2 md:mb-3">Our Mission</h3>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                  To empower businesses with cutting-edge web solutions that drive growth and innovation.
                </p>
              </Card>

              <Card className="p-5 sm:p-8 bg-card border-border text-center">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 md:mb-6">
                  <Heart className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                </div>
                <h3 className="text-lg md:text-xl font-bold mb-2 md:mb-3">Our Values</h3>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                  Quality, transparency, and client satisfaction are at the heart of everything we do.
                </p>
              </Card>

              <TeamSection />
            </div>

            <Card className="p-6 sm:p-10 md:p-12 bg-linear-to-br from-card to-card/50 border-primary/20 mb-12 md:mb-20">
              <h2 className="text-2xl sm:text-3xl font-bold mb-5 md:mb-6 text-center text-balance">
                Why We&apos;re Different
              </h2>
              <div className="grid sm:grid-cols-3 gap-6 md:gap-8">
                <div className="text-center">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Code2 className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Technical Excellence</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We use the latest technologies and best practices to ensure your project is built to last
                  </p>
                </div>
                <div className="text-center">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Fast Delivery</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Agile development process that delivers working software quickly and iteratively
                  </p>
                </div>
                <div className="text-center">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Ongoing Support</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    24/7 support and maintenance to keep your application running smoothly
                  </p>
                </div>
              </div>
            </Card>

            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-bold mb-4 md:mb-6 text-balance">
                Ready to Work Together?
              </h2>
              <p className="text-base md:text-lg text-muted-foreground mb-6 md:mb-8 max-w-2xl mx-auto text-pretty">
                Let&apos;s discuss your project and how we can help bring your vision to life.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
                <Button size="lg" asChild>
                  <Link href="/contact">Get in Touch</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/services">Our Services</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
