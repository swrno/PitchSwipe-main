/**
 * Results report (PDF). Pure. Draws the same charts as the Results and Audience & who swiped screens (KPI tiles,
 * funnel, leaderboard, price charts, state tile map, people rows, segment bars) in vector form, in the
 * light-theme colours. Every number comes from the results payload (code-filled, never written by an AI),
 * so it matches the screen. No emails.
 */
import { LIMITS } from "@/shared/lib/limits";
import { LEADS_FOOTNOTE, pct as pctN } from "@/features/results/insights";
import { STATE_TILES, rateBucket } from "@/features/results/state-tiles";
import type { InsightView, LeaderRow, ResultsPayload, SegmentRowView, SegmentView } from "@/features/results/types";

import { buildPdf, pdfSafe, T, textWidth, wrapLines, type PdfBlock, type PdfCanvas, type PdfDocument } from "./pdf";
import { LEADS_NOTE, PRIVACY_NOTE, SEGMENT_TAG, stampLabel, verdictTag } from "./stamp";
import type { PdfTheme } from "./pdf";
import type { ExportDeckData } from "./types";

// Light-theme tokens (src/app/globals.css) and the tints the UI makes with Tailwind opacity.
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
function card(c: PdfCanvas, x: number, y: number, w: number, h: number, borderColor: string = T.border, bw = 0.75) {
  c.roundRect(x, y, w, h, 8, T.card, { color: borderColor, width: bw });
}

function pill(c: PdfCanvas, x: number, y: number, label: string, kind: "accent" | "plain" | "warning" | "solid"): number {
  const w = mw(label, 8.5, true) + 16;
  if (kind === "accent") c.roundRect(x, y, w, 16, 5, T.accentSoft);
  else if (kind === "solid") c.roundRect(x, y, w, 16, 5, T.accent);
  else if (kind === "warning") c.roundRect(x, y, w, 16, 5, T.card, { color: WARNING, width: 0.75 });
  else c.roundRect(x, y, w, 16, 5, T.card, { color: T.border, width: 0.75 });
  c.text(label, x + 8, y + 11.5, 8.5, { bold: true, color: kind === "solid" ? T.onAccent : kind === "accent" ? T.accent : kind === "warning" ? WARNING : T.mutedInk });
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
  return draw(24, (c, x, y, w) => {
    c.roundRect(x, y, w, 22, 6, T.accent);
    c.text("PITCHSWIPE  ·  Results report", x + 12, y + 15, 9.5, { bold: true, color: T.onAccent });
    c.text(`${input.productName}: ${input.scopeText}  ·  ${input.stamp}`, x + w - 12, y + 15, 8.5, { color: T.accentSoft, align: "right", maxWidth: w - 200 });
  });
}

/** A tab page title: small "product · test" line, big bold title, thin accent underline; optional status pill on the right. */
function titleBlock(small: string, title: string, status?: string): PdfBlock {
  return draw(52, (c, x, y, w) => {
    c.text(small.toUpperCase(), x, y + 9, 8.5, { bold: true, color: T.mutedInk, maxWidth: w - 100 });
    c.text(title, x, y + 32, 22, { bold: true, color: T.ink, maxWidth: w - 110 });
    c.line(x, y + 39, x + Math.min(w - 110, textWidth(pdfSafe(title), 22, true)), y + 39, T.accent, 1.5);
    if (status) pill(c, x + w - (mw(status, 8.5, true) + 16), y + 14, status, "accent");
  });
}

/** Product + test, status; then the verdict pill and takeaway (or the price headline and chance badge). */
function headerBlock(p: ResultsPayload): PdfBlock {
  const d = p.priceCurve;
  const main = d ? d.headline : (takeaway(p) ?? p.verdict.headline);
  const mainSize = d ? 22 : 13;
  const mainLines = wrapLines(main, W, mainSize, true);
  const sub: string[] = [];
  if (!d && takeaway(p)) sub.push(p.verdict.headline);
  if (p.verdict.leaderLabel && p.verdict.chance !== null) sub.push(`${p.verdict.leaderLabel}: ${Math.round(p.verdict.chance * 100)}% chance to beat the control.`);
  if (!p.flagsmithAvailable) sub.push("Flagsmith results were not available when this report was made, so no winner or chance is shown.");
  const lead = d && d.verdict === "lead" && d.leadText ? wrapLines(d.leadText, W - 28, 9) : [];
  const subLines = wrapLines(`${verdictTag(p)}. ${sub.join(" ")}`, W, 8.5);
  const lh = mainSize + 4;
  const height = 54 + 22 + mainLines.length * lh + (d ? 28 : 0) + subLines.length * 11 + (lead.length ? lead.length * 12 + 30 : 0) + (d?.srmWarning ? 30 : 0) + 4;
  return draw(height, (c, x, y, w) => {
    c.text(p.deck.productName.toUpperCase(), x, y + 9, 8.5, { bold: true, color: T.mutedInk, maxWidth: w - 100 });
    c.text(p.deck.label, x, y + 32, 22, { bold: true, color: T.ink, maxWidth: w - 110 });
    c.line(x, y + 39, x + Math.min(w - 110, textWidth(pdfSafe(p.deck.label), 22, true)), y + 39, T.accent, 1.5);
    pill(c, x + w - (mw(p.deck.statusLabel, 8.5, true) + 16), y + 14, p.deck.statusLabel, "accent");
    let yy = y + 54;
    if (!d) {
      pill(c, x, yy, p.verdict.pill, p.verdict.kind === "decided" ? "accent" : "plain");
      yy += 22;
    }
    for (const l of mainLines) {
      c.text(l, x, yy + mainSize * 0.8, mainSize, { bold: true, color: T.ink });
      yy += lh;
    }
    if (d) {
      c.line(x, yy - 2, x + Math.min(w, textWidth(pdfSafe(mainLines[mainLines.length - 1] ?? ""), mainSize, true)), yy - 2, T.accent, 3);
      yy += 6;
      pill(c, x, yy, d.chanceBadge, d.verdict === "lead" ? "warning" : "accent");
      yy += 22;
    }
    for (const l of subLines) {
      c.text(l, x, yy + 7, 8.5, { color: T.mutedInk });
      yy += 11;
    }
    if (lead.length) {
      yy += 4;
      c.roundRect(x, yy, w, lead.length * 12 + 26, 8, T.track);
      c.roundRect(x + 12, yy + 7, 84, 13, 6.5, WARNING_SOFT);
      c.text("LEAD, NOT DECIDED", x + 18, yy + 16.5, 7.5, { bold: true, color: WARNING });
      lead.forEach((l, i) => c.text(l, x + 12, yy + 33 + i * 12 - 4, 9, { color: T.ink }));
      yy += lead.length * 12 + 30;
    }
    if (d?.srmWarning) {
      c.roundRect(x, yy + 2, w, 24, 8, WARNING_SOFT);
      c.text("Swipers were not split evenly across prices (sample ratio mismatch), so this stays a Lead.", x + 12, yy + 17, 8.5, { bold: true, color: WARNING, maxWidth: w - 24 });
    }
  });
}

// ---- KPI tiles ------------------------------------------------------------------------------

function ringGauge(c: PdfCanvas, cx: number, cy: number, value: number) {
  const k = 34 / 36;
  c.ring(cx, cy, 15.9155 * k, 4 * k, Math.max(0, Math.min(100, value)) / 100, T.accent, T.track);
  c.text(`${value}%`, cx, cy + 3, 8.5, { bold: true, color: T.ink, align: "center" });
}

function statTile(c: PdfCanvas, x: number, y: number, w: number, h: number, value: string | number, label: string, opts: { ring?: number; accentTone?: boolean } = {}) {
  card(c, x, y, w, h);
  let tx = x + 12;
  if (opts.ring !== undefined) {
    ringGauge(c, x + 12 + 17, y + h / 2, opts.ring);
    tx = x + 12 + 34 + 10;
  }
  c.text(String(value), tx, y + h / 2 + 1, 18, { bold: true, color: T.ink, maxWidth: w - (tx - x) - 10 });
  c.text(label, tx, y + h / 2 + 14, 8.5, { bold: true, color: T.mutedInk, maxWidth: w - (tx - x) - 10 });
}

function sourceTile(c: PdfCanvas, x: number, y: number, w: number, h: number, feed: number, link: number) {
  card(c, x, y, w, h);
  const total = feed + link;
  const feedPct = share(feed, total);
  const linkPct = total ? 100 - feedPct : 0;
  c.text("Where swipers came from", x + 14, y + 16, 9.5, { bold: true, color: T.ink });
  const bx = x + 14;
  const bw = w - 28;
  c.roundRect(bx, y + 22, bw, 7, 3.5, T.track);
  if (feed > 0 && link > 0) {
    const fw = (feedPct / 100) * bw;
    c.roundRect(bx, y + 22, bw, 7, 3.5, T.muted40);
    c.roundRect(bx, y + 22, fw, 7, 3.5, T.accent);
    c.rect(bx + Math.max(0, fw - 4), y + 22, 4, 7, T.accent);
  } else if (feed > 0) c.roundRect(bx, y + 22, bw, 7, 3.5, T.accent);
  else if (link > 0) c.roundRect(bx, y + 22, bw, 7, 3.5, T.muted40);
  let lx = bx;
  for (const part of [
    { label: "Feed", n: feed, pct: feedPct, dot: T.accent },
    { label: "Your link", n: link, pct: linkPct, dot: T.muted40 },
  ]) {
    c.circle(lx + 3, y + 40, 3, part.dot);
    let tx = lx + 10;
    c.text(part.label, tx, y + 43, 8.5, { color: T.mutedInk });
    tx += mw(part.label, 8.5) + 5;
    c.text(String(part.n), tx, y + 43, 8.5, { bold: true, color: T.ink });
    tx += mw(String(part.n), 8.5, true) + 4;
    c.text(`· ${part.pct}%`, tx, y + 43, 8.5, { color: T.mutedInk });
    lx = tx + mw(`· ${part.pct}%`, 8.5) + 16;
  }
}

function kpiBlock(p: ResultsPayload): PdfBlock {
  const t = p.totals;
  const d = p.priceCurve;
  return draw(2 * 52 + 6, (c, x, y, w) => {
    const tw = (w - 8) / 2;
    const at = (i: number) => ({ tx: x + (i % 2) * (tw + 8), ty: y + Math.floor(i / 2) * 58 });
    if (d) {
      const tiles: [string | number, string][] = [
        [d.totals.swipers, d.totals.perPriceSwipers ? `Swipers, ${d.totals.perPriceSwipers} per price` : "Swipers"],
        [d.totals.saidYes, `Said yes (${d.totals.saidYesPct}%)`],
        [d.totals.joined, `Joined waitlist (${d.totals.joinedPct}%)`],
        [d.bestTileValue, d.bestTileLabel],
      ];
      tiles.forEach(([v, l], i) => statTile(c, at(i).tx, at(i).ty, tw, 52, v, l));
      return;
    }
    let a = at(0);
    statTile(c, a.tx, a.ty, tw, 52, t.swipers, "Swipers");
    a = at(1);
    statTile(c, a.tx, a.ty, tw, 52, t.saidYes, `Said yes, of ${t.swipers} swipers`, { ring: share(t.saidYes, t.swipers) });
    a = at(2);
    statTile(c, a.tx, a.ty, tw, 52, t.joined, `Joined waitlist, of ${t.swipers} swipers`, { ring: share(t.joined, t.swipers) });
    a = at(3);
    sourceTile(c, a.tx, a.ty, tw, 52, t.feed, t.link);
  });
}

// ---- Funnel ---------------------------------------------------------------------------------

function funnelCard(p: ResultsPayload): PdfBlock {
  const t = p.totals;
  const steps = [
    { label: "Swipers", n: t.swipers, color: "muted35" as const },
    { label: "Said yes", n: t.saidYes, color: "accent60" as const },
    { label: "Joined waitlist", n: t.joined, color: "accent" as const },
  ];
  const rowH = 27;
  const height = 30 + steps.length * rowH + 8;
  return draw(height, (c, x, y, w) => {
    card(c, x, y, w, height);
    c.text("From swipe to waitlist", x + 14, y + 20, 12, { bold: true, color: T.ink });
    const labelW = 80;
    const colW = 100;
    const bx = x + 14 + labelW + 8;
    const bw = w - 28 - labelW - colW - 16;
    steps.forEach((st, i) => {
      const yy = y + 28 + i * rowH;
      const pc = share(st.n, t.swipers);
      c.text(st.label, x + 14, yy + 15, 9.5, { bold: true, color: T.ink });
      c.roundRect(bx, yy + 6, bw, 12, 3, T.track);
      const frac = Math.max(pc, st.n > 0 ? 2 : 0) / 100;
      if (frac > 0) c.roundRect(bx, yy + 6, Math.max(4, frac * bw), 12, 3, T[st.color]);
      const cx = bx + bw + 10;
      c.text(String(st.n), cx, yy + 12, 10.5, { bold: true, color: T.ink });
      c.text(`· ${pc}%`, cx + mw(String(st.n), 10.5, true) + 4, yy + 12, 9.5, { color: T.mutedInk });
      const prev = i > 0 ? steps[i - 1].n : 0;
      if (i > 0 && prev > 0) c.text(`-${Math.round(((prev - st.n) / prev) * 100)}% vs step above`, cx, yy + 22, 8.5, { color: T.mutedInk });
    });
  });
}

// ---- Leaderboard ----------------------------------------------------------------------------

function leaderCards(p: ResultsPayload): PdfBlock[] {
  const rows = p.leaderboard.everyone;
  if (rows.length === 0) return [];
  const maxRate = Math.max(0, ...rows.map((r) => r.claimRate ?? 0));
  const axisMax = Math.max(0.2, maxRate * 1.1);
  const leftW = 170;
  const lines = rows.map((r) => wrapLines(r.valueText, leftW, 10.5, true));
  const rowH = (i: number) => Math.max(54, 8 + 10 + lines[i].length * 12.5 + 22);
  const chunks: number[][] = [];
  for (let i = 0; i < rows.length; i += 6) chunks.push(rows.slice(i, i + 6).map((_, j) => i + j));
  return chunks.map((idx, ci) => {
    const top = ci === 0 ? 32 : 8;
    const height = top + idx.reduce((n, i) => n + rowH(i), 0) + 4;
    return draw(height, (c, x, y, w) => {
      card(c, x, y, w, height);
      if (ci === 0) {
        c.text("Leaderboard", x + 14, y + 21, 12, { bold: true, color: T.ink });
        c.text("ranked by reward claim rate", x + 14 + mw("Leaderboard", 12, true) + 8, y + 21, 8.5, { color: T.mutedInk });
      }
      let yy = y + top;
      idx.forEach((i, k) => {
        const r: LeaderRow = rows[i];
        const h = rowH(i);
        if (k > 0 || ci === 0) c.line(x + 1, yy, x + w - 1, yy, T.border, 0.75);
        c.text(String(r.rank), x + 14, yy + h / 2 + 8, 20, { bold: true, color: T.mutedInk });
        const lx = x + 40;
        c.text(r.label, lx, yy + 15, 8.5, { bold: true, color: T.mutedInk, maxWidth: leftW });
        let ly = yy + 15;
        for (const l of lines[i]) {
          ly += 12.5;
          c.text(l, lx, ly, 10.5, { bold: true, color: T.ink });
        }
        ly += 5;
        let bxx = lx;
        if (r.rank === 1 && !r.suppressed) bxx += pill(c, lx, ly, "Leading", "accent") + 8;
        if (r.chanceBest !== null) {
          const num = `${Math.round(r.chanceBest * 100)}%`;
          c.text(num, bxx, ly + 11, 8.5, { bold: true, color: r.rank === 1 ? T.accent : T.ink });
          c.text("chance best", bxx + mw(num, 8.5, true) + 3, ly + 11, 8.5, { color: T.mutedInk });
        }
        const bx = x + 40 + leftW + 10;
        const valW = 80;
        const nameW = 60;
        const bw = w - 14 - valW - (bx - x) - nameW - 8;
        if (r.suppressed) {
          c.text(`Too few swipers to show (under ${LIMITS.groupMinSize}).`, bx, yy + h / 2 + 3, 9, { color: T.mutedInk });
        } else {
          const line = (ty: number, name: string, frac: number, value: string, strong: boolean) => {
            c.text(name, bx, ty + 7, 8.5, { color: T.mutedInk });
            c.roundRect(bx + nameW, ty, bw, 7, 3.5, T.track);
            const f = Math.max(0, Math.min(1, frac));
            if (f > 0) c.roundRect(bx + nameW, ty, Math.max(7, f * bw), 7, 3.5, strong ? T.accent : T.muted45);
            c.text(value, x + w - 14, ty + 7, 8.5, { bold: true, color: T.ink, align: "right" });
          };
          const sw = r.swipers ?? 0;
          line(yy + h / 2 - 14, "Joined waitlist", (r.claimRate ?? 0) / axisMax, r.claimRate === null ? "-" : `${pct1(r.claimRate)} · ${r.joined ?? 0} of ${sw}`, r.rank === 1);
          line(yy + h / 2 + 3, "Said yes", sw ? (r.saidYes ?? 0) / sw : 0, `${share(r.saidYes ?? 0, sw)}% · ${r.saidYes ?? 0} of ${sw}`, false);
        }
        yy += h;
      });
    });
  });
}

// ---- Price charts (same geometry as demand-curve/ui, scaled) ------------------------------------

/** One chart card: title, caption, chart (scaled kx by ky from the 360x230 product chart), foot note. */
function chartCardAt(
  c: PdfCanvas, x: number, y: number, w: number, h: number,
  title: string, caption: string, foot: string,
  chart: (c: PdfCanvas, ox: number, oy: number, kx: number, ky: number) => void,
) {
  card(c, x, y, w, h);
  c.text(title, x + 12, y + 18, 11.5, { bold: true, color: T.ink });
  c.text(caption, x + 12, y + 30, 8.5, { color: T.mutedInk });
  const kx = (w - 16) / 360;
  const ky = (h - 70) / 230;
  chart(c, x + 8, y + 36, kx, ky);
  wrapLines(foot, w - 24, 8.5).forEach((l, i) => c.text(l, x + 12, y + h - 18 + i * 10 - 10 * (wrapLines(foot, w - 24, 8.5).length - 1), 8.5, { color: T.mutedInk }));
}

function priceBlocks(p: ResultsPayload): PdfBlock[] {
  const d = p.priceCurve;
  if (!d) return [];
  const { points, ticks, yMax } = d.lineChart;
  const { bars, yMax: bMax } = d.barChart;
  const joinChart = (c: PdfCanvas, ox: number, oy: number, kx: number, ky: number) => {
    const PAD = { left: 40, right: 24, top: 22, bottom: 34 };
    const plotW = 360 - PAD.left - PAD.right;
    const plotH = 230 - PAD.top - PAD.bottom;
    const Y = (v: number) => oy + ky * (PAD.top + plotH * (1 - v / yMax));
    const X = (i: number) => ox + kx * (PAD.left + (plotW / points.length) * (i + 0.5));
    for (const t of ticks) {
      c.line(ox + kx * PAD.left, Y(t), ox + kx * (360 - PAD.right), Y(t), T.border, 0.75);
      c.text(`${Math.round(t * 100)}%`, ox + kx * (PAD.left - 6), Y(t) + 3, 8.5, { color: T.mutedInk, align: "right" });
    }
    points.forEach((pt, i) => c.line(X(i), Y(Math.min(pt.high, yMax * 1.12)), X(i), Y(pt.low), T.muted45, 2.4));
    c.polyline(points.map((pt, i) => [X(i), Y(pt.rate)] as [number, number]), T.ink, 1.6);
    points.forEach((pt, i) => {
      c.circle(X(i), Y(pt.rate), 3.8, pt.isBest ? T.accent : T.ink);
      c.text(pt.text, X(i) + 6, Y(pt.rate) - 6, 9, { bold: true, color: T.ink });
      c.text(pt.label, X(i), oy + ky * 222 + 3, 8.5, { bold: true, color: T.ink, align: "center" });
    });
  };
  const revChart = (c: PdfCanvas, ox: number, oy: number, kx: number, ky: number) => {
    const PAD = { left: 8, right: 8, top: 34, bottom: 48 };
    const plotW = 360 - PAD.left - PAD.right;
    const plotH = 230 - PAD.top - PAD.bottom;
    const slot = plotW / Math.max(1, bars.length);
    const barW = Math.min(52, slot * 0.58);
    const base = oy + ky * (PAD.top + plotH);
    c.line(ox + kx * PAD.left, base, ox + kx * (360 - PAD.right), base, T.border, 0.75);
    bars.forEach((b, i) => {
      const cx = ox + kx * (PAD.left + slot * (i + 0.5));
      const h = bMax === 0 ? 0 : Math.max(2, (b.value / bMax) * plotH) * ky;
      c.roundRect(cx - (barW * kx) / 2, base - h, barW * kx, h, 3, b.isBest ? T.accent : T.border);
      c.text(b.valueText, cx, base - h - 5, 9, { bold: true, color: T.ink, align: "center" });
      c.text(b.label, cx, base + 12, 8.5, { bold: true, color: T.ink, align: "center" });
      const [a1, a2] = b.subLabel.includes(" joined") ? [b.subLabel.replace(" joined", ""), "joined"] : [b.subLabel, ""];
      c.text(a1, cx, base + 22, 8, { color: T.mutedInk, align: "center" });
      if (a2) c.text(a2, cx, base + 31, 8, { color: T.mutedInk, align: "center" });
    });
  };
  const cardH = 214;
  const charts = draw(cardH + 2, (c, x, y, w) => {
    const cw = (w - 8) / 2;
    chartCardAt(c, x, y, cw, cardH, "Who joined at each price", "dot = joined %, bar = likely range", "Dots show the share who joined at each price; bars show the 90% likely range.", joinChart);
    chartCardAt(c, x + cw + 8, y, cw, cardH, "Revenue per 100 swipers", "per month, if every sign-up pays", "Revenue = price x share who joined x 100.", revChart);
  });
  const rows = d.rows.map((r) => [r.priceLabel, String(r.swipers), String(r.saidYes), String(r.joined), r.joinedText, r.revenueText, `${r.chancePct}%`]);
  rows.push(["Total", String(d.totals.swipers), `${d.totals.saidYes} (${d.totals.saidYesPct}%)`, `${d.totals.joined} (${d.totals.joinedPct}%)`, "", "", ""]);
  return [
    charts,
    { type: "heading", text: "Every price, in numbers" },
    {
      type: "table",
      columns: [
        { header: "Price", weight: 2 },
        { header: "Swipers", weight: 1.4, align: "right" },
        { header: "Said yes", weight: 1.6, align: "right" },
        { header: "Joined", weight: 1.6, align: "right" },
        { header: "Joined %", weight: 2.3, align: "right" },
        { header: "Revenue per 100 swipers", weight: 3.7, align: "right" },
        { header: "Chance it earns most", weight: 3.1, align: "right" },
      ],
      rows,
      boldLastRow: true,
      highlight: d.rows.flatMap((r, i) => (r.isBest ? [i] : [])),
    },
    { type: "text", text: "Swipers > Said yes > Joined. Ranges are 90% likely.", muted: true, size: 8.5 },
  ];
}

// ---- Audience & who swiped -----------------------------------------------------------------------------

function totalBox(view: SegmentView, line?: string): PdfBlock {
  const text = `${view.overall.swipers} swipers · ${view.overall.saidYes} said yes · ${view.overall.joined} joined (${pctN(view.overall.rate)}%)`;
  const lines = line ? wrapLines(line, W - 28, 8.5) : [];
  return draw(26 + lines.length * 10, (c, x, y, w) => {
    c.roundRect(x, y, w, 22 + lines.length * 10, 7, T.track);
    c.text("Total", x + 12, y + 15, 9.5, { bold: true, color: T.ink });
    c.text(text, x + w - 12, y + 15, 9, { bold: true, color: T.ink, align: "right" });
    lines.forEach((l, i) => c.text(l, x + w - 12, y + 27 + i * 10, 8.5, { color: T.mutedInk, align: "right" }));
  });
}

const ROW = 26;

/** Top 6 groups plus Other (10+ only), as the Who swiped screen shows them. */
function segRows(view: SegmentView): SegmentRowView[] {
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
  return otherRow ? [...top, otherRow] : top;
}

/** Measured width, with a little safety margin for viewers that substitute the font. */
const mw = (text: string, size: number, bold = false) => textWidth(pdfSafe(text), size, bold) * 1.04;

function segHeight(view: SegmentView, w: number): number {
  void w;
  const n = segRows(view).length;
  return n === 0 ? 24 : n * ROW + 6 + 24;
}

/** One row per group: label, counts, join rate, and a bar against the dashed overall rate. Returns nothing; sized by segHeight. */
function drawSegBars(c: PdfCanvas, x: number, y: number, w: number, view: SegmentView, unit?: string) {
  const shown = segRows(view);
  if (view.rows.length === 0 || shown.length === 0) {
    c.text(`No group has ${LIMITS.groupMinSize} swipers yet${unit ? ` ${unit}` : ""}, so nothing is shown.`, x, y + 12, 8.5, { color: T.mutedInk, maxWidth: w });
    return;
  }
  const overallLeft = Math.min(1, view.overall.rate / view.axisMax);
  shown.forEach((r, i) => {
    const yy = y + i * ROW;
    const tail = ` · ${r.joined} of ${r.swipers} joined · ${r.saidYes} said yes`;
    c.text(tail, x + w, yy + 9, 8.5, { color: T.mutedInk, align: "right" });
    c.text(`${pctN(r.joinRate)}%`, x + w - mw(tail, 8.5) - 1, yy + 9, 10, { bold: true, color: T.ink, align: "right" });
    c.text(r.label, x, yy + 9, 10, { bold: true, color: T.ink, maxWidth: Math.max(40, w - mw(tail, 8.5) - 40) });
    c.roundRect(x, yy + 13, w, 8, 4, T.track);
    const f = Math.min(1, r.joinRate / view.axisMax);
    if (f > 0) c.roundRect(x, yy + 13, Math.max(8, f * w), 8, 4, r.best ? T.accent : T.muted45);
    c.line(x + overallLeft * w, yy + 11, x + overallLeft * w, yy + 23, T.ink, 1, [2.5, 2]);
  });
  // Key rows: the overall marker and its text on one row, the "Best" swatch on its own row below.
  const ly = y + shown.length * ROW + 6;
  const ov = `Overall: ${view.overall.swipers} swipers · ${view.overall.saidYes} said yes · ${view.overall.joined} joined (${pctN(view.overall.rate)}%)`;
  c.line(x + 3, ly - 1, x + 3, ly + 8, T.ink, 1, [2.5, 2]);
  c.text(ov, x + 12, ly + 7, 8.5, { color: T.mutedInk, maxWidth: w - 12 });
  c.roundRect(x + 1, ly + 14, 8, 8, 2, T.accent);
  c.text("Best", x + 14, ly + 21, 8.5, { color: T.mutedInk });
}

/** Lead note as a compact callout: at most two lines of text, then the Lead line. Counted as a Lead on its page. */
function callout(i: InsightView | null): PdfBlock[] {
  if (!i) return [];
  const body = wrapLines(`${i.title}. ${i.body}`, W - 28, 8.5);
  const lines = body.slice(0, 2);
  if (body.length > 2) lines[1] = `${lines[1].replace(/\s+\S*$/, "")} ...`;
  const height = 12 + lines.length * 10.5 + 13;
  return [
    {
      type: "draw" as const,
      height: height + 4,
      draw: (c: PdfCanvas, x: number, y: number, w: number) => {
        c.roundRect(x, y, w, height, 7, T.track);
        c.roundRect(x, y, 3, height, 1.5, i.warning ? "#c62828" : T.accent);
        lines.forEach((l, k) => c.text(l, x + 12, y + 14 + k * 10.5, 8.5, { color: T.ink, maxWidth: w - 24 }));
        c.text(i.lead, x + 12, y + 14 + lines.length * 10.5 + 1, 8.5, { bold: true, color: i.warning ? "#c62828" : WARNING, maxWidth: w - 24 });
      },
      lead: true,
    },
  ];
}

/** The India state tile map, same grid cells, 4-step green scale and grey for hidden states. Returns its size via the constants below. */
const MAP_T = 26;
const MAP_G = 2;
const MAP_W = 8 * (MAP_T + MAP_G) - MAP_G;
const MAP_H = 7 * (MAP_T + MAP_G) - MAP_G;
const MAP_LEGEND_H = 8 + 13 * 3;

function drawStateMap(c: PdfCanvas, x: number, y: number, tab: ResultsPayload["whoSwiped"]["location"]) {
  const byState = new Map(tab.tiles.map((t) => [t.state, t]));
  for (const t of STATE_TILES) {
    const d = byState.get(t.state);
    const tx = x + t.col * (MAP_T + MAP_G);
    const ty = y + t.row * (MAP_T + MAP_G);
    const b = d ? rateBucket(d.joinRate) : 0;
    c.roundRect(tx, ty, MAP_T, MAP_T, 4, d ? BUCKET_FILL[b] : T.track);
    if (d?.best) c.roundRect(tx, ty, MAP_T, MAP_T, 4, null, { color: T.ink, width: 1.6 });
    const ink = d ? BUCKET_INK[b] : T.muted45;
    c.text(t.abbr, tx + MAP_T / 2, ty + (d ? 11 : 16), 8, { bold: true, color: ink, align: "center" });
    if (d) c.text(`${pctN(d.joinRate)}%`, tx + MAP_T / 2, ty + 21, 8, { bold: true, color: ink, align: "center" });
  }
  // Legend under the map: measured items flowed into rows that stay inside the map width.
  const items: { label: string; swatch: string | null; bold?: boolean }[] = [
    { label: "Share who joined:", swatch: null, bold: true },
    ...LEGEND.map((l, i) => ({ label: l, swatch: BUCKET_FILL[i] })),
    { label: `under ${LIMITS.groupMinSize} swipers`, swatch: T.track },
  ];
  let lx = x;
  let ly = y + MAP_H + 8;
  for (const it of items) {
    const itemW = (it.swatch ? 12 : 0) + mw(it.label, 8.5, it.bold) + 10;
    if (lx > x && lx + itemW - 10 > x + MAP_W) {
      lx = x;
      ly += 13;
    }
    if (it.swatch) c.roundRect(lx, ly, 8, 8, 2, it.swatch);
    c.text(it.label, lx + (it.swatch ? 12 : 0), ly + 7, 8.5, { bold: it.bold, color: it.bold ? T.mutedInk : T.ink });
    lx += itemW;
  }
}

function locationBlocks(p: ResultsPayload): PdfBlock[] {
  const loc = p.whoSwiped.location;
  const barsW = W - MAP_W - 16;
  const h = Math.max(MAP_H + MAP_LEGEND_H + 8, segHeight(loc, barsW));
  return [
    { type: "heading", text: "Location (state, approximate from IP)" },
    draw(h + 18, (c, x, y) => {
      c.text("How many people from each state joined the waitlist.", x, y + 8, 8.5, { color: T.mutedInk });
      drawStateMap(c, x, y + 16, loc);
      drawSegBars(c, x + MAP_W + 16, y + 16, barsW, loc, "per state");
    }),
    totalBox(
      loc,
      loc.other
        ? `${loc.shown.swipers} in these ${loc.rows.length} states + ${loc.other.swipers} hidden (under ${LIMITS.groupMinSize} per state) = ${loc.overall.swipers} · ${loc.shown.joined} + ${loc.other.joined} = ${loc.overall.joined} joined`
        : undefined,
    ),
    ...callout(loc.insight),
    ...(loc.hiddenNote ? [{ type: "text" as const, text: loc.hiddenNote, muted: true, size: 8.5 }] : []),
  ];
}

/** Lucide "user" glyph (head and shoulders), 10 of them: the first `filled` are joined. */
function drawPeople(c: PdfCanvas, x: number, y: number, rate: number) {
  const filled = Math.round(rate * 10);
  for (let i = 0; i < 10; i++) {
    const cx = x + i * 17 + 6;
    const col = i < filled ? T.accent : T.track;
    c.circle(cx, y + 3.5, 3.4, col);
    c.roundRect(cx - 5.5, y + 9, 11, 7, 3.5, col);
  }
}

function targetBlocks(p: ResultsPayload): PdfBlock[] {
  const t = p.whoSwiped.target;
  if (!(t.enough && t.target && t.everyone)) return [{ type: "text", text: t.total.text, muted: true, size: 8.5 }];
  const group = (c: PdfCanvas, x: number, y: number, w: number, g: SegmentRowView, title: string, hi: boolean) => {
    card(c, x, y, w, 70, hi ? T.accent : T.border, hi ? 1.8 : 0.75);
    c.text(title, x + 12, y + 17, 9.5, { bold: true, color: T.ink, maxWidth: w - 70 });
    c.text(`${pctN(g.joinRate)}%`, x + w - 12, y + 21, 18, { bold: true, color: hi ? T.ink : T.mutedInk, align: "right" });
    drawPeople(c, x + 12, y + 28, g.joinRate);
    c.text(`${g.swipers} swipers · ${g.saidYes} said yes · ${g.joined} joined`, x + 12, y + 61, 8.5, { color: T.mutedInk });
  };
  return [
    draw(92, (c, x, y, w) => {
      c.text("Who joined the waitlist, out of every 10 people:", x, y + 8, 8.5, { color: T.mutedInk });
      const cw = (w - 8) / 2;
      group(c, x, y + 16, cw, t.target as SegmentRowView, `Target users${t.roles.length ? ` (${t.roles.join(", ")})` : ""}`, true);
      group(c, x + cw + 8, y + 16, cw, t.everyone as SegmentRowView, "Everyone else", false);
    }),
    { type: "text", text: t.total.text, muted: true, size: 8.5 },
  ];
}

function swipeToWaitlist(p: ResultsPayload): PdfBlock[] {
  const v = p.whoSwiped.saidYesVsActed;
  const max = Math.max(v.swipers, 1);
  const rows = [
    { label: "Swiped", n: v.swipers, text: `${v.swipers}`, color: "muted35" as const },
    { label: "Said yes", n: v.saidYes, text: `${v.saidYes} (${v.saidYesPct}%)`, color: "accent55" as const },
    { label: "Left an email", n: v.joined, text: `${v.joined} (${v.joinedPct}%)`, color: "accent" as const },
  ];
  const head = wrapLines(v.headline, W, 9.5, true);
  const note = wrapLines(v.note, W, 8.5);
  const top = 16 + head.length * 12 + 4;
  return [
    draw(top + rows.length * 20 + note.length * 10 + 8, (c, x, y, w) => {
      c.text("From swipe to waitlist", x, y + 10, 10.5, { bold: true, color: T.ink });
      c.text(`All ${v.swipers} swipers`, x + w, y + 10, 8.5, { color: T.mutedInk, align: "right" });
      head.forEach((l, i) => c.text(l, x, y + 24 + i * 12, 9.5, { bold: true, color: T.ink }));
      rows.forEach((r, i) => {
        const yy = y + top + i * 20;
        c.text(r.label, x, yy + 12, 9, { bold: true, color: T.ink });
        const bx = x + 80;
        const bw = w - 80 - 76;
        c.roundRect(bx, yy + 3, Math.max(5, (r.n / max) * bw), 12, 3, T[r.color]);
        c.text(r.text, x + w, yy + 12, 9, { bold: true, color: T.ink, align: "right" });
      });
      note.forEach((l, i) => c.text(l, x, y + top + rows.length * 20 + 9 + i * 10, 8.5, { color: T.mutedInk }));
    }),
  ];
}

/** Source and Interests bars side by side, each with its own title. */
function twoUp(left: { title: string; view: SegmentView; unit?: string }, right: { title: string; view: SegmentView; unit?: string }): PdfBlock {
  const cw = (W - 16) / 2;
  const h = Math.max(segHeight(left.view, cw), segHeight(right.view, cw));
  return draw(h + 22, (c, x, y, w) => {
    const half = (w - 16) / 2;
    for (const [i, s] of [left, right].entries()) {
      const sx = x + i * (half + 16);
      c.text(s.title, sx, y + 11, 10.5, { bold: true, color: T.ink, maxWidth: half });
      drawSegBars(c, sx, y + 20, half, s.view, s.unit);
    }
  });
}

function whoSwipedBlocks(p: ResultsPayload): PdfBlock[] {
  const w = p.whoSwiped;
  const blocks: PdfBlock[] = [{ type: "pagebreak" }, titleBlock(`${p.deck.productName} · ${p.deck.label}`, "Audience & who swiped")];
  if (!w.hasData) return [...blocks, { type: "text", text: "No counted swipes yet, so there is nobody to show.", muted: true }];
  blocks.push(...locationBlocks(p));
  blocks.push({ type: "heading", text: "Target users" }, ...targetBlocks(p), ...callout(w.target.insight), ...swipeToWaitlist(p));

  const s = w.source;
  const i = w.interests;
  blocks.push(twoUp({ title: "Source (swipe feed vs your link)", view: s }, { title: "Interests (one person can follow several)", view: i, unit: "per interest" }));
  blocks.push(totalBox(s, s.totalText || undefined), totalBox(i, i.totalText || undefined));
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
  blocks.push(...callout(s.insight));
  if (i.tiles.length > 0) {
    const n = Math.ceil(i.tiles.length / 2);
    blocks.push(
      draw(n * 46, (c, x, y, wd) => {
        const tw = (wd - 8) / 2;
        i.tiles.forEach((t, k) => {
          const tx = x + (k % 2) * (tw + 8);
          const ty = y + Math.floor(k / 2) * 46;
          card(c, tx, ty, tw, 40);
          c.text(t.value, tx + 12, ty + 19, 15, { bold: true, color: T.ink, maxWidth: tw - 24 });
          c.text(t.text, tx + 12, ty + 33, 8.5, { color: T.mutedInk, maxWidth: tw - 24 });
        });
      }),
    );
  }
  blocks.push(...callout(i.insight));
  blocks.push({ type: "text", text: `${SEGMENT_TAG} = ${LEADS_FOOTNOTE}`, muted: true, size: 8.5 });
  return blocks;
}

function waitlistBlock(p: ResultsPayload): PdfBlock {
  const wl = p.waitlist;
  return draw(64, (c, x, y, w) => {
    card(c, x, y, w, 58);
    c.roundRect(x + 12, y + 11, 36, 36, 18, T.accent);
    c.text(String(wl.count), x + 30, y + 34, 14, { bold: true, color: T.onAccent, align: "center" });
    c.text(`${wl.count} ${wl.count === 1 ? "person" : "people"} claimed the reward`, x + 62, y + 24, 11, { bold: true, color: T.ink });
    c.text([wl.reward, wl.acrossText].filter(Boolean).join(" - "), x + 62, y + 40, 8.5, { color: T.mutedInk, maxWidth: w - 76 });
    c.text("Emails are only in the waitlist file.", x + w - 12, y + 24, 8.5, { color: T.mutedInk, align: "right" });
  });
}

function deckBlocks(p: ResultsPayload): PdfBlock[] {
  const empty = p.totals.swipers === 0;
  const blocks: PdfBlock[] = [headerBlock(p), kpiBlock(p)];
  if (p.priceCurve) blocks.push(...priceBlocks(p));
  else if (!empty) blocks.push(funnelCard(p), ...leaderCards(p));
  else blocks.push({ type: "text", text: "No counted swipes yet. Only swipes from people whose quality score is 70 or more count here.", muted: true });
  blocks.push(...whoSwipedBlocks(p), { type: "pagebreak" }, titleBlock(`${p.deck.productName} · ${p.deck.label}`, "Waitlist users"), waitlistBlock(p));
  return blocks;
}

export function reportDocument(input: { productName: string; scopeText: string; decks: readonly ExportDeckData[]; now: Date; theme?: PdfTheme }): PdfDocument {
  const stamp = stampLabel(input.now);
  const blocks: PdfBlock[] = [
    coverBlock({ productName: input.productName, scopeText: input.scopeText, stamp }),
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
    blocks.push(...deckBlocks(payload));
  });
  blocks.push(
    { type: "spacer", height: 12 },
    { type: "heading", text: "Notes" },
    { type: "text", text: LEADS_NOTE, size: 8.5, muted: true },
    { type: "text", text: PRIVACY_NOTE, size: 8.5, muted: true },
    { type: "text", text: "Source: counted swipes recorded by PitchSwipe. Chance each version is best comes from Flagsmith. Every number is filled by code from this data.", muted: true, size: 8.5 },
  );
  return {
    title: `PitchSwipe results report: ${input.productName}`,
    footer: `PitchSwipe results report. Numbers as of ${stamp}.`,
    created: input.now,
    theme: input.theme,
    blocks,
  };
}

export function reportPdf(input: { productName: string; scopeText: string; decks: readonly ExportDeckData[]; now: Date; theme?: PdfTheme }): Buffer {
  return buildPdf(reportDocument(input));
}
