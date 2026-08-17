import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["", "/pricing", "/marketing", "/about", "/contact", "/start", "/terms", "/privacy", "/complaints"];
  return paths.map((path) => ({ url: `https://www.online2day.com${path}`, lastModified: new Date(), changeFrequency: path === "" ? "weekly" : "monthly", priority: path === "" ? 1 : path === "/pricing" ? 0.9 : 0.7 }));
}
