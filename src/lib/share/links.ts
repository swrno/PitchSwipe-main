/** Personal swipe link, WhatsApp and LinkedIn share text (spec/02 "Sharing"). Pure; the `/d/[slug]` page is WP3's. */

export function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

/** Full URL, e.g. "https://pitchswipe.app/d/voice-khata". */
export function deckLink(origin: string, slug: string): string {
  return `${normalizeOrigin(origin)}/d/${encodeURIComponent(slug)}`;
}

/** Shown without the scheme, as in the designs: "pitchswipe.app/d/voice-khata". */
export function displayLink(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

export interface ShareCopy {
  productName: string;
  /** One line about what the product is, e.g. the category line. */
  tagline?: string;
}

export function whatsappText(copy: ShareCopy, url: string): string {
  const about = copy.tagline ? ` (${copy.tagline})` : "";
  return `Hi! I'm testing ${copy.productName}${about}. It takes 10 seconds: swipe and tell me what you think. ${url}`;
}

export function linkedinText(copy: ShareCopy, url: string): string {
  const about = copy.tagline ? ` ${copy.tagline}.` : "";
  return `I'm testing ${copy.productName} before I build it.${about} I'd value your quick swipe: it takes 10 seconds and no sign-up is needed to look.\n${url}`;
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** LinkedIn's share-offsite takes only a URL; the post text is copied to the clipboard by the page. */
export function linkedinShareUrl(url: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
}
