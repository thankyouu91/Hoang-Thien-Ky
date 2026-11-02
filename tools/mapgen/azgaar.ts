// Đọc file Full JSON của Azgaar Fantasy Map Generator (Tools → Export → JSON → Full), chỉ giữ phần tools/mapgen dùng.
// Full JSON vài chục MB nên không vào git; bản rút gọn nén <vị diện>_azgaar.json.gz thì có (loadPlaneMap).
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";

export interface AzgaarCell {
  i: number;
  p: [number, number]; // toạ độ điểm ảnh bản đồ
  c: number[]; // ô kề
  v: number[]; // đỉnh đa giác của ô, chỉ số vào AzgaarMap.vertices
  h: number; // độ cao 0–100, đất từ 20
  area: number; // điểm ảnh vuông
  biome: number;
  r: number; // mã sông, 0 là không có
  fl: number; // lưu lượng nước
  burg: number; // mã thị trấn, 0 là không có
}
export interface AzgaarBurg {
  i: number;
  cell: number;
  x: number;
  y: number;
  name: string;
  population: number; // nghìn người
  capital: number;
}
export interface AzgaarRoute {
  i: number;
  group: string; // roads, trails, searoutes
  points: [number, number, number][]; // x, y, ô
}
export interface AzgaarRiver {
  i: number;
  name: string;
  cells: number[];
  discharge: number;
  width: number;
}
export interface AzgaarMarker {
  i: number;
  type: string;
  cell: number;
  name: string;
}
export interface AzgaarMap {
  seed: string;
  width: number;
  height: number;
  cells: AzgaarCell[];
  vertices: [number, number][];
  biomes: string[]; // tên theo mã
  biomeColors: string[];
  burgs: AzgaarBurg[]; // đã bỏ phần tử 0 và thị trấn đã xoá
  routes: AzgaarRoute[];
  rivers: AzgaarRiver[];
  markers: AzgaarMarker[];
}

export function loadAzgaar(file: string | URL): AzgaarMap {
  const json = JSON.parse(readFileSync(file, "utf8"));
  const { info, pack } = json;
  const pick = <T>(list: T[], keys: (keyof T)[]) => list.map((x) => Object.fromEntries(keys.map((k) => [k, x[k]])) as T);
  return {
    seed: info.seed,
    width: info.width,
    height: info.height,
    cells: pick<AzgaarCell>(pack.cells, ["i", "p", "c", "v", "h", "area", "biome", "r", "fl", "burg"]),
    vertices: pack.vertices.map((v: { p: [number, number] }) => v.p.map((x) => Math.round(x * 100) / 100)), // chỉ để vẽ
    biomes: pack.biomes.map((b: { name: string }) => b.name),
    biomeColors: pack.biomes.map((b: { color: string }) => b.color),
    burgs: pick<AzgaarBurg>(
      pack.burgs.filter((b: { i?: number; removed?: boolean }) => b.i && !b.removed),
      ["i", "cell", "x", "y", "name", "population", "capital"],
    ),
    routes: pick<AzgaarRoute>(pack.routes, ["i", "group", "points"]),
    rivers: pick<AzgaarRiver>(pack.rivers, ["i", "name", "cells", "discharge", "width"]),
    markers: pick<AzgaarMarker>(pack.markers, ["i", "type", "cell", "name"]),
  };
}

/** Bản đồ của một vị diện từ bản rút gọn nén; Full JSON mới hơn (vừa xuất lại từ Azgaar) thì ghi lại bản rút gọn trước */
export function loadPlaneMap(plane: string): AzgaarMap {
  const dataDir = new URL("../../data/maps/", import.meta.url);
  const full = new URL(`${plane}_azgaar_full.json`, dataDir);
  const compact = new URL(`${plane}_azgaar.json.gz`, dataDir);
  if (existsSync(full) && (!existsSync(compact) || statSync(full).mtimeMs > statSync(compact).mtimeMs))
    writeFileSync(compact, gzipSync(JSON.stringify(loadAzgaar(full)), { level: 9 }));
  return JSON.parse(gunzipSync(readFileSync(compact)).toString("utf8"));
}
