import type { PracticeMode, QualityResult } from "@/features/quality";

export interface PracticeOutcome extends QualityResult {
  mode: PracticeMode;
  persisted?: boolean;
}

const KEY = "pitchswipe.quality.result";

/** The just-finished run, kept for the result screen. Per tab; failures are ignored. */
export function saveOutcome(outcome: PracticeOutcome): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(outcome));
  } catch {
    /* private mode: the result screen falls back to the saved score */
  }
}

export function loadOutcome(): PracticeOutcome | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PracticeOutcome) : null;
  } catch {
    return null;
  }
}
