import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { GuidedChat } from '@/components/contact/GuidedChat'
import { Card } from '@/components/ui/card'
import { Mail, MessageSquare, Phone } from 'lucide-react'

export default function ContactPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen pt-24">
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-5xl">
            <div className="text-center mb-16">
              <h1 className="text-4xl md:text-6xl font-bold mb-6 text-balance">
                Let&apos;s Build Something <span className="text-primary">Amazing</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-pretty leading-relaxed">
                Ready to start your project? Get in touch and we&apos;ll respond within 24 hours.
              </p>
            </div>

            {/* Contact info cards — large, prominent */}
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              <Card className="p-8 bg-card border-border text-center flex flex-col items-center gap-3">
                <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Mail className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-bold text-lg">Email Us</h3>
                <p className="text-sm text-muted-foreground">Drop us a line anytime</p>
                <a
                  href="mailto:info@online2day.com"
                  className="text-2xl font-bold text-primary hover:underline tracking-tight mt-1"
                >
                  info@online2day.com
                </a>
              </Card>

              <Card className="p-8 text-center flex flex-col items-center gap-3 border-primary/30 bg-primary/5">
                <div className="h-14 w-14 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Phone className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-bold text-lg">Call Us</h3>
                <p className="text-sm text-muted-foreground">Mon–Fri 9am–6pm GMT</p>
                <a
                  href="tel:+443330506098"
                  className="text-3xl font-extrabold text-primary hover:underline tracking-tight mt-1"
                  style={{ letterSpacing: '-0.02em' }}
                >
                  +44 333 050 6098
                </a>
              </Card>

              <Card className="p-8 bg-card border-border text-center flex flex-col items-center gap-3">
                <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-bold text-lg">Live Chat</h3>
                <p className="text-sm text-muted-foreground">Available during business hours</p>
                <a href="#chat" className="text-2xl font-bold text-primary hover:underline tracking-tight mt-1">
                  Start a chat ↓
                </a>
              </Card>
            </div>

            {/* Guided chat */}
            <Card id="chat" className="bg-card border-border overflow-hidden scroll-mt-24">
              <div className="px-8 pt-8 pb-4 border-b border-border">
                <h2 className="text-2xl font-bold">Chat with us</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Our team usually replies within a few hours during business hours.
                </p>
              </div>
              <GuidedChat />
            </Card>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
