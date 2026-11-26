"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft } from "lucide-react";

import type { AskAnswer, HistoryTurn } from "@/lib/ask/types";
import { DemoBadge } from "@/components/ui/demo-badge";
import { cn } from "@/lib/utils";

import { askQuestion, loadAskIntro, type AskIntro } from "./api";
import { AssistantMark, RenderComponent, ToolLines, ToolsPanel } from "./ask-parts";

type Turn =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; answer: AskAnswer }
  | { id: number; role: "error"; text: string };

const MAX_QUESTION = 500;

function AnswerView({ answer }: { answer: AskAnswer }) {
  return (
    <div className="flex gap-3">
      <AssistantMark />
      <div className="min-w-0 flex-1 space-y-3">
        <ToolLines steps={answer.steps} />
        {answer.text && <p className="text-base leading-snug md:text-[1.05rem]">{answer.text}</p>}
        {answer.components.map((c, i) => (
          <RenderComponent key={i} c={c} />
        ))}
        {answer.notes.length > 0 && (
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {answer.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * F12 Ask your results (phone 26, web 26). Demo mode gets `initial` rendered on the server; otherwise the
 * header and suggested questions load with the founder's sign-in token. Each question is one POST /api/ask.
 */
export function AskScreen({ deckId, initial }: { deckId: string; initial?: AskIntro }) {
  const [intro, setIntro] = React.useState<AskIntro | undefined>(initial);
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const seq = React.useRef(0);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (initial) return;
    let cancelled = false;
    loadAskIntro(deckId)
      .then((v) => !cancelled && setIntro(v))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [deckId, initial]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns, busy]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const history: HistoryTurn[] = turns.flatMap((t): HistoryTurn[] =>
      t.role === "user" ? [{ role: "user", text: t.text }] : t.role === "assistant" && t.answer.text ? [{ role: "assistant", text: t.answer.text }] : [],
    );
    setTurns((prev) => [...prev, { id: ++seq.current, role: "user", text: q }]);
    setText("");
    setBusy(true);
    try {
      const answer = await askQuestion(deckId, q, history);
      setTurns((prev) => [...prev, { id: ++seq.current, role: "assistant", answer }]);
    } catch (error) {
      setTurns((prev) => [...prev, { id: ++seq.current, role: "error", text: error instanceof Error ? error.message : "Could not answer that. Try again." }]);
    } finally {
      setBusy(false);
    }
  }

  const header = intro?.header;
  const name = header?.productName ?? "your product";

  return (
    <div>
      <div className="mb-4 flex items-center gap-3 md:flex-wrap md:items-end md:justify-between md:gap-x-6 md:gap-y-1">
        <Link
          href="/decks"
          aria-label="Back to My decks"
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-background md:hidden"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl tracking-tight md:text-5xl">Ask {name}</h1>
          {header?.demo && <DemoBadge className="mt-1" />}
          {header && (
            <p className="text-sm text-muted-foreground md:hidden">
              {header.decks} {header.decks === 1 ? "deck" : "decks"} · {header.swipers.toLocaleString("en-US")} {header.swipersLabel}
              {header.updated ? ` · updated ${header.updated}` : ""}
            </p>
          )}
        </div>
        {header && (
          <p className="hidden text-base text-muted-foreground md:block md:pb-2">
            {header.decks} {header.decks === 1 ? "deck" : "decks"} · {header.swipers.toLocaleString("en-US")} {header.swipersLabel}
            {header.updated ? ` · updated ${header.updated}` : ""}
          </p>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1fr)_17rem]">
        <section className="flex min-h-[28rem] flex-col rounded-2xl md:border md:border-border md:bg-card md:p-5" aria-label="Chat">
          <div className="flex-1 space-y-5" role="log" aria-live="polite" aria-relevant="additions">
            {header?.demo && (
              <p className="text-xs text-muted-foreground">
                Demo data: the numbers and the sample comments in these answers are made up for the mockup.
              </p>
            )}
            {turns.length === 0 && !busy && (
              <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
                Ask about your cards, states, price or comments. I look up your results with tools, and code fills every number.
              </p>
            )}
            {turns.map((t) =>
              t.role === "user" ? (
                <div key={t.id} className="flex justify-end">
                  <p className="max-w-[85%] rounded-3xl rounded-tr-lg bg-foreground px-5 py-3 text-base text-background">{t.text}</p>
                </div>
              ) : t.role === "assistant" ? (
                <AnswerView key={t.id} answer={t.answer} />
              ) : (
                <p key={t.id} role="alert" className="rounded-xl bg-warning-soft px-4 py-3 text-sm font-semibold text-warning">
                  {t.text}
                </p>
              ),
            )}
            {busy && (
              <div className="flex items-center gap-3" aria-label="Looking at your results">
                <AssistantMark />
                <p className="animate-pulse text-sm text-muted-foreground">Looking at your results…</p>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="mt-5 space-y-3">
            {intro && intro.suggestions.length > 0 && (
              <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" aria-label="Suggested questions">
                {intro.suggestions.map((s) => (
                  <li key={s} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => send(s)}
                      disabled={busy}
                      className="whitespace-nowrap rounded-full border border-border bg-background px-4 py-2.5 text-sm font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(text);
              }}
              className="flex items-center gap-2 rounded-full border border-border bg-background py-1.5 pl-5 pr-1.5 focus-within:ring-2 focus-within:ring-ring"
            >
              <label htmlFor="ask-input" className="sr-only">
                Ask about {name} results
              </label>
              <input
                id="ask-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={MAX_QUESTION}
                placeholder={`Ask about ${name} results...`}
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                disabled={busy || !text.trim()}
                aria-label="Send question"
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl bg-foreground text-background transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  (busy || !text.trim()) && "opacity-40",
                )}
              >
                <ArrowRight className="size-5" aria-hidden />
              </button>
            </form>
            <p className="text-center text-xs text-muted-foreground md:text-sm">Answers use only your results. Numbers come from the data, not the AI.</p>
          </div>
        </section>

        <ToolsPanel />
      </div>
    </div>
  );
}
