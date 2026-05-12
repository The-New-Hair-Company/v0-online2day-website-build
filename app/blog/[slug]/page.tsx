import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { ArrowLeft, Calendar, Clock, Tag } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

const SITE_URL = 'https://www.online2day.com'

type Post = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  content: string | null
  category: string | null
  cover_url: string | null
  author_name: string
  author_role: string
  published_at: string
  read_time: number | null
  tags: string[]
  seo_title: string | null
  seo_desc: string | null
}

async function getPost(slug: string): Promise<Post | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('blog_posts')
    .select('id, slug, title, excerpt, content, category, cover_url, author_name, author_role, published_at, read_time, tags, seo_title, seo_desc')
    .eq('slug', slug)
    .eq('published', true)
    .single()

  if (!data) return null
  return {
    ...data,
    tags: data.tags ?? [],
    author_name: data.author_name ?? 'Online2Day Team',
    author_role: data.author_role ?? 'Online2Day',
  }
}

// ── SEO metadata ──────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return { title: 'Post not found | online2day' }

  const title = post.seo_title || `${post.title} | online2day`
  const description = post.seo_desc || post.excerpt || 'An article from the online2day team.'
  const url = `${SITE_URL}/blog/${post.slug}`
  const images = post.cover_url ? [{ url: post.cover_url, width: 1200, height: 630, alt: post.title }] : []

  return {
    title,
    description,
    openGraph: {
      title: post.seo_title || post.title,
      description,
      type: 'article',
      url,
      publishedTime: post.published_at,
      authors: [post.author_name],
      section: post.category ?? undefined,
      tags: post.tags,
      images,
    },
    twitter: {
      card: post.cover_url ? 'summary_large_image' : 'summary',
      title: post.seo_title || post.title,
      description,
      images: post.cover_url ? [post.cover_url] : [],
    },
    alternates: { canonical: url },
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    author: {
      '@type': 'Person',
      name: post.author_name,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Online2Day',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` },
    },
    datePublished: post.published_at,
    image: post.cover_url,
    url: `${SITE_URL}/blog/${post.slug}`,
    keywords: post.tags.join(', '),
  }

  const pubDate = new Date(post.published_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <>
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <Header />

      <main className="min-h-screen pt-24">
        <article>
          {/* ── Cover image hero ─────────────────────────────────────── */}
          {post.cover_url && (
            <div className="relative h-64 md:h-[480px] w-full">
              <Image
                src={post.cover_url}
                alt={post.title}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
            </div>
          )}

          {/* ── Article body ─────────────────────────────────────────── */}
          <div className="px-4 py-12 md:py-16">
            <div className="mx-auto max-w-2xl">

              {/* Back link */}
              <Link
                href="/blog"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 group"
              >
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                All articles
              </Link>

              {/* Category */}
              {post.category && (
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/20 mb-4">
                  {post.category}
                </span>
              )}

              {/* Title */}
              <h1 className="text-3xl md:text-5xl font-bold leading-tight text-balance tracking-tight mb-6">
                {post.title}
              </h1>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground border-y border-border py-4 mb-8">
                <span className="font-semibold text-foreground">{post.author_name}</span>
                <span className="text-border">·</span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {pubDate}
                </span>
                {post.read_time && (
                  <>
                    <span className="text-border">·</span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {post.read_time} min read
                    </span>
                  </>
                )}
              </div>

              {/* Excerpt (lead paragraph) */}
              {post.excerpt && (
                <p className="text-xl text-muted-foreground leading-relaxed mb-10 font-light">
                  {post.excerpt}
                </p>
              )}

              {/* Content */}
              {post.content && (
                <div
                  className="prose-content"
                  dangerouslySetInnerHTML={{ __html: post.content }}
                />
              )}

              {/* Tags */}
              {post.tags.length > 0 && (
                <div className="mt-12 flex flex-wrap items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  {post.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2.5 py-0.5 rounded-full text-xs border border-border text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Author card */}
              <div className="mt-14 rounded-xl border border-border bg-card p-6 flex items-start gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-primary">
                    {post.author_name.substring(0, 2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-semibold">{post.author_name}</p>
                  <p className="text-sm text-muted-foreground">{post.author_role}</p>
                </div>
              </div>

              {/* CTA */}
              <div className="mt-14 rounded-2xl bg-primary/10 border border-primary/20 p-8 text-center">
                <p className="text-2xl font-bold mb-2 text-balance">
                  Ready to get your business online?
                </p>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Talk to the team about what you&apos;re building. No sales pitch — just a straight conversation.
                </p>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
                >
                  Get in touch
                  <ArrowLeft className="h-4 w-4 rotate-180" />
                </Link>
              </div>

              {/* Bottom nav */}
              <div className="mt-10 pt-8 border-t border-border">
                <Link
                  href="/blog"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                >
                  <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                  Back to all articles
                </Link>
              </div>

            </div>
          </div>
        </article>
      </main>

      <Footer />
    </>
  )
}
