import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { Card } from "./card";

/**
 * Loading placeholders that match the final layout (docs/ux-principles.md, Doherty threshold). `Skeleton` is one
 * decorative block; composites below mirror PageHeader, Card, KPI tiles, list rows and tables so nothing jumps
 * when the real content arrives. Wrap a whole loading region in `SkeletonRegion`.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div aria-hidden className={cn("skeleton rounded-md", className)} {...props} />;
}

/** Announces one loading region to assistive tech (role=status + sr-only text); children are decorative. */
export function SkeletonRegion({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label={`Loading ${label}`} className={className}>
      <span className="sr-only">Loading {label}…</span>
      {children}
    </div>
  );
}

const LINE_WIDTHS = ["w-full", "w-11/12", "w-3/4", "w-5/6", "w-2/3"];

/** Text lines at body height (`text-sm` leading), widths varied and the last line short. */
export function SkeletonText({ lines = 3, className, lineClassName }: { lines?: number; className?: string; lineClassName?: string }) {
  return (
    <div aria-hidden className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 && lines > 1 ? "w-1/2" : LINE_WIDTHS[i % LINE_WIDTHS.length], lineClassName)} />
      ))}
    </div>
  );
}

/** Same box as PageHeader: optional back button, 40px icon tile, title, description, optional actions and tabs. */
export function SkeletonPageHeader({
  back = false,
  icon = true,
  description = true,
  actions = 0,
  tabs = 0,
  className,
}: {
  back?: boolean;
  icon?: boolean;
  description?: boolean;
  actions?: number;
  tabs?: number;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("mb-6 space-y-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-start gap-3">
          {back ? <Skeleton className="size-9 shrink-0 rounded-lg" /> : null}
          {icon ? <Skeleton className="mt-0.5 hidden size-10 shrink-0 rounded-lg sm:block" /> : null}
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-8 w-48 rounded-lg md:h-9 md:w-64" />
            {description ? <Skeleton className="h-4 w-64 max-w-full md:h-5 md:w-80" /> : null}
          </div>
        </div>
        {actions > 0 ? (
          <div className="flex items-center gap-2">
            {Array.from({ length: actions }, (_, i) => <Skeleton key={i} className="h-10 w-28 rounded-lg" />)}
          </div>
        ) : null}
      </div>
      {tabs > 0 ? (
        <div className="flex gap-6 border-b border-border pb-3">
          {Array.from({ length: tabs }, (_, i) => <Skeleton key={i} className="h-5 w-16" />)}
        </div>
      ) : null}
    </div>
  );
}

/** Card shell (same radius/border as Card) with an optional title row, then content. */
export function SkeletonCard({
  title = true,
  children,
  className,
  bodyClassName,
}: {
  title?: boolean;
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card aria-hidden className={className}>
      {title ? (
        <div className="flex items-center justify-between gap-3 p-5 pb-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-14" />
        </div>
      ) : null}
      <div className={cn("p-5", title && "pt-2", bodyClassName)}>{children ?? <SkeletonText lines={3} />}</div>
    </Card>
  );
}

/** n KPI tiles in the same grid as the KPI rows (2 columns on phones, n from md). */
export function SkeletonKpiRow({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("grid grid-cols-2 gap-3", count >= 4 ? "md:grid-cols-4" : count === 3 ? "md:grid-cols-3" : "md:grid-cols-2", className)}
    >
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="space-y-3 p-4">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-8 w-16" />
        </Card>
      ))}
    </div>
  );
}

/** Rows with a leading avatar/tile, two text lines and right-aligned numbers. Borderless; put it inside a card or divide. */
export function SkeletonList({
  rows = 4,
  avatar = "tile",
  trailing = true,
  className,
}: {
  rows?: number;
  avatar?: "tile" | "round" | "none";
  trailing?: boolean;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("divide-y divide-border", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          {avatar !== "none" ? <Skeleton className={cn("size-10 shrink-0", avatar === "round" ? "rounded-full" : "rounded-lg")} /> : null}
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className={cn("h-4", i % 2 ? "w-2/5" : "w-1/2")} />
            <Skeleton className={cn("h-3", i % 2 ? "w-1/4" : "w-1/3")} />
          </div>
          {trailing ? (
            <div className="flex shrink-0 flex-col items-end gap-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-3 w-8" />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Header row plus body rows, in a card. */
export function SkeletonTable({ rows = 5, columns = 4, className }: { rows?: number; columns?: number; className?: string }) {
  return (
    <Card aria-hidden className={cn("overflow-hidden", className)}>
      <div className="flex gap-4 border-b border-border bg-muted/40 px-4 py-3">
        {Array.from({ length: columns }, (_, c) => <Skeleton key={c} className={cn("h-3.5", c === 0 ? "w-1/4" : "w-16")} />)}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: columns }, (_, c) => <Skeleton key={c} className={cn("h-4", c === 0 ? "w-1/4" : "w-16")} />)}
          </div>
        ))}
      </div>
    </Card>
  );
}
