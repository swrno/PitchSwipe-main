/** Swiper-side READ tools: the signed-in user's own wallet and answer history (server only). Payouts are not live. */
import type { SourceFact } from "@/shared/lib/ai";
import { userKey } from "@/features/swipe/identity";
import type { Actor, AccountOutput } from "./account";
import type { KpiRowCard, PageLinkCard } from "../types";

const int = (n: number) => n.toLocaleString("en-US");
const rs = (n: number) => `Rs ${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const fact = (key: string, label: string, value: number, display: string): SourceFact => ({ key, label, value, display });

async function swiperProfile(ownerId: string) {
  const [{ connectDb }, { User }] = await Promise.all([import("@/shared/lib/db"), import("@/models")]);
  await connectDb();
  const u = (await User.findById(ownerId).select("email counting qualityScore").lean()) as { email?: string; counting?: boolean; qualityScore?: number } | null;
  return { email: u?.email, counting: u?.counting !== false, qualityScore: typeof u?.qualityScore === "number" && u.qualityScore > 0 ? u.qualityScore : undefined };
}

export async function getWalletTool(_args: Record<string, unknown>, actor: Actor, ref: string): Promise<AccountOutput> {
  const [{ claimsDeps }, { walletFor }] = await Promise.all([import("@/features/claims/server/server"), import("@/features/claims/server/service")]);
  const profile = await swiperProfile(actor.ownerId);
  const w = await walletFor(await claimsDeps(), userKey(actor.ownerId), { counting: profile.counting, qualityScore: profile.qualityScore });
  const facts = [
    fact(`${ref}.balance`, "Balance", w.balanceRs, rs(w.balanceRs)),
    fact(`${ref}.week`, "Earned this week", w.weeklyRs, rs(w.weeklyRs)),
    fact(`${ref}.today`, "Earned today", w.todayRs, rs(w.todayRs)),
    fact(`${ref}.week_swipes`, "Valid swipes this week", w.weeklyValidSwipes, int(w.weeklyValidSwipes)),
  ];
  const card: KpiRowCard = { kind: "kpiRow", items: [{ label: "Balance", value: rs(w.balanceRs) }, { label: "This week", value: rs(w.weeklyRs) }, { label: "Today", value: rs(w.todayRs) }] };
  return {
    summary: "Checked your earnings",
    call: "get_wallet()",
    result: { payouts: "Payouts are coming soon: withdrawing is not available yet.", recent: w.entries.slice(0, 5).map((e) => ({ title: e.title, detail: e.detail })) },
    facts,
    card,
  };
}

export async function getHistoryTool(_args: Record<string, unknown>, actor: Actor, ref: string): Promise<AccountOutput> {
  const [{ claimsDeps }, { historyFor }] = await Promise.all([import("@/features/claims/server/server"), import("@/features/claims/server/service")]);
  const profile = await swiperProfile(actor.ownerId);
  const page = await historyFor(await claimsDeps(), userKey(actor.ownerId), { before: null, email: profile.email });
  const items = page.items.slice(0, 10);
  const facts: SourceFact[] = [fact(`${ref}.count`, "Recent answers shown", items.length, int(items.length))];
  items.forEach((it, i) => facts.push(fact(`${ref}.a${i + 1}.earned`, `${it.product}: earned`, it.earnedRs, rs(it.earnedRs))));
  const card: PageLinkCard = { kind: "pageLink", title: "Your history", description: "All your past swipes and earnings", href: "/history" };
  return {
    summary: "Looked at your history",
    call: "get_history()",
    result: { more: page.nextCursor !== null, payouts: "Payouts are coming soon.", answers: items.map((it, i) => ({ product: it.product, variable: it.variable, answer: it.answer, paid: it.paid, claimed: it.claimed, answeredAt: it.answeredAt, factKey: `${ref}.a${i + 1}` })) },
    facts,
    card,
  };
}
