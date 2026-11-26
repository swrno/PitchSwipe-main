import { Layers, LayoutGrid, User, Wallet, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * The four app destinations, in the order of the phone bottom tab bar
 * (docs/designs/phone/33-swipe-home.jpg): Swipe · Wallet · My decks · Profile.
 * The web sidebar shows the same four plus "New deck" (docs/designs/web/03-my-decks.jpg).
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/swipe", label: "Swipe", icon: Layers },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/decks", label: "My decks", icon: LayoutGrid },
  { href: "/profile", label: "Profile", icon: User },
];

export const NEW_DECK_HREF = "/decks/new";

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
