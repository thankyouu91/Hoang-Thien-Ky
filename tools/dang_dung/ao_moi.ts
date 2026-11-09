// Dựng dải cho bộ áo theo tài năng (gói 3, 2026-11-05): nhan_vat/<thân>/<áo>/<động tác>.png từ hoạt ảnh skeleton-v3
// cùng tên trên state áo (mã ở ao_tai_nang.json), cộng ảnh nghỉ nhan_vat/<thân>/<áo>.png (hướng south-east).
//
// Neo, khung chạm, khung giữ, fps và cách giữ khung chép từ dải đạo bào cùng thân, cùng động tác: cùng thân, cùng move
// (hay cùng tư thế) thì xương như nhau. Đo trên dải có sẵn: neo đầu giữa đạo bào và võ phục lệch trung bình dưới 1 px;
// neo tay chỉ lệch lớn ở khung ước sai (tay khuất). Áo trùm đầu như sát thủ còn làm ước khung xương sai thêm, nên chép
// chắc hơn ước lại, và không tốn lượt.
//
// Chạy: node tools/dang_dung/ao_moi.ts <thân,…|all> <áo,…|all> <thư mục tạm> <ra.json>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { blank, blit, decodePng, encodePng } from "./png.ts";
import { api, ASSETS, download, frameOf, FW, headCenter, headOffset, readManifest, skeleton } from "./pixellab.ts";

/**
 * Soát neo đầu đã chép: ước khung xương ở khung giữa của dải (0,1 lượt); lệch quá ngần này px thì ước lại đầu cả dải.
 * PixelLab có chỉnh nhẹ tư thế cho vừa thân từng bộ áo (ngả người vài độ ở dáng ngồi, khoanh tay).
 */
const HEAD_TOL = 3;

/** Dáng đứng có dải PixelLab theo tài năng (DANG_THEO_TAI_NANG trong proto/src/scenes/battle/dangDung.ts). */
const DANG: Record<string, string[]> = {
  tu_tran: ["dung_bat_an"],
  tu_dan: ["dung_thien_toa"],
  sat_thu: ["dung_khoanh_tay"],
  tu_ren: ["dung_vac_vai"],
  tu_duoc: ["dung_chap_tay", "dung_thien_toa"],
  tu_kim_tien: ["dung_chong_nanh"],
};
const BASE = ["dung", "ra_chieu", "trung_don", "nga", "chay", "ra_chieu_chem", "ra_chieu_dam", "ra_chieu_dap", "ra_chieu_phong"];
const TEN_AO: Record<string, string> = {
  tu_tran: "áo tu trận", tu_dan: "áo tu đan", sat_thu: "áo sát thủ", tu_ren: "áo tu rèn", tu_duoc: "áo tu dược", tu_kim_tien: "áo tu kim tiền",
};

const [bodyArg, aoArg, tmp, outPath] = process.argv.slice(2);
if (!bodyArg || !aoArg || !tmp || !outPath) throw new Error("node tools/dang_dung/ao_moi.ts <thân,…|all> <áo,…|all> <thư mục tạm> <ra.json>");
mkdirSync(tmp, { recursive: true });

const STATES = JSON.parse(readFileSync(join(import.meta.dirname, "ao_tai_nang.json"), "utf8"));
const manifest = readManifest();
const byFile = new Map(manifest.map((a) => [a.file, a]));
const bodies = bodyArg === "all" ? ["nam_khoe", "nam_manh", "nu_khoe", "nu_manh"] : bodyArg.split(",");
const aos = aoArg === "all" ? Object.keys(DANG) : aoArg.split(",");

/** Cụm điểm tách khỏi thân nhỏ hơn ngần này thì coi là vệt văng ra (move fall_back, hit đôi khi vẽ máu, bụi bay). */
const DEBRIS = 40;

/**
 * Bỏ các cụm điểm có màu (8 hướng) nhỏ hơn DEBRIS điểm trong một khung, trừ cụm lớn nhất (thân). Không lọc theo màu vì
 * vệt văng có tông như bóng da. Trả số điểm đã bỏ.
 */
function dropDebris(img: { w: number; h: number; data: Uint8Array | Uint8ClampedArray }): number {
  const { w, h, data } = img;
  const seen = new Uint8Array(w * h);
  const groups: number[][] = [];
  for (let i = 0; i < w * h; i++) {
    if (seen[i] || data[i * 4 + 3] < 128) continue;
    const g: number[] = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      g.push(p);
      const x = p % w;
      const y = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const qx = x + dx;
          const qy = y + dy;
          if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
          const q = qy * w + qx;
          if (!seen[q] && data[q * 4 + 3] >= 128) {
            seen[q] = 1;
            stack.push(q);
          }
        }
      }
    }
    groups.push(g);
  }
  if (groups.length < 2) return 0;
  const biggest = groups.reduce((a, b) => (b.length > a.length ? b : a));
  let n = 0;
  for (const g of groups) {
    if (g === biggest || g.length >= DEBRIS) continue;
    for (const p of g) data[p * 4 + 3] = 0;
    n += g.length;
  }
  return n;
}

/** Chỉ số khung PixelLab được giữ, theo dải tham chiếu: khoảng [đầu, cuối], danh sách, hay `frames` khung đầu. */
function keptFrames(ref: any): number[] {
  const k = ref.params?.frames_kept;
  if (Array.isArray(k) && k.length === ref.frames) return k;
  if (Array.isArray(k) && k.length === 2 && k[1] - k[0] + 1 === ref.frames) return Array.from({ length: ref.frames }, (_, i) => k[0] + i);
  return Array.from({ length: ref.frames }, (_, i) => i);
}

const out: any[] = [];
const missing: string[] = [];
for (const body of bodies) {
  for (const ao of aos) {
    const stateId: string | undefined = STATES[body]?.[ao];
    if (!stateId) {
      missing.push(`${body}/${ao}: chưa có state`);
      continue;
    }
    const character = await api(`characters/${stateId}`);
    // Ảnh nghỉ 64×64 hướng south-east, như nhan_vat/<thân>/dao_bao.png.
    const rot = character.rotation_urls?.["south-east"] ?? character.rotations?.["south-east"];
    if (rot) {
      const bytes = await download(rot, join(tmp, `ao_${body}_${ao}_se.png`));
      const file = `nhan_vat/${body}/${ao}.png`;
      writeFileSync(join(ASSETS, file), bytes);
      out.push({
        file,
        description: `Ảnh nghỉ ${body.replace("_", " ")} mặc ${TEN_AO[ao]} (64×64, hướng south-east), cho màn chọn nhân vật.`,
        tool: "create_character_state",
        params: { edit_description: STATES.mo_ta?.[ao], direction: "south-east" },
        created: new Date().toISOString().slice(0, 10),
        pixellab_id: stateId,
      });
    }
    for (const name of [...BASE, ...DANG[ao]]) {
      const ref = byFile.get(`nhan_vat/${body}/dao_bao/${name}.png`);
      if (!ref?.neo) {
        missing.push(`${body}/${ao} ${name}: thiếu dải đạo bào để chép neo`);
        continue;
      }
      const found = (character.animations as any[]).filter((a) => a.display_name === name);
      if (found.length > 1) throw new Error(`${body}/${ao} ${name}: ${found.length} nhóm cùng tên`);
      const dir = found[0]?.directions?.find((d: any) => d.direction === "south-east");
      const keep = keptFrames(ref);
      if (!dir?.frames?.length || dir.frames.length <= Math.max(...keep)) {
        missing.push(`${body}/${ao} ${name}: chưa có hoạt ảnh (${dir?.frames?.length ?? 0} khung)`);
        continue;
      }
      const strip = blank(FW * keep.length, FW);
      for (let j = 0; j < keep.length; j++) {
        const bytes = await download(dir.frames[keep[j]], join(tmp, `ao_${body}_${ao}_${name}_${found[0].animation_group_id.slice(0, 8)}_${keep[j]}.png`));
        const img = decodePng(bytes);
        if (img.w !== FW || img.h !== FW) throw new Error(`${body}/${ao} ${name} khung ${keep[j]}: ${img.w}×${img.h}`);
        if (name === "nga" || name === "trung_don") {
          const n = dropDebris(img);
          if (n) console.log(`${body}/${ao} ${name} khung ${keep[j]}: bỏ ${n} điểm văng tách khỏi thân`);
        }
        blit(strip, img, j * FW, 0);
      }
      const file = `nhan_vat/${body}/${ao}/${name}.png`;
      mkdirSync(join(ASSETS, "nhan_vat", body, ao), { recursive: true });
      writeFileSync(join(ASSETS, file), encodePng(strip));
      const { file: _f, description: _d, pixellab_id: _p, created: _c, params, ...meta } = ref;
      // Soát đầu ở khung giữa; lệch thì ước lại đầu từng khung (giữ góc nghiêng đầu của dải tham chiếu).
      const [ox, oy] = await headOffset(manifest, body, "dao_bao", tmp);
      const est = async (j: number) => {
        const kps = await skeleton(encodePng(frameOf(strip, j)), join(tmp, `ao_kp_${body}_${ao}_${name}_${found[0].animation_group_id.slice(0, 8)}_${j}.json`));
        const c = headCenter(kps, FW, FW);
        return c ? ([c[0] + ox, c[1] + oy] as [number, number]) : null;
      };
      const mid = Math.floor(keep.length / 2);
      const h = await est(mid);
      if (h && Math.hypot(h[0] - meta.neo[mid].dau[0], h[1] - meta.neo[mid].dau[1]) > HEAD_TOL) {
        const neo = [];
        for (let j = 0; j < keep.length; j++) {
          const e = j === mid ? h : await est(j);
          const r = meta.neo[j];
          neo.push({ ...r, dau: e ? [Math.round(e[0] * 10) / 10, Math.round(e[1] * 10) / 10, r.dau[2]] : r.dau });
        }
        meta.neo = neo;
        console.log(`${file}: neo đầu lệch ${Math.hypot(h[0] - ref.neo[mid].dau[0], h[1] - ref.neo[mid].dau[1]).toFixed(1)} px so với đạo bào, đã ước lại`);
      }
      out.push({
        file,
        description: `Nhân vật ${body.replace("_", " ")} mặc ${TEN_AO[ao]}, động tác ${name}: dải ngang ${keep.length} khung 96×96, hướng south-east. Neo, khung chạm chép từ dải đạo bào cùng thân (cùng move nên cùng xương).`,
        tool: "animate_character",
        params: { ...params, group: found[0].animation_group_id },
        created: new Date().toISOString().slice(0, 10),
        pixellab_id: stateId,
        ...meta,
      });
    }
  }
}
writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
console.log(`${out.length} dòng → ${outPath}`);
if (missing.length) console.log(`thiếu ${missing.length}:\n${missing.join("\n")}`);
