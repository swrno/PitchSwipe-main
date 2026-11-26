import type { MetadataRoute } from "next";
import { siteUrl } from "@/components/landing/site-url";

/** Public pages are crawlable; the app itself (signed-in screens and the API) is not. */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/d/", "/login", "/signup", "/terms", "/privacy", "/contact"],
        disallow: ["/api", "/decks", "/products", "/wallet", "/profile", "/swipe", "/practice"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
