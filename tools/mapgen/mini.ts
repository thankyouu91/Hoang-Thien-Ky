// Ảnh nền bản đồ mini của từng vùng (người dùng 2026-11-03: bản đồ mini đơn điệu, muốn nhỏ lại mà vẫn thấy cảnh bản đồ).
// Lấy ảnh nền từng vùng đã cất (data/maps/<vị diện>_nen_vung/, ×6 theo map.frame của file điểm), thu về ×SCALE, màu đậm hơn
// một chút cho rõ ở cỡ nhỏ; phần ngoài vùng phủ giấy mờ, viền vùng nét mực. Điểm, sương mù, khung đang xem do proto vẽ chồng.
// Điểm (x, y) nằm ở ((x − x0) × SCALE, (y − y0) × SCALE) trên ảnh, với [x0, y0, x1, y1] là map.frame của file điểm.
//
// Hai bước vì Node không ghi được WebP:
//   1. node --experimental-strip-types tools/mapgen/mini.ts [vị diện]
//      → data/maps/<vị diện>_mini_viec.json: khung, cỡ ảnh, đường phần ngoài vùng và viền vùng (không commit)
//   2. chạy tools/mapgen/nhan-file.ts, mở proto (npm run dev:proto), trong console:
//      await (await import("/@fs/<thư mục repo>/tools/mapgen/mini-trang.ts")).run("ha", "<địa chỉ nhan-file.ts in ra>")
//      → data/maps/<vị diện>_mini/<mã vùng>.webp
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadPlaneMap } from "./azgaar.ts";
import { assignCells, centreCells, loadRegions } from "./vung.ts";
import { ZONE } from "./cam_khu.ts";

/** px ảnh mini trên một đơn vị bản đồ: khung mini cao tới ~180 px CSS, màn mật độ 2–3 */
export const SCALE = 1.5;

if (import.meta.main) {
  const plane = process.argv[2] ?? "ha";
  const dataDir = new URL("../../data/maps/", import.meta.url);
  const world = JSON.parse(readFileSync(new URL(`${plane}_vi_dien.json`, dataDir), "utf8")) as { regions: { code: string; file: string }[] };
  const map = loadPlaneMap(plane);
  const region = assignCells(map, loadRegions(plane));
  const zone = new Set(centreCells(map, region));
  const r1 = (x: number) => Math.round(x * 10) / 10;
  // 12 vùng theo mục lục, thêm Cấm Khu ở lòng giữa (cam_khu.ts) nếu đã có file điểm
  const areas = world.regions.map(({ code, file }, k) => ({ code, file, inside: (c: number) => region[c] === k }));
  if (existsSync(new URL(`${plane}_diem_${ZONE.code}.json`, dataDir))) areas.push({ code: ZONE.code, file: `${plane}_diem_${ZONE.code}.json`, inside: (c: number) => zone.has(c) });
  const regions = areas.map(({ code, file, inside }) => {
    const [x0, y0, x1, y1] = (JSON.parse(readFileSync(new URL(file, dataDir), "utf8")) as { map: { frame: [number, number, number, number] } }).map.frame;
    const px = (v: number) => `${r1((map.vertices[v][0] - x0) * SCALE)},${r1((map.vertices[v][1] - y0) * SCALE)}`;
    const near = (c: (typeof map.cells)[number]) => c.v.some((v) => map.vertices[v][0] > x0 - 8 && map.vertices[v][0] < x1 + 8 && map.vertices[v][1] > y0 - 8 && map.vertices[v][1] < y1 + 8);
    // phần ngoài vùng: một đường gồm mọi ô khác vùng trong khung, tô một lần nên chỗ hai ô giáp nhau không đậm thành lưới
    const outside = map.cells.filter((c) => !inside(c.i) && near(c)).map((c) => `M${c.v.map(px).join("L")}Z`).join("");
    // viền vùng: cạnh chung giữa ô trong vùng và ô ngoài vùng
    const border: string[] = [];
    for (const c of map.cells) {
      if (!inside(c.i)) continue;
      for (const n of c.c) {
        if (inside(n)) continue;
        const shared = c.v.filter((v) => map.cells[n].v.includes(v));
        if (shared.length === 2) border.push(`M${px(shared[0])}L${px(shared[1])}`);
      }
    }
    return {
      code,
      frame: [x0, y0, x1, y1],
      image: `${plane}_nen_vung/${plane}_nen_${code}.webp`,
      width: Math.round((x1 - x0) * SCALE),
      height: Math.round((y1 - y0) * SCALE),
      outside,
      border: border.join(""),
    };
  });
  const file = new URL(`${plane}_mini_viec.json`, dataDir);
  writeFileSync(file, JSON.stringify({ plane, scale: SCALE, regions }));
  console.log(`ghi ${file.pathname}: ${regions.length} vùng, ×${SCALE}, ${regions.map((r) => `${r.width}×${r.height}`).join(" ")}`);
}
