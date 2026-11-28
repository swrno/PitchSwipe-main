import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names, letting later classes win. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Rupee amount as shown in the designs, e.g. 6.25 -> "Rs 6.25". */
export function formatRs(amount: number): string {
  return `Rs ${amount.toFixed(2)}`;
}
