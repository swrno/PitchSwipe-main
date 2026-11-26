// Builders that turn raw counts into source-table facts. Code does all the arithmetic;
// the display text is produced here so the model never formats a number.

/** 1234 -> "1,234" */
export function formatInt(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 18.309 with 1 decimal -> "18.3%" */
export function formatPercent(value, decimals = 0) {
  return `${value.toFixed(decimals)}%`;
}

/** part / whole as a percentage, 0 when whole is 0. */
export function rate(part, whole) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

/**
 * Facts for one group row: swipers, said yes, joined and join rate.
 * group = { label, swipers, said, joined }; prefix is the key prefix, e.g. "B" or "gujarat".
 */
export function groupFacts(prefix, group, { decimals = 0 } = {}) {
  const pct = Number(rate(group.joined, group.swipers).toFixed(decimals));
  return [
    { key: `${prefix}.swipers`, label: `${group.label} swipers`, value: group.swipers, display: formatInt(group.swipers) },
    { key: `${prefix}.said`, label: `${group.label} said yes`, value: group.said, display: formatInt(group.said) },
    { key: `${prefix}.joined`, label: `${group.label} joined waitlist`, value: group.joined, display: formatInt(group.joined) },
    { key: `${prefix}.joinRate`, label: `${group.label} join rate`, value: pct, display: formatPercent(pct, decimals) },
  ];
}

/** A plain count fact, e.g. comments or decks. */
export function countFact(key, label, value, unitWord) {
  return { key, label, value, display: `${formatInt(value)} ${unitWord}`.trim() };
}

/** A Flagsmith chance fact, e.g. 96 -> "96%". */
export function chanceFact(key, label, chancePct) {
  return { key, label, value: chancePct, display: formatPercent(chancePct, 0) };
}
