// Run: npm test -- export
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildResultsPayload } from "@/features/results/payload";
import { SAMPLE_HEADLINE_DECK_ID, SAMPLE_PRICE_DECK_ID, sampleDeckData, sampleSwipes } from "@/shared/lib/testing/sample-deck";
import type { DeckMeta } from "@/features/results/types";

import { bundleExport, buildExportFiles } from "../bundle";
import { csvCell, parseCsv, toCsv } from "../csv";
import { createResendMailer, mailerFromEnv, type MailMessage, type Mailer } from "../server/mailer";
import { buildPdf, pdfSafe } from "../pdf";
import { reportDocument } from "../report";
import { parseExportRequest, runExport } from "../server/service";
import { stampLabel, stampSlug, versionTag } from "../stamp";
import { summaryCsv, summaryXlsx } from "../summary";
import { otherMap, scrubComment, swipesCsv, waitlistCsv } from "../swipes";
import { EXPORT_FILES, type ExportDeckData, type ExportFile, type ExportSwipe } from "../types";
import { buildXlsx, columnName } from "../xlsx";
import { buildZip, crc32, readZip } from "../zip";

const NOW = new Date("2026-11-15T12:50:00Z"); // 18:20 IST

function deckData(id = SAMPLE_HEADLINE_DECK_ID, label = "Headline test"): ExportDeckData {
  const d = sampleDeckData(id, NOW)!;
  const meta: DeckMeta = {
    id,
    productId: "voice-khata",
    productName: "Voice Khata",
    label,
    variable: "headline",
    noun: "headline",
    flagName: `deck_${id}`,
    status: "live",
    statusLabel: "Live",
  };
  const payload = buildResultsPayload({
    deck: meta,
    cards: d.cards,
    controlKey: d.controlKey,
    aggregates: d.aggregates,
    flagsmith: d.flagsmith,
    claimants: d.claimants,
    reward: d.reward,
    targetRoles: d.targetRoles,
    now: NOW,
  });
  const labels = Object.fromEntries(d.cards.map((c) => [c.key, c.label]));
  return {
    payload,
    swipes: sampleSwipes(d.cards, d.aggregates, NOW),
    claimants: d.claimants.map((c) => ({ email: c.email, cardLabel: labels[c.cardKey], claimedAt: c.createdAt })),
  };
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const IPV4 = /\b\d{1,3}(?:\.\d{1,3}){3}\b/;

/** Tiny well-formedness check: tags balance and attributes are quoted. */
function assertWellFormed(xml: string) {
  assert.ok(xml.startsWith("<?xml"), "xml declaration");
  const stack: string[] = [];
  const re = /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+="[^"]*")*)\s*(\/?)>/g;
  let last = 0;
  const body = xml.replace(/^<\?xml[^>]*\?>/, "");
  for (const m of body.matchAll(re)) {
    assert.ok(!/<|&(?!amp;|lt;|gt;|quot;|apos;|#)/.test(body.slice(last, m.index)), "text between tags is escaped");
    last = (m.index ?? 0) + m[0].length;
    if (m[4]) continue;
    if (m[1]) assert.equal(stack.pop(), m[2], `closing ${m[2]}`);
    else stack.push(m[2]);
  }
  assert.equal(stack.length, 0, "all tags closed");
  assert.equal(body.replace(re, "").replace(/&[a-z#0-9]+;/g, "").includes("<"), false, "no stray <");
}

describe("csv", () => {
  it("quotes, escapes and guards formulas", () => {
    assert.equal(csvCell('a,"b"'), '"a,""b"""');
    assert.equal(csvCell("=SUM(A1)"), "'=SUM(A1)");
    assert.equal(csvCell(null), "");
    const rows = [["a", "b,c", 'd"e', "line\nbreak"], ["1", "", "x", "y"]];
    assert.deepEqual(parseCsv(toCsv(rows)), rows);
  });
});

describe("zip", () => {
  it("round-trips stored and deflated entries with valid CRCs", () => {
    const big = Buffer.from("PitchSwipe ".repeat(500));
    const small = Buffer.from("x");
    const zip = buildZip([{ name: "big.txt", data: big }, { name: "dir/small.txt", data: small }, { name: "empty.txt", data: new Uint8Array() }], NOW);
    assert.equal(zip.readUInt32LE(0), 0x04034b50);
    assert.ok(zip.length < big.length, "deflate shrinks repetitive data");
    const out = readZip(zip);
    assert.deepEqual(out.map((e) => e.name), ["big.txt", "dir/small.txt", "empty.txt"]);
    assert.equal(Buffer.from(out[0].data).toString(), big.toString());
    assert.equal(Buffer.from(out[1].data).toString(), "x");
    assert.equal(out[2].data.length, 0);
  });
  it("crc32 matches the known check value", () => {
    assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
  });
});

describe("xlsx", () => {
  it("writes a well-formed workbook with the required parts", () => {
    const xlsx = buildXlsx(
      [
        { name: "Versions", rows: [[{ v: "Head & <er>", bold: true }, 1, { v: 0.375, percent: true }, null], ["a\u0001b", 2]] },
        { name: "Bad:name/with*chars?", rows: [["x"]] },
      ],
      { created: NOW },
    );
    const entries = readZip(xlsx);
    const names = entries.map((e) => e.name);
    for (const required of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]) {
      assert.ok(names.includes(required), required);
    }
    const text = (n: string) => Buffer.from(entries.find((e) => e.name === n)!.data).toString("utf8");
    for (const e of entries) assertWellFormed(text(e.name));
    assert.match(text("xl/worksheets/sheet1.xml"), /Head &amp; &lt;er&gt;/);
    assert.match(text("xl/worksheets/sheet1.xml"), /<c r="C1" s="2"><v>0.375<\/v><\/c>/);
    assert.doesNotMatch(text("xl/worksheets/sheet1.xml"), /\u0001/);
    assert.match(text("xl/workbook.xml"), /name="Bad name with chars"/);
  });
  it("names columns like a spreadsheet", () => {
    assert.deepEqual([0, 25, 26, 27, 701, 702].map(columnName), ["A", "Z", "AA", "AB", "ZZ", "AAA"]);
  });
});

describe("pdf", () => {
  const pdf = buildPdf({
    title: "T (test)",
    footer: "Numbers as of today",
    created: NOW,
    blocks: [
      { type: "title", text: "Results report" },
      { type: "text", text: "Rupee \u20b9 and arrow \u2192 and unicode \u0928" },
      { type: "table", columns: [{ header: "A", weight: 1 }, { header: "B", weight: 1, align: "right" }], rows: Array.from({ length: 80 }, (_, i) => [`row ${i} (x)`, String(i)]) },
    ],
  });
  const text = pdf.toString("latin1");

  it("has a header, trailer and a correct xref table", () => {
    assert.ok(text.startsWith("%PDF-1.4"));
    assert.ok(text.trimEnd().endsWith("%%EOF"));
    const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(text)![1]);
    assert.equal(text.slice(startxref, startxref + 4), "xref");
    const m = /xref\n0 (\d+)\n/.exec(text.slice(startxref))!;
    const count = Number(m[1]);
    const entries = text.slice(startxref + m[0].length).split("\n").slice(0, count);
    assert.equal(entries[0], "0000000000 65535 f ");
    entries.slice(1).forEach((line, i) => {
      assert.match(line, /^\d{10} 00000 n $/);
      const off = Number(line.slice(0, 10));
      assert.ok(text.startsWith(`${i + 1} 0 obj`, off), `object ${i + 1} at ${off}`);
    });
    assert.match(text, new RegExp(`/Size ${count}`));
  });
  it("paginates, declares the page count and stream lengths", () => {
    const pages = Number(/\/Count (\d+)/.exec(text)![1]);
    assert.ok(pages >= 2);
    assert.equal((text.match(/\/Type \/Page /g) ?? []).length, pages);
    for (const m of text.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
      const start = (m.index ?? 0) + m[0].length;
      assert.equal(text.slice(start + Number(m[1]), start + Number(m[1]) + 10), "\nendstream");
    }
    assert.match(text, /Page 1 of \d+/);
  });
  it("escapes parentheses and replaces characters the font cannot show", () => {
    assert.match(text, /row 1 \\\(x\\\)/);
    assert.equal(pdfSafe("\u20b9 \u2192 \u0928"), "Rs  -> ?");
    assert.doesNotMatch(text, /\u0928/);
  });
  it("keeps at most two Lead insights on a page", () => {
    const insight = { type: "insight" as const, title: "t", body: "b", footnote: "Lead: x", lead: true };
    const doc = buildPdf({ title: "x", footer: "f", created: NOW, blocks: [insight, insight, insight, insight, insight] });
    const s = doc.toString("latin1");
    const pages = Number(/\/Count (\d+)/.exec(s)![1]);
    assert.equal(pages, 3);
  });
});

describe("tags and stamps", () => {
  it("formats the time the numbers were taken in IST", () => {
    assert.equal(stampLabel(NOW), "15 Nov 2026, 18:20 IST");
    assert.equal(stampSlug(NOW), "20261115-1820");
  });
  it("Result only for a decided winner, Lead for a card in the lead", () => {
    const d = deckData();
    const key = d.payload.verdict.leaderKey!;
    assert.equal(d.payload.verdict.kind, "leading");
    assert.equal(versionTag(d.payload, key), "Lead");
    const decided = { ...d.payload, verdict: { ...d.payload.verdict, kind: "decided" as const } };
    assert.equal(versionTag(decided, key), "Result");
    assert.equal(versionTag(decided, "zzz"), "");
  });
});

describe("every-swipe CSV", () => {
  const deck = deckData();
  const csv = swipesCsv([deck], NOW);
  const rows = parseCsv(csv);

  it("starts with the header row, no note", () => {
    assert.equal(parseCsv(swipesCsv([deck], NOW))[0][0], "deck");
    assert.equal(parseCsv(waitlistCsv([deck], NOW))[0][0], "deck");
  });

  it("matches the swipe counts and has no identity columns", () => {
    assert.equal(rows.length - 1, deck.payload.totals.swipers);
    assert.deepEqual(rows[0], ["deck", "time_utc", "version", "answer", "comment", "state", "source", "interest", "numbers_as_of"]);
    assert.doesNotMatch(csv, EMAIL);
    assert.doesNotMatch(csv, IPV4);
    assert.ok(rows.slice(1).every((r) => r[8] === "15 Nov 2026, 18:20 IST"));
    assert.ok(rows.slice(1).every((r) => /^\d{4}-\d\d-\d\dT\d\d:\d\dZ$/.test(r[1])));
  });
  it("rolls groups under 10 swipers into Other", () => {
    const count = (col: number) => {
      const m = new Map<string, number>();
      for (const r of rows.slice(1)) for (const v of r[col].split("; ").filter(Boolean)) m.set(v, (m.get(v) ?? 0) + 1);
      return m;
    };
    for (const col of [5, 6]) {
      for (const [group, n] of count(col)) if (group !== "Other") assert.ok(n >= 10, `${group} has ${n}`);
    }
    assert.ok(count(7).size > 0);
  });
  it("scrubs emails and IPs a swiper typed into a comment", () => {
    const swipe: ExportSwipe = { at: NOW, cardLabel: "Headline A", answer: "yes", comment: "mail me at raj@shop.in or 10.2.3.4 / 2001:db8:85a3::1 ok", region: null, source: "feed", interests: [] };
    const out = swipesCsv([{ ...deck, swipes: [swipe] }], NOW);
    assert.doesNotMatch(out, EMAIL);
    assert.doesNotMatch(out, IPV4);
    assert.doesNotMatch(out, /2001:db8/);
    assert.equal(scrubComment("a@b.co"), "[removed]");
    assert.equal(scrubComment("call +91 98765 43210 or see https://x.example/me, ping @ravi_k"), "call [removed] or see [removed] ping [removed]");
    assert.equal(scrubComment("Would pay Rs 299 for 10 users"), "Would pay Rs 299 for 10 users");
  });
  it("hides a small group even when only one is under 10", () => {
    const values = [...Array(12).fill("Gujarat"), ...Array(15).fill("Kerala"), ...Array(4).fill("Goa")];
    const map = otherMap(values);
    // Goa (4) alone would be revealed by subtraction, so the smallest shown group joins it.
    assert.equal(map.get("Goa"), "Other");
    assert.equal(map.get("Gujarat"), "Other");
    assert.equal(map.get("Kerala"), "Kerala");
  });
});

describe("waitlist CSV", () => {
  it("lists explicit claimants only, with their version and time", () => {
    const deck = deckData();
    const rows = parseCsv(waitlistCsv([deck], NOW));
    assert.equal(rows.length - 1, 26);
    assert.deepEqual(rows[0], ["deck", "email", "version", "claimed_at_utc", "numbers_as_of"]);
    assert.ok(rows.slice(1).every((r) => EMAIL.test(r[1]) && /^Headline [ABC]$/.test(r[2])));
  });
});

describe("summary table", () => {
  const deck = deckData();
  const ctx = { productName: "Voice Khata", scopeText: "this deck: Headline test", decks: [deck], now: NOW };

  it("xlsx has Versions and Segments sheets with the on-screen numbers", () => {
    const entries = readZip(summaryXlsx(ctx));
    const sheet1 = Buffer.from(entries.find((e) => e.name === "xl/worksheets/sheet1.xml")!.data).toString("utf8");
    assertWellFormed(sheet1);
    assert.match(sheet1, /Numbers as of 15 Nov 2026, 18:20 IST/);
    assert.match(sheet1, /Headline B/);
    assert.match(Buffer.from(entries.find((e) => e.name === "xl/workbook.xml")!.data).toString(), /Versions[\s\S]*Segments/);
  });
  it("csv has no email, one row per version, totals and Lead tags", () => {
    const csv = summaryCsv(ctx);
    assert.doesNotMatch(csv, EMAIL);
    assert.doesNotMatch(csv, IPV4);
    const rows = parseCsv(csv);
    const versions = rows.filter((r) => r[0] === "Headline test" && /^Headline [ABC]$/.test(r[1]));
    assert.equal(versions.length, 3);
    const total = rows.find((r) => r[1] === "Total")!;
    assert.equal(total[3], String(deck.payload.totals.swipers));
    assert.ok(rows.some((r) => r[1] === "State" && r[7] === "Lead"));
    assert.ok(csv.includes("Numbers as of 15 Nov 2026, 18:20 IST"));
    const b = versions.find((r) => r[1] === "Headline B")!;
    assert.equal(b[14], "Lead");
  });
});

describe("report PDF", () => {
  it("is stamped, tagged and free of emails", () => {
    const deck = deckData();
    const doc = reportDocument({ productName: "Voice Khata", scopeText: "this deck", decks: [deck], now: NOW });
    const pdf = buildPdf(doc).toString("latin1");
    assert.ok(pdf.startsWith("%PDF-"));
    assert.match(pdf, /Numbers as of 15 Nov 2026, 18:20 IST/);
    assert.match(pdf, /Headline B is in the lead\./);
    assert.match(pdf, /Lead:/);
    assert.doesNotMatch(pdf, EMAIL);
  });
});

describe("bundle", () => {
  const decks = [deckData(), deckData(SAMPLE_PRICE_DECK_ID, "Price test")];
  const base = { productName: "Voice Khata", decks, now: NOW };

  it("zips several files, each stamped, plus a README", () => {
    const b = bundleExport({ ...base, scope: "product", files: [...EXPORT_FILES] as ExportFile[] });
    assert.match(b.name, /^pitchswipe-voice-khata-all-decks-20261115-1820\.zip$/);
    const entries = readZip(b.data);
    const names = entries.map((e) => e.name);
    assert.equal(names.filter((n) => n.includes("20261115-1820")).length, 5);
    assert.ok(names.some((n) => n.endsWith(".pdf")) && names.some((n) => n.endsWith(".xlsx")) && names.includes("README.txt"));
    for (const e of entries.filter((e) => e.name.endsWith(".csv"))) {
      const t = Buffer.from(e.data).toString("utf8");
      if (e.name.includes("waitlist")) assert.match(t, EMAIL);
      else assert.doesNotMatch(t, EMAIL, e.name);
      assert.doesNotMatch(t, IPV4, e.name);
    }
    const pdf = Buffer.from(entries.find((e) => e.name.endsWith(".pdf"))!.data).toString("latin1");
    assert.ok(pdf.startsWith("%PDF-"));
    const readme = Buffer.from(entries.find((e) => e.name === "README.txt")!.data).toString();
    assert.match(readme, /Numbers as of 15 Nov 2026, 18:20 IST/);
  });
  it("returns a single file as is and the summary as xlsx + csv", () => {
    const one = bundleExport({ ...base, scope: "deck", files: ["waitlist"] });
    assert.match(one.name, /waitlist-20261115-1820\.csv$/);
    assert.equal(one.contentType, "text/csv; charset=utf-8");
    assert.equal(buildExportFiles({ ...base, scope: "deck", files: ["summary"] }).length, 2);
  });
});

describe("request parsing and service", () => {
  const decks = [deckData()];
  const load = async (_o: string, id: string) => (id === SAMPLE_HEADLINE_DECK_ID ? decks : null);
  const req = { deckId: SAMPLE_HEADLINE_DECK_ID, scope: "deck" as const, files: ["report" as const, "waitlist" as const] };

  it("validates input", () => {
    assert.equal(parseExportRequest({}).ok, false);
    assert.equal(parseExportRequest({ deckId: "d", files: "nope" }).ok, false);
    assert.equal(parseExportRequest({ deckId: "d", files: "report", scope: "all" }).ok, false);
    const ok = parseExportRequest({ deckId: "d", files: "report,summary,report" });
    assert.ok(ok.ok && ok.value.files.length === 2 && ok.value.scope === "deck" && ok.value.delivery === "download");
  });
  it("404s for a deck that is not the founder's", async () => {
    const out = await runExport("o", { ...req, deckId: "someone-elses", delivery: "download" }, { load, mailer: null, founderEmail: null, now: NOW });
    assert.equal(out.kind === "error" && out.status, 404);
  });
  it("sends nothing without a mailer (no RESEND_API_KEY)", async () => {
    assert.equal(mailerFromEnv({}), null);
    const out = await runExport("o", { ...req, delivery: "email" }, { load, mailer: null, founderEmail: "a@b.co", now: NOW });
    assert.equal(out.kind === "error" && out.status, 503);
  });
  it("emails the zip only to the founder's own address", async () => {
    const sent: MailMessage[] = [];
    const mailer: Mailer = { send: async (m) => void sent.push(m) };
    const out = await runExport("o", { ...req, delivery: "email" }, { load, mailer, founderEmail: "founder@example.com", now: NOW });
    assert.equal(out.kind, "emailed");
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, "founder@example.com");
    assert.match(sent[0].attachments[0].filename, /\.zip$/);
    assert.equal(readZip(sent[0].attachments[0].content).length, 3);
    assert.equal(out.kind === "emailed" && out.to, "f***@example.com");
  });
  it("downloads", async () => {
    const out = await runExport("o", { ...req, delivery: "download" }, { load, mailer: null, founderEmail: null, now: NOW });
    assert.ok(out.kind === "download" && out.bundle.name.endsWith(".zip"));
  });
  it("resend adapter posts base64 attachments with the key", async () => {
    let seen: { url: string; headers: Record<string, string>; body: string } | undefined;
    const mailer = createResendMailer({
      apiKey: "test-key",
      from: "PitchSwipe <x@example.com>",
      fetchImpl: async (url, init) => {
        seen = { url, headers: init.headers, body: init.body };
        return { ok: true, status: 200 };
      },
    });
    await mailer.send({ to: "a@b.co", subject: "s", text: "t", attachments: [{ filename: "f.zip", content: Buffer.from("hi") }] });
    assert.equal(seen?.url, "https://api.resend.com/emails");
    assert.equal(seen?.headers.authorization, "Bearer test-key");
    assert.equal(JSON.parse(seen!.body).attachments[0].content, Buffer.from("hi").toString("base64"));
  });
});
