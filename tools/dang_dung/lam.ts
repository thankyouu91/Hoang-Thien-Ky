// Dựng dải hoạt ảnh dáng đứng (nhan_vat/<thân>/<áo>/dung_<dáng>.png) từ hoạt ảnh skeleton-v3 trên PixelLab:
// tìm hoạt ảnh tên `dung_<dáng>` của state thân + áo (id lấy từ dòng manifest của dải dung.png), tải khung, giữ đoạn
// lặp được, ghép dải ngang 96×96, ước điểm neo (đầu, cổ tay) bằng POST /v2/estimate-skeleton (0,1 lượt mỗi khung), ghi
// PNG vào assets/pixellab và in dòng manifest ra file JSON (ghép vào manifest bằng ghep.ts).
//
// Chạy: node tools/dang_dung/lam.ts <dáng,dáng|all> <thân/áo,…|all> <thư mục tạm> <ra.json>
// Ví dụ: node tools/dang_dung/lam.ts khoanh_tay,lo_lung all %TEMP%\dang ra.json
//
// Neo đầu: tâm các điểm đầu (mũi, mắt, tai) cộng độ lệch chỉnh theo dải dung.png có sẵn của cùng thân và áo, để mũ ngồi
// đúng chỗ như ở hoạt ảnh cũ. Neo tay theo DANG[x].tay: "phai" cổ tay có x lớn hơn (như các dải cũ), "cao" cổ tay cao
// hơn (tay giơ cầm vũ khí), "khong" tay không cầm gì (vũ khí đeo lưng hay cất, proto tự vẽ).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { blank, blit, decodePng, encodePng, type Rgba } from "./png.ts";

interface PoseSpec {
  /** Khung giữ lại (chỉ số từ 0, gồm hai đầu); khung trước đó là đoạn chuyển từ tư thế nghỉ sang dáng. */
  keep: [number, number];
  fps: number;
  tay: "phai" | "cao" | "khong";
  moTa: string;
}

/** Các dáng đã vẽ trên PixelLab (tư thế viết trong docs/DANG_DUNG.md). */
const DANG: Record<string, PoseSpec> = {
  khoanh_tay: { keep: [3, 9], fps: 5, tay: "khong", moTa: "khoanh tay trước ngực, ngẩng đầu, thở chậm" },
  chap_tay: { keep: [3, 9], fps: 5, tay: "khong", moTa: "chắp tay sau lưng, ưỡn ngực" },
  thien_toa: { keep: [4, 9], fps: 4, tay: "khong", moTa: "ngồi thiền trên đất, hai tay đặt trong lòng" },
  the_thu: { keep: [0, 7], fps: 8, tay: "phai", moTa: "thế thủ quyền, chân trụ rộng, nắm tay giơ trước ngực, nhún nhẹ" },
  chong_nanh: { keep: [3, 9], fps: 5, tay: "cao", moTa: "một tay chống hông, một tay cầm vật trước ngực" },
  vac_vai: { keep: [3, 9], fps: 5, tay: "cao", moTa: "một tay giơ nắm cán vũ khí gác vai, tay kia chống hông" },
  lo_lung: { keep: [0, 7], fps: 6, tay: "phai", moTa: "bay lơ lửng (move hover), chân buông thõng, tay buông hơi dang" },
  bat_an: { keep: [3, 9], fps: 5, tay: "khong", moTa: "một tay dựng trước mặt bắt ấn, tay kia buông" },
};

interface Kp {
  label: string;
  x: number;
  y: number;
}

const ROOT = join(import.meta.dirname, "..", "..");
const ASSETS = join(ROOT, "assets", "pixellab");
const FW = 96;
const HEAD = ["NOSE", "RIGHT EYE", "LEFT EYE", "RIGHT EAR", "LEFT EAR"];

const [poseArg, comboArg, tmp, outPath] = process.argv.slice(2);
if (!poseArg || !comboArg || !tmp || !outPath) {
  throw new Error("node tools/dang_dung/lam.ts <dáng,…|all> <thân/áo,…|all> <thư mục tạm> <ra.json>");
}
mkdirSync(tmp, { recursive: true });

function token(): string {
  const cfg = JSON.parse(readFileSync(join(homedir(), ".claude.json"), "utf8"));
  const auth: string | undefined = cfg?.mcpServers?.pixellab?.headers?.Authorization;
  if (!auth) throw new Error("không thấy token PixelLab trong ~/.claude.json");
  return auth.replace(/^Bearer\s+/i, "");
}
const TOKEN = token();
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** Tải về file đệm; fetch của Node đôi khi nhận 500 từ kho ảnh PixelLab nên lùi về curl. */
async function download(url: string, cache: string): Promise<Uint8Array> {
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

async function api(path: string, body?: unknown): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(`https://api.pixellab.ai/v2/${path}`, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.ok) return r.json();
    if (attempt >= 3) throw new Error(`${path}: ${r.status} ${await r.text()}`);
    await sleep(3000);
  }
}

async function skeleton(png: Uint8Array, cache: string): Promise<Kp[]> {
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, "utf8"));
  const j = await api("estimate-skeleton", { image: { type: "base64", base64: Buffer.from(png).toString("base64") } });
  writeFileSync(cache, JSON.stringify(j.keypoints));
  return j.keypoints;
}

function frameOf(strip: Rgba, i: number): Rgba {
  const f = blank(FW, FW);
  blit(f, strip, 0, 0, i * FW, 0, FW, FW);
  return f;
}

const px = (k: Kp, w: number, h: number) => [k.x * w, k.y * h] as const;
const round = (v: number) => Math.round(v * 10) / 10;

function headCenter(kps: Kp[], w: number, h: number): [number, number] | null {
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

const manifest = JSON.parse(readFileSync(join(ASSETS, "manifest.json"), "utf8")).assets as any[];
const idleOf = (body: string, outfit: string) => manifest.find((a) => a.file === `nhan_vat/${body}/${outfit}/dung.png`);

/** Độ lệch từ tâm điểm đầu tới neo `dau` đã chốt của dải dung.png, trung bình trên các khung. */
async function headOffset(body: string, outfit: string): Promise<[number, number]> {
  const meta = idleOf(body, outfit);
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

const combos: [string, string][] =
  comboArg === "all"
    ? manifest
        .map((a) => /^nhan_vat\/(\w+)\/(\w+)\/dung\.png$/.exec(a.file))
        .filter((m): m is RegExpExecArray => !!m)
        .map((m) => [m[1], m[2]])
    : comboArg.split(",").map((c) => c.split("/") as [string, string]);
const poses = poseArg === "all" ? Object.keys(DANG) : poseArg.split(",");

const out: unknown[] = [];
for (const [body, outfit] of combos) {
  const stateId: string | undefined = idleOf(body, outfit)?.pixellab_id;
  if (!stateId) {
    console.log(`${body}/${outfit}: không có pixellab_id`);
    continue;
  }
  const character = await api(`characters/${stateId}`);
  const [ox, oy] = await headOffset(body, outfit);
  for (const pose of poses) {
    const spec = DANG[pose];
    if (!spec) throw new Error(`dáng lạ: ${pose}`);
    const anim = (character.animations as any[]).filter((a) => a.display_name === `dung_${pose}`).pop();
    const dir = anim?.directions?.find((d: any) => d.direction === "south-east");
    if (!dir?.frames?.length) {
      console.log(`${body}/${outfit} dung_${pose}: chưa có hoạt ảnh`);
      continue;
    }
    const n = spec.keep[1] - spec.keep[0] + 1;
    const strip = blank(FW * n, FW);
    const neo: { dau: [number, number, number]; tay: [number, number] | null }[] = [];
    let prevDau: [number, number] = [48, 27];
    for (let j = 0; j < n; j++) {
      const i = spec.keep[0] + j;
      const tag = `${body}_${outfit}_${pose}_${anim.animation_group_id.slice(0, 8)}_${i}`;
      const bytes = await download(dir.frames[i], join(tmp, `${tag}.png`));
      const img = decodePng(bytes);
      if (img.w !== FW || img.h !== FW) throw new Error(`${tag}: khung ${img.w}×${img.h}, cần ${FW}×${FW}`);
      blit(strip, img, j * FW, 0);
      const kps = await skeleton(bytes, join(tmp, `${tag}.json`));
      const c = headCenter(kps, img.w, img.h);
      const dau: [number, number] = c ? [c[0] + ox, c[1] + oy] : prevDau;
      prevDau = dau;
      let tay: [number, number] | null = null;
      if (spec.tay !== "khong") {
        const wrists = kps.filter((k) => k.label === "RIGHT ARM" || k.label === "LEFT ARM").map((k) => px(k, img.w, img.h));
        if (wrists.length) {
          const pick = wrists.reduce((a, b) => (spec.tay === "cao" ? (b[1] < a[1] ? b : a) : b[0] > a[0] ? b : a));
          tay = [round(pick[0]), round(pick[1])];
        }
      }
      neo.push({ dau: [round(dau[0]), round(dau[1]), 0], tay });
    }
    const file = `nhan_vat/${body}/${outfit}/dung_${pose}.png`;
    writeFileSync(join(ASSETS, file), encodePng(strip));
    out.push({
      file,
      description: `Nhân vật ${body.replace("_", " ")} mặc ${outfit.replace("_", " ")}, dáng đứng: ${spec.moTa}; dải ngang ${n} khung 96×96 lặp được, hướng south-east. Mũ và vũ khí ghép lúc chạy theo trường neo.`,
      tool: "animate_character",
      params: { mode: "skeleton-v3", action: anim.animation_type, directions: ["south-east"], frames_kept: spec.keep, group: anim.animation_group_id },
      created: new Date().toISOString().slice(0, 10),
      pixellab_id: stateId,
      frames: n,
      frame_w: FW,
      frame_h: FW,
      fps: spec.fps,
      neo,
    });
    console.log(`${file}: ${n} khung`);
  }
}
writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
console.log(`${out.length} dải → ${outPath}`);
