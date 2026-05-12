import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { ArrowRight, Calendar, Clock } from 'lucide-react'
import { blogPublicApi, type BlogPostDto } from '@/lib/api/client'

export const metadata: Metadata = {
  title: 'Blog & Insights | online2day',
  description: 'Practical articles on web development, CRM systems, digital strategy and running an efficient online business. Written by the Online2Day team.',
  openGraph: {
    title: 'Blog & Insights | online2day',
    description: 'Practical articles on web development, CRM systems and digital strategy.',
    type: 'website',
    url: 'https://www.online2day.com/blog',
  },
  alternates: { canonical: 'https://www.online2day.com/blog' },
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function CategoryBadge({ category }: { category: string | null | undefined }) {
  if (!category) return null
  return (
    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/20">
      {category}
    </span>
  )
}

function FeaturedPost({ post }: { post: BlogPostDto }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <div className="relative rounded-2xl overflow-hidden border border-border bg-card hover:border-primary/40 transition-colors duration-300">
        {post.coverUrl ? (
          <div className="relative h-72 md:h-96 w-full">
            <Image src={post.coverUrl} alt={post.title} fill className="object-cover" priority />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
              <CategoryBadge category={post.category} />
              <h2 className="mt-3 text-2xl md:text-4xl font-bold text-white text-balance leading-tight group-hover:text-primary transition-colors">
                {post.title}
              </h2>
              {post.excerpt && (
                <p className="mt-3 text-white/70 text-base leading-relaxed line-clamp-2 max-w-2xl">
                  {post.excerpt}
                </p>
              )}
              <div className="mt-4 flex items-center gap-4 text-white/60 text-sm">
                {post.publishedAt && <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{fmt(post.publishedAt)}</span>}
                {post.readTime && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{post.readTime} min read</span>}
                <span className="ml-auto flex items-center gap-1 text-primary font-medium">Read article <ArrowRight className="h-4 w-4" /></span>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative p-8 md:p-12 bg-gradient-to-br from-card to-primary/5">
            <div className="absolute inset-0 opacity-5"
              style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, var(--primary) 0%, transparent 60%)' }} />
            <CategoryBadge category={post.category} />
            <h2 className="mt-4 text-3xl md:text-5xl font-bold text-balance leading-tight group-hover:text-primary transition-colors max-w-3xl">
              {post.title}
            </h2>
            {post.excerpt && (
              <p className="mt-4 text-muted-foreground text-lg leading-relaxed line-clamp-3 max-w-2xl">
                {post.excerpt}
              </p>
            )}
            <div className="mt-6 flex items-center gap-4 text-sm text-muted-foreground">
              {post.publishedAt && <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{fmt(post.publishedAt)}</span>}
              {post.readTime && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{post.readTime} min read</span>}
              <span className="ml-auto flex items-center gap-1 text-primary font-medium">Read article <ArrowRight className="h-4 w-4" /></span>
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}

function PostCard({ post }: { post: BlogPostDto }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group flex flex-col rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 transition-all duration-300 hover:-translate-y-0.5 transform-gpu">
      {post.coverUrl ? (
        <div className="relative h-44 w-full overflow-hidden flex-shrink-0">
          <Image src={post.coverUrl} alt={post.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>
      ) : (
        <div className="h-44 bg-gradient-to-br from-primary/10 to-primary/5 flex-shrink-0 flex items-center justify-center">
          <span className="text-4xl font-black text-primary/20 select-none uppercase">
            {post.title.substring(0, 2)}
          </span>
        </div>
      )}
      <div className="flex flex-col flex-1 p-5 gap-3">
        <CategoryBadge category={post.category} />
        <h3 className="font-bold text-lg leading-snug text-balance line-clamp-2 group-hover:text-primary transition-colors">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3 flex-1">
            {post.excerpt}
          </p>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border mt-auto">
          {post.publishedAt && <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />{fmt(post.publishedAt)}</span>}
          {post.readTime && <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{post.readTime} min</span>}
        </div>
      </div>
    </Link>
  )
}

export default async function BlogPage() {
  const posts = await blogPublicApi.listPublished().catch(() => [])
  const [featured, ...rest] = posts

  return (
    <>
      <Header />
      <main className="min-h-screen pt-24">
        <section className="px-4 pt-10 pb-12">
          <div className="mx-auto max-w-5xl">
            <p className="text-sm font-semibold tracking-widest uppercase text-primary mb-3">Insights & ideas</p>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-balance">
              From the <span className="text-primary">online2day</span> team
            </h1>
            <p className="mt-4 text-muted-foreground text-lg max-w-xl leading-relaxed">
              Practical articles on web development, CRM systems, and building a business that runs online.
            </p>
          </div>
        </section>

        <section className="px-4 pb-24">
          <div className="mx-auto max-w-5xl">
            {posts.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-12 text-center">
                <p className="text-2xl font-bold mb-2">First post coming soon</p>
                <p className="text-muted-foreground">We&apos;re writing our first articles — check back shortly.</p>
              </div>
            ) : (
              <>
                {featured && <FeaturedPost post={featured} />}
                {rest.length > 0 && (
                  <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {rest.map(post => <PostCard key={post.id} post={post} />)}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
