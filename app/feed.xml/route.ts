import { blogPublicApi } from '@/lib/api/client'

export const dynamic = 'force-dynamic'

function xml(value: string) {
  return value.replace(/[<>&'\"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '\"': '&quot;' })[char] || char)
}

export async function GET() {
  const posts = await blogPublicApi.listPublished().catch(() => [])
  const items = posts.map((post) => `<item><title>${xml(post.title)}</title><link>https://www.online2day.com/blog/${xml(post.slug)}</link><guid isPermaLink="true">https://www.online2day.com/blog/${xml(post.slug)}</guid><description>${xml(post.excerpt || '')}</description>${post.publishedAt ? `<pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>` : ''}</item>`).join('')
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Online2Day insights</title><link>https://www.online2day.com/blog</link><description>Practical web, CRM and digital strategy articles.</description>${items}</channel></rss>`, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
  })
}
