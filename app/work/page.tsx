import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { ExternalLink, ArrowRight } from 'lucide-react'

const projects = [
  {
    id: 1,
    title: 'FinTech Dashboard',
    description: 'Real-time analytics platform for financial services with interactive charts and data visualization.',
    tags: ['Next.js', 'TypeScript', 'Recharts', 'Supabase'],
    category: 'SaaS Platform',
  },
  {
    id: 2,
    title: 'E-commerce Marketplace',
    description: 'Multi-vendor marketplace with secure payments, inventory management, and order tracking.',
    tags: ['Next.js', 'Stripe', 'PostgreSQL', 'AWS'],
    category: 'E-commerce',
  },
  {
    id: 3,
    title: 'Healthcare Portal',
    description: 'Patient management system with appointment scheduling, medical records, and telemedicine.',
    tags: ['Next.js', 'TypeScript', 'Supabase', 'WebRTC'],
    category: 'Web Application',
  },
  {
    id: 4,
    title: 'Real Estate Platform',
    description: 'Property listing and management platform with advanced search and virtual tours.',
    tags: ['Next.js', 'Mapbox', 'Prisma', 'Vercel'],
    category: 'Web Application',
  },
  {
    id: 5,
    title: 'Education LMS',
    description: 'Learning management system with course creation, video streaming, and progress tracking.',
    tags: ['Next.js', 'TypeScript', 'Supabase', 'Mux'],
    category: 'SaaS Platform',
  },
  {
    id: 6,
    title: 'Restaurant Booking System',
    description: 'Table reservation system with real-time availability, menu management, and reviews.',
    tags: ['Next.js', 'Tailwind CSS', 'Supabase'],
    category: 'Web Application',
  },
]

export default function WorkPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen pt-24">
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h1 className="text-4xl md:text-6xl font-bold mb-6 text-balance">
                Our <span className="text-primary">Work</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-pretty leading-relaxed">
                Explore some of our recent projects. Each one built with modern technologies 
                and a focus on user experience.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="p-8 bg-card border-border hover:border-primary/50 transition-colors"
                >
                  <div className="mb-4">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                      {project.category}
                    </Badge>
                  </div>

                  <h2 className="text-2xl font-bold mb-3">{project.title}</h2>
                  
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    {project.description}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {project.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <Button variant="ghost" className="group">
                    View Case Study
                    <ExternalLink className="ml-2 h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </Button>
                </Card>
              ))}
            </div>

            <Card className="mt-16 p-12 bg-gradient-to-br from-card to-card/50 border-primary/20 text-center">
              <h2 className="text-3xl font-bold mb-4 text-balance">
                Have a Project in Mind?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto text-pretty">
                Let's collaborate and create something exceptional together.
              </p>
              <Button size="lg" asChild>
                <Link href="/contact">
                  Start Your Project
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </Card>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
