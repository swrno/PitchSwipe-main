/**
 * Haptics: short taps that confirm what the swiper did. Client only, never throws, never blocks.
 *
 * Order of preference:
 *  1. The Capacitor Haptics plugin, when the app runs in the native shell and the plugin is installed
 *     (read from window.Capacitor at call time, so the web bundle has no native dependency).
 *  2. navigator.vibrate (Android browsers). iOS Safari has no web vibration API, so on an iPhone in the
 *     browser this is silent.
 *  3. Nothing.
 *
 * The swiper can turn haptics off (setHapticsEnabled(false)); the choice is kept in this browser only.
 */

export type Haptic = "tick" | "select" | "commit" | "success" | "warning";

/** Vibration patterns in ms. Short: a buzz longer than ~30 ms reads as a notification, not as feedback. */
const PATTERN: Record<Haptic, number | number[]> = {
  tick: 6,
  select: 10,
  commit: 18,
  success: [12, 60, 22],
  warning: [24, 80, 24],
};

const STORAGE_KEY = "ps:haptics";

interface CapacitorHaptics {
  impact(options: { style: "LIGHT" | "MEDIUM" | "HEAVY" }): Promise<void>;
  notification(options: { type: "SUCCESS" | "WARNING" | "ERROR" }): Promise<void>;
  selectionStart?(): Promise<void>;
  selectionChanged?(): Promise<void>;
}

// The native selection tick only fires inside a selectionStart() / selectionEnd() pair (Android and iOS both
// ignore selectionChanged() otherwise), so the first select starts one and leaves it open.
let selectionOpen: Promise<void> | null = null;

function selectionTick(native: CapacitorHaptics): Promise<void> {
  if (!native.selectionStart || !native.selectionChanged) return native.impact({ style: "LIGHT" });
  selectionOpen ??= native.selectionStart().catch(() => {
    selectionOpen = null;
  });
  return selectionOpen.then(() => native.selectionChanged?.());
}

function nativeHaptics(): CapacitorHaptics | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { Haptics?: CapacitorHaptics } } })
    .Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.Haptics ?? null;
}

export function hapticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setHapticsEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // Private mode or blocked storage: the setting just does not persist.
  }
}

/** True when this device can give any haptic feedback at all (to decide whether to show the setting). */
export function hapticsSupported(): boolean {
  if (typeof window === "undefined") return false;
  return nativeHaptics() !== null || typeof navigator.vibrate === "function";
}

export function haptic(kind: Haptic): void {
  if (!hapticsEnabled()) return;
  const native = nativeHaptics();
  if (native) {
    const run =
      kind === "success"
        ? native.notification({ type: "SUCCESS" })
        : kind === "warning"
          ? native.notification({ type: "WARNING" })
          : kind === "select"
            ? selectionTick(native)
            : native.impact({ style: kind === "commit" ? "MEDIUM" : "LIGHT" });
    run.catch(() => undefined);
    return;
  }
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(PATTERN[kind]);
    } catch {
      // Some browsers throw before the first user gesture; feedback is optional.
    }
  }
}
