import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function DemoBadge({ className, children = "Demo data" }: { className?: string; children?: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-dashed border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
