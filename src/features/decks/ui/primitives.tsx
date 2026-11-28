import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { BrandMark } from "@/shared/shell/brand-mark";
import type { Accent } from "@/features/decks/product";
import type { StatusTone } from "@/features/decks/status";
import { haptic } from "@/shared/lib/feel/haptics";
import { cn } from "@/shared/lib/utils";

const ACCENT_BG: Record<Accent, string> = {
  green: "bg-muted",
  blue: "bg-muted",
  purple: "bg-muted",
};

/** Product tile: coloured square with the product's initial (designs: V green, Q blue). */
export function ProductTile({ icon, accent, className }: { icon: string; accent: Accent; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl text-xl font-extrabold text-foreground",
        ACCENT_BG[accent],
        className ?? "size-12",
      )}
    >
      {icon}
    </span>
  );
}

const TONE_CLASS: Record<StatusTone, string> = {
  won: "text-accent",
  leading: "text-muted-foreground",
  live: "text-muted-foreground",
  ready: "text-accent",
  draft: "text-muted-foreground",
  finished: "text-muted-foreground",
};

export function StatusText({ tone, children, className }: { tone: StatusTone; children: React.ReactNode; className?: string }) {
  return <span className={cn("text-sm font-bold", TONE_CLASS[tone], className)}>{children}</span>;
}

/**
 * Phone: back button and logo in one row (designs phone 04 to 13), replacing the shell's brand bar.
 * Web: nothing; the top bar is the only breadcrumb. Shared by the founder sub-pages.
 */
export function SubPageNav({ backHref, right }: { backHref: string; right?: React.ReactNode }) {
  return (
    <div data-hide-brand-bar className="mb-3 flex items-center justify-between gap-3 md:hidden">
      <div className="flex items-center gap-3">
        <Link
          href={backHref}
          aria-label="Back"
          className="flex size-10 items-center justify-center rounded-full border border-border bg-background"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <BrandMark className="size-8" />
      </div>
      <div className="text-sm font-medium text-muted-foreground">{right}</div>
    </div>
  );
}

/** Pill toggle chip. Selected = near-black fill (designs). */
export function ToggleChip({
  selected,
  onClick,
  children,
  disabled,
  className,
}: {
  selected: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => {
        if (!selected) haptic("select");
        onClick?.();
      }}
      className={cn(
        "pressable rounded-full border px-4 py-2 text-sm font-semibold transition-[color,background-color,border-color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}

export { Segmented } from "./segmented";

export function TextInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-xl border border-border bg-background px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  );
}

export function TextArea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  );
}

export function FieldLabel({ htmlFor, children, hint }: { htmlFor?: string; children: React.ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-bold">
      {children}
      {hint ? <span className="ml-1.5 font-normal text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-sm font-medium text-destructive">
      {message}
    </p>
  );
}

export function Notice({ tone = "muted", children }: { tone?: "muted" | "error" | "ok"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl px-4 py-3 text-sm",
        tone === "muted" && "bg-muted text-muted-foreground",
        tone === "error" && "bg-warning-soft text-warning",
        tone === "ok" && "bg-accent-soft text-accent",
      )}
    >
      {children}
    </div>
  );
}

/** "Step 2 of 3" with a thin progress bar (goal-gradient). */
export function StepProgress({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">
        Step {step} of {total} · {label}
      </p>
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step}
        aria-label={`Step ${step} of ${total}`}
        className="mt-1.5 h-1 rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-accent motion-safe:transition-[width] motion-safe:duration-300"
          style={{ width: `${(step / total) * 100}%` }}
        />
      </div>
    </div>
  );
}
