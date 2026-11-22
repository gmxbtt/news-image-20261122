// THE WORLD IN ONE PAGE — Sunday 22 November 2026.
//
// Entry for make.fun news-image-20261122: "Sum up 22 November's world
// news in one image". The program draws a newspaper front page entirely in
// code (Node 22 standard library only, no assets, no network, fully
// deterministic: two runs write byte-identical PNGs) and writes it to
// entry.png.
//
// The day's news (all reported on 22 November 2026, corroborated across
// Reuters / AP / AFP coverage): the COP31 climate summit in Antalya
// collapses with no deal after the EU rejects a pact that never mentions
// fossil fuels; Iran fires missiles and drones at US bases in Bahrain and
// strikes three tankers near the Strait of Hormuz; Mexican special forces
// capture cartel boss 'El Chapo Isidro' in Sinaloa, 11 killed in the raid;
// a Russian drone strike partly destroys an apartment block near Kyiv, 14
// missing; the World Court rules Myanmar committed genocide against the
// Rohingya; US stocks fall into correction in an AI sell-off.
//
// Run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------------------
// framebuffer
// ---------------------------------------------------------------------------
type RGB = [number, number, number];
const fb = new Uint8Array(W * H * 3);

function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function px(x: number, y: number, c: RGB): void {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  const i = (yi * W + xi) * 3;
  fb[i] = c[0];
  fb[i + 1] = c[1];
  fb[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(W, Math.round(x + w));
  const y1 = Math.min(H, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) {
    let i = (yy * W + x0) * 3;
    for (let xx = x0; xx < x1; xx++) {
      fb[i] = c[0];
      fb[i + 1] = c[1];
      fb[i + 2] = c[2];
      i += 3;
    }
  }
}
function hline(x0: number, x1: number, y: number, c: RGB, th = 1): void {
  fillRect(Math.min(x0, x1), y - Math.floor(th / 2), Math.abs(x1 - x0), th, c);
}
function vline(x: number, y0: number, y1: number, c: RGB, th = 1): void {
  fillRect(x - Math.floor(th / 2), Math.min(y0, y1), th, Math.abs(y1 - y0), c);
}
// Bresenham line, thickness via filled discs. Coordinates are rounded to
// integers first: with float endpoints the x===x1 test can never hit and
// the loop runs forever.
function line(x0: number, y0: number, x1: number, y1: number, c: RGB, th = 1): void {
  let ax = Math.round(x0);
  let ay = Math.round(y0);
  const bx = Math.round(x1);
  const by = Math.round(y1);
  const dx = Math.abs(bx - ax);
  const dy = -Math.abs(by - ay);
  const sx = ax < bx ? 1 : -1;
  const sy = ay < by ? 1 : -1;
  let err = dx + dy;
  const r = Math.max(0, Math.floor(th / 2));
  for (;;) {
    for (let oy = -r; oy <= r; oy++) {
      for (let ox = -r; ox <= r; ox++) {
        if (ox * ox + oy * oy <= r * r + r) px(ax + ox, ay + oy, c);
      }
    }
    if (ax === bx && ay === by) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; ax += sx; }
    if (e2 <= dx) { err += dx; ay += sy; }
  }
}
function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) px(x, y, c);
    }
  }
}
function circle(cx: number, cy: number, r: number, c: RGB, th = 1): void {
  const steps = Math.max(24, Math.floor(2 * Math.PI * r));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    const b = ((i + 1) / steps) * 2 * Math.PI;
    line(cx + r * Math.cos(a), cy + r * Math.sin(a), cx + r * Math.cos(b), cy + r * Math.sin(b), c, th);
  }
}
function fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minX = Math.floor(Math.min(x0, x1, x2));
  const maxX = Math.ceil(Math.max(x0, x1, x2));
  const minY = Math.floor(Math.min(y0, y1, y2));
  const maxY = Math.ceil(Math.max(y0, y1, y2));
  const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const a = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / d;
      const b = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / d;
      const cc = 1 - a - b;
      if (a >= 0 && b >= 0 && cc >= 0) px(x, y, c);
    }
  }
}
// starburst: n spikes from a centre, alternating outer/inner radius.
function starburst(cx: number, cy: number, rOuter: number, rInner: number, spikes: number, c: RGB): void {
  for (let i = 0; i < spikes * 2; i++) {
    const a0 = (i / (spikes * 2)) * 2 * Math.PI - Math.PI / 2;
    const a1 = ((i + 1) / (spikes * 2)) * 2 * Math.PI - Math.PI / 2;
    const r0 = i % 2 === 0 ? rOuter : rInner;
    const r1 = i % 2 === 0 ? rInner : rOuter;
    fillTriangle(cx, cy, cx + r0 * Math.cos(a0), cy + r0 * Math.sin(a0), cx + r1 * Math.cos(a1), cy + r1 * Math.sin(a1), c);
  }
  fillCircle(cx, cy, rInner * 0.55, c);
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font (uppercase + digits + punctuation). Each glyph: 7 rows of
// 5 bits, '1' = ink. All text is uppercased before drawing, so no
// lowercase glyphs are needed.
// ---------------------------------------------------------------------------
const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '00100', '01000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '"': ['01010', '01010', '01010', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  $: ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '#': ['01010', '01010', '11111', '01010', '11111', '01010', '01010'],
  '@': ['01110', '10001', '10111', '10101', '10110', '10000', '01110'],
  '*': ['00000', '00100', '10101', '01110', '10101', '00100', '00000'],
};
const BLANK_GLYPH = ['00000', '00000', '00000', '00000', '00000', '00000', '00000'];

function drawChar(x: number, y: number, ch: string, s: number, c: RGB): void {
  const g = FONT[ch] || BLANK_GLYPH;
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 5; col++) {
      if (g[r][col] === '1') fillRect(x + col * s, y + r * s, s, s, c);
    }
  }
}
// Advance per character, including a 1-unit gap.
function textWidth(text: string, s: number): number {
  return text.length * 6 * s - s;
}
function drawText(x: number, y: number, text: string, s: number, c: RGB): void {
  const up = text.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    drawChar(x + i * 6 * s, y, up[i], s, c);
  }
}
function drawTextCentred(cx: number, y: number, text: string, s: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(text, s) / 2), y, text, s, c);
}
// Greedy word wrap to maxWidth pixels; returns lines (already uppercased).
function wrapText(text: string, s: number, maxWidth: number): string[] {
  const words = text.toUpperCase().split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const trial = cur === '' ? w : cur + ' ' + w;
    if (textWidth(trial, s) <= maxWidth || cur === '') {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}
// Draw a wrapped paragraph; lineHeight in px. Returns the y just below it.
function drawPara(x: number, y: number, text: string, s: number, maxWidth: number, c: RGB, lineHeight: number, maxLines = 99): number {
  const lines = wrapText(text, s, maxWidth).slice(0, maxLines);
  for (let i = 0; i < lines.length; i++) {
    drawText(x, y + i * lineHeight, lines[i], s, c);
  }
  return y + lines.length * lineHeight;
}

// ---------------------------------------------------------------------------
// PNG encoder (deterministic: no ancillary chunks, fixed zlib level)
// ---------------------------------------------------------------------------
const CRC_TABLE: number[] = (() => {
  const table: number[] = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}
function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    raw.set(fb.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// palette
// ---------------------------------------------------------------------------
const PAPER = hex('#f6f1e5');
const INK = hex('#191919');
const RED = hex('#b3202c');
const NAVY = hex('#1f3a5f');
const SKY = hex('#7fa8c9');
const GOLD = hex('#c8a24a');
const GREY = hex('#6b675c');
const LIGHT = hex('#e9e2cf');
const WHITE = hex('#ffffff');
const ORANGE = hex('#e07830');
const SMOKE = hex('#8a8a8a');

// ---------------------------------------------------------------------------
// illustrations (all flat vector scenes, drawn in code)
// ---------------------------------------------------------------------------
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function vgrad(x: number, y: number, w: number, h: number, top: RGB, bottom: RGB): void {
  for (let yy = 0; yy < h; yy++) {
    const t = yy / Math.max(1, h - 1);
    fillRect(x, y + yy, w, 1, [
      Math.round(lerp(top[0], bottom[0], t)),
      Math.round(lerp(top[1], bottom[1], t)),
      Math.round(lerp(top[2], bottom[2], t)),
    ]);
  }
}

// Lead: COP31 — a cracked globe over the Antalya summit hall, NO DEAL stamp.
function drawCOP31(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, hex('#0d2b2e'), hex('#1d5c5f'));
  // hall floor
  fillRect(x, y + h * 0.82, w, h * 0.18, hex('#0a1f21'));
  // row of delegate flags along the floor
  const flagCols = [RED, WHITE, GOLD, SKY, ORANGE, hex('#4ade80'), WHITE, RED, GOLD, SKY];
  for (let i = 0; i < 10; i++) {
    const fx = x + (0.03 + i * 0.096) * w;
    fillRect(fx, y + h * 0.82, w * 0.05, h * 0.1, flagCols[i]);
    vline(fx + (w * 0.05) / 2, y + h * 0.78, y + h * 0.82, WHITE, 1);
  }
  // the globe, centre-left
  const gx = x + 0.34 * w;
  const gy = y + 0.42 * h;
  const gr = h * 0.3;
  fillCircle(gx, gy, gr, hex('#2f6fb2'));
  // land blobs
  fillCircle(gx - gr * 0.35, gy - gr * 0.3, gr * 0.28, hex('#3f9e57'));
  fillCircle(gx + gr * 0.3, gy + gr * 0.15, gr * 0.24, hex('#3f9e57'));
  fillCircle(gx + gr * 0.1, gy - gr * 0.45, gr * 0.16, hex('#3f9e57'));
  fillCircle(gx - gr * 0.15, gy + gr * 0.45, gr * 0.18, hex('#3f9e57'));
  circle(gx, gy, gr, WHITE, 2);
  // the crack: a dark zigzag across the globe
  const crack: [number, number][] = [[-0.8, -0.5], [-0.45, -0.2], [-0.55, 0.1], [-0.2, 0.35], [0.05, 0.15], [0.3, 0.45], [0.55, 0.3], [0.85, 0.55]];
  for (let i = 0; i < crack.length - 1; i++) {
    line(gx + crack[i][0] * gr, gy + crack[i][1] * gr, gx + crack[i + 1][0] * gr, gy + crack[i + 1][1] * gr, INK, 4);
  }
  // heat: small orange sun, top right
  fillCircle(x + 0.82 * w, y + 0.16 * h, 16, ORANGE);
  starburst(x + 0.82 * w, y + 0.16 * h, 26, 12, 8, GOLD);
  // NO DEAL stamp, bottom right
  fillRect(x + 0.58 * w, y + h * 0.66, w * 0.38, h * 0.13, RED);
  drawTextCentred(x + 0.77 * w, y + h * 0.70, 'NO DEAL', 3, WHITE);
}

// Bahrain: night over the Gulf — a tanker, missile trails, a Patriot dish.
function drawBahrain(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h * 0.66, hex('#0d1526'), hex('#2c3e5e'));
  fillRect(x, y + h * 0.66, w, h * 0.34, hex('#12283f'));
  // moon
  fillCircle(x + 0.85 * w, y + 0.14 * h, 11, GOLD);
  // sea shimmer
  for (let i = 0; i < 4; i++) {
    hline(x + (0.08 + i * 0.2) * w, x + (0.2 + i * 0.2) * w, y + h * (0.74 + i * 0.06), hex('#4a6b8a'), 2);
  }
  // tanker: hull + bridge tower
  const ty = y + h * 0.6;
  fillRect(x + 0.3 * w, ty, w * 0.55, h * 0.12, hex('#5a1f1f'));
  fillRect(x + 0.68 * w, ty - h * 0.16, w * 0.1, h * 0.16, hex('#e8e2d2'));
  fillRect(x + 0.3 * w, ty + h * 0.12, w * 0.55, 4, hex('#8a2a2a'));
  // missile trails arcing down onto the tanker
  line(x + 0.12 * w, y + 0.08 * h, x + 0.42 * w, ty - 6, ORANGE, 3);
  starburst(x + 0.42 * w, ty - 8, 14, 6, 7, ORANGE);
  line(x + 0.95 * w, y + 0.05 * h, x + 0.62 * w, ty - 6, WHITE, 2);
  starburst(x + 0.62 * w, ty - 8, 10, 4, 6, WHITE);
  // Patriot radar dish on the shore, left
  const dx = x + 0.14 * w;
  const dy = y + h * 0.56;
  fillRect(dx - 3, dy, 6, h * 0.1, INK);
  fillTriangle(dx - 18, dy - 6, dx + 18, dy - 6, dx, dy + 14, hex('#c8ccd4'));
  line(dx, dy - 6, dx + 26, dy - 26, WHITE, 2);
  fillCircle(dx + 26, dy - 26, 3, RED);
}

// Mexico: dusk over Sinaloa — mountains, a helicopter, a gold star.
function drawMexico(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, hex('#e8a04c'), hex('#7a3b2e'));
  // sun low on the horizon
  fillCircle(x + 0.8 * w, y + 0.3 * h, 13, hex('#f7d774'));
  // mountain silhouettes
  fillTriangle(x, y + h, x + 0.28 * w, y + h * 0.42, x + 0.55 * w, y + h, hex('#5a2a20'));
  fillTriangle(x + 0.4 * w, y + h, x + 0.68 * w, y + h * 0.34, x + 0.98 * w, y + h, hex('#3f1d16'));
  fillRect(x, y + h * 0.86, w, h * 0.14, hex('#2c130e'));
  // helicopter with searchlight cone
  const hx = x + 0.3 * w;
  const hy = y + 0.24 * h;
  fillTriangle(hx - 8, hy + 6, hx + 34, hy + 44, hx + 6, hy + 22, hex('#f7e9a0'));
  fillCircle(hx, hy, 9, INK);
  fillRect(hx + 8, hy - 3, 26, 5, INK);
  hline(hx - 22, hx + 22, hy - 12, INK, 3);
  vline(hx, hy - 12, hy - 2, INK, 2);
  // gold star badge, bottom right
  starburst(x + 0.85 * w, y + 0.72 * h, 16, 7, 5, GOLD);
  fillCircle(x + 0.85 * w, y + 0.72 * h, 4, hex('#7a5a10'));
}

// Kyiv: an apartment block with its top corner blown out, smoke rising.
function drawKyivFlat(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, hex('#3a4a5e'), hex('#1c2733'));
  // apartment block
  const bx = x + 0.22 * w;
  const bw = w * 0.56;
  fillRect(bx, y + h * 0.3, bw, h * 0.7, hex('#8a7f6a'));
  // window grid, a few lit
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      const lit = (r * 5 + c) % 4 === 0;
      fillRect(bx + 8 + c * (bw / 5.4), y + h * (0.36 + r * 0.15), 10, 8, lit ? GOLD : hex('#2c2620'));
    }
  }
  // blown-out top corner: dark jagged hole + fire glow
  fillTriangle(bx + bw * 0.55, y + h * 0.3, bx + bw, y + h * 0.3, bx + bw, y + h * 0.48, INK);
  fillTriangle(bx + bw * 0.7, y + h * 0.3, bx + bw, y + h * 0.42, bx + bw * 0.82, y + h * 0.52, hex('#3a2a1a'));
  starburst(bx + bw * 0.82, y + h * 0.36, 12, 5, 7, ORANGE);
  // smoke
  fillCircle(bx + bw * 0.7, y + h * 0.16, 10, SMOKE);
  fillCircle(bx + bw * 0.85, y + h * 0.08, 13, SMOKE);
  fillCircle(bx + bw * 0.55, y + h * 0.1, 8, SMOKE);
  // drone silhouette, top left
  fillRect(x + 0.06 * w, y + 0.12 * h, 14, 4, WHITE);
  hline(x + 0.02 * w, x + 0.12 * w, y + 0.1 * h, WHITE, 2);
}

// The Hague: courthouse columns and the scales of justice.
function drawICJ(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, hex('#1e3a6e'));
  // courthouse pediment + columns
  const cx = x + w / 2;
  fillTriangle(cx - w * 0.32, y + h * 0.3, cx + w * 0.32, y + h * 0.3, cx, y + h * 0.08, WHITE);
  for (let i = 0; i < 4; i++) {
    fillRect(x + (0.2 + i * 0.2) * w, y + h * 0.3, w * 0.06, h * 0.42, WHITE);
  }
  fillRect(x + 0.14 * w, y + h * 0.72, w * 0.72, h * 0.06, WHITE);
  // scales of justice, gold, hanging from the pediment
  const sx = cx;
  const sy = y + h * 0.34;
  vline(sx, sy, sy + h * 0.22, GOLD, 3);
  hline(sx - w * 0.12, sx + w * 0.12, sy + 2, GOLD, 3);
  line(sx - w * 0.12, sy + 2, sx - w * 0.12, sy + h * 0.14, GOLD, 2);
  line(sx + w * 0.12, sy + 2, sx + w * 0.12, sy + h * 0.14, GOLD, 2);
  fillTriangle(sx - w * 0.17, sy + h * 0.14, sx - w * 0.07, sy + h * 0.14, sx - w * 0.12, sy + h * 0.22, GOLD);
  fillTriangle(sx + w * 0.07, sy + h * 0.14, sx + w * 0.17, sy + h * 0.14, sx + w * 0.12, sy + h * 0.22, GOLD);
  fillCircle(sx, sy - 4, 4, GOLD);
}

// Markets: a red chart line plunging, -3.7% in white.
function drawMarkets(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, hex('#101820'));
  // grid
  for (let i = 1; i < 4; i++) {
    hline(x + 6, x + w - 6, y + (i * h) / 4, hex('#22303c'), 1);
    vline(x + (i * w) / 4, y + 6, y + h - 6, hex('#22303c'), 1);
  }
  // the plunge: a jagged red line from top-left to bottom-right
  const pts: [number, number][] = [[0.06, 0.2], [0.2, 0.26], [0.32, 0.22], [0.46, 0.42], [0.58, 0.38], [0.7, 0.58], [0.82, 0.66], [0.94, 0.86]];
  for (let i = 0; i < pts.length - 1; i++) {
    line(x + pts[i][0] * w, y + pts[i][1] * h, x + pts[i + 1][0] * w, y + pts[i + 1][1] * h, RED, 4);
  }
  // arrowhead at the end
  const ex = x + 0.94 * w;
  const ey = y + 0.86 * h;
  fillTriangle(ex, ey, ex - 16, ey - 4, ex - 4, ey - 16, RED);
  // the number, lower-left, clear of the plunging line and the border
  drawText(x + 0.08 * w, y + 0.46 * h, '-3.7%', 3, WHITE);
  drawText(x + 0.08 * w, y + 0.46 * h + 24, 'S&P 500', 2, hex('#8a97a3'));
}

// ---------------------------------------------------------------------------
// layout — a newspaper front page, 1024 x 1024
// ---------------------------------------------------------------------------
function border(x: number, y: number, w: number, h: number, c: RGB, th = 2): void {
  hline(x, x + w, y, c, th);
  hline(x, x + w, y + h, c, th);
  vline(x, y, y + h, c, th);
  vline(x + w, y, y + h, c, th);
}

function main(): void {
  fillRect(0, 0, W, H, PAPER);

  // masthead
  drawTextCentred(512, 30, 'THE WORLD IN ONE PAGE', 6, INK);
  hline(24, 1000, 84, INK, 3);
  hline(24, 1000, 89, INK, 1);
  drawTextCentred(512, 98, 'SUNDAY 22 NOVEMBER 2026', 3, INK);
  hline(24, 1000, 130, INK, 3);

  // ---- lead: COP31 collapses ----------------------------------------------
  drawCOP31(24, 140, 476, 312);
  border(24, 140, 476, 312, INK);
  drawText(524, 144, 'CLIMATE SUMMIT', 2, RED);
  drawText(524, 172, 'COP31 ENDS WITH', 4, INK);
  drawText(524, 204, 'NO DEAL AT ALL', 4, INK);
  drawText(524, 236, 'FOSSIL FUELS UNSAID', 4, INK);
  drawPara(
    524, 282,
    'The UN climate summit in Antalya collapsed on Sunday after the EU and a group of nations rejected a final deal that made no mention of fossil fuels. COP31 president Murat Kurum told delegates the decisions had not been adopted, ending two weeks of talks with no agreement at all. Activists called it a failure of leadership as the hottest decade on record grinds on.',
    2, 476, INK, 15, 11,
  );

  // ---- divider ------------------------------------------------------------
  hline(24, 1000, 462, INK, 2);

  // ---- row 2: Bahrain + Mexico ----------------------------------------------
  drawBahrain(24, 472, 476, 110);
  border(24, 472, 476, 110, INK);
  drawText(24, 592, 'IRAN HITS US BASES', 3, INK);
  drawText(24, 616, 'IN BAHRAIN', 3, INK);
  drawPara(
    24, 648,
    'Iran fired missiles and drones at US bases in Bahrain, hitting a civilian site and wounding two. Tehran claimed two Patriot radars destroyed.',
    2, 476, INK, 15, 5,
  );

  drawMexico(524, 472, 476, 110);
  border(524, 472, 476, 110, INK);
  drawText(524, 592, 'MEXICO CAPTURES', 3, INK);
  drawText(524, 616, "'EL CHAPO ISIDRO'", 3, INK);
  drawPara(
    524, 648,
    'Mexican special forces captured cartel boss Fausto Isidro Meza Flores in Sinaloa, with US intelligence help. Eleven died in the raid, four of them soldiers.',
    2, 476, INK, 15, 5,
  );

  // ---- divider ------------------------------------------------------------
  hline(24, 1000, 740, INK, 2);

  // ---- row 3: Kyiv flat + ICJ + markets --------------------------------------
  drawKyivFlat(24, 750, 310, 84);
  border(24, 750, 310, 84, INK);
  drawText(24, 842, 'FLAT HIT NEAR KYIV', 2, INK);
  drawText(24, 860, '14 STILL MISSING', 2, INK);
  drawPara(
    24, 884,
    'A Russian drone strike partly destroyed an apartment block near Kyiv. Two were killed and at least 14 are missing.',
    2, 310, INK, 14, 5,
  );

  drawICJ(357, 750, 310, 84);
  border(357, 750, 310, 84, INK);
  drawText(357, 842, 'MYANMAR GUILTY OF', 2, INK);
  drawText(357, 860, 'GENOCIDE, COURT RULES', 2, INK);
  drawPara(
    357, 884,
    'The World Court ruled Myanmar committed genocide against the Rohingya in 2017 — the first state ever found responsible.',
    2, 310, INK, 14, 5,
  );

  drawMarkets(690, 750, 310, 84);
  border(690, 750, 310, 84, INK);
  drawText(690, 842, 'STOCKS FALL INTO', 2, INK);
  drawText(690, 860, 'CORRECTION', 2, INK);
  drawPara(
    690, 884,
    'The S&P 500 fell 3.7% on Friday and the Nasdaq 5.3% as the AI sell-off spread to Japan and Korea.',
    2, 310, INK, 14, 5,
  );

  // ---- footer ---------------------------------------------------------------
  hline(24, 1000, 972, INK, 2);
  drawTextCentred(512, 982, 'REPORTED SUNDAY 22 NOVEMBER 2026', 2, GREY);

  // ---- write ---------------------------------------------------------------
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
  mkdirSync(outDir, { recursive: true });
  const png = encodePNG();
  writeFileSync(join(outDir, 'entry.png'), png);
  // eslint-disable-next-line no-console
  console.log(`entry.png ${png.length} bytes -> ${join(outDir, 'entry.png')}`);
}

main();
