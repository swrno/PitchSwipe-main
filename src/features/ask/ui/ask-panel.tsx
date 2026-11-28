"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, Check, Loader2, Square, SquarePen, X } from "lucide-react";

import { useAuth } from "@/features/auth/ui/provider";
import type { RenderedComponent } from "@/features/ask/types";
import { CLIENT_NAMES, pageTitleFor } from "@/features/ask/app-map";
import { cn } from "@/shared/lib/utils";
import { buttonVariants } from "@/shared/ui/button";

import { askFetch, loadAskPage, type AskPageInfo } from "./api";
import { RenderComponent, DoneCard } from "./ask-parts";
import { currentThemeInfo, isActionTool, isClientTool, runClientTool } from "./client-tools";
import { Skeleton } from "@/shared/ui/skeleton";

const MAX_QUESTION = 500;
const STORE_PREFIX = "ps:ask:v1:";
const MAX_STORED = 40;
const CHAT_ID = "ask-pitchswipe";
/** The page for the NEXT request (read when a request is made, so a resumed turn sees the page the user is on now). */
const live = { pathname: "/" };

const SUGGESTIONS = [
  "How many products do I have?",
  "Create a product called …",
  "Draft a headline test for Mess Menu Daily",
  "Invite a co-founder",
  "Open the waitlist for my price test",
  "Switch to the Midnight theme",
];

type PartState = "input-streaming" | "input-available" | "approval-requested" | "approval-responded" | "output-available" | "output-error" | "output-denied";

interface ToolPartLike {
  type: string;
  toolCallId?: string;
  state?: PartState;
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
  approval?: { id: string; approved?: boolean; requestReason?: string; reason?: string };
}

const isToolPart = (p: { type: string }): p is ToolPartLike => p.type.startsWith("tool-");
const toolName = (p: ToolPartLike) => p.type.slice(5);

/* Tool lines and cards ------------------------------------------------------------------ */

function ToolLine({ part }: { part: ToolPartLike }) {
  const out = part.output as { summary?: string; error?: string; ok?: boolean } | undefined;
  const done = part.state === "output-available";
  const failed = part.state === "output-error" || (done && (!!out?.error || out?.ok === false));
  const client = isClientTool(toolName(part));
  const label = failed ? "Could not do that" : done ? (out?.summary ?? (client ? "Done in your browser" : "Looked it up")) : client ? "Working in your browser" : "Looking it up";
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

interface Preview {
  title: string;
  lines: { label: string; value: string }[];
  warning?: string;
  confirmLabel: string;
}

function parsePreview(part: ToolPartLike): Preview {
  try {
    const p = JSON.parse(part.approval?.requestReason ?? "") as Preview;
    if (p && typeof p.title === "string" && Array.isArray(p.lines)) return p;
  } catch {
    // fall through
  }
  return { title: toolName(part).replace(/_/g, " "), lines: [], confirmLabel: "Approve" };
}

/** The confirmation card for an action: what will happen, the exact target and values. Disabled once answered. */
function ActionCard({ part, onAnswer }: { part: ToolPartLike; onAnswer: (id: string, approved: boolean) => void }) {
  const state = part.state;
  const out = part.output as { ok?: boolean; done?: { title: string; text: string; href: string; linkLabel: string }; error?: string } | undefined;

  if (state === "output-available" && out?.ok && out.done) return <DoneCard c={{ kind: "done", ...out.done }} />;
  if (state === "output-available" || state === "output-error") {
    return (
      <p role="alert" className="rounded-2xl border border-border bg-warning-soft px-3.5 py-3 text-sm text-warning">
        Could not do that: {out?.error ?? part.errorText ?? "it failed."}
      </p>
    );
  }
  if (state === "output-denied" || (state === "approval-responded" && part.approval?.approved === false)) {
    return <p className="rounded-2xl bg-muted px-3.5 py-3 text-sm text-muted-foreground">Cancelled. Nothing was changed.</p>;
  }
  if (state !== "approval-requested" && state !== "approval-responded") {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 aria-hidden className="size-3.5 animate-spin" />
        Getting the details ready
      </p>
    );
  }
  const preview = parsePreview(part);
  const answered = state === "approval-responded";
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4" aria-label={preview.title}>
      <h3 className="text-base font-extrabold tracking-tight">{preview.title}</h3>
      <dl className="space-y-1.5 text-sm">
        {preview.lines.map((l) => (
          <div key={l.label} className="grid grid-cols-[6.5rem_1fr] gap-2">
            <dt className="text-muted-foreground">{l.label}</dt>
            <dd className="min-w-0 break-words font-semibold">{l.value}</dd>
          </div>
        ))}
      </dl>
      {preview.warning && <p className="text-xs text-muted-foreground">{preview.warning}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={answered}
          onClick={() => part.approval && onAnswer(part.approval.id, false)}
          className={cn(buttonVariants({ variant: "outline" }), "w-full disabled:opacity-50")}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={answered}
          onClick={() => part.approval && onAnswer(part.approval.id, true)}
          className={cn(buttonVariants(), "w-full disabled:opacity-50")}
        >
          {answered ? (
            <>
              <Loader2 aria-hidden className="mr-1.5 size-4 animate-spin" />
              Working
            </>
          ) : (
            preview.confirmLabel
          )}
        </button>
      </div>
    </section>
  );
}

function AssistantMessage({ message, onAnswer }: { message: UIMessage; onAnswer: (id: string, approved: boolean) => void }) {
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
        if (!isToolPart(part)) return null;
        const p = part as unknown as ToolPartLike;
        const name = toolName(p);
        if (name === "show") return <ShowPart key={i} part={p} />;
        if (isActionTool(name)) return <ActionCard key={i} part={p} onAnswer={onAnswer} />;
        const card = (p.output as { card?: RenderedComponent } | undefined)?.card;
        return (
          <div key={i} className="space-y-2">
            <ToolLine part={p} />
            {card && p.state === "output-available" ? <RenderComponent c={card} /> : null}
          </div>
        );
      })}
    </div>
  );
}

/* One conversation, kept per signed-in user for this browser tab ------------------------------ */

function loadStored(uid: string): UIMessage[] {
  try {
    const raw = window.sessionStorage.getItem(STORE_PREFIX + uid);
    const list = raw ? (JSON.parse(raw) as UIMessage[]) : [];
    return Array.isArray(list) ? list.filter((m) => m && (m.role === "user" || m.role === "assistant") && Array.isArray(m.parts)) : [];
  } catch {
    return [];
  }
}

function saveStored(uid: string, messages: UIMessage[]) {
  try {
    // Only settled parts: a half-streamed tool call can never resume after a reload.
    const settled = messages.slice(-MAX_STORED).map((m) => ({
      ...m,
      parts: m.parts.filter((p) => !isToolPart(p) || (p as unknown as ToolPartLike).state !== "input-streaming"),
    }));
    window.sessionStorage.setItem(STORE_PREFIX + uid, JSON.stringify(settled));
  } catch {
    // storage full or blocked: the conversation just lives in memory
  }
}

/** Resume only when the last step is waiting on the server: an answered approval, or a browser tool that just reported back. */
function shouldResume(messages: UIMessage[]): boolean {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant") return false;
  const types = last.parts.map((p) => p.type);
  const step = last.parts.slice(types.lastIndexOf("step-start") + 1).filter((p) => isToolPart(p)) as unknown as ToolPartLike[];
  if (!step.length) return false;
  const settled = (p: ToolPartLike) => ["output-available", "output-error", "output-denied", "approval-responded"].includes(p.state ?? "");
  if (!step.every(settled)) return false;
  return step.some((p) => (isActionTool(toolName(p)) && p.state === "approval-responded") || (isClientTool(toolName(p)) && (p.state === "output-available" || p.state === "output-error")));
}

/**
 * The "Ask PitchSwipe" chat as a right-side panel (full-screen sheet on phones). Streams from POST /api/chat:
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

export function AskPanel({ open, onClose, pathname }: { open: boolean; onClose: () => void; pathname: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  React.useEffect(() => {
    live.pathname = pathname;
  }, [pathname]);
  const resumes = React.useRef(new Map<string, number>());

  // One transport and one chat id for the life of the shell: navigating never resets the conversation.
  const transport = React.useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: askFetch as typeof fetch,
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            // Earlier tool parts are never replayed (the server drops them), so keep the request small.
            messages: messages.slice(-14).map((m, i, all) => (i === all.length - 1 ? m : { ...m, parts: m.parts.filter((p) => p.type === "text") })),
            pathname: live.pathname,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            theme: currentThemeInfo(),
          },
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, stop, error, setMessages, addToolApprovalResponse, addToolOutput } = useChat({
    id: CHAT_ID,
    transport,
    sendAutomaticallyWhen: ({ messages: all }) => {
      if (!shouldResume(all)) return false;
      const key = all[all.length - 1].id;
      const n = (resumes.current.get(key) ?? 0) + 1;
      resumes.current.set(key, n);
      return n <= 3;
    },
    async onToolCall({ toolCall }) {
      const name = toolCall.toolName as string;
      if (!(CLIENT_NAMES as readonly string[]).includes(name)) return;
      try {
        const output = await runClientTool(name, (toolCall.input ?? {}) as Record<string, unknown>, (path) => router.push(path));
        void addToolOutput({ tool: name as never, toolCallId: toolCall.toolCallId, output: output as never });
      } catch (e) {
        void addToolOutput({ tool: name as never, toolCallId: toolCall.toolCallId, state: "output-error", errorText: e instanceof Error ? e.message : "Could not do that." });
      }
    },
  });
  const busy = status === "submitted" || status === "streaming";

  const [page, setPage] = React.useState<AskPageInfo | null>(null);
  const [text, setText] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const endRef = React.useRef<HTMLDivElement>(null);
  const restoredFor = React.useRef<string | null>(null);

  // Restore this tab's conversation once per signed-in user; forget it when they sign out.
  React.useEffect(() => {
    if (uid && restoredFor.current !== uid) {
      restoredFor.current = uid;
      const saved = loadStored(uid);
      if (saved.length) setMessages(saved);
    } else if (!uid && restoredFor.current) {
      try {
        window.sessionStorage.removeItem(STORE_PREFIX + restoredFor.current);
      } catch {
        // ignore
      }
      restoredFor.current = null;
      setMessages([]);
    }
  }, [uid, setMessages]);

  React.useEffect(() => {
    if (uid && restoredFor.current === uid && status === "ready") saveStored(uid, messages);
  }, [uid, messages, status]);

  // The header chip follows the page; the conversation does not.
  React.useEffect(() => {
    if (!open || !uid) return;
    let cancelled = false;
    loadAskPage(pathname).then((v) => !cancelled && setPage(v)).catch(() => !cancelled && setPage(null));
    return () => {
      cancelled = true;
    };
  }, [open, uid, pathname]);

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
    void sendMessage({ text: q });
  }

  function newChat() {
    if (busy) void stop();
    setMessages([]);
    resumes.current.clear();
    if (uid) {
      try {
        window.sessionStorage.removeItem(STORE_PREFIX + uid);
      } catch {
        // ignore
      }
    }
  }

  const chip = page?.testLabel ?? page?.productName ?? (page?.page && page.page !== "Unknown page" ? page.page : pageTitleFor(pathname));
  const { width, dragging, handleProps } = useSplitWidth(open);

  return (
    <aside
      aria-label="Ask PitchSwipe"
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
      {/* Phones: as before. md+: exactly the top bar's height (h-14) so the two bottom borders form one line. */}
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:h-14 md:items-center md:py-0 md:pt-0">
        <div className="flex min-w-0 flex-col md:flex-row md:items-center md:gap-2">
          <h2 className="truncate text-lg font-extrabold tracking-tight md:text-sm md:font-semibold">Ask PitchSwipe</h2>
          {chip ? (
            <p className="max-w-full truncate text-xs text-muted-foreground md:rounded-full md:bg-muted md:px-2 md:py-0.5" title={chip}>
              {chip}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={newChat}
            disabled={messages.length === 0}
            aria-label="New chat"
            title="New chat"
            className="flex size-11 md:size-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          >
            <SquarePen className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="flex size-11 md:size-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4" role="log" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="rounded-2xl bg-muted p-3.5 text-sm text-muted-foreground">
              Ask about your products, tests and results, or tell me what to do: create a product, draft or publish a test, invite a co-founder, open a page, change the theme. I ask you to confirm before anything changes. Numbers come from your data, not the AI.
            </p>
            <ul className="flex flex-wrap gap-2" aria-label="Suggested prompts">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => (s.endsWith("…") ? (setText(s.slice(0, -1).trimEnd() + " "), inputRef.current?.focus()) : send(s))}
                    disabled={busy}
                    className="rounded-lg border border-border bg-background px-3.5 py-2 text-left text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
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
            <AssistantMessage key={m.id} message={m} onAnswer={(id, approved) => void addToolApprovalResponse({ id, approved })} />
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
            Ask PitchSwipe
          </label>
          <input
            id="ask-input"
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            maxLength={MAX_QUESTION}
            placeholder="Ask or tell me what to do..."
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
              aria-label="Send"
              className="flex size-11 md:size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40"
            >
              <ArrowUp className="size-4" aria-hidden />
            </button>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">Changes need your approval. Numbers come from the data, not the AI.</p>
      </form>
    </aside>
  );
}
