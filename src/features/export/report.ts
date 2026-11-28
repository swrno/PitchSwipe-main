/**
 * Results report (PDF). Pure. Winner and chance each version is best, Swipers > Said yes >
 * Joined waitlist per version, who swiped, and the insights. Every number comes from the
 * WP7 payload (code-filled, never written by an AI), so it matches the screen. No emails.
 */
import { LIMITS } from "@/shared/lib/limits";
import { LEADS_FOOTNOTE } from "@/features/results/insights";
import type { InsightView, ResultsPayload, SegmentView } from "@/features/results/types";

import { ACCENT, ACCENT_SOFT, BORDER, buildPdf, INK, MUTED_INK, pdfSafe, textWidth, TRACK, wrapLines, type PdfBlock, type PdfCanvas, type PdfDocument } from "./pdf";
import { LEADS_NOTE, PRIVACY_NOTE, SEGMENT_TAG, stampLabel, verdictTag, versionTag } from "./stamp";
import type { ExportDeckData } from "./types";

const pct = (x: number | null): string => (x === null ? "-" : `${Math.round(x * 100)}%`);

const NEUTRAL = "#b9b6ad";
const NEUTRAL_DARK = "#8a8891";
const ACCENT_MID = "#8fbd62";
const CARD = "#f6f5f1";
const CONTENT_COL = 499;

/** A vector block: `height` tall, drawn by `fn` inside the content column. */
const draw = (height: number, fn: (c: PdfCanvas, x: number, y: number, w: number) => void): PdfBlock => ({ type: "draw", height, draw: fn });

/** Rounded track with a filled part. `frac` is 0 to 1 of the track. */
function bar(c: PdfCanvas, x: number, y: number, w: number, h: number, frac: number, color: string) {
  c.roundRect(x, y, w, h, h / 2, TRACK);
  const fw = Math.max(0, Math.min(1, frac)) * w;
  if (fw > 0) c.roundRect(x, y, Math.max(fw, h), h, h / 2, color);
}

function pill(c: PdfCanvas, x: number, y: number, label: string, fill: string, color: string, align: "left" | "right" = "left"): number {
  const w = textWidth(pdfSafe(label), 8.5, true) + 16;
  const px = align === "right" ? x - w : x;
  c.roundRect(px, y, w, 17, 8.5, fill);
  c.text(label, px + 8, y + 12, 8.5, { bold: true, color });
  return w;
}

function cardBox(c: PdfCanvas, x: number, y: number, w: number, h: number) {
  c.roundRect(x, y, w, h, 8, CARD, { color: BORDER, width: 0.75 });
}

function coverBlock(input: { productName: string; scopeText: string; stamp: string }): PdfBlock {
  return draw(78, (c, x, y, w) => {
    c.roundRect(x, y, w, 70, 10, ACCENT);
    c.text("PITCHSWIPE", x + 18, y + 22, 8.5, { bold: true, color: ACCENT_SOFT });
    c.text("Results report", x + 18, y + 46, 22, { bold: true, color: "#ffffff" });
    c.text(`${input.productName}: ${input.scopeText}`, x + w - 18, y + 30, 10.5, { bold: true, color: "#ffffff", align: "right", maxWidth: w - 190 });
    c.text(`Numbers as of ${input.stamp}`, x + w - 18, y + 48, 9, { color: ACCENT_SOFT, align: "right" });
  });
}

function headerBlock(p: ResultsPayload, stamp: string): PdfBlock {
  const headLines = wrapLines(p.verdict.headline, CONTENT_COL - 8, 15, true);
  const sub =
    `${p.verdict.pill}. Tag: ${verdictTag(p)}.` +
    (p.verdict.leaderLabel && p.verdict.chance !== null ? ` ${p.verdict.leaderLabel}: ${Math.round(p.verdict.chance * 100)}% chance to beat the control.` : "");
  const subLines = wrapLines(sub, CONTENT_COL - 8, 9.5);
  const height = 62 + headLines.length * 19 + subLines.length * 13 + (p.flagsmithAvailable ? 0 : 16);
  return draw(height, (c, x, y, w) => {
    c.text(p.deck.productName.toUpperCase(), x, y + 10, 8.5, { bold: true, color: MUTED_INK, maxWidth: w - 120 });
    c.text(p.deck.label, x, y + 34, 22, { bold: true, color: INK, maxWidth: w - 120 });
    pill(c, x + w, y + 16, p.deck.statusLabel, ACCENT_SOFT, ACCENT, "right");
    c.text(stamp, x + w, y + 10, 8, { color: MUTED_INK, align: "right" });
    let yy = y + 62;
    for (const l of headLines) {
      c.text(l, x, yy, 15, { bold: true, color: INK });
      yy += 19;
    }
    for (const l of subLines) {
      c.text(l, x, yy - 2, 9.5, { color: MUTED_INK });
      yy += 13;
    }
    if (!p.flagsmithAvailable) {
      c.text("Flagsmith results were not available when this report was made, so no winner or chance is shown.", x, yy - 2, 8.5, { color: MUTED_INK });
    }
  });
}

function kpiBlock(p: ResultsPayload): PdfBlock {
  const t = p.totals;
  return draw(142, (c, x, y, w) => {
    const gap = 10;
    const tw = (w - gap * 2) / 3;
    const tile = (i: number) => {
      const tx = x + i * (tw + gap);
      cardBox(c, tx, y, tw, 96);
      return tx;
    };
    const tx = tile(0);
    c.text("SWIPERS", tx + 14, y + 22, 8.5, { bold: true, color: MUTED_INK });
    c.text(String(t.swipers), tx + 14, y + 64, 32, { bold: true, color: INK });
    c.text("people who swiped", tx + 14, y + 82, 8.5, { color: MUTED_INK });
    const ringTile = (i: number, label: string, count: number, percent: number, caption: string) => {
      const rx = tile(i);
      c.text(label, rx + 14, y + 22, 8.5, { bold: true, color: MUTED_INK });
      const cx = rx + 40;
      const cy = y + 62;
      c.ring(cx, cy, 24, 7, percent / 100, ACCENT, TRACK);
      c.text(`${percent}%`, cx, cy + 4.5, 12, { bold: true, color: INK, align: "center" });
      c.text(String(count), rx + 80, cy + 2, 22, { bold: true, color: INK });
      c.text(caption, rx + 80, cy + 18, 8.5, { color: MUTED_INK });
    };
    ringTile(1, "SAID YES", t.saidYes, t.saidYesPct, "of swipers");
    ringTile(2, "JOINED WAITLIST", t.joined, t.joinedPct, "of swipers");
    // Source split: one stacked bar, values written on it.
    const sy = y + 108;
    c.text("SOURCE", x, sy + 14, 8.5, { bold: true, color: MUTED_INK });
    const total = t.feed + t.link;
    const bx = x + 70;
    const bw = w - 70;
    c.roundRect(bx, sy, bw, 20, 10, TRACK);
    if (total > 0) {
      const fw = Math.min(bw, Math.max((t.feed / total) * bw, t.feed > 0 ? 20 : 0));
      if (t.link > 0) c.roundRect(bx, sy, bw, 20, 10, ACCENT_MID);
      if (t.feed > 0) c.roundRect(bx, sy, fw, 20, 10, ACCENT);
      if (t.feed > 0 && t.link > 0) c.rect(bx + fw - 10, sy, 10, 20, ACCENT);
    }
    if (t.feed > 0) c.text(`Feed ${t.feed}`, bx + 12, sy + 14, 9, { bold: true, color: "#ffffff" });
    else c.text("Feed 0", bx + 12, sy + 14, 9, { bold: true, color: MUTED_INK });
    c.text(`Your link ${t.link}`, bx + bw - 12, sy + 14, 9, { bold: true, color: INK, align: "right" });
  });
}

function funnelBlock(p: ResultsPayload): PdfBlock {
  const t = p.totals;
  const steps = [
    { label: "Swipers", count: t.swipers, note: "everyone", color: NEUTRAL },
    { label: "Said yes", count: t.saidYes, note: `${t.saidYesPct}% of swipers`, color: ACCENT_MID },
    { label: "Joined waitlist", count: t.joined, note: `${t.joinedPct}% of swipers`, color: ACCENT },
  ];
  return draw(steps.length * 36 + 4, (c, x, y, w) => {
    const labelW = 96;
    const barX = x + labelW;
    const barW = w - labelW - 150;
    steps.forEach((s, i) => {
      const yy = y + i * 36;
      c.text(s.label, x, yy + 19, 10, { bold: true, color: INK });
      c.roundRect(barX, yy + 4, barW, 22, 5, TRACK);
      const fw = t.swipers > 0 ? (s.count / t.swipers) * barW : 0;
      if (fw > 0) c.roundRect(barX, yy + 4, Math.max(fw, 6), 22, 5, s.color);
      c.text(String(s.count), barX + barW + 12, yy + 14, 11, { bold: true, color: INK });
      c.text(s.note, barX + barW + 12, yy + 26, 8.5, { color: MUTED_INK });
      if (i > 0) c.text(`-${steps[i - 1].count - s.count} dropped`, x + w, yy + 14, 8.5, { color: MUTED_INK, align: "right" });
    });
  });
}

function leaderBlocks(p: ResultsPayload): PdfBlock[] {
  const rows = p.leaderboard.everyone;
  const maxRate = Math.max(0.0001, ...rows.map((r) => r.claimRate ?? 0));
  const maxYes = Math.max(1, ...rows.map((r) => r.saidYes ?? 0));
  const badge = p.verdict.kind === "decided" ? "Winner" : p.verdict.kind === "leading" ? "Leading" : null;
  return rows.map((r) =>
    draw(66, (c, x, y, w) => {
      const lead = p.verdict.leaderKey === r.key;
      cardBox(c, x, y, w, 60);
      if (lead) c.roundRect(x, y, 4, 60, 2, ACCENT);
      const lx = x + 14;
      c.text(r.label, lx, y + 18, 11, { bold: true, color: INK, maxWidth: 140 });
      if (lead && badge) pill(c, lx + Math.min(140, textWidth(pdfSafe(r.label), 11, true)) + 8, y + 6, badge, ACCENT, "#ffffff");
      c.text(r.valueText, lx, y + 32, 8.5, { color: MUTED_INK, maxWidth: 190 });
      if (r.chanceBest !== null) c.text(`${pct(r.chanceBest)} chance best`, lx, y + 48, 8.5, { bold: true, color: lead ? ACCENT : MUTED_INK });
      const bx = x + 215;
      const bw = w - 215 - 100;
      const line = (yy: number, name: string, frac: number, value: string, color: string) => {
        c.text(name, bx, yy + 8, 8, { color: MUTED_INK });
        bar(c, bx + 54, yy, bw - 54, 10, frac, color);
        c.text(value, bx + bw + 8, yy + 9, 9, { bold: true, color: INK });
      };
      if (r.suppressed || r.claimRate === null) {
        c.text("Under 10 swipers: numbers hidden", bx, y + 34, 9, { color: MUTED_INK });
      } else {
        line(y + 14, "Claim rate", r.claimRate / maxRate, pct(r.claimRate), lead ? ACCENT : NEUTRAL_DARK);
        line(y + 34, "Said yes", (r.saidYes ?? 0) / maxYes, String(r.saidYes ?? 0), lead ? ACCENT_MID : NEUTRAL);
        c.text(`${r.joined ?? 0} joined of ${r.swipers ?? 0} swipers`, bx + 54, y + 54, 8, { color: MUTED_INK });
      }
      const tag = versionTag(p, r.key);
      if (tag) c.text(tag, x + w - 12, y + 18, 8.5, { bold: true, color: ACCENT, align: "right" });
    }),
  );
}

function priceBlocks(p: ResultsPayload): PdfBlock[] {
  const d = p.priceCurve;
  if (!d) return [];
  const pts = d.lineChart.points;
  const bars = d.barChart.bars;
  const maxV = Math.max(d.barChart.yMax, 1);
  return [
    { type: "heading", text: "Who joined at each price" },
    draw(pts.length * 30 + 30, (c, x, y, w) => {
      const lx = x + 80;
      const aw = w - 80 - 120;
      const max = Math.max(d.lineChart.yMax, 0.01);
      for (const tk of d.lineChart.ticks) {
        const tx = lx + (tk / max) * aw;
        c.line(tx, y, tx, y + pts.length * 30, BORDER, 0.5);
        c.text(`${Math.round(tk * 100)}%`, tx, y + pts.length * 30 + 14, 8, { color: MUTED_INK, align: "center" });
      }
      pts.forEach((pt, i) => {
        const yy = y + i * 30 + 15;
        c.text(pt.label, x, yy + 3.5, 10, { bold: pt.isBest, color: INK, maxWidth: 76 });
        const x1 = lx + (pt.low / max) * aw;
        const x2 = lx + (pt.high / max) * aw;
        c.roundRect(x1, yy - 3, Math.max(x2 - x1, 6), 6, 3, pt.isBest ? ACCENT_MID : NEUTRAL);
        c.circle(lx + (pt.rate / max) * aw, yy, 6, pt.isBest ? ACCENT : NEUTRAL_DARK);
        c.text(d.rows.find((r) => r.key === pt.key)?.joinedText ?? pt.text, x + w, yy + 3.5, 9.5, { bold: pt.isBest, color: INK, align: "right" });
      });
    }),
    { type: "heading", text: "Revenue per 100 swipers" },
    draw(bars.length * 34 + 4, (c, x, y, w) => {
      const lx = x + 80;
      const aw = w - 80 - 120;
      bars.forEach((b, i) => {
        const yy = y + i * 34;
        c.text(b.label, x, yy + 18, 10, { bold: b.isBest, color: INK, maxWidth: 76 });
        bar(c, lx, yy + 6, aw, 18, b.value / maxV, b.isBest ? ACCENT : NEUTRAL_DARK);
        c.text(b.valueText, lx + aw + 10, yy + 16, 10, { bold: true, color: INK });
        c.text(b.subLabel, lx + aw + 10, yy + 27, 8, { color: MUTED_INK, maxWidth: 110 });
      });
    }),
    { type: "text", text: d.headline, bold: true, size: 10 },
  ];
}

interface BarRow {
  label: string;
  swipers: number;
  joined: number;
  rate: number;
  best: boolean;
}

/** Horizontal bars, one per group: join rate on the bar, "joined of swipers" written beside it. */
function barsBlock(title: string, rows: BarRow[], axisMax: number, footnote?: string): PdfBlock {
  const axis = Math.max(axisMax, ...rows.map((r) => r.rate), 0.01);
  return draw(24 + rows.length * 24 + (footnote ? 14 : 0), (c, x, y, w) => {
    c.text(title, x, y + 12, 10, { bold: true, color: INK });
    const lx = x + 120;
    const aw = w - 120 - 140;
    rows.forEach((r, i) => {
      const yy = y + 22 + i * 24;
      c.text(r.label, x, yy + 12, 9.5, { color: INK, maxWidth: 112 });
      bar(c, lx, yy + 3, aw, 12, r.rate / axis, r.best ? ACCENT : NEUTRAL_DARK);
      c.text(`${pct(r.rate)} joined`, lx + aw + 10, yy + 13, 9.5, { bold: true, color: INK });
      c.text(`${r.joined} of ${r.swipers}`, x + w, yy + 13, 8.5, { color: MUTED_INK, align: "right" });
    });
    if (footnote) c.text(footnote, x, y + 22 + rows.length * 24 + 8, 8.5, { color: MUTED_INK });
  });
}

function segmentBlock(title: string, view: SegmentView): PdfBlock[] {
  const rows: BarRow[] = view.rows.slice(0, 6).map((r) => ({ label: r.label, swipers: r.swipers, joined: r.joined, rate: r.joinRate, best: r.best }));
  if (view.other && view.otherVisible) {
    const o = view.other;
    rows.push({ label: LIMITS.otherLabel, swipers: o.swipers, joined: o.joined, rate: o.swipers ? o.joined / o.swipers : 0, best: false });
  }
  if (rows.length === 0) return [{ type: "text", text: `${title}: not enough swipers to show a group yet.`, muted: true }];
  const hidden = view.other && !view.otherVisible ? `${LIMITS.otherLabel}: hidden, groups under ${LIMITS.groupMinSize} swipers.` : undefined;
  return [barsBlock(title, rows, view.axisMax, hidden)];
}

function insightBlock(i: InsightView | null): PdfBlock[] {
  if (!i) return [];
  return [{ type: "insight", title: i.title, body: i.body, footnote: i.lead, lead: true }];
}

function waitlistBlock(p: ResultsPayload): PdfBlock {
  const wl = p.waitlist;
  return draw(64, (c, x, y, w) => {
    cardBox(c, x, y, w, 58);
    c.roundRect(x + 12, y + 11, 36, 36, 18, ACCENT);
    c.text(String(wl.count), x + 30, y + 34, 14, { bold: true, color: "#ffffff", align: "center" });
    c.text(`${wl.count} ${wl.count === 1 ? "person" : "people"} claimed the reward`, x + 62, y + 24, 11, { bold: true, color: INK });
    const sub = [wl.reward, wl.acrossText].filter(Boolean).join(" - ");
    c.text(sub, x + 62, y + 40, 8.5, { color: MUTED_INK, maxWidth: w - 76 });
    c.text("Emails are only in the waitlist file.", x + w - 12, y + 24, 8.5, { color: MUTED_INK, align: "right" });
  });
}

function deckBlocks(p: ResultsPayload, stamp: string): PdfBlock[] {
  const w = p.whoSwiped;
  const blocks: PdfBlock[] = [
    headerBlock(p, stamp),
    kpiBlock(p),
    { type: "heading", text: "Funnel" },
    funnelBlock(p),
    { type: "text", text: `${w.saidYesVsActed.headline} ${w.saidYesVsActed.note}`, size: 9.5, muted: true },
    { type: "heading", text: "Leaderboard" },
    ...leaderBlocks(p),
    ...priceBlocks(p),
    { type: "heading", text: "Waitlist" },
    waitlistBlock(p),
    { type: "heading", text: "Who swiped" },
  ];
  if (!w.hasData) {
    blocks.push({ type: "text", text: "No counted swipes yet.", muted: true });
    return blocks;
  }
  blocks.push(...segmentBlock("Location (approximate state)", w.location));
  blocks.push(...segmentBlock("Source", w.source));
  blocks.push(...segmentBlock("Interests (one person can follow several)", w.interests));
  const t = w.target;
  if (t.enough && t.target && t.everyone) {
    blocks.push(barsBlock("Target users", [t.target, t.everyone].map((r, i) => ({ label: r.label, swipers: r.swipers, joined: r.joined, rate: r.joinRate, best: i === 0 })), 0));
  } else {
    blocks.push({ type: "text", text: `Target users: ${t.total.text}`, muted: true });
  }
  const insights = [w.location.insight, w.target.insight, w.source.insight, w.interests.insight];
  if (insights.some(Boolean)) {
    blocks.push({ type: "heading", text: "Insights" });
    for (const i of insights) blocks.push(...insightBlock(i));
    blocks.push({ type: "text", text: `${SEGMENT_TAG} = ${LEADS_FOOTNOTE}`, muted: true, size: 8.5 });
  }
  return blocks;
}

export function reportDocument(input: { productName: string; scopeText: string; decks: readonly ExportDeckData[]; now: Date }): PdfDocument {
  const stamp = stampLabel(input.now);
  const blocks: PdfBlock[] = [
    coverBlock({ productName: input.productName, scopeText: input.scopeText, stamp }),
    { type: "text", text: LEADS_NOTE, size: 9 },
    { type: "text", text: PRIVACY_NOTE, size: 9 },
    { type: "spacer", height: 12 },
  ];
  if (input.decks.length > 1) {
    blocks.push(
      { type: "heading", text: "Tests in this report" },
      {
        type: "table",
        columns: [
          { header: "Test", weight: 3 },
          { header: "Status", weight: 2 },
          { header: "Swipers", weight: 1.2, align: "right" },
          { header: "Joined", weight: 1.2, align: "right" },
          { header: "Tag", weight: 3 },
        ],
        rows: input.decks.map(({ payload: p }) => [p.deck.label, p.deck.statusLabel, String(p.totals.swipers), String(p.totals.joined), verdictTag(p)]),
      },
    );
  }
  input.decks.forEach(({ payload }, i) => {
    if (i > 0 || input.decks.length > 1) blocks.push({ type: "pagebreak" });
    blocks.push(...deckBlocks(payload, stamp));
  });
  blocks.push(
    { type: "spacer", height: 10 },
    { type: "text", text: "Source: counted swipes recorded by PitchSwipe. Chance each version is best comes from Flagsmith. Every number is filled by code from this data.", muted: true, size: 8.5 },
  );
  return {
    title: `PitchSwipe results report: ${input.productName}`,
    footer: `PitchSwipe results report. Numbers as of ${stamp}.`,
    created: input.now,
    blocks,
  };
}

export function reportPdf(input: { productName: string; scopeText: string; decks: readonly ExportDeckData[]; now: Date }): Buffer {
  return buildPdf(reportDocument(input));
}
