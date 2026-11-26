/**
 * Small pure-TypeScript QR code encoder (no dependency). Byte mode, error correction
 * level M, versions 1 to 10 (up to 213 bytes: plenty for a share link). Follows
 * ISO/IEC 18004. Returns a square boolean matrix (true = dark module) and an SVG path.
 */

export interface QrCode {
  version: number;
  size: number;
  mask: number;
  /** modules[y][x], true = dark. */
  modules: boolean[][];
}

/** Level M tables, indexed by version (index 0 unused). */
const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const NUM_BLOCKS = [0, 1, 1, 2, 2, 2, 4, 4, 4, 5, 5];
const MAX_VERSION = 10;

function rawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

const dataCodewords = (ver: number) => Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver];

function alignmentPositions(ver: number): number[] {
  if (ver === 1) return [];
  const numAlign = Math.floor(ver / 7) + 2;
  const step = Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = ver * 4 + 10; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

/* Reed-Solomon over GF(256), polynomial 0x11D. */
function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

export function rsGenerator(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

export function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => (result[i] ^= gfMultiply(coef, factor)));
  }
  return result;
}

/** Data codewords (mode, length, bytes, terminator, padding) for the chosen version. */
function buildData(bytes: number[], ver: number): number[] {
  const bits: number[] = [];
  const push = (value: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4); // byte mode
  push(bytes.length, ver <= 9 ? 8 : 16);
  bytes.forEach((b) => push(b, 8));
  const capacityBits = dataCodewords(ver) * 8;
  push(0, Math.min(4, capacityBits - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let pad = 0xec; out.length < dataCodewords(ver); pad ^= 0xec ^ 0x11) out.push(pad);
  return out;
}

/** Splits into blocks, adds error correction, interleaves. */
export function interleave(data: number[], ver: number): number[] {
  const numBlocks = NUM_BLOCKS[ver];
  const eccLen = ECC_PER_BLOCK[ver];
  const rawCodewords = Math.floor(rawDataModules(ver) / 8);
  const numShort = numBlocks - (rawCodewords % numBlocks);
  const shortLen = Math.floor(rawCodewords / numBlocks);
  const gen = rsGenerator(eccLen);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const len = shortLen - eccLen + (i < numShort ? 0 : 1);
    const dat = data.slice(k, k + len);
    k += len;
    const ecc = rsRemainder(dat, gen);
    if (i < numShort) dat.push(0); // placeholder so columns line up
    blocks.push(dat.concat(ecc));
  }
  const result: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLen - eccLen || j >= numShort) result.push(block[i]);
    });
  }
  return result;
}

function bchRemainder(value: number, poly: number, polyBits: number, extra: number): number {
  let rem = value;
  for (let i = 0; i < extra; i++) rem = (rem << 1) ^ ((rem >>> (polyBits - 1)) * poly);
  return rem;
}

/** 15 format bits for level M and the given mask pattern (0 to 7). */
export function formatBits(mask: number): number {
  const data = (0 << 3) | mask; // level M = 0b00
  return ((data << 10) | bchRemainder(data, 0x537, 10, 10)) ^ 0x5412;
}

function versionBits(ver: number): number {
  return (ver << 12) | bchRemainder(ver, 0x1f25, 12, 12);
}

export const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** Modules that are not data (finder, timing, alignment, format, version). Exported for tests. */
export function functionMap(ver: number): boolean[][] {
  return new Grid(ver).fn;
}

class Grid {
  readonly size: number;
  readonly mod: boolean[][];
  readonly fn: boolean[][];
  readonly ver: number;
  constructor(ver: number) {
    this.ver = ver;
    this.size = ver * 4 + 17;
    this.mod = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.fn = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.drawFunctionPatterns();
  }
  private set(x: number, y: number, dark: boolean) {
    this.mod[y][x] = dark;
    this.fn[y][x] = true;
  }
  private drawFunctionPatterns() {
    const n = this.size;
    for (let i = 0; i < n; i++) {
      this.set(6, i, i % 2 === 0);
      this.set(i, 6, i % 2 === 0);
    }
    for (const [cx, cy] of [
      [3, 3],
      [n - 4, 3],
      [3, n - 4],
    ]) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          const x = cx + dx;
          const y = cy + dy;
          if (x >= 0 && x < n && y >= 0 && y < n) this.set(x, y, dist !== 2 && dist !== 4);
        }
      }
    }
    const pos = alignmentPositions(this.ver);
    pos.forEach((px, i) =>
      pos.forEach((py, j) => {
        if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) this.set(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }),
    );
    this.drawFormat(0); // reserve the format modules
    if (this.ver >= 7) {
      const bits = versionBits(this.ver);
      for (let i = 0; i < 18; i++) {
        const dark = ((bits >>> i) & 1) !== 0;
        const a = n - 11 + (i % 3);
        const b = Math.floor(i / 3);
        this.set(a, b, dark);
        this.set(b, a, dark);
      }
    }
  }
  drawFormat(mask: number) {
    const n = this.size;
    const bits = formatBits(mask);
    const bit = (i: number) => ((bits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) this.set(8, i, bit(i));
    this.set(8, 7, bit(6));
    this.set(8, 8, bit(7));
    this.set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) this.set(n - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) this.set(8, n - 15 + i, bit(i));
    this.set(8, n - 8, true); // always dark
  }
  /** Zigzag placement of the codeword bits into non-function modules. */
  placeData(codewords: number[]) {
    const n = this.size;
    let i = 0;
    for (let right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < n; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? n - 1 - vert : vert;
          if (!this.fn[y][x] && i < codewords.length * 8) {
            this.mod[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
            i++;
          }
        }
      }
    }
  }
  applyMask(mask: number) {
    for (let y = 0; y < this.size; y++)
      for (let x = 0; x < this.size; x++) if (!this.fn[y][x] && MASKS[mask](x, y)) this.mod[y][x] = !this.mod[y][x];
  }
  penalty(): number {
    const n = this.size;
    const m = this.mod;
    let score = 0;
    const lineScore = (line: boolean[]) => {
      let s = 0;
      let run = 1;
      for (let i = 1; i <= line.length; i++) {
        if (i < line.length && line[i] === line[i - 1]) run++;
        else {
          if (run >= 5) s += 3 + (run - 5);
          run = 1;
        }
      }
      const str = line.map((b) => (b ? "1" : "0")).join("");
      for (const p of ["10111010000", "00001011101"]) {
        let at = str.indexOf(p);
        while (at !== -1) {
          s += 40;
          at = str.indexOf(p, at + 1);
        }
      }
      return s;
    };
    for (let y = 0; y < n; y++) score += lineScore(m[y]);
    for (let x = 0; x < n; x++) score += lineScore(m.map((row) => row[x]));
    for (let y = 0; y < n - 1; y++)
      for (let x = 0; x < n - 1; x++)
        if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) score += 3;
    const dark = m.reduce((a, row) => a + row.filter(Boolean).length, 0);
    score += Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
    return score;
  }
}

export function encodeQr(text: string): QrCode {
  const bytes = Array.from(new TextEncoder().encode(text));
  let ver = 1;
  const lenBits = (v: number) => (v <= 9 ? 8 : 16);
  while (ver <= MAX_VERSION && 4 + lenBits(ver) + bytes.length * 8 > dataCodewords(ver) * 8) ver++;
  if (ver > MAX_VERSION) throw new RangeError("Text is too long for this QR encoder.");

  const codewords = interleave(buildData(bytes, ver), ver);
  let best: { grid: Grid; mask: number } | undefined;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const grid = new Grid(ver);
    grid.placeData(codewords);
    grid.applyMask(mask);
    grid.drawFormat(mask);
    const score = grid.penalty();
    if (score < bestScore) {
      bestScore = score;
      best = { grid, mask };
    }
  }
  const { grid, mask } = best as { grid: Grid; mask: number };
  return { version: ver, size: grid.size, mask, modules: grid.mod };
}

/** SVG path for the dark modules (one 1x1 square each), offset by a quiet-zone `border`. */
export function qrPath(qr: QrCode, border = 0): string {
  const parts: string[] = [];
  qr.modules.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) parts.push(`M${x + border},${y + border}h1v1h-1z`);
    }),
  );
  return parts.join("");
}
