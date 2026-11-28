import * as React from "react";
import { UserRound,
  Activity, BarChart3, Briefcase, CheckCircle2, CircleDot, Clock, CreditCard, Eye, Filter, FlaskConical, Globe, Heart, History,
  Home, IndianRupee, Layers, LayoutDashboard, Loader2, Mail, MapPin, Package, Palette, PencilLine, Settings, Share2, Sparkles,
  Split, Target, ThumbsUp, Trophy, UserCheck, UserPlus, Users, Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";

/**
 * ICON SYSTEM (lucide only). One semantic icon per concept, reused everywhere (sidebar, tabs, headers, cards, empty states).
 * Sizes: 16px (size-4) inline and in buttons; 20px (size-5) nav and section titles; 24px (size-6) empty states inside a 48px
 * rounded-xl muted tile (IconTile). strokeWidth 1.75, 2 when active. Colour: muted by default, foreground on hover/active,
 * accent only where the rulebook already uses accent. Always aria-hidden with visible text next to it; icon-only buttons keep
 * aria-label and a tooltip.
 */
export const ICONS = {
  overview: Home,
  products: Package,
  test: FlaskConical,
  tests: FlaskConical,
  swipe: Layers,
  earnings: Wallet,
  wallet: Wallet,
  history: History,
  settings: Settings,
  profile: UserRound,
  appearance: Palette,
  plan: CreditCard,
  newTest: Sparkles,
  results: BarChart3,
  whoSwiped: Users,
  waitlistUsers: UserCheck,
  waitlist: Mail,
  share: Share2,
  dashboard: LayoutDashboard,
  website: Globe,
  leaderboard: Trophy,
  funnel: Filter,
  source: Split,
  location: MapPin,
  target: Target,
  role: Briefcase,
  interests: Heart,
  cofounders: Users,
  preview: Eye,
  swipers: Users,
  saidYes: ThumbsUp,
  joined: UserPlus,
  earnsMost: IndianRupee,
  live: Activity,
  testsLeft: Layers,
  statusLive: CircleDot,
  statusDraft: PencilLine,
  statusDecided: CheckCircle2,
  statusCollecting: Loader2,
  statusSoon: Clock,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;
export type IconSize = "sm" | "md" | "lg";
const SIZE: Record<IconSize, string> = { sm: "size-4", md: "size-5", lg: "size-6" };

/** Decorative icon: pass a lucide component (or a name from ICONS). */
export function Icon({
  icon,
  size = "sm",
  active,
  className,
}: {
  icon: LucideIcon | IconName;
  size?: IconSize;
  active?: boolean;
  className?: string;
}) {
  const C = typeof icon === "string" ? ICONS[icon] : icon;
  return <C aria-hidden className={cn("shrink-0", SIZE[size], className)} strokeWidth={active ? 2 : 1.75} />;
}

/** 48px rounded-xl muted tile with a 24px icon, for empty, error and success states. */
export function IconTile({ icon, className }: { icon: LucideIcon | IconName; className?: string }) {
  return (
    <span aria-hidden className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground", className)}>
      <Icon icon={icon} size="lg" />
    </span>
  );
}

/** Title with a leading 20px muted icon, for card and section titles. */
export function IconLabel({ icon, children, className }: { icon: LucideIcon | IconName; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Icon icon={icon} size="md" className="text-muted-foreground" />
      <span>{children}</span>
    </span>
  );
}
