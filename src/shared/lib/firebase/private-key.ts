/**
 * The service-account private key as Firebase Admin needs it (real newlines).
 *
 * A .env file with the key in double quotes already turns `\n` into newlines, but hosted env vars (Vercel, CI
 * secrets) keep the two characters backslash + n. Accept both, plus a key pasted with surrounding quotes.
 */
export function normalizePrivateKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let key = raw.trim();
  if (key.length >= 2 && ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'")))) {
    key = key.slice(1, -1);
  }
  key = key
    .replace(/\\r\\n|\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim();
  return key || undefined;
}
