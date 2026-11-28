import type { DemandCurveData } from "@/features/demand-curve";
import { cn } from "@/shared/lib/utils";

/** "Every price, in numbers": Swipers -> Said yes -> Joined, then rates, revenue and chance. */
export function PriceTable({ data }: { data: DemandCurveData }) {
  const { rows, totals } = data;
  const num = "px-3 py-3.5 text-right tabular-nums";
  const head = "px-3 py-2 text-right font-semibold text-muted-foreground";
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className={cn(head, "text-left")}>Price</th>
            <th scope="col" className={head}>Swipers</th>
            <th scope="col" className={head}>Said yes</th>
            <th scope="col" className={head}>Joined</th>
            <th scope="col" className={head}>Joined %</th>
            <th scope="col" className={head}>Revenue per 100 swipers</th>
            <th scope="col" className={head}>Chance it earns most</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={cn("border-b border-border", r.isBest && "bg-accent-soft font-semibold")}>
              <th scope="row" className="px-3 py-3.5 text-left font-semibold">{r.priceLabel}</th>
              <td className={num}>{r.swipers}</td>
              <td className={num}>{r.saidYes}</td>
              <td className={num}>{r.joined}</td>
              <td className={num}>{r.joinedText}</td>
              <td className={num}>{r.revenueText}</td>
              <td className={num}>{r.chancePct}%</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <th scope="row" className="px-3 py-3.5 text-left">Total</th>
            <td className={num}>{totals.swipers}</td>
            <td className={num}>{totals.saidYes} ({totals.saidYesPct}%)</td>
            <td className={num}>{totals.joined} ({totals.joinedPct}%)</td>
            <td className={num} />
            <td className={num} />
            <td className={num} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
