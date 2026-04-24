import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { ContactForm } from '@/components/contact-form'
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
                Let's Build Something <span className="text-primary">Amazing</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-pretty leading-relaxed">
                Ready to start your project? Get in touch and we'll respond within 24 hours.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-12">
              <Card className="p-6 bg-card border-border text-center">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Email Us</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Drop us a line anytime
                </p>
                <a
                  href="mailto:info@online2day.com"
                  className="text-sm text-primary hover:underline"
                >
                  info@online2day.com
                </a>
              </Card>

              <Card className="p-6 bg-card border-border text-center">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Call Us</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Mon-Fri 9am-6pm GMT
                </p>
                <a
                  href="tel:+443330506098"
                  className="text-sm text-primary hover:underline"
                >
                  +44 333 050 6098
                </a>
              </Card>

              <Card className="p-6 bg-card border-border text-center">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Live Chat</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Available during business hours
                </p>
                <button className="text-sm text-primary hover:underline">
                  Start Chat
                </button>
              </Card>
            </div>

            <Card className="p-8 md:p-12 bg-card border-border">
              <h2 className="text-2xl font-bold mb-6">Send us a message</h2>
              <ContactForm />
            </Card>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
