// Dựng dải chạy và ra chiêu theo loại chiêu (nhan_vat/<thân>/<áo>/<động tác>.png, gói 2 ngày 2026-11-05) từ hoạt ảnh
// skeleton-v3 trên PixelLab: tìm hoạt ảnh cùng tên của state thân + áo, tải khung, ghép dải ngang 96×96, ước điểm neo
// bằng POST /v2/estimate-skeleton (0,1 lượt mỗi khung) rồi in dòng manifest ra file JSON (ghép bằng ghep.ts).
//
// Chạy: node tools/dang_dung/dong_tac.ts <động tác,…|all> <thân/áo,…|all> <thư mục tạm> <ra.json>
//
// Neo mỗi khung:
// - `dau` như lam.ts: tâm các điểm đầu cộng độ lệch chỉnh theo dải dung.png của cùng thân và áo.
// - `tay` [x, y, góc, vươn]: cổ tay cầm vũ khí, theo đúng một bên tay suốt dải (bên có x lớn hơn ở khung nghỉ dung.png,
//   như neo tay cũ), để lúc hai tay bắt chéo neo không nhảy sang tay kia. Góc (độ, chiều kim đồng hồ, 0 là sang phải)
//   là hướng cẳng tay từ khuỷu tới cổ tay; vươn 0–1 là cổ tay đã rời chỗ nghỉ bao xa (đủ 1 ở REACH px). Lúc vẽ, lưỡi vũ
//   khí quay từ góc gốc của ảnh đồ về hướng cẳng tay theo độ vươn: tay ở chỗ nghỉ thì vũ khí như lúc đứng (không giật
//   khi chuyển động tác), tay vươn hết thì lưỡi nối dài cẳng tay (đâm thẳng, chém theo cung tay).
// - `cham` (ra chiêu): khung chạm, tức khung đòn trúng hay đạn rời tay; `giu` (đập): khung tay giơ cao nhất, giữ trong
//   lúc vận công. Tự tìm theo đường đi của cổ tay, hoặc đặt tay trong DONG khi xem khung thấy lệch.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { blank, blit, decodePng, encodePng } from "./png.ts";
import { api, ASSETS, combosOf, download, frameOf, FW, headCenter, headOffset, idleOf, px, readManifest, round, skeleton, type Kp } from "./pixellab.ts";

interface Spec {
  fps: number;
  /** Chỉ giữ các khung này của hoạt ảnh PixelLab (theo thứ tự); bỏ trống là giữ hết. */
  keep?: number[];
  moTa: string;
  /** Cách tìm khung chạm: tay đi nhanh nhất, tay vươn xa nhất về phía trước, hay tay xuống thấp nhất sau khi giơ cao. */
  cham?: "nhanh" | "xa" | "dap";
  /** Đặt tay khung chạm / khung giữ khi cách tự tìm không đúng. */
  chamTay?: number;
  giuTay?: number;
  loop?: boolean;
}

/**
 * Nhóm hoạt ảnh vẽ hỏng, không dùng (đầu mã nhóm trên PixelLab); REST không cho biết thứ tự tạo nên phải loại tay.
 * bbd9e4ec: chém trên nam khoẻ đạo bào, mô tả có chữ "sword" nên PixelLab vẽ thêm kiếm vào tay, trùng vũ khí ghép.
 */
const BO_NHOM = ["bbd9e4ec"];

/**
 * Neo tay lấy từ dải cùng thân, cùng động tác của bộ áo khác khi khung xương ước sai (cùng thân, cùng move thì xương như
 * nhau). Nữ khoẻ: nắm tay giơ ra sau đầu bị tóc che nên ước nhầm cổ tay (võ phục chém: ở thắt lưng; đạo bào đập: lệch
 * ra sau gáy ở khung 1).
 */
const TAY_TU: Record<string, string> = {
  "nu_khoe/vo_phuc/ra_chieu_chem": "nu_khoe/dao_bao",
  "nu_khoe/dao_bao/ra_chieu_dap": "nu_khoe/vo_phuc",
};

const DONG: Record<string, Spec> = {
  chay: { fps: 16, loop: true, moTa: "chạy tới (move run), một vòng hai bước, lặp được" },
  ra_chieu_chem: { fps: 16, cham: "nhanh", chamTay: 4, moTa: "vung tay trước chém ngang (move slash), cho cận đơn và cận quét" },
  ra_chieu_dam: { fps: 16, cham: "xa", moTa: "thu tay rồi đâm tới (move stab), cho thân pháp" },
  ra_chieu_dap: { fps: 14, cham: "dap", keep: [0, 1, 2, 3, 8, 9, 10, 11], chamTay: 5, moTa: "hai tay giơ cao rồi đập xuống (arms_overhead rồi cast_down), cho diện rộng và trận pháp" },
  ra_chieu_phong: { fps: 16, cham: "xa", moTa: "vung tay ra sau rồi phóng tới (move throw), cho tầm xa, bùa chú, khống chế" },
};

const [animArg, comboArg, tmp, outPath] = process.argv.slice(2);
if (!animArg || !comboArg || !tmp || !outPath) {
  throw new Error("node tools/dang_dung/dong_tac.ts <động tác,…|all> <thân/áo,…|all> <thư mục tạm> <ra.json>");
}
mkdirSync(tmp, { recursive: true });

const manifest = readManifest();
const names = animArg === "all" ? Object.keys(DONG) : animArg.split(",");
const find = (kps: Kp[], label: string) => kps.find((k) => k.label === label);
const deg = (a: number) => (a * 180) / Math.PI;
const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
/** Cổ tay rời chỗ nghỉ ngần này px thì coi như vươn hết. */
const REACH = 14;

/** Bên tay cầm vũ khí và chỗ cổ tay ở khung nghỉ (khung 0 của dung.png). */
async function restHand(body: string, outfit: string): Promise<{ side: "LEFT" | "RIGHT"; wrist: [number, number] }> {
  const meta = idleOf(manifest, body, outfit);
  const strip = decodePng(readFileSync(join(ASSETS, meta.file)));
  const kps = await skeleton(encodePng(frameOf(strip, 0)), join(tmp, `cal_${body}_${outfit}_0.json`));
  const l = find(kps, "LEFT ARM");
  const r = find(kps, "RIGHT ARM");
  const side = !r || (l && l.x >= r.x) ? "LEFT" : "RIGHT";
  const w = side === "LEFT" ? l : r;
  return { side, wrist: w ? [w.x * FW, w.y * FW] : [56, 50] };
}

function forearm(kps: Kp[], side: "LEFT" | "RIGHT"): number | null {
  const e = find(kps, `${side} ELBOW`);
  const w = find(kps, `${side} ARM`);
  if (!e || !w) return null;
  return deg(Math.atan2((w.y - e.y) * FW, (w.x - e.x) * FW));
}

function contact(spec: Spec, wrists: [number, number][]): { cham?: number; giu?: number } {
  if (!spec.cham) return {};
  const n = wrists.length;
  const speed = wrists.map((w, i) => (i === 0 ? 0 : Math.hypot(w[0] - wrists[i - 1][0], w[1] - wrists[i - 1][1])));
  const argmax = (from: number, to: number, f: (i: number) => number) => {
    let best = from;
    for (let i = from; i <= to; i++) if (f(i) > f(best)) best = i;
    return best;
  };
  if (spec.cham === "nhanh") return { cham: spec.chamTay ?? argmax(1, n - 1, (i) => speed[i]) };
  if (spec.cham === "xa") return { cham: spec.chamTay ?? argmax(1, n - 1, (i) => wrists[i][0]) };
  const giu = spec.giuTay ?? argmax(1, Math.floor((n * 2) / 3), (i) => -wrists[i][1]);
  return { giu, cham: spec.chamTay ?? argmax(giu + 1, n - 1, (i) => wrists[i][1]) };
}

const out: unknown[] = [];
for (const [body, outfit] of combosOf(manifest, comboArg)) {
  const stateId: string | undefined = idleOf(manifest, body, outfit)?.pixellab_id;
  if (!stateId) {
    console.log(`${body}/${outfit}: không có pixellab_id`);
    continue;
  }
  const character = await api(`characters/${stateId}`);
  const [ox, oy] = await headOffset(manifest, body, outfit, tmp);
  const rest = await restHand(body, outfit);
  for (const name of names) {
    const spec = DONG[name];
    if (!spec) throw new Error(`động tác lạ: ${name}`);
    const found = (character.animations as any[]).filter((a) => a.display_name === name && !BO_NHOM.some((b) => a.animation_group_id.startsWith(b)));
    if (found.length > 1) throw new Error(`${body}/${outfit} ${name}: ${found.length} nhóm cùng tên, thêm nhóm hỏng vào BO_NHOM`);
    const anim = found[0];
    const dir = anim?.directions?.find((d: any) => d.direction === "south-east");
    if (!dir?.frames?.length) {
      console.log(`${body}/${outfit} ${name}: chưa có hoạt ảnh`);
      continue;
    }
    const keep = spec.keep ?? dir.frames.map((_: string, i: number) => i);
    const n = keep.length;
    const strip = blank(FW * n, FW);
    const neo: { dau: [number, number, number]; tay: [number, number, number, number] | null }[] = [];
    const wrists: [number, number][] = [];
    let prevDau: [number, number] = [48, 27];
    let prevTay: [number, number, number, number] | null = null;
    let first: [number, number] | undefined;
    for (let j = 0; j < n; j++) {
      const i = keep[j];
      const tag = `${body}_${outfit}_${name}_${anim.animation_group_id.slice(0, 8)}_${i}`;
      const bytes = await download(dir.frames[i], join(tmp, `${tag}.png`));
      const img = decodePng(bytes);
      if (img.w !== FW || img.h !== FW) throw new Error(`${tag}: khung ${img.w}×${img.h}, cần ${FW}×${FW}`);
      blit(strip, img, j * FW, 0);
      const kps = await skeleton(bytes, join(tmp, `${tag}.json`));
      const c = headCenter(kps, img.w, img.h);
      const dau: [number, number] = c ? [c[0] + ox, c[1] + oy] : prevDau;
      prevDau = dau;
      const w = find(kps, `${rest.side} ARM`);
      const a = forearm(kps, rest.side);
      let tay = prevTay;
      if (w) {
        const [x, y] = px(w, img.w, img.h);
        // Vươn tính từ chỗ nghỉ của dung.png, và với dải không lặp thì cả từ khung đầu của dải (khung đầu nhiều khi đã
        // lệch tư thế nghỉ vài px): khung đầu, khung cuối giữ vũ khí như lúc đứng, khỏi giật khi chuyển động tác.
        first ??= [x, y];
        const off = Math.min(Math.hypot(x - rest.wrist[0], y - rest.wrist[1]), spec.loop ? Infinity : Math.hypot(x - first[0], y - first[1]));
        const reach = Math.min(1, off / REACH);
        tay = [round(x), round(y), a === null ? prevTay?.[2] ?? 90 : Math.round(wrap(a)), Math.round(reach * 100) / 100];
      }
      prevTay = tay;
      wrists.push(tay ? [tay[0], tay[1]] : wrists[wrists.length - 1] ?? [48, 50]);
      neo.push({ dau: [round(dau[0]), round(dau[1]), 0], tay });
    }
    const beat = contact(spec, wrists);
    const file = `nhan_vat/${body}/${outfit}/${name}.png`;
    writeFileSync(join(ASSETS, file), encodePng(strip));
    out.push({
      file,
      description: `Nhân vật ${body.replace("_", " ")} mặc ${outfit.replace("_", " ")}: ${spec.moTa}; dải ngang ${n} khung 96×96, hướng south-east. Mũ và vũ khí ghép lúc chạy theo trường neo (tay có góc xoay theo cẳng tay).`,
      tool: "animate_character",
      params: { mode: "skeleton-v3", action: anim.animation_type, directions: ["south-east"], group: anim.animation_group_id, ...(spec.keep ? { frames_kept: spec.keep } : {}) },
      created: new Date().toISOString().slice(0, 10),
      pixellab_id: stateId,
      frames: n,
      frame_w: FW,
      frame_h: FW,
      fps: spec.fps,
      ...(spec.loop ? { loop: true } : {}),
      ...beat,
      neo,
    });
    const track = wrists.map((p, i) => `${i}:${p[0].toFixed(0)},${p[1].toFixed(0)},${neo[i].tay?.[2] ?? "-"}°×${neo[i].tay?.[3] ?? "-"}`).join(" ");
    console.log(`${file}: ${n} khung${beat.giu !== undefined ? `, giữ ${beat.giu}` : ""}${beat.cham !== undefined ? `, chạm ${beat.cham}` : ""} | tay ${rest.side} ${track}`);
  }
}

// Neo tay lấy từ áo khác (TAY_TU): làm sau khi xong mọi tổ hợp để nguồn đi trước hay sau đều có, rồi tìm lại khung chạm.
for (const e of out as any[]) {
  const [, combo, name] = /^nhan_vat\/(\w+\/\w+)\/(\w+)\.png$/.exec(e.file)!;
  const from = TAY_TU[`${combo}/${name}`];
  if (!from) continue;
  const srcFile = `nhan_vat/${from}/${name}.png`;
  const src = (out as any[]).find((x) => x.file === srcFile) ?? manifest.find((x) => x.file === srcFile);
  if (!src || src.frames !== e.frames) throw new Error(`${e.file}: chưa có dải ${srcFile} cùng số khung để lấy neo tay`);
  e.neo = e.neo.map((k: any, j: number) => ({ ...k, tay: src.neo[j].tay }));
  delete e.cham;
  delete e.giu;
  Object.assign(e, contact(DONG[name], e.neo.map((k: any) => (k.tay ? [k.tay[0], k.tay[1]] : [48, 50]))));
  console.log(`${e.file}: neo tay lấy từ ${from}${e.giu !== undefined ? `, giữ ${e.giu}` : ""}${e.cham !== undefined ? `, chạm ${e.cham}` : ""}`);
}
writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
console.log(`${out.length} dải → ${outPath}`);
