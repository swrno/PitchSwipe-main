import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { PageTabs, type PageTab } from "./page-tabs";

/**
 * Header every signed-in page starts with: title, one-line muted description, at most one primary and one
 * secondary action on the right, then optional tabs. The top bar is the only breadcrumb.
 */
export function PageHeader({
  title,
  description,
  actions,
  tabs,
  tabsLabel,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: readonly PageTab[];
  tabsLabel?: string;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 space-y-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground md:text-base">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {tabs && tabs.length > 0 ? <PageTabs tabs={tabs} label={tabsLabel} /> : null}
    </header>
  );
}
