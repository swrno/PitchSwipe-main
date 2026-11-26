/**
 * Generates PNG icons from public/icons/icon.svg.
 * Method: uses `sharp`, which is present in node_modules only as a transitive
 * dependency of `next` (NOT listed in package.json; no new dependency added).
 * Outputs (public/icons): icon-192.png, icon-512.png, icon-maskable-512.png
 * (full-bleed background, artwork scaled into the 80% safe zone), apple-touch-icon.png (180).
 * Run: node scripts/make-icons.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const { default: sharp } = await import("sharp");
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
const svg = await readFile(path.join(dir, "icon.svg"), "utf8");

// Inner artwork = everything after the background rect.
const art = svg.replace(/<svg[^>]*>/, "").replace("</svg>", "").replace(/<rect width="512"[^>]*\/>/, "");
const bg = "#16803c";
const fullBleed = (scale) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${bg}"/>` +
  `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${art}</g></svg>`;

const jobs = [
  ["icon-192.png", svg, 192],
  ["icon-512.png", svg, 512],
  ["icon-maskable-512.png", fullBleed(0.8), 512],
  ["apple-touch-icon.png", fullBleed(0.92), 180],
];
for (const [name, source, size] of jobs) {
  const buf = await sharp(Buffer.from(source)).resize(size, size).png().toBuffer();
  await writeFile(path.join(dir, name), buf);
  console.log(`wrote ${name} (${size}x${size}, ${buf.length} bytes)`);
}
