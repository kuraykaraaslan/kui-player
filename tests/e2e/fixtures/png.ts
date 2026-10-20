import { inflateSync } from 'node:zlib';

export type Raster = { width: number; height: number; at: (x: number, y: number) => [number, number, number] };

/** Decodes the PNG Playwright's `page.screenshot` returns (8-bit RGB/RGBA, not interlaced), enough to ask "which pixels are this colour". */
export function decodePng(png: Buffer): Raster {
  let offset = 8;
  let width = 0; let height = 0; let channels = 4;
  const idat: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const body = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[12] !== 0) throw new Error('unsupported PNG: need 8-bit, not interlaced');
      channels = body[9] === 6 ? 4 : body[9] === 2 ? 3 : 0;
      if (!channels) throw new Error('unsupported PNG colour type');
    } else if (type === 'IDAT') idat.push(body);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]!;
    for (let i = 0; i < stride; i += 1) {
      const x = raw[y * (stride + 1) + 1 + i]!;
      const a = i >= channels ? pixels[y * stride + i - channels]! : 0;
      const b = y > 0 ? pixels[(y - 1) * stride + i]! : 0;
      const c = y > 0 && i >= channels ? pixels[(y - 1) * stride + i - channels]! : 0;
      let value = x;
      if (filter === 1) value = x + a;
      else if (filter === 2) value = x + b;
      else if (filter === 3) value = x + ((a + b) >> 1);
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c);
        value = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      pixels[y * stride + i] = value & 255;
    }
  }
  return { width, height, at: (x, y) => { const o = y * stride + x * channels; return [pixels[o]!, pixels[o + 1]!, pixels[o + 2]!]; } };
}

/** The leftmost and rightmost x (inclusive) of pixels in the rows `y0..y1` for which `match` holds, or null. */
export function extent(raster: Raster, y0: number, y1: number, match: (rgb: [number, number, number]) => boolean): [number, number] | null {
  let min = Infinity; let max = -Infinity;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = 0; x < raster.width; x += 1) {
      if (match(raster.at(x, y))) { if (x < min) min = x; if (x > max) max = x; }
    }
  }
  return min === Infinity ? null : [min, max];
}
