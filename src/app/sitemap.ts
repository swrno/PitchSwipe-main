import type { MetadataRoute } from "next";
import { siteUrl } from "@/features/landing/ui/site-url";

const PATHS: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/signup", priority: 0.8 },
  { path: "/login", priority: 0.5 },
  { path: "/terms", priority: 0.3 },
  { path: "/privacy", priority: 0.3 },
  { path: "/contact", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PATHS.map(({ path, priority }) => ({
    url: path === "/" ? `${base}/` : `${base}${path}`,
    changeFrequency: "monthly",
    priority,
  }));
}
