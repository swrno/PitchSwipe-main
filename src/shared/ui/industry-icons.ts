import {
  Baby, Banknote, Dumbbell, Gamepad2, GraduationCap, HeartPulse, Home, Plane, PawPrint, Shirt, ShoppingBag, Sparkles, Sprout, Truck,
  Utensils, Code2, type LucideIcon,
} from "lucide-react";
import type { Industry } from "@/shared/lib/lists";

/** One icon per industry (lists.ts), shown in the swipe home category chips. */
export const INDUSTRY_ICONS: Record<Industry, LucideIcon> = {
  Retail: ShoppingBag,
  Finance: Banknote,
  Food: Utensils,
  Healthcare: HeartPulse,
  Logistics: Truck,
  Travel: Plane,
  Education: GraduationCap,
  Fashion: Shirt,
  "Real estate": Home,
  Agriculture: Sprout,
  SaaS: Code2,
  Gaming: Gamepad2,
  Fitness: Dumbbell,
  Beauty: Sparkles,
  Pets: PawPrint,
  Kids: Baby,
};
