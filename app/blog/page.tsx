import Link from 'next/link'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function BlogPage() {
  const supabase = await createClient()
  
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('published', true)
    .order('published_at', { ascending: false })

  return (
    <>
      <Header />
      <main className="min-h-screen pt-24">
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h1 className="text-4xl md:text-6xl font-bold mb-6 text-balance">
                Blog & <span className="text-primary">Insights</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-pretty leading-relaxed">
                Technical articles, industry insights, and best practices from our team
              </p>
            </div>

            {!posts || posts.length === 0 ? (
              <Card className="p-12 bg-card border-border text-center">
                <h3 className="text-xl font-semibold mb-2">No posts yet</h3>
                <p className="text-muted-foreground">
                  Check back soon for our latest articles and insights
                </p>
              </Card>
            ) : (
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => (
                  <Link key={post.id} href={`/blog/${post.slug}`}>
                    <Card className="p-6 bg-card border-border hover:border-primary/50 transition-all h-full flex flex-col">
                      {post.category && (
                        <Badge variant="outline" className="w-fit mb-4 bg-primary/10 text-primary border-primary/20">
                          {post.category}
                        </Badge>
                      )}
                      
                      <h2 className="text-xl font-bold mb-3 line-clamp-2 text-balance">
                        {post.title}
                      </h2>
                      
                      <p className="text-muted-foreground mb-4 line-clamp-3 leading-relaxed flex-grow">
                        {post.excerpt}
                      </p>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground pt-4 border-t border-border">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {new Date(post.published_at).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        {post.read_time && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{post.read_time} min read</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center text-primary mt-4 text-sm font-medium">
                        Read article
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
