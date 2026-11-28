"use client";

import * as React from "react";
import {
  ArrowLeft, Bell, ChevronDown, ChevronRight, Download, Gift, LayoutDashboard, Layers, Package, Plus, Sparkles, Wallet,
} from "lucide-react";
import { TOKEN_KEYS, type PaletteMode, type TokenSet } from "@/shared/lib/feel/palettes";
import { cn } from "@/shared/lib/utils";

const W = 1000;
const H = 625;
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
type View = "app" | "card";
const VIEWS: { id: View; label: string }[] = [
  { id: "app", label: "App" },
  { id: "card", label: "Swipe card" },
];

/** Illustrative miniature of the real app in the candidate palette, for the mode being edited and the other mode. */
export function ThemePreview({ mode, edited, other }: { mode: PaletteMode; edited: TokenSet; other: TokenSet }) {
  const [view, setView] = React.useState<View>("app");
  const modes: { mode: PaletteMode; tokens: TokenSet }[] = [
    { mode, tokens: edited },
    { mode: mode === "light" ? "dark" : "light", tokens: other },
  ];
  return (
    <section aria-labelledby="preview-h" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="preview-h" className="text-lg font-semibold">
          Preview <span className="ml-1 text-xs font-medium text-muted-foreground">Sample preview, numbers are made up</span>
        </h2>
        <div role="tablist" aria-label="Preview view" className="inline-flex rounded-lg bg-muted p-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              type="button"
              id={`pv-${v.id}`}
              aria-selected={view === v.id}
              aria-controls="preview-panel"
              tabIndex={view === v.id ? 0 : -1}
              onClick={() => setView(v.id)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                const next = VIEWS.find((x) => x.id !== v.id)!.id;
                setView(next);
                requestAnimationFrame(() => document.getElementById(`pv-${next}`)?.focus());
              }}
              className={cn("min-h-9 rounded-md px-4 text-sm font-semibold", FOCUS, view === v.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
      <div id="preview-panel" role="tabpanel" aria-labelledby={`pv-${view}`} className="grid gap-4 xl:grid-cols-2">
        {modes.map((m, i) => (
          <figure key={m.mode} className="space-y-1.5">
            <figcaption className="text-xs font-semibold text-muted-foreground">
              {m.mode === "light" ? "Light" : "Dark"}
              {i === 0 ? " (editing)" : ""}
            </figcaption>
            <Scaled tokens={m.tokens}>{view === "app" ? <AppView /> : <CardView />}</Scaled>
          </figure>
        ))}
      </div>
    </section>
  );
}

function Scaled({ tokens, children }: { tokens: TokenSet; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0.5);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const vars = Object.fromEntries(TOKEN_KEYS.map((k) => [`--${k}`, tokens[k]])) as React.CSSProperties;
  return (
    <div ref={ref} aria-hidden style={{ ...vars, height: H * scale }} className="relative w-full overflow-hidden rounded-xl border border-border bg-background text-foreground">
      <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "top left" }} className="absolute left-0 top-0 text-[13px] leading-snug">
        {children}
      </div>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  return (
    <svg width="46" height="46" viewBox="0 0 46 46" className="shrink-0">
      <circle cx="23" cy="23" r={r} fill="none" stroke="var(--muted)" strokeWidth="5" />
      <circle cx="23" cy="23" r={r} fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 23 23)" />
      <text x="23" y="26.5" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--foreground)">{pct}%</text>
    </svg>
  );
}

function Pill({ children, tone = "accent" }: { children: React.ReactNode; tone?: "accent" | "muted" }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold", tone === "accent" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>{children}</span>
  );
}

function PitchCard({ big }: { big?: boolean }) {
  return (
    <div className={cn("flex flex-col rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm", big ? "w-[300px] gap-4 p-5" : "w-[210px] gap-3")}>
      <div className={cn("flex items-center justify-center rounded-xl bg-accent-soft", big ? "h-[170px]" : "h-[70px]")}>
        <Package className={cn("text-accent", big ? "size-14" : "size-8")} strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Mess Menu Daily</p>
        <p className={cn("font-bold leading-tight", big ? "text-xl" : "text-[14px]")}>
          Never wonder what&apos;s for <span className="underline decoration-accent decoration-[3px] underline-offset-4">lunch</span> again
        </p>
      </div>
      <p className="text-xs text-muted-foreground">Rs 99 / month</p>
      <span className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
        <Gift className="size-3.5" /> Join waitlist, get a reward
      </span>
    </div>
  );
}

function AppView() {
  const nav = [
    { label: "Overview", icon: LayoutDashboard },
    { label: "Products", icon: Layers, open: true },
    { label: "Swipe", icon: Sparkles },
    { label: "Earnings", icon: Wallet },
  ];
  const bars = [
    { label: "Never wonder what's for lunch", pct: 62, lead: true },
    { label: "Fresh menu, every morning", pct: 41 },
    { label: "Your mess, on your phone", pct: 27 },
  ];
  return (
    <div className="flex h-full">
      <aside className="flex w-[190px] shrink-0 flex-col border-r border-border bg-card p-3">
        <div className="mb-4 flex items-center gap-2 px-1">
          <span className="grid size-7 place-items-center rounded-lg bg-accent text-accent-foreground"><Sparkles className="size-4" /></span>
          <span className="text-[15px] font-bold">PitchSwipe</span>
        </div>
        <nav className="space-y-0.5">
          {nav.map((n) => (
            <div key={n.label}>
              <div className={cn("relative flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px]", n.open ? "bg-accent-soft font-semibold" : "text-muted-foreground")}>
                {n.open ? <span className="absolute -left-3 top-1.5 h-6 w-1 rounded-r bg-accent" /> : null}
                <n.icon className="size-4" /> {n.label}
                {n.open ? <ChevronDown className="ml-auto size-3.5" /> : null}
              </div>
              {n.open ? (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-2">
                  <div className="rounded-md bg-muted px-2 py-1.5 text-xs font-semibold">Mess Menu Daily</div>
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">Gym Buddy</div>
                </div>
              ) : null}
            </div>
          ))}
        </nav>
        <span className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-[13px] font-bold text-primary-foreground"><Plus className="size-4" /> New test</span>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-5 text-xs text-muted-foreground">
          Products <ChevronRight className="size-3" /> Mess Menu Daily <ChevronRight className="size-3" /> <span className="font-semibold text-foreground">Headline test</span>
          <span className="ml-auto"><Pill tone="muted">3 tests left</Pill></span>
          <Bell className="size-4" />
          <span className="grid size-7 place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground">AK</span>
        </header>

        <div className="flex-1 space-y-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-lg border border-border bg-card"><ArrowLeft className="size-4" /></span>
            <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent"><Layers className="size-5" /></span>
            <div className="min-w-0">
              <p className="text-xl font-bold leading-none">Headline test</p>
              <p className="mt-1 text-xs text-muted-foreground">Which headline makes people want your mess app most?</p>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs font-semibold"><Download className="size-3.5" /> Download</span>
          </div>

          <div className="flex gap-5 border-b border-border text-[13px]">
            {["Results", "Audience & who swiped", "Waitlist users", "Share"].map((t, i) => (
              <span key={t} className={cn("-mb-px border-b-2 pb-2", i === 0 ? "border-accent font-semibold" : "border-transparent text-muted-foreground")}>{t}</span>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[13px]">
            <Pill>Leading</Pill>
            <span className="font-semibold">&ldquo;Never wonder what&apos;s for lunch&rdquo; is ahead of the rest.</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { l: "Swipers", v: "214" },
              { l: "Said yes", v: "98", p: 46 },
              { l: "Joined waitlist", v: "26", p: 12 },
            ].map((k) => (
              <div key={k.l} className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-card-foreground">
                <div>
                  <p className="text-xs text-muted-foreground">{k.l}</p>
                  <p className="text-2xl font-bold leading-tight">{k.v}</p>
                </div>
                {k.p ? <Ring pct={k.p} /> : null}
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <div className="min-w-0 flex-1 space-y-2.5 rounded-xl border border-border bg-card p-4 text-card-foreground">
              <p className="text-sm font-bold">Headline leaderboard</p>
              {bars.map((b) => (
                <div key={b.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">{b.label}{b.lead ? <Pill>Leading</Pill> : null}</span>
                    <span className="font-semibold">{b.pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted"><div className={cn("h-full rounded-full", b.lead ? "bg-accent" : "bg-muted-foreground/50")} style={{ width: `${b.pct}%` }} /></div>
                </div>
              ))}
            </div>
            <PitchCard />
          </div>
        </div>

        <div className="absolute bottom-4 right-5 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold shadow-lg">
          <Pill tone="muted">Coming soon</Pill> Ship the winner
        </div>
      </div>
    </div>
  );
}

function CardView() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 bg-canvas">
      <p className="text-xs font-semibold text-muted-foreground">What a swiper sees</p>
      <PitchCard big />
      <div className="flex items-center gap-3">
        <span className="rounded-full border border-border bg-card px-5 py-2 text-sm font-semibold">Skip</span>
        <span className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-accent-foreground">Yes, I want this</span>
      </div>
    </div>
  );
}
