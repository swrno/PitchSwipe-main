"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { breadcrumbFor } from "@/shared/lib/nav";
import { cn } from "@/shared/lib/utils";
import { parentOf } from "./back-target";
import { useBreadcrumbItems } from "./breadcrumb";

/** Back button shown left of every page title that has a parent page. */
export function BackButton({ href, label, className }: { href?: string; label?: string; className?: string }) {
  const pathname = usePathname() || "/";
  const registered = useBreadcrumbItems();
  const parent = href ? { href, label: label ?? "Back" } : parentOf(pathname, registered ?? breadcrumbFor(pathname));
  if (!parent?.href) return null;
  return (
    <Link
      href={parent.href}
      aria-label={`Back to ${parent.label}`}
      title={`Back to ${parent.label}`}
      className={cn(
        "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-10",
        className,
      )}
    >
      <ChevronLeft aria-hidden className="size-5" />
    </Link>
  );
}
