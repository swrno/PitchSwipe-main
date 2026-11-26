// Result vs Lead tagging (spec 05 §6.5 rules 3, 4, 7 and §6.3 "finished decks only").

export const THRESHOLDS = Object.freeze({
  minChancePct: 95, // Flagsmith chance to be best
  minIdentitiesPerCard: 50, // Flagsmith minimum per variation
  minGroupSize: 10, // groups under this are hidden / "Other"
  maxLeadsPerPage: 2,
});

export const TAGS = Object.freeze({
  RESULT: 'Result',
  LEAD: 'Lead',
  LEADING: 'Leading',
  INCONCLUSIVE: 'Inconclusive',
  SIMULATED: 'Simulated',
});

export const TAG_LABELS = Object.freeze({
  Result: 'Result',
  Lead: 'Lead · confirm with a test',
  Leading: 'Leading, not decided',
  Inconclusive: 'Too close to call',
  Simulated: 'Simulated · Unproven',
});

const FINISHED = new Set(['decided', 'shipped', 'closed']);

/**
 * Classify one experiment.
 *   exp = { source: 'flagsmith'|'persona', status, srmWarning, cards: [{ id, chancePct, identities }] }
 * - persona predictions are always Simulated and never counted (§6.2, §6.5 rule 7)
 * - a running test is Leading, never a Result (§6.3)
 * - a finished test is a Result only with 95%+ best, 50+ identities per card and no SRM warning (§6.5 rule 3)
 */
export function classifyExperiment(exp, t = THRESHOLDS) {
  if (exp?.source === 'persona') {
    return { tag: TAGS.SIMULATED, counted: false, reasons: ['AI persona predictions are never counted'] };
  }
  const cards = exp?.cards ?? [];
  if (cards.length < 2) {
    return { tag: TAGS.INCONCLUSIVE, counted: false, reasons: ['needs at least two cards'] };
  }
  const best = cards.reduce((a, b) => (b.chancePct > a.chancePct ? b : a));
  const reasons = [];
  if (best.chancePct < t.minChancePct) reasons.push(`best chance is under ${t.minChancePct}%`);
  for (const c of cards) {
    if (c.identities < t.minIdentitiesPerCard) reasons.push(`card ${c.id} has under ${t.minIdentitiesPerCard} identities`);
  }
  if (exp.srmWarning) reasons.push('sample-ratio warning is showing');

  if (!FINISHED.has(exp.status)) {
    return { tag: TAGS.LEADING, counted: false, leaderId: best.id, reasons: ['test is still running'] };
  }
  if (reasons.length > 0) {
    return { tag: TAGS.INCONCLUSIVE, counted: false, reasons };
  }
  return { tag: TAGS.RESULT, counted: true, winnerId: best.id, reasons: [] };
}

/**
 * Classify one segment group (state, source, interest, target users).
 * Segments are always Leads (§6.5 rule 4), and only from groups of 10 or more.
 */
export function classifySegment(group, t = THRESHOLDS) {
  if (!(group.swipers >= t.minGroupSize)) {
    return { tag: null, shown: false, reasons: [`under ${t.minGroupSize} swipers`] };
  }
  return { tag: TAGS.LEAD, shown: true, groupSize: group.swipers, reasons: [] };
}

/**
 * Split segment groups into shown Leads and one "Other" row that adds up the hidden groups.
 * groups: [{ key, label, swipers, said, joined }]
 */
export function groupSegments(groups, t = THRESHOLDS) {
  const leads = [];
  const other = { key: 'other', label: 'Other', swipers: 0, said: 0, joined: 0 };
  let hasOther = false;
  for (const g of groups) {
    const c = classifySegment(g, t);
    if (c.shown) leads.push({ group: g, classification: c });
    else {
      hasOther = true;
      other.swipers += g.swipers;
      other.said += g.said;
      other.joined += g.joined;
    }
  }
  return { leads, other: hasOther ? other : null };
}

/**
 * Persona track record: how often the AI prediction matched the real winner,
 * counted only over finished real decks. decks: [{ finished, predictedId, winnerId }]
 */
export function personaTrackRecord(decks) {
  const finished = (decks ?? []).filter((d) => d.finished && d.winnerId);
  const right = finished.filter((d) => d.predictedId === d.winnerId).length;
  return { right, total: finished.length, label: 'Unproven' };
}
