/**
 * What the sidebar account chip and wallet badge may show (pure).
 * Demo mode: the designed demo user and wallet balance (labelled "Demo data" by the component).
 * Real mode: only the signed-in user's own profile and wallet balance. Anything not loaded is
 * left out, never replaced by a made-up value.
 */
export interface ShellIdentity {
  name: string;
  initials: string;
  /** "Gujarat · Shop owner"; empty when the profile has neither state nor role. */
  detail: string;
  /** Own wallet balance in rupees; undefined until the wallet has loaded (or when it cannot). */
  balanceRs?: number;
  demo: boolean;
}

export interface ProfileLike {
  name?: string;
  role?: string;
  state?: string;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function demoIdentity(chip: { name: string; initials: string; detail: string }, balanceRs: number): ShellIdentity {
  return { name: chip.name, initials: chip.initials, detail: chip.detail, balanceRs, demo: true };
}

/** Null while the profile is loading or unavailable: the chip is then not drawn at all. */
export function realIdentity(profile: ProfileLike | null | undefined, wallet: { balanceRs: number } | null | undefined): ShellIdentity | null {
  const name = profile?.name?.trim();
  if (!name) return null;
  const detail = [profile?.state, profile?.role].filter((x): x is string => Boolean(x)).join(" · ");
  const balance = wallet && Number.isFinite(wallet.balanceRs) ? wallet.balanceRs : undefined;
  return { name, initials: initialsOf(name), detail, balanceRs: balance, demo: false };
}
