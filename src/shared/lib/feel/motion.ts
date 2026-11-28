/**
 * Motion presets (framer-motion). Motion here answers something the user did: a press, a swipe, a sheet
 * opening, a value changing. Nothing moves on its own to decorate. Components read useReducedMotion() and
 * fall back to a plain fade when the system asks for less motion; globals.css also cuts CSS transitions.
 */
import type { Transition } from "framer-motion";

/** Something the user threw or dragged settling: quick, a little bounce. */
export const SPRING_SNAPPY: Transition = { type: "spring", stiffness: 520, damping: 34, mass: 0.9 };

/** Panels and sheets arriving: no bounce, settles fast. */
export const SPRING_SHEET: Transition = { type: "spring", stiffness: 420, damping: 40 };

/** Small state changes (a label swapping, a badge appearing). */
export const EASE_OUT: Transition = { duration: 0.2, ease: [0.22, 1, 0.36, 1] };

/** Leaving: faster than arriving, so the next thing is not kept waiting. */
export const EXIT_FAST: Transition = { duration: 0.14, ease: [0.65, 0, 0.35, 1] };
