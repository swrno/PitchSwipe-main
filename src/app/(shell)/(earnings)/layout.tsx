import { PageHeader } from "@/shared/shell/page-header";

const TABS = [
  { label: "Wallet", href: "/wallet" },
  { label: "History", href: "/history" },
] as const;

/** Earnings: Wallet and History share one header with tabs. */
export default function EarningsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div>
      <PageHeader title="Earnings" description="What you earn for swiping, and what you have answered." tabs={TABS} tabsLabel="Earnings sections" />
      {children}
    </div>
  );
}
