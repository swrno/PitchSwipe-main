/**
 * Results report (PDF). Pure. Draws the same charts as the Results and Who swiped screens (KPI tiles,
 * funnel, leaderboard, price charts, state tile map, people rows, segment bars) in vector form, in the
 * light-theme colours. Every number comes from the results payload (code-filled, never written by an AI),
 * so it matches the screen. No emails.
 */
import { LIMITS } from "@/shared/lib/limits";
import { LEADS_FOOTNOTE, pct as pctN } from "@/features/results/insights";
import { STATE_TILES, rateBucket } from "@/features/results/state-tiles";
import type { InsightView, LeaderRow, ResultsPayload, SegmentRowView, SegmentView } from "@/features/results/types";

import { ACCENT, ACCENT_SOFT, BORDER, buildPdf, INK, MUTED_INK, pdfSafe, textWidth, TRACK, wrapLines, type PdfBlock, type PdfCanvas, type PdfDocument } from "./pdf";
import { LEADS_NOTE, PRIVACY_NOTE, SEGMENT_TAG, stampLabel, verdictTag } from "./stamp";
import type { ExportDeckData } from "./types";

// Light-theme tokens (src/app/globals.css) and the tints the UI makes with Tailwind opacity.
const WHITE = "#ffffff";
const MUTED_35 = "#c6c6c8"; // muted-foreground / 35
const MUTED_45 = "#b6b5b9"; // muted-foreground / 45
const MUTED_40 = "#bebdc0"; // muted-foreground / 40
const ACCENT_60 = "#89af6d"; // accent / 60
const ACCENT_55 = "#93b679"; // accent / 55
const WARNING = "#c2410c";
const WARNING_SOFT = "#fdeee6";
const BUCKET_FILL = ["#8ee8a8", "#2fcf6b", "#168a3d", "#14532d"] as const;
const BUCKET_INK = ["#14532d", "#0b3d1f", "#ffffff", "#ffffff"] as const;
const LEGEND = ["under 10%", "10 to 14%", "15 to 19%", "20% or more"] as const;

const W = 499.28; // content column

const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`;
const share = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

const draw = (height: number, fn: (c: PdfCanvas, x: number, y: number, w: number) => void): PdfBlock => ({ type: "draw", height, draw: fn });

/** Card shell: white, 1px border, rounded. */
function card(c: PdfCanvas, x: number, y: number, w: number, h: number, borderColor: string = BORDER, bw = 0.75) {
  c.roundRect(x, y, w, h, 8, WHITE, { color: borderColor, width: bw });
}

function pill(c: PdfCanvas, x: number, y: number, label: string, kind: "accent" | "plain" | "warning" | "solid"): number {
  const w = textWidth(pdfSafe(label), 8.5, true) + 16;
  if (kind === "accent") c.roundRect(x, y, w, 16, 5, ACCENT_SOFT);
  else if (kind === "solid") c.roundRect(x, y, w, 16, 5, ACCENT);
  else if (kind === "warning") c.roundRect(x, y, w, 16, 5, WHITE, { color: WARNING, width: 0.75 });
  else c.roundRect(x, y, w, 16, 5, WHITE, { color: BORDER, width: 0.75 });
  c.text(label, x + 8, y + 11.5, 8.5, { bold: true, color: kind === "solid" ? WHITE : kind === "accent" ? ACCENT : kind === "warning" ? WARNING : MUTED_INK });
  return w;
}

/** The one-line takeaway, same wording as the Results screen. */
function takeaway(data: ResultsPayload): string | null {
  const rows = data.leaderboard.everyone.filter((r) => !r.suppressed && r.claimRate !== null);
  const top = rows[0];
  if (!top || data.totals.swipers === 0) return null;
  const next = rows[1];
  const ratio = next && next.claimRate && top.claimRate !== null && top.claimRate > 0 ? ` (${(top.claimRate / next.claimRate).toFixed(1)}x ${next.label})` : "";
  const verb = data.verdict.kind === "decided" ? "won with" : "is leading so far with";
  return `${top.label} ${verb} a ${pct1(top.claimRate ?? 0)} claim rate${ratio}.`;
}

function coverBlock(input: { productName: string; scopeText: string; stamp: string }): PdfBlock {
  return draw(78, (c, x, y, w) => {
    c.roundRect(x, y, w, 70, 10, ACCENT);
    c.text("PITCHSWIPE", x + 18, y + 22, 8.5, { bold: true, color: ACCENT_SOFT });
    c.text("Results report", x + 18, y + 46, 22, { bold: true, color: WHITE });
    c.text(`${input.productName}: ${input.scopeText}`, x + w - 18, y + 30, 10.5, { bold: true, color: WHITE, align: "right", maxWidth: w - 190 });
    c.text(`Numbers as of ${input.stamp}`, x + w - 18, y + 48, 9, { color: ACCENT_SOFT, align: "right" });
  });
}

/** Product + test, date, status; then the verdict pill and takeaway (or the price headline and chance badge). */
function headerBlock(p: ResultsPayload, stamp: string): PdfBlock {
  const d = p.priceCurve;
  const main = d ? d.headline : (takeaway(p) ?? p.verdict.headline);
  const mainSize = d ? 24 : 14;
  const mainLines = wrapLines(main, W, mainSize, true);
  const sub: string[] = [];
  if (!d && takeaway(p)) sub.push(p.verdict.headline);
  if (p.verdict.leaderLabel && p.verdict.chance !== null) sub.push(`${p.verdict.leaderLabel}: ${Math.round(p.verdict.chance * 100)}% chance to beat the control.`);
  if (!p.flagsmithAvailable) sub.push("Flagsmith results were not available when this report was made, so no winner or chance is shown.");
  const lead = d && d.verdict === "lead" && d.leadText ? wrapLines(d.leadText, W - 28, 10) : [];
  const subLines = wrapLines(`${verdictTag(p)}. ${sub.join(" ")}`, W, 9.5);
  const lh = mainSize + 5;
  const height = (d ? 48 : 74) + mainLines.length * lh + (d ? 32 : 0) + subLines.length * 12.5 + 10 + (lead.length ? lead.length * 13 + 40 : 0) + (d?.srmWarning ? 34 : 0) + 6;
  return draw(height, (c, x, y, w) => {
    c.text(p.deck.productName.toUpperCase(), x, y + 9, 8.5, { bold: true, color: MUTED_INK, maxWidth: w - 140 });
    c.text(stamp, x + w, y + 9, 8, { color: MUTED_INK, align: "right" });
    c.text(p.deck.label, x, y + 30, 16, { bold: true, color: INK, maxWidth: w - 120 });
    pill(c, x + w - (textWidth(pdfSafe(p.deck.statusLabel), 8.5, true) + 16), y + 17, p.deck.statusLabel, "accent");
    let yy = y + 48;
    if (!d) {
      pill(c, x, yy, p.verdict.pill, p.verdict.kind === "decided" ? "accent" : "plain");
      yy += 26;
    }
    for (const l of mainLines) {
      c.text(l, x, yy + mainSize * 0.8, mainSize, { bold: true, color: INK });
      yy += lh;
    }
    if (d) {
      c.line(x, yy - 2, x + Math.min(w, textWidth(pdfSafe(mainLines[mainLines.length - 1] ?? ""), mainSize, true)), yy - 2, ACCENT, 3);
      yy += 8;
      pill(c, x, yy, d.chanceBadge, d.verdict === "lead" ? "warning" : "accent");
      yy += 24;
    }
    for (const l of subLines) {
      c.text(l, x, yy + 8, 9.5, { color: MUTED_INK });
      yy += 12.5;
    }
    if (lead.length) {
      yy += 6;
      c.roundRect(x, yy, w, lead.length * 13 + 30, 10, TRACK);
      c.roundRect(x + 14, yy + 10, 78, 14, 7, WARNING_SOFT);
      c.text("LEAD, NOT DECIDED", x + 20, yy + 20, 7, { bold: true, color: WARNING });
      lead.forEach((l, i) => c.text(l, x + 14, yy + 40 + i * 13 - 4, 10, { color: INK }));
      yy += lead.length * 13 + 36;
    }
    if (d?.srmWarning) {
      c.roundRect(x, yy + 4, w, 26, 8, WARNING_SOFT);
      c.text("Swipers were not split evenly across prices (sample ratio mismatch), so this stays a Lead.", x + 12, yy + 20, 9, { bold: true, color: WARNING, maxWidth: w - 24 });
    }
  });
}

// ---- KPI tiles ------------------------------------------------------------------------------

function ringGauge(c: PdfCanvas, cx: number, cy: number, value: number) {
  const k = 42 / 36;
  c.ring(cx, cy, 15.9155 * k, 4 * k, Math.max(0, Math.min(100, value)) / 100, ACCENT, TRACK);
  c.text(`${value}%`, cx, cy + 3.5, 9.5, { bold: true, color: INK, align: "center" });
}

function statTile(c: PdfCanvas, x: number, y: number, w: number, h: number, value: string | number, label: string, opts: { ring?: number; accentTone?: boolean } = {}) {
  card(c, x, y, w, h);
  let tx = x + 14;
  if (opts.ring !== undefined) {
    ringGauge(c, x + 14 + 21, y + h / 2, opts.ring);
    tx = x + 14 + 42 + 12;
  }
  c.text(String(value), tx, y + h / 2 + 2, 20, { bold: true, color: INK, maxWidth: w - (tx - x) - 10 });
  c.text(label, tx, y + h / 2 + 17, 9, { bold: true, color: MUTED_INK, maxWidth: w - (tx - x) - 10 });
}

function sourceTile(c: PdfCanvas, x: number, y: number, w: number, h: number, feed: number, link: number) {
  card(c, x, y, w, h);
  const total = feed + link;
  const feedPct = share(feed, total);
  const linkPct = total ? 100 - feedPct : 0;
  c.text("Where swipers came from", x + 14, y + 20, 10, { bold: true, color: INK });
  const bx = x + 14;
  const bw = w - 28;
  c.roundRect(bx, y + 28, bw, 7, 3.5, TRACK);
  if (feed > 0 && link > 0) {
    const fw = (feedPct / 100) * bw;
    c.roundRect(bx, y + 28, bw, 7, 3.5, MUTED_40);
    c.roundRect(bx, y + 28, fw, 7, 3.5, ACCENT);
    c.rect(bx + Math.max(0, fw - 4), y + 28, 4, 7, ACCENT);
  } else if (feed > 0) c.roundRect(bx, y + 28, bw, 7, 3.5, ACCENT);
  else if (link > 0) c.roundRect(bx, y + 28, bw, 7, 3.5, MUTED_40);
  let lx = bx;
  for (const part of [
    { label: "Feed", n: feed, pct: feedPct, dot: ACCENT },
    { label: "Your link", n: link, pct: linkPct, dot: MUTED_40 },
  ]) {
    c.circle(lx + 3, y + 49, 3, part.dot);
    let tx = lx + 10;
    c.text(part.label, tx, y + 52, 9, { color: MUTED_INK });
    tx += textWidth(part.label, 9) + 5;
    c.text(String(part.n), tx, y + 52, 9, { bold: true, color: INK });
    tx += textWidth(String(part.n), 9, true) + 4;
    c.text(`· ${part.pct}%`, tx, y + 52, 9, { color: MUTED_INK });
    lx = tx + textWidth(`· ${part.pct}%`, 9) + 16;
  }
}

function kpiBlock(p: ResultsPayload): PdfBlock {
  const t = p.totals;
  const d = p.priceCurve;
  return draw(2 * 66 + 8, (c, x, y, w) => {
    const tw = (w - 8) / 2;
    const at = (i: number) => ({ tx: x + (i % 2) * (tw + 8), ty: y + Math.floor(i / 2) * 74 });
    if (d) {
      const tiles: [string | number, string][] = [
        [d.totals.swipers, d.totals.perPriceSwipers ? `Swipers, ${d.totals.perPriceSwipers} per price` : "Swipers"],
        [d.totals.saidYes, `Said yes (${d.totals.saidYesPct}%)`],
        [d.totals.joined, `Joined waitlist (${d.totals.joinedPct}%)`],
        [d.bestTileValue, d.bestTileLabel],
      ];
      tiles.forEach(([v, l], i) => statTile(c, at(i).tx, at(i).ty, tw, 66, v, l));
      return;
    }
    let a = at(0);
    statTile(c, a.tx, a.ty, tw, 66, t.swipers, "Swipers");
    a = at(1);
    statTile(c, a.tx, a.ty, tw, 66, t.saidYes, `Said yes, of ${t.swipers} swipers`, { ring: share(t.saidYes, t.swipers) });
    a = at(2);
    statTile(c, a.tx, a.ty, tw, 66, t.joined, `Joined waitlist, of ${t.swipers} swipers`, { ring: share(t.joined, t.swipers) });
    a = at(3);
    sourceTile(c, a.tx, a.ty, tw, 66, t.feed, t.link);
  });
}

// ---- Funnel ---------------------------------------------------------------------------------

function funnelCard(p: ResultsPayload): PdfBlock {
  const t = p.totals;
  const steps = [
    { label: "Swipers", n: t.swipers, color: MUTED_35 },
    { label: "Said yes", n: t.saidYes, color: ACCENT_60 },
    { label: "Joined waitlist", n: t.joined, color: ACCENT },
  ];
  return draw(40 + steps.length * 38 + 4, (c, x, y, w) => {
    card(c, x, y, w, 40 + steps.length * 38 + 2);
    c.text("From swipe to waitlist", x + 14, y + 24, 13, { bold: true, color: INK });
    const labelW = 80;
    const colW = 96;
    const bx = x + 14 + labelW + 8;
    const bw = w - 28 - labelW - colW - 16;
    steps.forEach((st, i) => {
      const yy = y + 38 + i * 38;
      const pc = share(st.n, t.swipers);
      c.text(st.label, x + 14, yy + 17, 10, { bold: true, color: INK });
      c.roundRect(bx, yy + 5, bw, 18, 4, TRACK);
      const frac = Math.max(pc, st.n > 0 ? 2 : 0) / 100;
      if (frac > 0) c.roundRect(bx, yy + 5, Math.max(4, frac * bw), 18, 4, st.color);
      const cx = bx + bw + 10;
      c.text(String(st.n), cx, yy + 16, 11, { bold: true, color: INK });
      c.text(`· ${pc}%`, cx + textWidth(String(st.n), 11, true) + 4, yy + 16, 10, { color: MUTED_INK });
      const prev = i > 0 ? steps[i - 1].n : 0;
      if (i > 0 && prev > 0) c.text(`-${Math.round(((prev - st.n) / prev) * 100)}% vs step above`, cx, yy + 28, 8.5, { color: MUTED_INK });
    });
  });
}

// ---- Leaderboard ----------------------------------------------------------------------------

function leaderCards(p: ResultsPayload): PdfBlock[] {
  const rows = p.leaderboard.everyone;
  if (rows.length === 0) return [];
  const maxRate = Math.max(0, ...rows.map((r) => r.claimRate ?? 0));
  const axisMax = Math.max(0.2, maxRate * 1.1);
  const leftW = 150;
  const heights = rows.map((r) => 12 + 12 + wrapLines(r.valueText, leftW, 12, true).length * 15 + 26 + 8);
  const rowH = (i: number) => Math.max(heights[i], 78);
  const chunks: number[][] = [];
  for (let i = 0; i < rows.length; i += 2) chunks.push(rows.slice(i, i + 2).map((_, j) => i + j));
  return chunks.map((idx, ci) => {
    const top = ci === 0 ? 44 : 14;
    const height = top + idx.reduce((n, i) => n + rowH(i), 0) + 6;
    return draw(height, (c, x, y, w) => {
      card(c, x, y, w, height - 2);
      if (ci === 0) {
        c.text("Leaderboard", x + 14, y + 26, 13, { bold: true, color: INK });
        c.text("ranked by reward claim rate", x + 14 + textWidth("Leaderboard", 13, true) + 8, y + 26, 9.5, { bold: false, color: MUTED_INK });
      }
      let yy = y + top;
      idx.forEach((i, k) => {
        const r: LeaderRow = rows[i];
        const h = rowH(i);
        if (k > 0 || ci === 0) c.line(x + 1, yy, x + w - 1, yy, BORDER, 0.75);
        c.text(String(r.rank), x + 14, yy + 34, 24, { bold: true, color: MUTED_INK });
        const lx = x + 44;
        c.text(r.label, lx, yy + 20, 9, { bold: true, color: MUTED_INK, maxWidth: leftW });
        let ly = yy + 20;
        for (const l of wrapLines(r.valueText, leftW, 12, true)) {
          ly += 15;
          c.text(l, lx, ly, 12, { bold: true, color: INK });
        }
        ly += 8;
        let bxx = lx;
        if (r.rank === 1 && !r.suppressed) bxx += pill(c, lx, ly, "Leading", "accent") + 8;
        if (r.chanceBest !== null) {
          const num = `${Math.round(r.chanceBest * 100)}%`;
          c.text(num, bxx, ly + 11.5, 9, { bold: true, color: r.rank === 1 ? ACCENT : INK });
          c.text("chance best", bxx + textWidth(num, 9, true) + 3, ly + 11.5, 8.5, { color: MUTED_INK });
        }
        const bx = x + 214;
        const valW = 84;
        const nameW = 62;
        const bw = w - 14 - valW - (bx - x) - nameW - 8;
        if (r.suppressed) {
          c.text(`Too few swipers to show (under ${LIMITS.groupMinSize}).`, bx, yy + h / 2 + 3, 9.5, { color: MUTED_INK });
        } else {
          const line = (ty: number, name: string, frac: number, value: string, strong: boolean) => {
            c.text(name, bx, ty + 8.5, 8.5, { color: MUTED_INK });
            c.roundRect(bx + nameW, ty, bw, 9, 4.5, TRACK);
            const f = Math.max(0, Math.min(1, frac));
            if (f > 0) c.roundRect(bx + nameW, ty, Math.max(9, f * bw), 9, 4.5, strong ? ACCENT : MUTED_45);
            c.text(value, x + w - 14, ty + 8.5, 8.5, { bold: true, color: INK, align: "right" });
          };
          const sw = r.swipers ?? 0;
          line(yy + h / 2 - 16, "Joined waitlist", (r.claimRate ?? 0) / axisMax, r.claimRate === null ? "-" : `${pct1(r.claimRate)} · ${r.joined ?? 0} of ${sw}`, r.rank === 1);
          line(yy + h / 2 + 4, "Said yes", sw ? (r.saidYes ?? 0) / sw : 0, `${share(r.saidYes ?? 0, sw)}% · ${r.saidYes ?? 0} of ${sw}`, false);
        }
        yy += h;
      });
    });
  });
}

// ---- Price charts (same geometry as demand-curve/ui, scaled) ------------------------------------

function chartCard(title: string, caption: string, foot: string, chart: (c: PdfCanvas, x: number, y: number, k: number) => void): PdfBlock {
  const k = 1.2;
  const h = 230 * k;
  const height = 44 + h + 28;
  return draw(height, (c, x, y, w) => {
    card(c, x, y, w, height - 2);
    c.text(title, x + 14, y + 26, 13, { bold: true, color: INK });
    c.text(caption, x + w - 14, y + 26, 9.5, { color: MUTED_INK, align: "right" });
    chart(c, x + (w - 360 * k) / 2, y + 38, k);
    c.text(foot, x + 14, y + height - 14, 9, { color: MUTED_INK });
  });
}

function priceBlocks(p: ResultsPayload): PdfBlock[] {
  const d = p.priceCurve;
  if (!d) return [];
  const { points, ticks, yMax } = d.lineChart;
  const join = chartCard("Who joined at each price", "dot = joined %, bar = likely range", "Dots show the share who joined at each price; bars show the 90% likely range.", (c, ox, oy, k) => {
    const PAD = { left: 40, right: 24, top: 22, bottom: 34 };
    const plotW = 360 - PAD.left - PAD.right;
    const plotH = 230 - PAD.top - PAD.bottom;
    const Y = (v: number) => oy + k * (PAD.top + plotH * (1 - v / yMax));
    const X = (i: number) => ox + k * (PAD.left + (plotW / points.length) * (i + 0.5));
    for (const t of ticks) {
      c.line(ox + k * PAD.left, Y(t), ox + k * (360 - PAD.right), Y(t), BORDER, 0.75);
      c.text(`${Math.round(t * 100)}%`, ox + k * (PAD.left - 8), Y(t) + 3.5, 9, { color: MUTED_INK, align: "right" });
    }
    points.forEach((pt, i) => c.line(X(i), Y(Math.min(pt.high, yMax * 1.12)), X(i), Y(pt.low), MUTED_45, 3 * k * 0.9));
    c.polyline(points.map((pt, i) => [X(i), Y(pt.rate)] as [number, number]), INK, 1.8);
    points.forEach((pt, i) => {
      c.circle(X(i), Y(pt.rate), 5 * k * 0.9, pt.isBest ? ACCENT : INK);
      c.text(pt.text, X(i) + 9, Y(pt.rate) - 8, 10.5, { bold: true, color: INK });
      c.text(pt.label, X(i), oy + k * 220 + 2, 10, { bold: true, color: INK, align: "center" });
    });
  });
  const { bars, yMax: bMax } = d.barChart;
  const rev = chartCard("Revenue per 100 swipers", "per month, if every sign-up pays", "Revenue = price x share who joined x 100.", (c, ox, oy, k) => {
    const PAD = { left: 8, right: 8, top: 34, bottom: 48 };
    const plotW = 360 - PAD.left - PAD.right;
    const plotH = 230 - PAD.top - PAD.bottom;
    const slot = plotW / Math.max(1, bars.length);
    const barW = Math.min(52, slot * 0.58);
    const base = oy + k * (PAD.top + plotH);
    c.line(ox + k * PAD.left, base, ox + k * (360 - PAD.right), base, BORDER, 0.75);
    bars.forEach((b, i) => {
      const cx = ox + k * (PAD.left + slot * (i + 0.5));
      const h = bMax === 0 ? 0 : Math.max(2, (b.value / bMax) * plotH) * k;
      c.roundRect(cx - (barW * k) / 2, base - h, barW * k, h, 4, b.isBest ? ACCENT : BORDER);
      c.text(b.valueText, cx, base - h - 7, 10, { bold: true, color: INK, align: "center" });
      c.text(b.label, cx, base + 15, 10, { bold: true, color: INK, align: "center" });
      c.text(b.subLabel, cx, base + 28, 7.5, { color: MUTED_INK, align: "center" });
    });
  });
  const rows = d.rows.map((r) => [r.priceLabel, String(r.swipers), String(r.saidYes), String(r.joined), r.joinedText, r.revenueText, `${r.chancePct}%`]);
  rows.push(["Total", String(d.totals.swipers), `${d.totals.saidYes} (${d.totals.saidYesPct}%)`, `${d.totals.joined} (${d.totals.joinedPct}%)`, "", "", ""]);
  return [
    join,
    rev,
    { type: "heading", text: "Every price, in numbers" },
    {
      type: "table",
      columns: [
        { header: "Price", weight: 2.2 },
        { header: "Swipers", weight: 1.6, align: "right" },
        { header: "Said yes", weight: 2, align: "right" },
        { header: "Joined", weight: 2, align: "right" },
        { header: "Joined %", weight: 2.2, align: "right" },
        { header: "Revenue per 100 swipers", weight: 3.3, align: "right" },
        { header: "Chance it earns most", weight: 2.8, align: "right" },
      ],
      rows,
      boldLastRow: true,
      highlight: d.rows.flatMap((r, i) => (r.isBest ? [i] : [])),
    },
    { type: "text", text: "Swipers > Said yes > Joined. Ranges are 90% likely.", muted: true, size: 8.5 },
  ];
}

// ---- Who swiped -----------------------------------------------------------------------------

function totalBox(view: SegmentView, line?: string): PdfBlock {
  const text = `${view.overall.swipers} swipers · ${view.overall.saidYes} said yes · ${view.overall.joined} joined (${pctN(view.overall.rate)}%)`;
  const lines = line ? wrapLines(line, W - 28, 8.5) : [];
  return draw(34 + lines.length * 11, (c, x, y, w) => {
    c.roundRect(x, y, w, 28 + lines.length * 11, 8, TRACK);
    c.text("Total", x + 14, y + 18, 10.5, { bold: true, color: INK });
    c.text(text, x + w - 14, y + 18, 10, { bold: true, color: INK, align: "right" });
    lines.forEach((l, i) => c.text(l, x + w - 14, y + 31 + i * 11, 8.5, { color: MUTED_INK, align: "right" }));
  });
}

/** One row per group: label, counts, join rate, and a bar against the dashed overall rate. */
function segmentBars(view: SegmentView, unit?: string): PdfBlock[] {
  const sorted = [...view.rows].sort((a, b) => b.joinRate - a.joinRate);
  const top = sorted.slice(0, 6);
  const rest = sorted.slice(6);
  const sum = (k: "swipers" | "saidYes" | "joined") => rest.reduce((n, r) => n + r[k], 0);
  const other =
    view.otherVisible && view.other
      ? { swipers: view.other.swipers + sum("swipers"), saidYes: view.other.saidYes + sum("saidYes"), joined: view.other.joined + sum("joined") }
      : rest.length
        ? { swipers: sum("swipers"), saidYes: sum("saidYes"), joined: sum("joined") }
        : null;
  const otherRow: SegmentRowView | null =
    other && other.swipers >= LIMITS.groupMinSize ? { key: "__other", label: LIMITS.otherLabel, ...other, joinRate: other.joined / other.swipers, best: false } : null;
  const shown = otherRow ? [...top, otherRow] : top;
  if (view.rows.length === 0) {
    return [{ type: "text", text: `No group has ${LIMITS.groupMinSize} swipers yet${unit ? ` ${unit}` : ""}, so nothing is shown.`, muted: true }];
  }
  const overallLeft = Math.min(1, view.overall.rate / view.axisMax);
  return [
    draw(shown.length * 36 + 24, (c, x, y, w) => {
      shown.forEach((r, i) => {
        const yy = y + i * 36;
        c.text(r.label, x, yy + 11, 11, { bold: true, color: INK, maxWidth: 170 });
        const rest2 = ` · ${r.joined} of ${r.swipers} joined · ${r.saidYes} said yes`;
        const big = `${pctN(r.joinRate)}%`;
        c.text(rest2, x + w, yy + 11, 8.5, { color: MUTED_INK, align: "right" });
        c.text(big, x + w - textWidth(pdfSafe(rest2), 8.5) - 2, yy + 11, 11, { bold: true, color: INK, align: "right" });
        c.roundRect(x, yy + 17, w, 9, 4.5, TRACK);
        const f = Math.min(1, r.joinRate / view.axisMax);
        if (f > 0) c.roundRect(x, yy + 17, Math.max(9, f * w), 9, 4.5, r.best ? ACCENT : MUTED_45);
        c.line(x + overallLeft * w, yy + 14, x + overallLeft * w, yy + 29, "#444444", 1.2, [2.5, 2]);
      });
      const ly = y + shown.length * 36 + 8;
      c.line(x + 2, ly - 5, x + 2, ly + 5, "#444444", 1.2, [2.5, 2]);
      const ov = `Overall: ${view.overall.swipers} swipers · ${view.overall.saidYes} said yes · ${view.overall.joined} joined (${pctN(view.overall.rate)}%)`;
      c.text(ov, x + 10, ly + 3, 8.5, { color: MUTED_INK });
      const bx = x + 10 + textWidth(pdfSafe(ov), 8.5) + 16;
      c.roundRect(bx, ly - 4, 8, 8, 2, ACCENT);
      c.text("Best", bx + 12, ly + 3, 8.5, { color: MUTED_INK });
    }),
  ];
}

function insightBlock(i: InsightView | null): PdfBlock[] {
  if (!i) return [];
  return [{ type: "insight", title: i.title, body: i.body, footnote: i.lead, lead: true, warning: i.warning }];
}

/** The India state tile map, same grid cells, 4-step green scale and grey for hidden states. */
function stateMap(p: ResultsPayload): PdfBlock {
  const tab = p.whoSwiped.location;
  const byState = new Map(tab.tiles.map((t) => [t.state, t]));
  const cols = Math.max(...STATE_TILES.map((t) => t.col)) + 1;
  const rows = Math.max(...STATE_TILES.map((t) => t.row)) + 1;
  const T = 28;
  const G = 3;
  const mapH = rows * T + (rows - 1) * G;
  return draw(mapH + 8, (c, x, y) => {
    for (const t of STATE_TILES) {
      const d = byState.get(t.state);
      const tx = x + t.col * (T + G);
      const ty = y + t.row * (T + G);
      const b = d ? rateBucket(d.joinRate) : 0;
      c.roundRect(tx, ty, T, T, 5, d ? BUCKET_FILL[b] : TRACK);
      if (d?.best) c.roundRect(tx, ty, T, T, 5, null, { color: INK, width: 1.6 });
      const ink = d ? BUCKET_INK[b] : "#8d8c91";
      c.text(t.abbr, tx + T / 2, ty + (d ? 12 : 17), 8, { bold: true, color: ink, align: "center" });
      if (d) c.text(`${pctN(d.joinRate)}%`, tx + T / 2, ty + 22, 7, { bold: true, color: ink, align: "center" });
    }
    const lx = x + cols * (T + G) + 16;
    c.text("Share who joined", lx, y + 10, 9, { bold: true, color: MUTED_INK });
    LEGEND.forEach((l, i) => {
      c.roundRect(lx, y + 20 + i * 17, 10, 10, 2, BUCKET_FILL[i]);
      c.text(l, lx + 16, y + 29 + i * 17, 9, { color: INK });
    });
    c.roundRect(lx, y + 20 + 4 * 17, 10, 10, 2, TRACK);
    c.text(`under ${LIMITS.groupMinSize} swipers`, lx + 16, y + 29 + 4 * 17, 9, { color: MUTED_INK });
  });
}

/** Lucide "user" glyph, 10 of them: `filled` are joined. */
function peopleRow(rate: number): (c: PdfCanvas, x: number, y: number) => void {
  const filled = Math.round(rate * 10);
  return (c, x, y) => {
    for (let i = 0; i < 10; i++) {
      const cx = x + i * 21 + 7;
      const col = i < filled ? ACCENT : TRACK;
      c.circle(cx, y + 4, 3.8, col);
      c.roundRect(cx - 6, y + 10, 12, 8, 4, col);
    }
  };
}

function targetBlocks(p: ResultsPayload): PdfBlock[] {
  const t = p.whoSwiped.target;
  if (!(t.enough && t.target && t.everyone)) return [{ type: "text", text: t.total.text, muted: true }];
  const group = (g: SegmentRowView, title: string, hi: boolean) =>
    draw(86, (c, x, y, w) => {
      card(c, x, y, w, 80, hi ? ACCENT : BORDER, hi ? 1.8 : 0.75);
      c.text(title, x + 14, y + 22, 10.5, { bold: true, color: INK, maxWidth: w - 100 });
      c.text(`${pctN(g.joinRate)}%`, x + w - 14, y + 26, 22, { bold: true, color: hi ? INK : MUTED_INK, align: "right" });
      peopleRow(g.joinRate)(c, x + 14, y + 34);
      c.text(`${g.swipers} swipers · ${g.saidYes} said yes · ${g.joined} joined`, x + 14, y + 70, 9, { color: MUTED_INK });
    });
  return [
    { type: "text", text: "Who joined the waitlist, out of every 10 people:", size: 9.5 },
    group(t.target, `Target users${t.roles.length ? ` (${t.roles.join(", ")})` : ""}`, true),
    group(t.everyone, "Everyone else", false),
    { type: "text", text: t.total.text, muted: true, size: 9 },
  ];
}

function swipeToWaitlist(p: ResultsPayload): PdfBlock[] {
  const v = p.whoSwiped.saidYesVsActed;
  const max = Math.max(v.swipers, 1);
  const rows = [
    { label: "Swiped", n: v.swipers, text: `${v.swipers}`, color: MUTED_35 },
    { label: "Said yes", n: v.saidYes, text: `${v.saidYes} (${v.saidYesPct}%)`, color: ACCENT_55 },
    { label: "Left an email", n: v.joined, text: `${v.joined} (${v.joinedPct}%)`, color: ACCENT },
  ];
  const head = wrapLines(v.headline, W, 10, true);
  const note = wrapLines(v.note, W, 9);
  const top = 18 + head.length * 13 + 6;
  return [
    draw(top + rows.length * 30 + note.length * 12 + 10, (c, x, y, w) => {
      c.text(`From swipe to waitlist`, x, y + 12, 11, { bold: true, color: INK });
      c.text(`All ${v.swipers} swipers`, x + w, y + 12, 9, { color: MUTED_INK, align: "right" });
      head.forEach((l, i) => c.text(l, x, y + 28 + i * 13, 10, { bold: true, color: INK }));
      rows.forEach((r, i) => {
        const yy = y + top + i * 30;
        c.text(r.label, x, yy + 16, 10, { bold: true, color: INK });
        const bx = x + 84;
        const bw = w - 84 - 84;
        c.roundRect(bx, yy + 6, Math.max(6, (r.n / max) * bw), 18, 3, r.color);
        c.text(r.text, x + w, yy + 18, 9.5, { bold: true, color: INK, align: "right" });
      });
      note.forEach((l, i) => c.text(l, x, y + top + rows.length * 30 + 10 + i * 12, 9, { color: MUTED_INK }));
    }),
  ];
}

function whoSwipedBlocks(p: ResultsPayload): PdfBlock[] {
  const w = p.whoSwiped;
  // Each app tab (Results, Who swiped, Waitlist users) starts on its own page, like switching tabs.
  const blocks: PdfBlock[] = [{ type: "pagebreak" }, { type: "heading", text: "Who swiped" }];
  if (!w.hasData) return [...blocks, { type: "text", text: "No counted swipes yet, so there is nobody to show.", muted: true }];
  const loc = w.location;
  blocks.push(
    { type: "heading", text: "Location (state, approximate from IP)" },
    { type: "text", text: "How many people from each state joined the waitlist.", size: 9.5 },
    stateMap(p),
    ...segmentBars(loc, "per state"),
    totalBox(
      loc,
      loc.other
        ? `${loc.shown.swipers} in these ${loc.rows.length} states + ${loc.other.swipers} hidden (under ${LIMITS.groupMinSize} per state) = ${loc.overall.swipers} · ${loc.shown.joined} + ${loc.other.joined} = ${loc.overall.joined} joined`
        : undefined,
    ),
    ...insightBlock(loc.insight),
  );
  if (loc.hiddenNote) blocks.push({ type: "text", text: loc.hiddenNote, muted: true, size: 9 });

  blocks.push({ type: "heading", text: "Target users" }, ...targetBlocks(p), ...swipeToWaitlist(p), ...insightBlock(w.target.insight));

  const s = w.source;
  blocks.push({ type: "heading", text: "Source (swipe feed vs your link)" }, ...segmentBars(s), totalBox(s, s.totalText || undefined));
  if (s.cards.length > 1) {
    const cell = (c: (typeof s.cards)[number]["feed"]) => (c ? `${pctN(c.rate)}% · ${c.swipers} swipers · ${c.saidYes} yes · ${c.joined} joined` : "Other (under 10)");
    blocks.push({
      type: "table",
      columns: [
        { header: `Each ${p.deck.noun}`, weight: 2 },
        { header: "Swipe feed", weight: 4 },
        { header: "Your link", weight: 4 },
      ],
      rows: s.cards.map((c) => [c.label, cell(c.feed), cell(c.link)]),
    });
  }
  blocks.push(...insightBlock(s.insight));

  const i = w.interests;
  blocks.push({ type: "heading", text: "Interests (one person can follow several)" }, ...segmentBars(i, "per interest"), totalBox(i, i.totalText || undefined));
  if (i.tiles.length > 0) {
    const n = Math.ceil(i.tiles.length / 2);
    blocks.push(
      draw(n * 58, (c, x, y, wd) => {
        const tw = (wd - 8) / 2;
        i.tiles.forEach((t, k) => {
          const tx = x + (k % 2) * (tw + 8);
          const ty = y + Math.floor(k / 2) * 58;
          card(c, tx, ty, tw, 52);
          c.text(t.value, tx + 14, ty + 25, 18, { bold: true, color: INK, maxWidth: tw - 28 });
          c.text(t.text, tx + 14, ty + 42, 8.5, { color: MUTED_INK, maxWidth: tw - 28 });
        });
      }),
    );
  }
  blocks.push(...insightBlock(i.insight));
  blocks.push({ type: "text", text: `${SEGMENT_TAG} = ${LEADS_FOOTNOTE}`, muted: true, size: 8.5 });
  return blocks;
}

function waitlistBlock(p: ResultsPayload): PdfBlock {
  const wl = p.waitlist;
  return draw(64, (c, x, y, w) => {
    card(c, x, y, w, 58);
    c.roundRect(x + 12, y + 11, 36, 36, 18, ACCENT);
    c.text(String(wl.count), x + 30, y + 34, 14, { bold: true, color: WHITE, align: "center" });
    c.text(`${wl.count} ${wl.count === 1 ? "person" : "people"} claimed the reward`, x + 62, y + 24, 11, { bold: true, color: INK });
    c.text([wl.reward, wl.acrossText].filter(Boolean).join(" - "), x + 62, y + 40, 8.5, { color: MUTED_INK, maxWidth: w - 76 });
    c.text("Emails are only in the waitlist file.", x + w - 12, y + 24, 8.5, { color: MUTED_INK, align: "right" });
  });
}

function deckBlocks(p: ResultsPayload, stamp: string): PdfBlock[] {
  const empty = p.totals.swipers === 0;
  const blocks: PdfBlock[] = [headerBlock(p, stamp), kpiBlock(p)];
  if (p.priceCurve) blocks.push(...priceBlocks(p));
  else if (!empty) blocks.push(funnelCard(p), ...leaderCards(p));
  else blocks.push({ type: "text", text: "No counted swipes yet. Only swipes from people whose quality score is 70 or more count here.", muted: true });
  blocks.push(...whoSwipedBlocks(p), { type: "pagebreak" }, { type: "heading", text: "Waitlist users" }, waitlistBlock(p));
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
