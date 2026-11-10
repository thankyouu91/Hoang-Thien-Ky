// Dựng map mẫu bằng lớp ô đất + vật cảnh + bầy + boss cho một khu: node tools/o_dat/mau_khu.mts <chỉ số khu>
// Chạy với cwd = thư mục gốc repo. Không có đối số thì in danh sách khu. Ghi đè assets/map_khu/<vùng>__<khu>.json.
// Bố cục rải bằng số ngẫu nhiên có hạt (theo chỉ số khu) để lần nào chạy cũng ra cùng map; sửa tay tiếp bằng proto/sua_map.html.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
const root = process.cwd();
const imp = (p: string) => import(pathToFileURL(`${root}/proto/src/scenes/mmo/${p}`).href);
const { datO, lopMoi, toO } = await imp("oDat.ts");
const { zone, ZONE_COUNT } = await imp("tienTrinh.ts");
const idx = Number(process.argv[2]);
if (!(idx >= 0)) {
  for (let i = 0; i < ZONE_COUNT; i++) console.log(i, zone(i).bg, zone(i).safe ? "safe" : "", zone(i).boss ? "boss" : "");
  process.exit(0);
}
const bo = JSON.parse(readFileSync(`${root}/assets/pixellab/o_dat/bo.json`, "utf8"));
const CO = 48, COT = 72, HANG = 40;
const l = lopMoi(bo, COT * CO, HANG * CO, CO);
let seed = 7 + idx;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const blob = (cx: number, cy: number, rx: number, ry: number, k: string, rag = 0.35) => {
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
    for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d < 1 - rag * rnd()) toO(l, x, y, k);
    }
};
// Đồng hoa và cỏ hoa rải rác
for (let i = 0; i < 9; i++) blob(4 + rnd() * 64, 3 + rnd() * 34, 3 + rnd() * 4, 2 + rnd() * 3, i % 2 ? "h" : "m");
// Hồ có bãi cát phía đông bắc
blob(54, 10, 11, 6.5, "b", 0.2);
blob(54, 10, 8.5, 4.5, "n", 0.15);
// Ao nhỏ bờ đất phía tây nam
blob(14, 31, 5, 3, "n", 0.2);
// Bãi đất sỏi (bãi quái)
blob(24, 9, 6, 3.5, "s");
blob(50, 30, 7, 4, "s");
// Đường đất uốn từ cửa trái sang cửa phải, rộng 2 ô
for (let x = 0; x < COT; x++) {
  const y = Math.round(HANG / 2 + Math.sin(x / 7) * 4 + Math.sin(x / 2.3) * 0.8);
  toO(l, x, y, "d", 2);
}
// Nhánh rẽ lên hồ
for (let y = 12; y < 21; y++) toO(l, 40 + Math.round(Math.sin(y / 3)), y, "d", 2);
const id = zone(idx).bg.replace("/", "__");
const bayC = [[24, 9], [50, 30], [10, 12], [34, 31], [62, 22], [30, 20], [44, 5], [66, 34], [18, 24], [40, 36], [58, 15], [8, 36], [28, 3], [48, 22]];
const bossC = [[20, 6], [60, 36]];
const xa = (c: number, r: number, ds: number[][], d: number) => ds.every(([x, y]) => Math.hypot(x - c, y - r) > d);
const vat: Record<string, unknown>[] = [];
// Vật cảnh nhỏ 64px vẽ ở 1,5× (96 đơn vị, người cao 56): bụi, cỏ, đá rải khắp cỏ; lau sậy sát nước; đá cuội trên sỏi; nấm, gỗ mục dưới tán cây.
const NHO = { co: ["bui_tron", "bui_qua_do", "co_cao", "bui_hoa_trang", "da_nho", "bui_gai", "thong_non", "cay_kho", "goc_cay"], nuoc: ["lau_say", "lau_say", "da_cuoi"], soi: ["da_cuoi", "da_nho", "tang_da_reu"], ria: ["truc", "nam_rung", "khuc_go_muc", "tang_da_reu"] };
const ke = (c: number, r: number, ks: string[]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => ks.includes(datO(l, c + dx, r + dy)));
const tai = (c: number, r: number) => l.dat[r]?.[c];
const daCo = () => vat.map((v) => [((v.x as number) + (v.w as number) / 2) / CO, ((v.y as number) + (v.h as number)) / CO]);
for (let i = 0; i < 900 && vat.length < 150; i++) {
  const c = Math.floor(rnd() * COT), r = Math.floor(rnd() * HANG);
  const d = tai(c, r);
  if (!d || d === "n" || d === "d" || !xa(c, r, bayC, 2.2) || !xa(c, r, bossC, 2.5) || !xa(c, r, daCo(), 1.6)) continue;
  const nhom = d === "b" && ke(c, r, ["n"]) ? NHO.nuoc : d === "s" ? NHO.soi : ["c", "h", "m"].includes(d) ? (c < 6 || c > COT - 7 || r < 5 || r > HANG - 6 ? NHO.ria : NHO.co) : null;
  if (!nhom || (nhom === NHO.co && rnd() < 0.35)) continue;
  const file = nhom[Math.floor(rnd() * nhom.length)];
  const k = file === "thong_non" || file === "cay_kho" ? 2.2 : 1.5;
  vat.push({ file: "vat_canh/" + file, x: c * CO + CO / 2 - 32 * k, y: r * CO + CO / 2 - 60 * k, w: 64 * k, h: 64 * k, ...(rnd() < 0.5 ? { lat: true } : {}) });
}
// Cây cổ thụ (95×105 vẽ 2×) rải trên cỏ, dày ở rìa; vẽ sau để tán đè lên vật nhỏ.
for (let i = 0; i < 400 && vat.length < 220; i++) {
  const c = Math.floor(rnd() * COT), r = Math.floor(rnd() * HANG);
  const kCo = ["c", "h", "m"].includes(tai(c, r)) && ["c", "h", "m"].includes(tai(c, Math.min(HANG - 1, r + 1)));
  if (!kCo || !xa(c, r, bayC, 3.5) || !xa(c, r, bossC, 3) || !xa(c, r, daCo(), 3)) continue;
  const ria = c < 6 || c > COT - 7 || r < 5 || r > HANG - 6;
  if (!ria && rnd() < 0.6) continue;
  vat.push({ file: "vat_canh/cay_co_thu", x: c * CO - 95, y: r * CO - 190, w: 190, h: 210, ...(rnd() < 0.5 ? { lat: true } : {}) });
}
const map = {
  w: COT * CO, h: HANG * CO, nen: [], vat,
  bay: bayC.map(([c, r]) => ({ x: c * CO, y: r * CO })),
  boss: [{ x: bossC[0][0] * CO, y: bossC[0][1] * CO, ten: "Thanh Mộc Lang Vương" }, { x: bossC[1][0] * CO, y: bossC[1][1] * CO, ten: "Độc Căn Mộc Yêu" }],
  cam: [], o: l,
};
writeFileSync(`${root}/assets/map_khu/${id}.json`, JSON.stringify(map, null, 1) + "\n");
const ids = readdirSync(`${root}/assets/map_khu`).filter((f) => f.endsWith(".json") && f !== "index.json").map((f) => f.slice(0, -5)).sort();
writeFileSync(`${root}/assets/map_khu/index.json`, JSON.stringify(ids, null, 1) + "\n");
console.log("ghi", id, `${vat.length} vật cảnh, ${bayC.length} bầy, ${map.boss.length} boss`, ids);
