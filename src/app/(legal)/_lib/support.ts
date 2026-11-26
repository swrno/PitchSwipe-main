/**
 * Support / grievance contact (contract C7). The address comes only from NEXT_PUBLIC_SUPPORT_EMAIL; when it is
 * unset or not a plausible address, pages say it will be published before launch. Never invent one.
 */
export function supportEmail(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  if (!raw) return null;
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(raw) ? raw : null;
}

export const SUPPORT_EMAIL_PENDING = "The contact address will be published before launch.";
