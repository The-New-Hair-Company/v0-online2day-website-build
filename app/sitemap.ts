import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

const SITE_URL = 'https://www.online2day.com'

const staticRoutes: MetadataRoute.Sitemap = [
  { url: SITE_URL, lastModified: new Date(), changeFrequency: 'monthly', priority: 1 },
  { url: `${SITE_URL}/services`, changeFrequency: 'monthly', priority: 0.8 },
  { url: `${SITE_URL}/work`, changeFrequency: 'monthly', priority: 0.7 },
  { url: `${SITE_URL}/pricing`, changeFrequency: 'monthly', priority: 0.7 },
  { url: `${SITE_URL}/blog`, changeFrequency: 'weekly', priority: 0.9 },
  { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.6 },
  { url: `${SITE_URL}/contact`, changeFrequency: 'monthly', priority: 0.6 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('slug, updated_at, published_at')
    .eq('published', true)
    .order('published_at', { ascending: false })

  const blogRoutes: MetadataRoute.Sitemap = (posts || []).map(post => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.updated_at || post.published_at),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  return [...staticRoutes, ...blogRoutes]
}
