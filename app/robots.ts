import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", "/dashboard/", "/protected/", "/user-dashboard/"],
    },
    sitemap: "https://www.online2day.com/sitemap.xml",
    host: "https://www.online2day.com",
  };
}
