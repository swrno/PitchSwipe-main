/**
 * `?demo=1` on /signup and /verify renders the screen without Firebase so the layout can be checked and
 * demoed. Server-side gate: only in development, or when PITCHSWIPE_DEMO=1. The preview never submits,
 * never calls Firebase and never stores anything.
 */
export function previewAllowed(demoParam: string | string[] | undefined): boolean {
  if (demoParam !== "1") return false;
  return process.env.NODE_ENV !== "production" || process.env.PITCHSWIPE_DEMO === "1";
}
