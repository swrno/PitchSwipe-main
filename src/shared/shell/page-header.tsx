import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { BackButton } from "./back-button";
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
  back = true,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: readonly PageTab[];
  tabsLabel?: string;
  /** Back button left of the title (default: to the parent page from the breadcrumb; none on top-level pages). */
  back?: boolean | { href: string; label?: string };
  className?: string;
}) {
  return (
    <header className={cn("mb-6 space-y-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-start gap-3">
          {back ? <BackButton {...(typeof back === "object" ? back : {})} /> : null}
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
            {description ? <p className="mt-1 text-sm text-muted-foreground md:text-base">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {tabs && tabs.length > 0 ? <PageTabs tabs={tabs} label={tabsLabel} /> : null}
    </header>
  );
}
