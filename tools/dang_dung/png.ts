// Đọc và ghi PNG RGBA 8 bit không cần thư viện ngoài (chỉ zlib của Node), đủ cho hình PixelLab:
// kiểu màu 6 (RGBA), 2 (RGB), 3 (bảng màu, có tRNS), 0 và 4 (xám), 8 bit, không xen kẽ.
import { deflateSync, inflateSync } from "node:zlib";

export interface Rgba {
  w: number;
  h: number;
  /** w * h * 4 byte, hàng trên trước */
  data: Uint8Array;
}

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function blank(w: number, h: number): Rgba {
  return { w, h, data: new Uint8Array(w * h * 4) };
}

export function decodePng(buf: Uint8Array): Rgba {
  const b = Buffer.from(buf);
  if (!b.subarray(0, 8).equals(SIG)) throw new Error("không phải PNG");
  let pos = 8;
  let w = 0;
  let h = 0;
  let depth = 0;
  let type = 0;
  let interlace = 0;
  let palette: Buffer | null = null;
  let trns: Buffer | null = null;
  const idat: Buffer[] = [];
  while (pos < b.length) {
    const len = b.readUInt32BE(pos);
    const kind = b.toString("latin1", pos + 4, pos + 8);
    const body = b.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;
    if (kind === "IHDR") {
      w = body.readUInt32BE(0);
      h = body.readUInt32BE(4);
      depth = body[8];
      type = body[9];
      interlace = body[12];
    } else if (kind === "PLTE") palette = body;
    else if (kind === "tRNS") trns = body;
    else if (kind === "IDAT") idat.push(body);
    else if (kind === "IEND") break;
  }
  if (depth !== 8 || interlace !== 0) throw new Error(`PNG chưa hỗ trợ: depth ${depth}, interlace ${interlace}`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!channels) throw new Error(`PNG kiểu màu ${type} chưa hỗ trợ`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const px = new Uint8Array(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = px.subarray(y * stride, (y + 1) * stride);
    const up = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? row[i - channels] : 0;
      const u = up ? up[i] : 0;
      const c = up && i >= channels ? up[i - channels] : 0;
      let v = src[i];
      if (f === 1) v += a;
      else if (f === 2) v += u;
      else if (f === 3) v += (a + u) >> 1;
      else if (f === 4) {
        const p = a + u - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - u);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c;
      }
      row[i] = v & 255;
    }
  }
  const out = blank(w, h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    if (type === 6) out.data.set(px.subarray(i * 4, i * 4 + 4), o);
    else if (type === 2) {
      out.data.set(px.subarray(i * 3, i * 3 + 3), o);
      out.data[o + 3] = 255;
    } else if (type === 3) {
      const k = px[i];
      out.data.set(palette!.subarray(k * 3, k * 3 + 3), o);
      out.data[o + 3] = trns && k < trns.length ? trns[k] : 255;
    } else if (type === 0) {
      out.data.fill(px[i], o, o + 3);
      out.data[o + 3] = 255;
    } else {
      out.data.fill(px[i * 2], o, o + 3);
      out.data[o + 3] = px[i * 2 + 1];
    }
  }
  return out;
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(b: Buffer): number {
  let c = -1;
  for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(kind: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(kind, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

export function encodePng(img: Rgba): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = img.w * 4;
  const raw = Buffer.alloc(img.h * (stride + 1));
  for (let y = 0; y < img.h; y++) raw.set(img.data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  return Buffer.concat([SIG, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

/** Chép vùng (sx, sy, w, h) của `src` vào `dst` tại (dx, dy), ghi đè. */
export function blit(dst: Rgba, src: Rgba, dx: number, dy: number, sx = 0, sy = 0, w = src.w, h = src.h): void {
  for (let y = 0; y < h; y++) {
    const ty = dy + y;
    const fy = sy + y;
    if (ty < 0 || ty >= dst.h || fy < 0 || fy >= src.h) continue;
    for (let x = 0; x < w; x++) {
      const tx = dx + x;
      const fx = sx + x;
      if (tx < 0 || tx >= dst.w || fx < 0 || fx >= src.w) continue;
      const o = (ty * dst.w + tx) * 4;
      const i = (fy * src.w + fx) * 4;
      dst.data.set(src.data.subarray(i, i + 4), o);
    }
  }
}
