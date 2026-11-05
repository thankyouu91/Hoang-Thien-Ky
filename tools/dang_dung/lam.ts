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
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { blank, blit, decodePng, encodePng } from "./png.ts";
import { api, ASSETS, combosOf, download, FW, headCenter, headOffset, idleOf, px, readManifest, round, skeleton } from "./pixellab.ts";

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

const [poseArg, comboArg, tmp, outPath] = process.argv.slice(2);
if (!poseArg || !comboArg || !tmp || !outPath) {
  throw new Error("node tools/dang_dung/lam.ts <dáng,…|all> <thân/áo,…|all> <thư mục tạm> <ra.json>");
}
mkdirSync(tmp, { recursive: true });

const manifest = readManifest();
const combos = combosOf(manifest, comboArg);
const poses = poseArg === "all" ? Object.keys(DANG) : poseArg.split(",");

const out: unknown[] = [];
for (const [body, outfit] of combos) {
  const stateId: string | undefined = idleOf(manifest, body, outfit)?.pixellab_id;
  if (!stateId) {
    console.log(`${body}/${outfit}: không có pixellab_id`);
    continue;
  }
  const character = await api(`characters/${stateId}`);
  const [ox, oy] = await headOffset(manifest, body, outfit, tmp);
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
