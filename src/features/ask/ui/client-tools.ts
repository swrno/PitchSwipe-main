"use client";

/** The chat's CLIENT tools: they run in the browser with the user's own session, no server tool. Inputs are re-validated here. */
import { ACTION_NAMES, CLIENT_NAMES, validateAppPath } from "../app-map";
import { PALETTE_PRESETS, getPreset, type PaletteChoice } from "@/shared/lib/feel/palettes";
import { readPaletteChoice, savePaletteChoice } from "@/shared/lib/feel/palette";
import { applyTheme, readTheme } from "@/shared/lib/feel/theme";
import { downloadExport } from "@/features/export/ui/api";
import type { ExportFile } from "@/features/export/types";

export const isClientTool = (name: string): boolean => (CLIENT_NAMES as readonly string[]).includes(name);
export const isActionTool = (name: string): boolean => (ACTION_NAMES as readonly string[]).includes(name);

const FILES: Record<string, ExportFile[]> = { results: ["report", "summary"], audience: ["swipes"], waitlist: ["waitlist"] };

/** What the page's theme is now, sent with each message so "which theme am I on?" has an answer. */
export function currentThemeInfo(): { mode: "light" | "dark"; presetId: string } {
  const mode = readTheme();
  return { mode, presetId: readPaletteChoice()[mode]?.presetId ?? "pitchswipe" };
}

export async function runClientTool(name: string, input: Record<string, unknown>, navigate: (path: string) => void): Promise<Record<string, unknown>> {
  if (name === "open_page") {
    const check = validateAppPath(input.path);
    if (!check.ok) throw new Error(check.error);
    navigate(check.path);
    return { ok: true, opened: check.path };
  }
  if (name === "open_download") {
    const files = FILES[String(input.tab)];
    const test = typeof input.test === "string" ? input.test : "";
    if (!files || !test) throw new Error("Pick a test and a tab: results, audience or waitlist.");
    const file = await downloadExport({ deckId: test, scope: input.scope === "product" ? "product" : "deck", files });
    return { ok: true, file };
  }
  if (name === "set_theme") {
    const mode = input.mode === "light" || input.mode === "dark" ? input.mode : null;
    const preset = typeof input.preset === "string" ? getPreset(input.preset) : undefined;
    if (!mode && !preset) throw new Error(`Unknown theme. Presets: ${PALETTE_PRESETS.map((p) => p.id).join(", ")}.`);
    if (preset) {
      const choice: PaletteChoice = { light: { presetId: preset.id }, dark: { presetId: preset.id } };
      savePaletteChoice(choice, mode ?? readTheme());
    }
    if (mode) applyTheme(mode);
    return { ok: true, preset: preset?.id ?? null, mode: mode ?? readTheme() };
  }
  throw new Error("Unknown tool.");
}
