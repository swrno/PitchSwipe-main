import { PageHeader } from "@/shared/shell/page-header";
import { Badge } from "@/shared/ui/badge";

/** Earnings: the wallet (payouts coming soon). History is its own page. */
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
        description="What you earn for swiping. Payouts are coming soon." />
      {children}
    </div>
  );
}
