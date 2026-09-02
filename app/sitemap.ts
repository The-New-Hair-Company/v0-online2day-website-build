import type { MetadataRoute } from "next";
import { blogPublicApi } from '@/lib/api/client'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paths = ["", "/pricing", "/marketing", "/about", "/contact", "/start", "/terms", "/privacy", "/complaints"];
  const pages: MetadataRoute.Sitemap = paths.map((path) => ({ url: `https://www.online2day.com${path}`, lastModified: new Date(), changeFrequency: path === "" ? "weekly" : "monthly", priority: path === "" ? 1 : path === "/pricing" ? 0.9 : 0.7 }));
  const posts = await blogPublicApi.listPublished().catch(() => [])
  return [...pages, { url: 'https://www.online2day.com/blog', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 }, ...posts.filter((post) => !post.noindex).map((post) => ({
    url: `https://www.online2day.com/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt || post.publishedAt || post.createdAt),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))]
}
