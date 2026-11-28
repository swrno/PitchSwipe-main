"use client";

import * as React from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, Check, Loader2, Square, X } from "lucide-react";

import type { RenderedComponent } from "@/features/ask/types";
import { cn } from "@/shared/lib/utils";

import { askFetch, loadAskIntro, type AskIntro } from "./api";
import { RenderComponent } from "./ask-parts";
import { Skeleton } from "@/shared/ui/skeleton";


const MAX_QUESTION = 500;

interface ToolPartLike {
  type: string;
  state?: "input-streaming" | "input-available" | "output-available" | "output-error";
  output?: unknown;
}

const isToolPart = (p: { type: string }): p is ToolPartLike => p.type.startsWith("tool-");

function ToolLine({ part }: { part: ToolPartLike }) {
  const out = part.output as { summary?: string; error?: string } | undefined;
  const done = part.state === "output-available";
  const failed = part.state === "output-error" || (done && !!out?.error);
  const label = failed ? "Could not look that up" : done ? (out?.summary ?? "Looked up your results") : "Looking up your results";
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      {done && !failed ? <Check aria-hidden className="size-3.5 shrink-0" /> : failed ? <X aria-hidden className="size-3.5 shrink-0" /> : <Loader2 aria-hidden className="size-3.5 shrink-0 animate-spin" />}
      <span className="min-w-0 truncate">{label}</span>
    </p>
  );
}

function ShowPart({ part }: { part: ToolPartLike }) {
  if (part.state !== "output-available") {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 aria-hidden className="size-3.5 shrink-0 animate-spin" />
        Drawing the answer
      </p>
    );
  }
  const out = part.output as { components?: RenderedComponent[]; notes?: string[] } | undefined;
  return (
    <div className="space-y-2">
      {(out?.components ?? []).map((c, i) => (
        <RenderComponent key={i} c={c} />
      ))}
      {(out?.notes ?? []).map((n) => (
        <p key={n} className="text-xs text-muted-foreground">
          {n}
        </p>
      ))}
    </div>
  );
}

function AssistantMessage({ message }: { message: UIMessage }) {
  return (
    <div className="space-y-2">
      {message.parts.map((part, i) => {
        if (part.type === "text") {
          return part.text ? (
            <p key={i} className="text-sm leading-relaxed">
              {part.text}
            </p>
          ) : null;
        }
        if (part.type === "tool-show") return <ShowPart key={i} part={part as unknown as ToolPartLike} />;
        if (isToolPart(part)) return <ToolLine key={i} part={part} />;
        return null;
      })}
    </div>
  );
}

/**
 * The "Ask your results" chat as a right-side panel (full-screen sheet on phones). Streams from POST /api/chat:
 * tool lines, generative components from the `show` tool, and text whose numbers code has checked and filled.
 * It stays mounted once opened so a conversation survives closing and reopening.
 */
const WIDTH_KEY = "ps:chat-width";
const DEFAULT_WIDTH = 420;
const MIN_WIDTH = 340;

/** Widest the chat may get: leave the app at least 480px next to it (and never past 900px). */
function maxWidth(): number {
  return Math.max(MIN_WIDTH, Math.min(900, window.innerWidth - 480));
}

const clampWidth = (w: number) => Math.round(Math.min(maxWidth(), Math.max(MIN_WIDTH, w)));

/**
 * Split-screen width for the chat on web. While the chat is open, --chat-width on <html> is its width, and the shell
 * pads the app by it (shell-frame.tsx), so the app squeezes instead of being covered. The width is kept in this
 * browser. Phones ignore it: the chat is a full-screen sheet there.
 */
function useSplitWidth(open: boolean) {
  const [width, setWidth] = React.useState(DEFAULT_WIDTH);
  const [dragging, setDragging] = React.useState(false);

  React.useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(WIDTH_KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one read of browser-only state after hydration
      if (saved) setWidth(clampWidth(saved));
    } catch {
      // storage unavailable: default width
    }
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--chat-width", open ? `${width}px` : "0px");
    return () => {
      root.style.setProperty("--chat-width", "0px");
    };
  }, [open, width]);

  const save = (w: number) => {
    try {
      window.localStorage.setItem(WIDTH_KEY, String(w));
    } catch {
      // ignore
    }
  };

  const handleProps = {
    role: "separator",
    tabIndex: 0,
    "aria-orientation": "vertical" as const,
    "aria-label": "Resize the chat",
    "aria-valuenow": width,
    "aria-valuemin": MIN_WIDTH,
    onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
      document.documentElement.dataset.resizing = "true";
    },
    onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      setWidth(clampWidth(window.innerWidth - e.clientX));
    },
    onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setDragging(false);
      delete document.documentElement.dataset.resizing;
      setWidth((w) => {
        save(w);
        return w;
      });
    },
    onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      setWidth((w) => {
        const next = clampWidth(w + (e.key === "ArrowLeft" ? 32 : -32));
        save(next);
        return next;
      });
    },
  };

  return { width, dragging, handleProps };
}

export function AskPanel({ open, onClose, deckId }: { open: boolean; onClose: () => void; deckId: string | null }) {
  const transport = React.useMemo(() => new DefaultChatTransport({ api: "/api/chat", fetch: askFetch as typeof fetch }), []);
  const { messages, sendMessage, status, stop, error, setMessages } = useChat({ transport });
  const busy = status === "submitted" || status === "streaming";

  const [intro, setIntro] = React.useState<AskIntro | null>(null);
  const [text, setText] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const endRef = React.useRef<HTMLDivElement>(null);
  const lastDeck = React.useRef(deckId);

  // A different deck is a different conversation.
  React.useEffect(() => {
    if (lastDeck.current !== deckId) {
      lastDeck.current = deckId;
      setMessages([]);
      setIntro(null);
    }
  }, [deckId, setMessages]);

  React.useEffect(() => {
    if (!open || intro) return;
    let cancelled = false;
    loadAskIntro(deckId)
      .then((v) => !cancelled && setIntro(v))
      .catch(() => !cancelled && setIntro({ header: null, suggestions: [] }));
    return () => {
      cancelled = true;
    };
  }, [open, intro, deckId]);

  React.useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, status]);

  function send(question: string) {
    const q = question.trim().slice(0, MAX_QUESTION);
    if (!q || busy) return;
    setText("");
    void sendMessage({ text: q }, { body: { deckId: deckId ?? undefined } });
  }

  const header = intro?.header;
  const name = header?.productName ?? "your results";
  const { width, dragging, handleProps } = useSplitWidth(open);

  return (
    <aside
      aria-label={`Ask ${name}`}
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-background shadow-xl ease-out md:z-30 md:w-[var(--chat-panel-width)] md:shadow-none",
        !dragging && "transition-transform duration-200",
        open ? "translate-x-0" : "pointer-events-none translate-x-full",
      )}
      style={{ ["--chat-panel-width" as string]: `${width}px` }}
    >
      {/* Web: drag the left edge to resize the split (arrow keys work when it has focus). */}
      <div
        {...handleProps}
        className="group absolute inset-y-0 -left-1.5 z-10 hidden w-3 cursor-col-resize touch-none outline-none md:block"
      >
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors group-hover:bg-accent group-focus-visible:bg-accent",
            dragging && "bg-accent",
          )}
        />
      </div>
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-extrabold tracking-tight">Ask {header?.productName ?? "your results"}</h2>
          {header ? (
            <p className="truncate text-xs text-muted-foreground">
              {header.decks} {header.decks === 1 ? "test" : "tests"} · {header.swipers.toLocaleString("en-US")} {header.swipersLabel}
              {header.updated ? ` · updated ${header.updated}` : ""}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="flex size-11 md:size-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4" role="log" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="rounded-2xl bg-muted p-3.5 text-sm text-muted-foreground">
              Ask about your cards, states, price or comments. I look up your results with tools, and code fills every number.
            </p>
            {!intro && (
              <div role="status" aria-label="Loading suggested questions" className="flex flex-wrap gap-2">
                <span className="sr-only">Loading suggested questions…</span>
                <Skeleton className="h-10 w-44 rounded-lg" />
                <Skeleton className="h-10 w-32 rounded-lg" />
                <Skeleton className="h-10 w-52 rounded-lg" />
              </div>
            )}
            {intro && intro.suggestions.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Suggested questions">
                {intro.suggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => send(s)}
                      disabled={busy}
                      className="rounded-lg border border-border bg-background px-3.5 py-2 text-left text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                {m.parts.map((p) => (p.type === "text" ? p.text : "")).join("")}
              </p>
            </div>
          ) : (
            <AssistantMessage key={m.id} message={m} />
          ),
        )}
        {status === "submitted" && (
          <div role="status" aria-label="Thinking" className="space-y-2">
            <span className="sr-only">Thinking…</span>
            <Skeleton className="h-12 w-[85%] rounded-2xl rounded-tl-md" />
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-muted px-3.5 py-2.5 text-sm text-foreground">
            Could not answer that. Try again.
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-4 pr-1.5 focus-within:ring-2 focus-within:ring-ring">
          <label htmlFor="ask-input" className="sr-only">
            Ask about {name}
          </label>
          <input
            id="ask-input"
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            maxLength={MAX_QUESTION}
            placeholder="Ask about your results..."
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-base outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => void stop()}
              aria-label="Stop"
              className="flex size-11 md:size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Square className="size-3.5 fill-current" aria-hidden />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!text.trim()}
              aria-label="Send question"
              className="flex size-11 md:size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40"
            >
              <ArrowUp className="size-4" aria-hidden />
            </button>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">Answers use only your results. Numbers come from the data, not the AI.</p>
      </form>
    </aside>
  );
}
