/**
 * Swiper quality score (spec 04 §5.9): four plain rules, no model.
 * Pure functions only, so they are unit tested and shared by the API and any later feed check.
 */

export type Answer = "yes" | "no";

/** One practice swipe. `expected` is set only for check cards (the answer the card instructs). */
export interface ScoredSwipe {
  cardId: string;
  answer: Answer;
  dwellMs: number;
  expected?: Answer;
}

/** Exact thresholds. The spec fixes the 2 s rule, the 70 line and the 30/20 card counts; the rest are chosen here. */
export const QUALITY = {
  minReadMs: 2000,
  countingScore: 70,
  practiceCards: 30,
  recheckCards: 20,
  /** Spec: 3 check cards in practice; the 20-card re-check carries 2. */
  checkCards: { initial: 3, recheck: 2 },
  repeatCards: { initial: 3, recheck: 2 },
  /** Straight-lining: >= 10 normal swipes and either >= 90% one answer or a run of >= 60% of them. */
  straightMinSwipes: 10,
  straightShare: 0.9,
  straightRunShare: 0.6,
  /** Points lost when a rule fails completely (100 = all swipes fast, all repeats differ, ...). */
  penalty: { fast: 100, repeat: 40, check: 50, straight: 40 },
} as const;

export interface QualityMetrics {
  total: number;
  fastCount: number;
  /** Share of swipes read for 2 s or more, 0-100, whole number. */
  readPct: number;
  repeats: { total: number; differing: number; samePct: number | null };
  checks: { total: number; missed: number };
  straight: { flagged: boolean; analysed: number; majorityShare: number; longestRun: number };
}

export interface QualityResult {
  score: number;
  counting: boolean;
  reasons: string[];
  metrics: QualityMetrics;
}

export function isCounting(score: number): boolean {
  return score >= QUALITY.countingScore;
}

const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100));

export function analyseStraightLining(answers: readonly Answer[]): QualityMetrics["straight"] {
  const analysed = answers.length;
  let yes = 0;
  let longestRun = 0;
  let run = 0;
  answers.forEach((a, i) => {
    if (a === "yes") yes += 1;
    run = i > 0 && answers[i - 1] === a ? run + 1 : 1;
    longestRun = Math.max(longestRun, run);
  });
  const majorityShare = analysed === 0 ? 0 : Math.max(yes, analysed - yes) / analysed;
  const flagged =
    analysed >= QUALITY.straightMinSwipes &&
    (majorityShare >= QUALITY.straightShare || longestRun >= QUALITY.straightRunShare * analysed);
  return { flagged, analysed, majorityShare, longestRun };
}

export function computeMetrics(swipes: readonly ScoredSwipe[]): QualityMetrics {
  const total = swipes.length;
  const fastCount = swipes.filter((s) => s.dwellMs < QUALITY.minReadMs).length;

  const checkSwipes = swipes.filter((s) => s.expected !== undefined);
  const missed = checkSwipes.filter((s) => s.answer !== s.expected).length;

  // Repeat cards: a normal card answered again later must get the same answer as its first showing.
  const firstAnswer = new Map<string, Answer>();
  let repeatTotal = 0;
  let differing = 0;
  const normal = swipes.filter((s) => s.expected === undefined);
  const firsts: Answer[] = [];
  for (const s of normal) {
    const first = firstAnswer.get(s.cardId);
    if (first === undefined) {
      firstAnswer.set(s.cardId, s.answer);
      // Straight-lining looks at first showings of normal cards only (check cards force an answer).
      firsts.push(s.answer);
    } else {
      repeatTotal += 1;
      if (first !== s.answer) differing += 1;
    }
  }

  return {
    total,
    fastCount,
    readPct: pct(total - fastCount, total),
    repeats: {
      total: repeatTotal,
      differing,
      samePct: repeatTotal === 0 ? null : pct(repeatTotal - differing, repeatTotal),
    },
    checks: { total: checkSwipes.length, missed },
    straight: analyseStraightLining(firsts),
  };
}

export function scoreMetrics(m: QualityMetrics): number {
  if (m.total === 0) return 0;
  const p = QUALITY.penalty;
  let lost = p.fast * (m.fastCount / m.total);
  if (m.repeats.total > 0) lost += p.repeat * (m.repeats.differing / m.repeats.total);
  if (m.checks.total > 0) lost += p.check * (m.checks.missed / m.checks.total);
  if (m.straight.flagged) lost += p.straight;
  return Math.min(100, Math.max(0, Math.round(100 - lost)));
}

export function reasonsFor(m: QualityMetrics): string[] {
  const out: string[] = [];
  if (m.fastCount > 0) out.push(`Too fast: under 2 seconds, ${m.fastCount} of ${m.total} cards`);
  if (m.repeats.differing > 0) {
    out.push(`Different answers on a repeated card: ${m.repeats.differing} of ${m.repeats.total}`);
  }
  if (m.checks.missed > 0) out.push(`Check cards missed: ${m.checks.missed} of ${m.checks.total}`);
  if (m.straight.flagged) out.push("Always the same answer");
  return out;
}

export function evaluateSwipes(swipes: readonly ScoredSwipe[]): QualityResult {
  const metrics = computeMetrics(swipes);
  const score = scoreMetrics(metrics);
  return { score, counting: isCounting(score), reasons: reasonsFor(metrics), metrics };
}
