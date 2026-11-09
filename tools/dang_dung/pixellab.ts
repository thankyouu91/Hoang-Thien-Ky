// Phần chung của các script dựng dải hoạt ảnh nhân vật (lam.ts cho dáng đứng, dong_tac.ts cho chạy và ra chiêu):
// token PixelLab đọc lúc chạy từ ~/.claude.json (không in ra), gọi REST, tải khung bằng curl, ước khung xương có đệm.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { blank, blit, decodePng, encodePng, type Rgba } from "./png.ts";

export interface Kp {
  label: string;
  x: number;
  y: number;
}

export const ROOT = join(import.meta.dirname, "..", "..");
export const ASSETS = join(ROOT, "assets", "pixellab");
/** Khung hoạt ảnh skeleton-v3 của thân 64 px: 96×96, chân ở y = 80. */
export const FW = 96;
const HEAD = ["NOSE", "RIGHT EYE", "LEFT EYE", "RIGHT EAR", "LEFT EAR"];

function token(): string {
  const cfg = JSON.parse(readFileSync(join(homedir(), ".claude.json"), "utf8"));
  const auth: string | undefined = cfg?.mcpServers?.pixellab?.headers?.Authorization;
  if (!auth) throw new Error("không thấy token PixelLab trong ~/.claude.json");
  return auth.replace(/^Bearer\s+/i, "");
}
let cached: string | undefined;
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** Tải về file đệm; fetch của Node đôi khi nhận 500 từ kho ảnh PixelLab nên dùng curl. */
export async function download(url: string, cache: string): Promise<Uint8Array> {
  if (existsSync(cache)) return readFileSync(cache);
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      execFileSync("curl", ["-sfL", "-o", cache, url]);
      if (existsSync(cache)) return readFileSync(cache);
    } catch {
      await sleep(2000);
    }
  }
  throw new Error(`tải ${url} không được`);
}

export async function api(path: string, body?: unknown): Promise<any> {
  cached ??= token();
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(`https://api.pixellab.ai/v2/${path}`, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cached}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.ok) return r.json();
    if (attempt >= 3) throw new Error(`${path}: ${r.status} ${await r.text()}`);
    await sleep(3000);
  }
}

/** Khung xương ước bởi PixelLab (0,1 lượt mỗi khung), đệm theo file. */
export async function skeleton(png: Uint8Array, cache: string): Promise<Kp[]> {
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, "utf8"));
  const j = await api("estimate-skeleton", { image: { type: "base64", base64: Buffer.from(png).toString("base64") } });
  writeFileSync(cache, JSON.stringify(j.keypoints));
  return j.keypoints;
}

export function frameOf(strip: Rgba, i: number): Rgba {
  const f = blank(FW, FW);
  blit(f, strip, 0, 0, i * FW, 0, FW, FW);
  return f;
}

export const px = (k: Kp, w: number, h: number) => [k.x * w, k.y * h] as const;
export const round = (v: number) => Math.round(v * 10) / 10;

export function headCenter(kps: Kp[], w: number, h: number): [number, number] | null {
  const hs = kps.filter((k) => HEAD.includes(k.label));
  if (hs.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const k of hs) {
    const [a, b] = px(k, w, h);
    x += a;
    y += b;
  }
  return [x / hs.length, y / hs.length];
}

export function readManifest(): any[] {
  return JSON.parse(readFileSync(join(ASSETS, "manifest.json"), "utf8")).assets as any[];
}

export function idleOf(manifest: any[], body: string, outfit: string): any {
  return manifest.find((a) => a.file === `nhan_vat/${body}/${outfit}/dung.png`);
}

/** Các tổ hợp thân/áo có dải dung.png, hoặc danh sách "thân/áo,…". */
export function combosOf(manifest: any[], arg: string): [string, string][] {
  if (arg !== "all") return arg.split(",").map((c) => c.split("/") as [string, string]);
  return manifest
    .map((a) => /^nhan_vat\/(\w+)\/(\w+)\/dung\.png$/.exec(a.file))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => [m[1], m[2]]);
}

/** Độ lệch từ tâm điểm đầu tới neo `dau` đã chốt của dải dung.png, trung bình trên các khung (để mũ ngồi đúng chỗ). */
export async function headOffset(manifest: any[], body: string, outfit: string, tmp: string): Promise<[number, number]> {
  const meta = idleOf(manifest, body, outfit);
  if (!meta?.neo) return [0, 0];
  const strip = decodePng(readFileSync(join(ASSETS, meta.file)));
  let dx = 0;
  let dy = 0;
  let n = 0;
  for (let i = 0; i < meta.frames; i++) {
    const kps = await skeleton(encodePng(frameOf(strip, i)), join(tmp, `cal_${body}_${outfit}_${i}.json`));
    const c = headCenter(kps, FW, FW);
    if (!c) continue;
    dx += meta.neo[i].dau[0] - c[0];
    dy += meta.neo[i].dau[1] - c[1];
    n++;
  }
  return n ? [dx / n, dy / n] : [0, 0];
}
