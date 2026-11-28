"use client";

import { IconLabel } from "@/shared/ui/icon";
import { SlidersHorizontal } from "lucide-react";
import * as React from "react";
import { AlertTriangle, Check } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { haptic } from "@/shared/lib/feel/haptics";
import { readPaletteChoice, savePaletteChoice } from "@/shared/lib/feel/palette";
import {
  CUSTOM_PRESET_ID, DEFAULT_PRESET_ID, PALETTE_PRESETS, TOKEN_KEYS, customFromTokens, failingPairs, normalizeHex, resolveTokens,
  type CustomColors, type PaletteChoice, type PaletteMode, type TokenSet,
} from "@/shared/lib/feel/palettes";
import { readTheme } from "@/shared/lib/feel/theme";
import { cn } from "@/shared/lib/utils";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const MODES: PaletteMode[] = ["light", "dark"];
const COLOR_ROWS: { key: keyof CustomColors; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "brand", label: "Brand" },
  { key: "accent", label: "Accent" },
];

/** Pick a palette for light and dark mode, or set three custom colours; a live preview shows the result before Apply. */
export function AppearanceScreen() {
  const [mode, setMode] = React.useState<PaletteMode>("dark");
  const [choice, setChoice] = React.useState<PaletteChoice>({});
  const [status, setStatus] = React.useState("");

  React.useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one read of browser-only state after hydration */
    setMode(readTheme());
    setChoice(readPaletteChoice());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const selection = choice[mode];
  const tokens = resolveTokens(mode, selection);
  const activeId = selection?.custom ? CUSTOM_PRESET_ID : (selection?.presetId ?? DEFAULT_PRESET_ID);
  const problems = failingPairs(tokens);

  const update = (next: PaletteChoice[PaletteMode]) => {
    setChoice((c) => ({ ...c, [mode]: next }));
    setStatus("");
  };

  const apply = () => {
    haptic("select");
    setStatus(savePaletteChoice(choice, readTheme()) ? "Applied. Your colours are saved on this device." : "Applied for this visit. This browser blocked saving.");
  };
  const reset = () => {
    haptic("select");
    setChoice({});
    savePaletteChoice({}, readTheme());
    setStatus("Back to the PitchSwipe default.");
  };

  return (
    <div className="rise-children space-y-6">
      <p className="max-w-[60ch] text-sm text-muted-foreground">
        Pick a colour theme for light and dark mode. Saved on this device only.
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <div role="tablist" aria-label="Mode to edit" className="inline-flex rounded-lg bg-muted p-1">
            {MODES.map((m) => (
              <button
                key={m}
                role="tab"
                type="button"
                id={`mode-${m}`}
                aria-selected={mode === m}
                aria-controls="appearance-panel"
                tabIndex={mode === m ? 0 : -1}
                onClick={() => setMode(m)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                    const other = m === "light" ? "dark" : "light";
                    setMode(other);
                    requestAnimationFrame(() => document.getElementById(`mode-${other}`)?.focus());
                  }
                }}
                className={cn("min-h-9 rounded-md px-4 text-sm font-semibold", FOCUS, mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {m === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>

          <div id="appearance-panel" role="tabpanel" aria-labelledby={`mode-${mode}`} className="space-y-6">
            <PresetGrid mode={mode} activeId={activeId} onPick={(id) => update({ presetId: id })} />
            <CustomColorsEditor
              key={`${mode}-${activeId}`}
              colors={selection?.custom ?? customFromTokens(tokens)}
              active={activeId === CUSTOM_PRESET_ID}
              onChange={(custom) => update({ presetId: CUSTOM_PRESET_ID, custom })}
            />
            {problems.length > 0 ? (
              <div role="status" className="space-y-1 rounded-lg border border-warning/40 bg-warning-soft p-4 text-sm">
                <p className="flex items-center gap-2 font-semibold">
                  <AlertTriangle aria-hidden className="size-4" /> Some text will be hard to read
                </p>
                <ul className="list-disc pl-6 text-muted-foreground">
                  {problems.map((p) => (
                    <li key={p.label}>
                      {p.label}: {p.ratio.toFixed(1)}:1 (needs 4.5:1)
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        <aside aria-label="Preview" className="space-y-3 lg:sticky lg:top-6 lg:self-start">
          <h2 className="text-sm font-semibold text-muted-foreground"><IconLabel icon="preview">Preview ({mode})</IconLabel></h2>
          <Preview tokens={tokens} />
        </aside>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={apply}>
          Apply
        </Button>
        <Button type="button" variant="outline" onClick={reset}>
          Reset to default
        </Button>
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {status}
        </p>
      </div>
    </div>
  );
}

function PresetGrid({ mode, activeId, onPick }: { mode: PaletteMode; activeId: string; onPick: (id: string) => void }) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  // With no match (custom colours) the first card takes the tab stop.
  const stop = Math.max(0, PALETTE_PRESETS.findIndex((p) => p.id === activeId));
  const move = (from: number, delta: number) => {
    const next = (from + delta + PALETTE_PRESETS.length) % PALETTE_PRESETS.length;
    onPick(PALETTE_PRESETS[next].id);
    refs.current[next]?.focus();
  };
  return (
    <section aria-labelledby="presets-h" className="space-y-3">
      <h2 id="presets-h" className="text-lg font-semibold">
        <IconLabel icon="appearance">Themes</IconLabel>
      </h2>
      <div role="radiogroup" aria-labelledby="presets-h" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {PALETTE_PRESETS.map((p, i) => {
          const t = p[mode];
          const checked = p.id === activeId;
          return (
            <button
              key={p.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={i === stop ? 0 : -1}
              onClick={() => onPick(p.id)}
              onKeyDown={(e) => {
                const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
                if (!delta) return;
                e.preventDefault();
                move(i, delta);
              }}
              className={cn("rounded-xl border-2 bg-card p-3 text-left transition-colors hover:bg-muted", FOCUS, checked ? "border-foreground" : "border-border")}
            >
              <span className="flex items-center justify-between">
                <span aria-hidden className="flex">
                  {[t.background, t.primary, t.accent].map((c, k) => (
                    <span key={k} className="-ml-1 size-5 rounded-full border border-border first:ml-0" style={{ background: c }} />
                  ))}
                </span>
                {checked ? <Check aria-hidden className="size-4" /> : null}
              </span>
              <span className="mt-2 block text-sm font-semibold">{p.name}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{p.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CustomColorsEditor({ colors, active, onChange }: { colors: CustomColors; active: boolean; onChange: (c: CustomColors) => void }) {
  return (
    <section aria-labelledby="custom-h" className="space-y-3">
      <h2 id="custom-h" className="text-lg font-semibold">
        <IconLabel icon={SlidersHorizontal}>Custom colours</IconLabel>
      </h2>
      <p className="text-sm text-muted-foreground">
        Pick three colours. Cards, borders and text colours follow from them{active ? "" : " (editing switches from the theme above to custom)"}.
      </p>
      <div className="space-y-2">
        {COLOR_ROWS.map(({ key, label }) => (
          <ColorRow key={key} label={label} value={colors[key]} onCommit={(v) => onChange({ ...colors, [key]: v })} />
        ))}
      </div>
    </section>
  );
}

function ColorRow({ label, value, onCommit }: { label: string; value: string; onCommit: (hex: string) => void }) {
  const [draft, setDraft] = React.useState(value);
  const id = React.useId();
  const valid = normalizeHex(draft) !== null;
  // Follow the value when it changes from outside (the picker, or another theme).
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keeps the text box in step with the colour picker
    setDraft(value);
  }, [value]);
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        aria-label={`${label} colour picker`}
        value={normalizeHex(value) ?? "#000000"}
        onChange={(e) => onCommit(e.target.value)}
        className={cn("size-10 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5", FOCUS)}
      />
      <label htmlFor={id} className="w-24 text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        value={draft}
        spellCheck={false}
        autoComplete="off"
        maxLength={7}
        aria-invalid={!valid}
        aria-describedby={valid ? undefined : `${id}-err`}
        onChange={(e) => {
          setDraft(e.target.value);
          const hex = normalizeHex(e.target.value);
          if (hex) onCommit(hex);
        }}
        className={cn("h-10 w-28 rounded-md border bg-card px-3 font-mono text-sm", FOCUS, valid ? "border-input" : "border-destructive")}
      />
      {valid ? null : (
        <span id={`${id}-err`} className="text-xs text-destructive">
          Use a hex colour like #1a2b3c
        </span>
      )}
    </div>
  );
}

/** Mini app drawn with the candidate tokens only (set as custom properties on this element, not on the page). */
function Preview({ tokens }: { tokens: TokenSet }) {
  const style = Object.fromEntries(TOKEN_KEYS.map((k) => [`--${k}`, tokens[k]])) as React.CSSProperties;
  return (
    <div style={style} className="flex overflow-hidden rounded-xl border border-border bg-background text-foreground" aria-hidden>
      <div className="w-16 shrink-0 space-y-2 border-r border-border bg-card p-2">
        <div className="size-5 rounded-md bg-accent" />
        <div className="rounded-md bg-accent-soft px-1.5 py-1 text-[10px] font-semibold text-foreground">Swipe</div>
        <div className="px-1.5 py-1 text-[10px] text-muted-foreground">Tests</div>
        <div className="px-1.5 py-1 text-[10px] text-muted-foreground">Wallet</div>
      </div>
      <div className="min-w-0 flex-1 space-y-3 p-3">
        <div className="rounded-lg border border-border bg-card p-3 text-card-foreground">
          <p className="text-xs text-muted-foreground">Ideas liked</p>
          <p className="text-2xl font-semibold">128</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Test an idea</span>
          <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-foreground">+12%</span>
          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">Draft</span>
        </div>
      </div>
    </div>
  );
}
