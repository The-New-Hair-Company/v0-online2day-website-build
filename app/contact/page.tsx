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
        <section className="pt-8 pb-16 px-4 md:pb-20">
          <div className="container mx-auto max-w-5xl">
            <div className="text-center mb-10 md:mb-16">
              <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 md:mb-6 text-balance">
                Let&apos;s Build Something <span className="text-primary">Amazing</span>
              </h1>
              <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto text-pretty leading-relaxed">
                Ready to start your project? Get in touch and we&apos;ll respond within 24 hours.
              </p>
            </div>

            {/* Contact info cards */}
            <div className="grid sm:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-12">
              <Card className="p-5 sm:p-8 bg-card border-border text-center flex flex-col items-center gap-2 sm:gap-3">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Mail className="h-6 w-6 md:h-7 md:w-7 text-primary" />
                </div>
                <h3 className="font-bold text-base md:text-lg">Email Us</h3>
                <p className="text-xs md:text-sm text-muted-foreground">Drop us a line anytime</p>
                <a
                  href="mailto:info@online2day.com"
                  className="text-base sm:text-lg md:text-2xl font-bold text-primary hover:underline tracking-tight mt-1 break-all"
                >
                  info@online2day.com
                </a>
              </Card>

              <Card className="p-5 sm:p-8 text-center flex flex-col items-center gap-2 sm:gap-3 border-primary/30 bg-primary/5">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Phone className="h-6 w-6 md:h-7 md:w-7 text-primary" />
                </div>
                <h3 className="font-bold text-base md:text-lg">Call Us</h3>
                <p className="text-xs md:text-sm text-muted-foreground">Mon–Fri 9am–6pm GMT</p>
                <a
                  href="tel:+443330506098"
                  className="text-xl sm:text-2xl md:text-3xl font-extrabold text-primary hover:underline tracking-tight mt-1 whitespace-nowrap"
                  style={{ letterSpacing: '-0.02em' }}
                >
                  +44 333 050 6098
                </a>
              </Card>

              <Card className="p-5 sm:p-8 bg-card border-border text-center flex flex-col items-center gap-2 sm:gap-3">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 md:h-7 md:w-7 text-primary" />
                </div>
                <h3 className="font-bold text-base md:text-lg">Live Chat</h3>
                <p className="text-xs md:text-sm text-muted-foreground">Available during business hours</p>
                <a href="#chat" className="text-base sm:text-lg md:text-2xl font-bold text-primary hover:underline tracking-tight mt-1">
                  Start a chat ↓
                </a>
              </Card>
            </div>

            {/* Guided chat */}
            <Card id="chat" className="bg-card border-border overflow-hidden scroll-mt-24">
              <div className="px-5 sm:px-8 pt-6 sm:pt-8 pb-4 border-b border-border">
                <h2 className="text-xl sm:text-2xl font-bold">Chat with us</h2>
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
