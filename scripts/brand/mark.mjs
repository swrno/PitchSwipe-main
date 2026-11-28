// The PitchSwipe logo as plain SVG strings: the card character (cream card with a face, sky card behind) on lime.
// Same drawing as src/shared/ui/mascot.tsx. Used to write public/icons/*.svg and to render the PNG icons
// (render-icons.md describes how the PNGs were made).
//
//   node scripts/brand/mark.mjs   writes public/icons/icon.svg, public/icons/icon-maskable.svg, scripts/brand/mark.svg

import { writeFileSync } from "node:fs";

const INK = "#111111";
const LIME = "#c8f35e";
const CREAM = "#f6efe4";
const SKY = "#6ea2fd";
const CORAL = "#ff8a66";

/** The two cards, in a 96x96 box (the drawing spans roughly x 16..84, y 8..90). */
export function cardsSvg() {
  return [
    `<rect x="24" y="14" width="46" height="62" rx="11" fill="${SKY}" stroke="${INK}" stroke-width="3" transform="rotate(-12 47 45)"/>`,
    `<g transform="rotate(8 52 50)">`,
    `<rect x="28" y="18" width="48" height="64" rx="12" fill="${CREAM}" stroke="${INK}" stroke-width="3"/>`,
    `<circle cx="44" cy="45" r="3.2" fill="${INK}"/>`,
    `<circle cx="60" cy="45" r="3.2" fill="${INK}"/>`,
    `<circle cx="38.5" cy="53" r="3.4" fill="${CORAL}" opacity="0.85"/>`,
    `<circle cx="65.5" cy="53" r="3.4" fill="${CORAL}" opacity="0.85"/>`,
    `<path d="M45 54 q7 7 14 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
    `<path d="M52 74 c-3.2 -2.6 -6 -4.4 -6 -7.2 c0 -1.9 1.4 -3.2 3.1 -3.2 c1.3 0 2.3 0.8 2.9 1.8 c0.6 -1 1.6 -1.8 2.9 -1.8 c1.7 0 3.1 1.3 3.1 3.2 c0 2.8 -2.8 4.6 -6 7.2z" fill="${INK}"/>`,
    `</g>`,
  ].join("");
}

/** App icon: lime rounded square, the cards centred at about 78% of the side. */
export function iconSvg({ rounded = true } = {}) {
  const r = rounded ? 112 : 0;
  // Centre the 68x82 drawing (x 16..84, y 8..90) in 512, scaled to ~400px tall.
  const scale = 400 / 82;
  const tx = 256 - (16 + 34) * scale;
  const ty = 256 - (8 + 41) * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${r}" fill="${LIME}"/><g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(4)})">${cardsSvg()}</g></svg>`;
}

/** Maskable icon: full-bleed lime, the cards inside the 80% safe circle (~56% of the side). */
export function maskableSvg() {
  const scale = 288 / 82;
  const tx = 256 - (16 + 34) * scale;
  const ty = 256 - (8 + 41) * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${LIME}"/><g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(4)})">${cardsSvg()}</g></svg>`;
}

/** Just the cards, transparent background, cropped. */
export function markSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="16 8 68 82">${cardsSvg()}</svg>`;
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("mark.mjs")) {
  writeFileSync("public/icons/icon.svg", iconSvg() + "\n");
  writeFileSync("public/icons/icon-maskable.svg", maskableSvg() + "\n");
  writeFileSync("scripts/brand/mark.svg", markSvg() + "\n");
  console.log("wrote public/icons/icon.svg, public/icons/icon-maskable.svg, scripts/brand/mark.svg");
}
