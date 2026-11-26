/**
 * Image sources on a deck (logo, product screenshots) are data: URLs only. Never an http(s) URL
 * (it would make every swiper's browser call a third-party host and hand over their IP) and never
 * SVG (it can carry script). Pure and dependency-free, so the server validator and the rendering
 * components share it.
 */

/** Largest decoded image, in bytes (the upload UI enforces the same number). */
export const MAX_IMAGE_BYTES = 450_000;

const DATA_URL = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

const startsWith = (bytes: Uint8Array, sig: readonly number[], at = 0) => sig.every((b, i) => bytes[at + i] === b);

function magicMatches(kind: string, bytes: Uint8Array): boolean {
  if (kind === "png") return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (kind === "jpeg") return startsWith(bytes, [0xff, 0xd8, 0xff]);
  // WebP: "RIFF" size "WEBP"
  return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8);
}

/** Null when `value` is an acceptable image data URL, else a short reason for the founder. */
export function imageDataUrlError(value: unknown, maxBytes: number = MAX_IMAGE_BYTES): string | null {
  if (typeof value !== "string" || !value.trim()) return "Image is missing.";
  if (value.length > Math.ceil((maxBytes * 4) / 3) + 64) return "Image is too large.";
  const m = DATA_URL.exec(value);
  if (!m) return "Use an uploaded PNG, JPG or WebP image. Links and SVG are not allowed.";
  const b64 = m[2];
  if (b64.length % 4 !== 0) return "That image is not valid.";
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  if ((b64.length / 4) * 3 - pad > maxBytes) return "Image is too large.";
  let head: Uint8Array;
  try {
    const bin = atob(b64.slice(0, 16));
    head = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return "That image is not valid.";
  }
  if (!magicMatches(m[1], head)) return "That file is not really a PNG, JPG or WebP image.";
  return null;
}

/**
 * Same-origin demo fixture images only: `/demo/<name>.png|jpg|webp`. A single path segment of safe
 * characters, so no `//host`, no `..`, no query or fragment, never SVG. Rendering only: the server
 * validator (`imageDataUrlError`) still rejects these, so founders cannot save them.
 */
const DEMO_PATH = /^\/demo\/[A-Za-z0-9][A-Za-z0-9_-]{0,63}\.(png|jpe?g|webp)$/;

/**
 * For rendering: the src when it is a safe image data URL or a same-origin `/demo/` fixture file, else
 * undefined (stored legacy values such as http(s) or SVG are not rendered). Cheap check, no size or
 * magic-byte decoding.
 */
export function safeImageSrc(src: unknown): string | undefined {
  if (typeof src !== "string") return undefined;
  return DATA_URL.test(src) || DEMO_PATH.test(src) ? src : undefined;
}
