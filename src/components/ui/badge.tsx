import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Pill chips and status labels. */
export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors duration-150",
  {
    variants: {
      variant: {
        outline: "border-border bg-transparent text-muted-foreground",
        selected: "border-highlight bg-highlight text-highlight-foreground",
        accent: "border-transparent bg-accent-soft text-accent",
        warning: "border-transparent bg-warning-soft text-warning",
        muted: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "outline",
    },
  },
);

export type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
