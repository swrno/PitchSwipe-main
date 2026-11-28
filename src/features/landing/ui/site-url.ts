/** Public base URL of the site, without a trailing slash. Shared by the landing metadata, robots.txt and the sitemap. */
export const DEFAULT_SITE_URL = "https://noor-api.centralindia.cloudapp.azure.com";

export function siteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || DEFAULT_SITE_URL).trim();
  try {
    const url = new URL(raw);
    return url.origin + url.pathname.replace(/\/+$/, "");
  } catch {
    return DEFAULT_SITE_URL;
  }
}
