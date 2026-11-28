import { PageHeader } from "@/shared/shell/page-header";
import { Badge } from "@/shared/ui/badge";

const TABS = [
  { icon: "wallet", label: "Wallet", href: "/wallet" },
  { icon: "history", label: "History", href: "/history" },
] as const;

/** Earnings: Wallet and History share one header with tabs. */
export default function EarningsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div>
      <PageHeader
        icon="earnings"
        title={
          <span className="inline-flex items-center gap-2">
            Earnings <Badge variant="coming">Coming soon</Badge>
          </span>
        }
        description="What you earn for swiping and what you have answered. Payouts are coming soon." tabs={TABS} tabsLabel="Earnings sections" />
      {children}
    </div>
  );
}
