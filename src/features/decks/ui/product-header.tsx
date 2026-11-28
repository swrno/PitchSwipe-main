"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/shared/ui/button";
import { useBreadcrumb } from "@/shared/shell/breadcrumb";
import { PageHeader } from "@/shared/shell/page-header";
import { isTabActive, type PageTab } from "@/shared/shell/page-tabs";
import type { ProductRecord } from "@/features/decks/views";
import { cn } from "@/shared/lib/utils";
import { api } from "./api";

/** Header of every product page: name, Add deck, and the Overview · Tests · Website · Config tabs. */
export function ProductHeader({ productId }: { productId: string }) {
  const pathname = usePathname();
  const [name, setName] = React.useState<{ id: string; name: string; category: string } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    api<ProductRecord>(`/api/products/${productId}`)
      .then((p) => !cancelled && setName({ id: productId, name: p.name, category: p.category }))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const base = `/products/${productId}`;
  const tabs: PageTab[] = [
    { label: "Overview", href: base, exact: true },
    { label: "Tests", href: `${base}/tests` },
    { label: "Website", href: `${base}/site`, alsoActive: [`${base}/connect`] },
    { label: "Config", href: `${base}/config` },
  ];
  const loaded = name?.id === productId ? name : null;
  const active = tabs.find((t) => isTabActive(pathname, t));
  const crumbs = loaded
    ? [
        { label: "Products", href: "/products" },
        active && active.label !== "Overview" ? { label: loaded.name, href: base } : { label: loaded.name },
        ...(active && active.label !== "Overview" ? [{ label: active.label }] : []),
      ]
    : null;
  useBreadcrumb(crumbs);

  return (
    <PageHeader
      title={loaded?.name ?? <span className="inline-block h-8 w-48 rounded-lg bg-muted align-middle motion-safe:animate-pulse" />}
      description="Test ideas for this product and see which test is winning."
      actions={
        <Link href={`/decks/new?product=${productId}`} className={cn(buttonVariants({ variant: "default" }))}>
          <Plus /> Add test
        </Link>
      }
      tabs={tabs}
      tabsLabel="Product sections"
    />
  );
}
