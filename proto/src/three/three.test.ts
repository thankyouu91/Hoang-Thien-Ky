// Test phần không cần GPU của lớp Three.js: nhiễu dựng sẵn, bảng công thức cảnh, bảng công trình và điểm bản đồ.
// Chạy: npm.cmd test -w @ktlp/proto (node --test, Node tự bỏ kiểu TypeScript).
import assert from "node:assert/strict";
import { test } from "node:test";
import { ELEMENT_IDS } from "../replay/types.ts";
import { hashSeed, makeNoise, NOISE_SIZE, rng } from "./engine/noise.ts";
import { LOCATION_PIECES, POINT_PIECES } from "./scenes/places.ts";
import { toPaper } from "./scenes/paper.ts";
import { ELEMENT_RECIPES, sonThuy } from "./scenes/recipes.ts";

const noise = makeNoise(7);

test("nhiễu: cùng seed ra cùng ảnh, seed khác ra ảnh khác", () => {
  const again = makeNoise(7);
  assert.deepEqual(again.data, noise.data);
  const other = makeNoise(8);
  assert.notDeepEqual(other.data, noise.data);
});

test("nhiễu: mỗi kênh trải đủ 0..255", () => {
  for (let ch = 0; ch < 4; ch++) {
    let min = 255;
    let max = 0;
    for (let i = ch; i < noise.data.length; i += 4) {
      min = Math.min(min, noise.data[i]);
      max = Math.max(max, noise.data[i]);
    }
    assert.equal(min, 0, `kênh ${ch} min`);
    assert.equal(max, 255, `kênh ${ch} max`);
  }
});

test("nhiễu: lặp liền mép (mép trái khớp mép phải như RepeatWrapping)", () => {
  const n = NOISE_SIZE;
  for (let ch = 0; ch < 4; ch++) {
    let diff = 0;
    for (let y = 0; y < n; y++) diff += Math.abs(noise.data[(y * n + n - 1) * 4 + ch] - noise.data[(y * n) * 4 + ch]);
    // hai cột kề nhau qua mép chênh trung bình không hơn hai cột kề nhau bất kỳ (kênh mịn nhất chênh nhiều nhất)
    let inner = 0;
    for (let y = 0; y < n; y++) inner += Math.abs(noise.data[(y * n + 100) * 4 + ch] - noise.data[(y * n + 101) * 4 + ch]);
    assert.ok(diff <= inner * 2 + n, `kênh ${ch}: mép ${diff / n}, trong ${inner / n}`);
  }
});

test("nhiễu: sample đọc đúng tâm điểm ảnh và lặp theo chu kỳ 1", () => {
  for (const [i, j, ch] of [[0, 0, 0], [17, 200, 1], [255, 3, 2], [128, 128, 3]]) {
    const u = (i + 0.5) / NOISE_SIZE;
    const v = (j + 0.5) / NOISE_SIZE;
    const want = noise.data[(j * NOISE_SIZE + i) * 4 + ch] / 255;
    assert.ok(Math.abs(noise.sample(u, v, ch) - want) < 1e-9);
    assert.ok(Math.abs(noise.sample(u + 3, v - 2, ch) - want) < 1e-9);
  }
});

test("rng và hashSeed ổn định", () => {
  const a = rng(42);
  const b = rng(42);
  for (let i = 0; i < 100; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
  assert.equal(hashSeed("cong_trinh", "loi", 1), hashSeed("cong_trinh", "loi", 1));
  assert.notEqual(hashSeed("cong_trinh", "loi", 1), hashSeed("cong_trinh", "loi", 2));
});

const HEX = /^#[0-9a-f]{6}$/i;

function colors(o: unknown, path = ""): [string, string][] {
  if (typeof o === "string") return o.startsWith("#") ? [[path, o]] : [];
  if (!o || typeof o !== "object") return [];
  return Object.entries(o).flatMap(([k, v]) => colors(v, `${path}.${k}`));
}

test("đủ 12 cảnh theo hệ, màu hợp lệ, có trời và ít nhất một lớp núi hoặc sóng", () => {
  assert.deepEqual(Object.keys(ELEMENT_RECIPES).sort(), [...ELEMENT_IDS].sort());
  for (const el of ELEMENT_IDS) {
    const r = ELEMENT_RECIPES[el]();
    assert.ok(r.sky, el);
    assert.ok(r.far || r.mid || r.hooks?.afterFar, `${el} thiếu lớp cảnh`);
    for (const [p, c] of colors(r)) assert.match(c, HEX, `${el}${p}`);
  }
  for (const tone of ["chang_vang", "giay"] as const) for (const [p, c] of colors(sonThuy(tone))) assert.match(c, HEX, `son_thuy ${tone}${p}`);
});

test("đủ 11 công trình (GDD mục 5) và 10 loại điểm bản đồ", () => {
  assert.deepEqual(Object.keys(LOCATION_PIECES).sort(), [
    "bao_kho", "chinh_dien", "dien_vo_truong", "ho_son_dai_tran", "linh_duoc_vien", "luyen_dan_phong",
    "luyen_khi_cac", "phi_thang_dai", "tang_kinh_cac", "thuong_hoi", "truyen_tong_tran",
  ]);
  assert.deepEqual(Object.keys(POINT_PIECES).sort(), [
    "ben_do", "cua_bi_canh", "deo", "hang_di_thu", "linh_tuyen", "mo_duoc", "mo_linh_thach", "mo_quang", "son_mon", "thanh_chu",
  ]);
  for (const list of [...Object.values(LOCATION_PIECES), ...Object.values(POINT_PIECES)]) assert.ok(list.length > 0);
});

test("tông kem: 12 hệ đổi sang nền sáng, màu hợp lệ, không hạt cộng sáng, không sao", () => {
  for (const el of ELEMENT_IDS) {
    const r = toPaper(ELEMENT_RECIPES[el](), el);
    for (const [p, c] of colors(r)) assert.match(c, HEX, `${el}${p}`);
    assert.equal(r.sky.stars, 0, el);
    for (const p of r.particles ?? []) assert.equal(p.additive, false, el);
    // trời sáng: kênh nhỏ nhất của màu đỉnh trời vẫn trên 200/255
    const top = parseInt(r.sky.top.slice(1), 16);
    assert.ok(Math.min(top >> 16, (top >> 8) & 255, top & 255) > 200, `${el} trời ${r.sky.top}`);
  }
});

test("8 nền tài năng dựng được (host giả, không cần GPU), đủ lớp, có lớp làm thoáng giữa", async () => {
  const { Stage } = await import("./engine/stage.ts");
  const { talentScene } = await import("./scenes/talents.ts");
  const { TALENT_IDS } = await import("./types.ts");
  const host = { noise, noiseTex: null } as unknown as import("./engine/host.ts").Host;
  for (const t of TALENT_IDS) {
    const s = new Stage(host, t);
    talentScene(s, t);
    s.resize(440, 400, 1);
    assert.ok(s.scene.children.length >= 4, `${t}: ${s.scene.children.length} lớp`);
    const without = new Stage(host, t);
    talentScene(without, t, { wash: false });
    assert.equal(without.scene.children.length, s.scene.children.length - 1, `${t}: wash là một lớp`);
  }
});
