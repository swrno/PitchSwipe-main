// Writes docs/images/qr-latest-release.svg: a QR code that opens the latest GitHub release.
//   node --import ./scripts/register-ts.mjs scripts/brand/qr-release.mjs
// Uses the app's own encoder (src/lib/share/qr.ts), so there is no extra dependency.
import { mkdirSync, writeFileSync } from "node:fs";
import { encodeQr, qrPath } from "../../src/lib/share/qr.ts";

const URL = "https://github.com/swrno/PitchSwipe/releases/latest";
const BORDER = 3;
const qr = encodeQr(URL);
const total = qr.size + BORDER * 2;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#ffffff"/><path d="${qrPath(qr, BORDER)}" fill="#111111"/></svg>\n`;
mkdirSync("docs/images", { recursive: true });
writeFileSync("docs/images/qr-latest-release.svg", svg);
console.log(`wrote docs/images/qr-latest-release.svg (${qr.size}x${qr.size} modules) for ${URL}`);
