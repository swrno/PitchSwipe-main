import * as React from "react";
import { Loader2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

/** shadcn/ui-style button, written by hand (no CLI). Pills, heavy labels. `ink` is the black pill for colour blocks. */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-bold transition-[color,background-color,border-color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        accent: "bg-accent text-accent-foreground hover:bg-accent/90",
        ink: "bg-ink text-ink-foreground hover:bg-ink/85",
        lime: "bg-lime text-ink hover:bg-lime/90",
        outline: "border-2 border-border bg-transparent text-foreground hover:bg-muted hover:border-foreground/30",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "text-foreground hover:bg-muted",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
      },
      size: {
        default: "h-12 px-6",
        sm: "h-11 px-4 md:h-9",
        lg: "h-14 px-8 text-base",
        icon: "size-11 md:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Shows a spinner and blocks clicks while an action is in flight (Doherty: feedback under 100 ms). */
    loading?: boolean;
  };

/**
 * Hierarchy: one primary per screen (default / accent), secondary = outline, tertiary = ghost.
 * Touch height is at least 44px on phones.
 */
export function Button({ className, variant, size, type = "button", loading = false, disabled, children, ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" /> : null}
      {children}
    </button>
  );
}
