"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useBreadcrumb } from "@/shared/shell/breadcrumb";
import { PageHeader } from "@/shared/shell/page-header";
import { isTabActive, type PageTab } from "@/shared/shell/page-tabs";
import type { ProductRecord } from "@/features/decks/views";
import { api } from "./api";
import { Skeleton } from "@/shared/ui/skeleton";

/** Header of every product page: name and the Overview · Tests · Website · Settings tabs (Add test lives on the Tests tab). */
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
    { icon: "dashboard", label: "Overview", href: base, exact: true },
    { icon: "tests", label: "Tests", href: `${base}/tests` },
    { icon: "website", label: "Website", href: `${base}/site`, alsoActive: [`${base}/connect`] },
    { icon: "settings", label: "Settings", href: `${base}/config` },
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
      icon="products"
      title={loaded?.name ?? <Skeleton className="inline-block h-8 w-48 rounded-lg align-middle md:h-9" />}
      description="Test ideas for this product and see which test is winning."
      tabs={tabs}
      tabsLabel="Product sections"
    />
  );
}
