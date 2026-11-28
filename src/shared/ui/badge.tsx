import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

/** The one status pill: neutral by default, accent only for good news, warning for cautions, coming for unfinished features. */
export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap transition-colors duration-150",
  {
    variants: {
      variant: {
        outline: "border-border bg-transparent text-muted-foreground",
        coming: "border-dashed border-border bg-transparent text-muted-foreground",
        selected: "border-accent bg-accent text-accent-foreground",
        accent: "border-accent/30 bg-accent-soft text-accent",
        warning: "border-warning/30 bg-warning-soft text-warning",
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
