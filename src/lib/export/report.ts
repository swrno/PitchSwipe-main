/**
 * Results report (PDF). Pure. Winner and chance each version is best, Swipers > Said yes >
 * Joined waitlist per version, who swiped, and the insights. Every number comes from the
 * WP7 payload (code-filled, never written by an AI), so it matches the screen. No emails.
 */
import { LIMITS } from "@/fixtures";
import { LEADS_FOOTNOTE } from "@/lib/results/insights";
import type { InsightView, ResultsPayload, SegmentView } from "@/lib/results/types";

import { buildPdf, type PdfBlock, type PdfDocument } from "./pdf";
import { DEMO_NOTE, isDemoExport, LEADS_NOTE, PRIVACY_NOTE, SEGMENT_TAG, stampLabel, verdictTag, versionTag } from "./stamp";
import type { ExportDeckData } from "./types";

const pct = (x: number | null): string => (x === null ? "-" : `${Math.round(x * 100)}%`);
const n = (x: number | null): string => (x === null ? "-" : String(x));

function segmentTable(title: string, view: SegmentView): PdfBlock[] {
  const rows = view.rows.map((r) => [r.label, String(r.swipers), String(r.saidYes), String(r.joined), pct(r.joinRate)]);
  if (view.other) {
    const o = view.other;
    rows.push([LIMITS.otherLabel, String(o.swipers), String(o.saidYes), String(o.joined), pct(o.swipers ? o.joined / o.swipers : 0)]);
  } else if (view.groupCount > view.rows.length) {
    rows.push([`${LIMITS.otherLabel} (hidden, under ${LIMITS.groupMinSize})`, "-", "-", "-", "-"]);
  }
  if (rows.length === 0) return [{ type: "text", text: `${title}: not enough swipers to show a group yet.`, muted: true }];
  return [
    { type: "text", text: title, bold: true },
    {
      type: "table",
      columns: [
        { header: "Group", weight: 4 },
        { header: "Swipers", weight: 1.3, align: "right" },
        { header: "Said yes", weight: 1.3, align: "right" },
        { header: "Joined", weight: 1.3, align: "right" },
        { header: "Join rate", weight: 1.3, align: "right" },
      ],
      rows,
    },
  ];
}

function insightBlock(i: InsightView | null): PdfBlock[] {
  if (!i) return [];
  return [{ type: "insight", title: i.title, body: i.body, footnote: i.lead, lead: true }];
}

function deckBlocks(p: ResultsPayload): PdfBlock[] {
  const w = p.whoSwiped;
  const blocks: PdfBlock[] = [
    { type: "heading", text: `${p.deck.productName}: ${p.deck.label}` },
    { type: "text", text: p.verdict.headline, bold: true, size: 14 },
    {
      type: "text",
      text:
        `${p.verdict.pill}. Tag: ${verdictTag(p)}.` +
        (p.verdict.leaderLabel && p.verdict.chance !== null
          ? ` ${p.verdict.leaderLabel}: ${Math.round(p.verdict.chance * 100)}% chance to beat the control.`
          : ""),
    },
  ];
  if (!p.flagsmithAvailable) {
    blocks.push({ type: "text", text: "Flagsmith results were not available when this report was made, so no winner or chance is shown.", muted: true });
  }
  blocks.push({
    type: "text",
    text: `${p.totals.swipers} swipers, ${p.totals.saidYes} said yes (${p.totals.saidYesPct}%), ${p.totals.joined} joined the waitlist (${p.totals.joinedPct}%).`,
  });

  blocks.push(
    { type: "text", text: "Each version: Swipers > Said yes > Joined waitlist", bold: true },
    {
      type: "table",
      columns: [
        { header: "Version", weight: 2.2 },
        { header: "What it says", weight: 4 },
        { header: "Swipers", weight: 1.2, align: "right" },
        { header: "Said yes", weight: 1.2, align: "right" },
        { header: "Joined", weight: 1.2, align: "right" },
        { header: "Chance best", weight: 1.5, align: "right" },
        { header: "Tag", weight: 1.1 },
      ],
      rows: p.leaderboard.everyone.map((r) => [r.label, r.valueText, n(r.swipers), n(r.saidYes), n(r.joined), pct(r.chanceBest), versionTag(p, r.key)]),
    },
    { type: "text", text: `${w.saidYesVsActed.headline} ${w.saidYesVsActed.note}`, size: 9.5 },
    { type: "text", text: `Waitlist: ${p.waitlist.count} people claimed the reward. Their emails are only in the waitlist file.`, size: 9.5 },
  );

  blocks.push({ type: "heading", text: "Who swiped" });
  if (!w.hasData) {
    blocks.push({ type: "text", text: "No counted swipes yet.", muted: true });
  } else {
    blocks.push(...segmentTable("Location (approximate state)", w.location));
    blocks.push(...segmentTable("Source", w.source));
    blocks.push(...segmentTable("Interests (one person can follow several)", w.interests));
    const t = w.target;
    if (t.enough && t.target && t.everyone) {
      blocks.push(
        { type: "text", text: "Target users", bold: true },
        {
          type: "table",
          columns: [
            { header: "Group", weight: 4 },
            { header: "Swipers", weight: 1.3, align: "right" },
            { header: "Said yes", weight: 1.3, align: "right" },
            { header: "Joined", weight: 1.3, align: "right" },
            { header: "Join rate", weight: 1.3, align: "right" },
          ],
          rows: [t.target, t.everyone].map((r) => [r.label, String(r.swipers), String(r.saidYes), String(r.joined), pct(r.joinRate)]),
        },
      );
    } else {
      blocks.push({ type: "text", text: `Target users: ${t.total.text}`, muted: true });
    }
    const insights = [w.location.insight, w.target.insight, w.source.insight, w.interests.insight];
    if (insights.some(Boolean)) {
      blocks.push({ type: "heading", text: "Insights" });
      for (const i of insights) blocks.push(...insightBlock(i));
      blocks.push({ type: "text", text: `${SEGMENT_TAG} = ${LEADS_FOOTNOTE}`, muted: true, size: 8.5 });
    }
  }
  return blocks;
}

export function reportDocument(input: { productName: string; scopeText: string; decks: readonly ExportDeckData[]; now: Date }): PdfDocument {
  const stamp = stampLabel(input.now);
  const blocks: PdfBlock[] = [
    { type: "title", text: "Results report" },
    { type: "text", text: `${input.productName}: ${input.scopeText}`, bold: true, size: 12 },
    { type: "text", text: `Numbers as of ${stamp}`, muted: true },
    ...(isDemoExport(input.decks) ? [{ type: "text" as const, text: DEMO_NOTE, bold: true, size: 9 }] : []),
    { type: "text", text: LEADS_NOTE, size: 9 },
    { type: "text", text: PRIVACY_NOTE, size: 9 },
  ];
  if (input.decks.length > 1) {
    blocks.push(
      { type: "heading", text: "Decks in this report" },
      {
        type: "table",
        columns: [
          { header: "Deck", weight: 3 },
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
