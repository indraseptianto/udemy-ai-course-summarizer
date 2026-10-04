/**
 * Generates extension PNG icons (16/32/48/128) with a simple rounded
 * gradient — no external image dependency. Written to public/icons/.
 * Uses Node's zlib to build valid PNGs directly.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const START = hexToRgb('#4f8cff');
const END = hexToRgb('#7c5cff');

function makeIcon(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const radius = size / 2 - size * 0.08;
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const t = Math.min(1, Math.max(0, (dist - (radius - size * 0.28)) / (size * 0.5)));
      // alpha: inside circle + soft edge
      const alpha = dist <= radius ? 255 : Math.max(0, Math.round(255 * (1 - (dist - radius) / (size * 0.08))));
      // gradient along x
      const gx = x / size;
      const r = Math.round(START[0] + (END[0] - START[0]) * gx);
      const g = Math.round(START[1] + (END[1] - START[1]) * gx);
      const b = Math.round(START[2] + (END[2] - START[2]) * gx);
      // small "book" glyph cutout
      let isGlyph = false;
      if (size >= 32) {
        const bx0 = size * 0.32, bx1 = size * 0.68;
        const by0 = size * 0.3, by1 = size * 0.62;
        if (x >= bx0 && x <= bx1 && y >= by0 && y <= by1) {
          // closer to white toward the middle (book lines)
          isGlyph = true;
        }
      }
      if (isGlyph) {
        raw[o++] = Math.round(r * 0.9 + 255 * 0.1);
        raw[o++] = Math.round(g * 0.9 + 255 * 0.1);
        raw[o++] = Math.round(b * 0.9 + 255 * 0.1);
      } else {
        raw[o++] = r;
        raw[o++] = g;
        raw[o++] = b;
      }
      raw[o++] = alpha;
    }
  }
  const idat = deflateSync(raw);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [16, 32, 48, 128]) {
  writeFileSync(join(outDir, `icon${size}.png`), makeIcon(size));
  console.log(`wrote icon${size}.png`);
}
console.log('Icons generated.');
