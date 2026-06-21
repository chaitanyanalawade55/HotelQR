// Generates PWA icon PNGs using only Node.js built-ins (no sharp/canvas needed).
// Orange (#F97316) background with a white utensils symbol drawn in pixel rects.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, '..', 'public', 'icons');

// ── CRC32 ────────────────────────────────────────────────────────────────────
const CRC = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = (CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  return ((c ^ 0xffffffff) >>> 0);
}

// ── PNG builder ───────────────────────────────────────────────────────────────
function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const l = Buffer.allocUnsafe(4); l.writeUInt32BE(d.length);
  const cr = Buffer.allocUnsafe(4); cr.writeUInt32BE(crc32(Buffer.concat([t, d])));
  return Buffer.concat([l, t, d, cr]);
}

// drawFn(x, y, size) → [r, g, b]
function buildPNG(size, drawFn) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const stride = 1 + size * 3;
  const raw = Buffer.allocUnsafe(size * stride);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = drawFn(x, y, size);
      raw[y * stride + 1 + x * 3] = r;
      raw[y * stride + 2 + x * 3] = g;
      raw[y * stride + 3 + x * 3] = b;
    }
  }

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Drawing helpers ───────────────────────────────────────────────────────────
// Returns true if (x,y) is inside the rounded rect of size s with radius r
function inRoundedRect(x, y, s, r) {
  if (x < 0 || y < 0 || x >= s || y >= s) return false;
  const cx = x < r ? r : x >= s - r ? s - r - 1 : x;
  const cy = y < r ? r : y >= s - r ? s - r - 1 : y;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2;
}

// Returns true if (x,y) hits a rect at (rx,ry) with dimensions (rw,rh) — all normalized 0..1
function inRect(x, y, s, rx, ry, rw, rh) {
  const px = x / s, py = y / s;
  return px >= rx && px < rx + rw && py >= ry && py < ry + rh;
}

// ── Icon draw function ─────────────────────────────────────────────────────────
// Orange rounded square + simplified white fork-and-knife silhouette
const ORANGE = [249, 115, 22];
const WHITE  = [255, 255, 255];
const TRANSP = [255, 255, 255]; // outside rounded rect → white (for non-maskable)

function drawIcon(x, y, size, maskable = false) {
  const radius = maskable ? 0 : Math.round(size * 0.2);

  if (!maskable && !inRoundedRect(x, y, size, radius)) {
    return TRANSP;
  }

  // ── Fork (left side) ──
  // handle
  if (inRect(x, y, size, 0.295, 0.52, 0.075, 0.30)) return WHITE;
  // tine 1
  if (inRect(x, y, size, 0.245, 0.17, 0.055, 0.26)) return WHITE;
  // tine 2 (center)
  if (inRect(x, y, size, 0.330, 0.17, 0.055, 0.26)) return WHITE;
  // tine 3
  if (inRect(x, y, size, 0.415, 0.17, 0.055, 0.26)) return WHITE;
  // shoulder (connects tines to handle)
  if (inRect(x, y, size, 0.245, 0.43, 0.225, 0.09)) return WHITE;

  // ── Knife (right side) ──
  // blade (angled top — approximate with rect)
  if (inRect(x, y, size, 0.565, 0.17, 0.075, 0.30)) return WHITE;
  // handle
  if (inRect(x, y, size, 0.565, 0.52, 0.075, 0.30)) return WHITE;
  // shoulder
  if (inRect(x, y, size, 0.565, 0.47, 0.150, 0.055)) return WHITE;
  // blade tip diagonal
  if (inRect(x, y, size, 0.605, 0.17, 0.11, 0.08)) return WHITE;

  return ORANGE;
}

// ── Generate files ────────────────────────────────────────────────────────────
const icons = [
  { file: 'icon-192.png',          size: 192, maskable: false },
  { file: 'icon-512.png',          size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true  },
  { file: 'apple-touch-icon.png',  size: 180, maskable: false },
];

for (const { file, size, maskable } of icons) {
  const png = buildPNG(size, (x, y, s) => drawIcon(x, y, s, maskable));
  writeFileSync(join(OUT, file), png);
  console.log(`✓ ${file}  (${size}×${size}, ${(png.length / 1024).toFixed(1)} KB)`);
}
