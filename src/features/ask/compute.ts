/**
 * `compute`: a small fixed set of operations (no eval, no expression parsing) so the model never does maths in its
 * head. Every result comes back as a FACT with its exact display text; the model states it through {fact.key}.
 */
import type { SourceFact } from "@/shared/lib/ai";

export const COMPUTE_OPS = ["difference", "ratio", "percent_change", "percent_of", "sum", "average", "compare_rates", "days_between"] as const;
export type ComputeOp = (typeof COMPUTE_OPS)[number];

export interface ComputeArgs {
  op: ComputeOp;
  values?: number[];
  /** compare_rates: successes and totals of two versions. */
  a?: { label?: string; count: number; total: number };
  b?: { label?: string; count: number; total: number };
  from?: string;
  to?: string;
}

const MAX_VALUES = 50;
const fmt = (n: number, digits = 1): string => {
  const r = Number(n.toFixed(digits));
  return r.toLocaleString("en-US", { maximumFractionDigits: digits });
};
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

function nums(values: unknown, min: number, max = MAX_VALUES): number[] {
  if (!Array.isArray(values) || values.length < min || values.length > max || !values.every(finite)) {
    throw new Error(`Give ${min === max ? min : `${min} or more`} numbers in "values".`);
  }
  return values;
}

function day(value: unknown): number {
  const t = typeof value === "string" ? Date.parse(value) : NaN;
  if (!Number.isFinite(t)) throw new Error('Dates must look like "2026-11-28".');
  return Math.floor(t / 86_400_000);
}

const rateOf = (x: { count: number; total: number } | undefined, name: string): number => {
  if (!x || !finite(x.count) || !finite(x.total) || x.total <= 0 || x.count < 0 || x.count > x.total) throw new Error(`"${name}" needs count <= total and total > 0.`);
  return x.count / x.total;
};

export function runCompute(args: ComputeArgs, ref: string): { summary: string; facts: SourceFact[]; result: Record<string, unknown> } {
  const fact = (key: string, label: string, value: number, display: string): SourceFact => ({ key: `${ref}.${key}`, label, value, display });
  switch (args.op) {
    case "difference": {
      const [a, b] = nums(args.values, 2, 2);
      return done("Difference", [fact("value", "Difference (first minus second)", a - b, fmt(a - b))]);
    }
    case "ratio": {
      const [a, b] = nums(args.values, 2, 2);
      if (b === 0) throw new Error("Cannot divide by zero.");
      return done("Ratio", [fact("value", "Ratio (first / second)", a / b, fmt(a / b, 2))]);
    }
    case "percent_change": {
      const [from, to] = nums(args.values, 2, 2);
      if (from === 0) throw new Error("Cannot take a percent change from zero.");
      const p = ((to - from) / Math.abs(from)) * 100;
      return done("Percent change", [fact("value", "Percent change", p, `${fmt(p)}%`)]);
    }
    case "percent_of": {
      const [part, whole] = nums(args.values, 2, 2);
      if (whole === 0) throw new Error("Cannot divide by zero.");
      const p = (part / whole) * 100;
      return done("Percent of", [fact("value", "Percent (first of second)", p, `${fmt(p)}%`)]);
    }
    case "sum": {
      const v = nums(args.values, 1);
      const s = v.reduce((n, x) => n + x, 0);
      return done("Sum", [fact("value", "Sum", s, fmt(s))]);
    }
    case "average": {
      const v = nums(args.values, 1);
      const s = v.reduce((n, x) => n + x, 0) / v.length;
      return done("Average", [fact("value", "Average", s, fmt(s, 2))]);
    }
    case "compare_rates": {
      const ra = rateOf(args.a, "a");
      const rb = rateOf(args.b, "b");
      const la = args.a?.label?.slice(0, 30) || "A";
      const lb = args.b?.label?.slice(0, 30) || "B";
      const gap = (ra - rb) * 100;
      return done(`Compare ${la} and ${lb}`, [
        fact("a_rate", `${la} rate`, ra * 100, `${fmt(ra * 100)}%`),
        fact("b_rate", `${lb} rate`, rb * 100, `${fmt(rb * 100)}%`),
        fact("gap_points", `Gap (${la} minus ${lb}, in points)`, gap, fmt(gap)),
      ]);
    }
    case "days_between": {
      const d = day(args.to) - day(args.from);
      return done("Days between", [fact("days", "Days between", d, fmt(d, 0))]);
    }
    default:
      throw new Error(`Unknown operation. Use one of: ${COMPUTE_OPS.join(", ")}.`);
  }

  function done(summary: string, facts: SourceFact[]) {
    return { summary, facts, result: { op: args.op, values: Object.fromEntries(facts.map((f) => [f.key, f.display])) } };
  }
}
