// Test lớp hiệu ứng (không cần trình duyệt): mỗi khung là hàm của (replay, t, tốc độ), tua tới lui ra y hệt; đủ 10 loại
// chiêu, 12 hệ, chiêu cuối đều vẽ ra tấm; 10 đấu 10 không tràn bộ đệm.
// Chạy: node --test src/hieu_ung/hieu_ung.test.ts (trong proto/)
import { test } from "node:test";
import assert from "node:assert/strict";
import { ELEMENT_IDS, SKILL_IDS, type ElementId, type Replay, type SkillId } from "../replay/types.ts";
import { ReplayIndex } from "../replay/timeline.ts";
import { emitFrame } from "./canh.ts";
import { castTimeline } from "./chieu.ts";
import { Emitter, STRIDE } from "./emit.ts";
import { recipe, recipeOf } from "./recipe.ts";
import type { FxInput } from "./types.ts";
import { sampleReplay } from "./xem_thu/mau.ts";

const CELL = 64;

function input(index: ReplayIndex, t: number, speed = 1): FxInput {
  const tps = index.replay.tps;
  const len = (index.replay.fieldLength / 1000) * CELL;
  return {
    index, t, speed,
    life: (s) => Math.min(2 * tps, s * tps * speed),
    at: (id, time = t) => {
      const ut = index.byId.get(id);
      if (!ut) return null;
      return { x: (ut.unit.id % 5) * 60 - 120, y: len - (ut.pos.moving(time) / 1000) * CELL };
    },
    zone: (center, radius) => ({ x: 0, y: len - (center / 1000) * CELL, rx: 210, ry: (radius / 1000) * CELL }),
    size: 40,
  };
}

/** Ảnh chụp bộ đệm: số tấm từng lớp và toàn bộ số liệu đã ghi. */
function snap(e: Emitter): string {
  const parts: string[] = [];
  for (let l = 0; l < e.count.length; l++) parts.push(e.count[l] + ":" + Array.from(e.data[l].subarray(0, e.count[l] * STRIDE), (v) => v.toFixed(4)).join(","));
  return parts.join("|");
}

test("mỗi khung là hàm của t: tua tới, tua lui, nhảy cóc đều ra y hệt", () => {
  const index = new ReplayIndex(sampleReplay({ skill: "tran_phap", element: "loi", subs: ["cuc_han"], variant: "linh", grade: 7 }, { ult: true }));
  const e = new Emitter();
  const times = [0, 12.5, 40, 61.3, 99.9, 140, 150.25, 170, 200];
  const forward = times.map((t) => (emitFrame(e, input(index, t)), snap(e)));
  const backward = [...times].reverse().map((t) => (emitFrame(e, input(index, t)), snap(e))).reverse();
  assert.deepEqual(backward, forward);
  // Một bộ đệm khác, gọi lẻ từng khung: vẫn y hệt.
  const e2 = new Emitter();
  for (let i = 0; i < times.length; i++) {
    emitFrame(e2, input(index, times[i]));
    assert.equal(snap(e2), forward[i], `t = ${times[i]}`);
  }
});

test("×1, ×2, ×4 đều dựng được bốn pha và đều tất định", () => {
  for (const speed of [1, 2, 4]) {
    const index = new ReplayIndex(sampleReplay({ skill: "tam_xa", element: "hoa", subs: ["phong"], grade: 5 }));
    const c = index.casts[0];
    const tl = castTimeline({ index, life: (s) => Math.min(40, s * 20 * speed) }, c, recipeOf(c));
    assert.ok(tl.windup < tl.travel && tl.travel < tl.hit && tl.hit < tl.settle, `mốc pha ở ×${speed}`);
    const e = new Emitter();
    for (const t of [(tl.windup + tl.travel) / 2, (tl.travel + tl.hit) / 2, tl.hit + 0.5]) {
      emitFrame(e, input(index, t, speed));
      assert.ok(e.total > 0, `×${speed} t = ${t} có hình`);
      const a = snap(e);
      emitFrame(e, input(index, t, speed));
      assert.equal(snap(e), a);
    }
  }
});

test("đủ 10 loại chiêu × 12 hệ và chiêu cuối: pha khởi chiêu, đường bay, chạm trúng đều có tấm", () => {
  const e = new Emitter();
  for (const skill of SKILL_IDS) {
    for (const element of ELEMENT_IDS) {
      for (const ult of [false, true]) {
        const index = new ReplayIndex(sampleReplay({ skill, element, subs: [sub(element)], grade: 4 }, { ult }));
        const c = index.casts[0];
        const tl = castTimeline({ index, life: (s) => Math.min(40, s * 20) }, c, recipeOf(c));
        for (const [name, t] of [["khởi chiêu", tl.windup + 0.7 * (tl.travel - tl.windup)], ["đường bay", tl.travel + 0.5 * (tl.hit - tl.travel)], ["chạm trúng", tl.hit + 0.5]] as const) {
          emitFrame(e, input(index, t));
          assert.ok(e.total > 0, `${skill} ${element}${ult ? " chiêu cuối" : ""}: ${name} trống`);
          assert.equal(e.dropped, 0);
        }
      }
    }
  }
});

test("trạng thái kéo dài (pha 4) có hình: đóng băng, tê liệt, trói, chậm, thiêu, giảm hồi máu, khiên, lộ vị trí, xích", () => {
  const cases: [SkillId, ElementId][] = [
    ["tam_xa", "cuc_han"], ["can_don", "loi"], ["tam_xa", "moc"], ["tam_xa", "thuy"], ["can_don", "hoa"],
    ["can_don", "cuc_am"], ["ho_the", "kim"], ["can_don", "tho"], ["than_phap", "phong"], ["khong_che", "kim"],
  ];
  const e = new Emitter();
  for (const [skill, element] of cases) {
    const index = new ReplayIndex(sampleReplay({ skill, element, grade: 3 }));
    const c = index.casts[0];
    const tl = castTimeline({ index, life: (s) => Math.min(40, s * 20) }, c, recipeOf(c));
    // Sau pha chạm trúng, chỉ còn trạng thái.
    const t = Math.min(tl.settle + 1, c.tick + 9);
    emitFrame(e, input(index, Math.max(t, tl.settle + 0.5)));
    assert.ok(e.total > 0, `${skill} ${element}: không có hình trạng thái`);
  }
});

test("10 đấu 10 ở ×4 không tràn bộ đệm", () => {
  // Hai mươi người ra chiêu dồn trong 2 giây, đủ loại chiêu, ở tốc độ ×4 (hiệu ứng kéo dài nhiều tick nhất).
  const base = sampleReplay({ skill: "can_don", element: "kim" });
  const units = [...Array(20)].map((_, i) => ({ ...base.units[0], id: i < 10 ? i + 1 : 100 + i, team: (i < 10 ? 0 : 1) as 0 | 1, row: (i % 2) as 0 | 1, pos: i < 10 ? 4000 + (i % 5) * 300 : 7000 + (i % 5) * 300 }));
  const events: Replay["events"] = [];
  for (let k = 0; k < 120; k++) {
    const skill = SKILL_IDS[k % SKILL_IDS.length];
    const el = ELEMENT_IDS[k % ELEMENT_IDS.length];
    const src = units[k % 20];
    const foes = units.filter((u) => u.team !== src.team).slice(0, 4).map((u) => u.id);
    const tick = 60 + Math.floor(k / 3);
    const zone = skill === "dien_rong" || skill === "tran_phap";
    events.push({ tick, kind: "cast", unit: src.id, skill, element: el, targets: foes, subElements: [sub(el)], ...(zone ? { start: tick - 20, center: 6000, radius: 1500 } : {}), ...(k === 7 ? { ult: true } : {}) });
  }
  const index = new ReplayIndex({ ...base, units, events, ticks: 400 });
  const e = new Emitter();
  let most = 0;
  for (let t = 40; t < 160; t += 1.7) {
    emitFrame(e, input(index, t, 4));
    most = Math.max(most, ...e.count);
    assert.equal(e.dropped, 0, `t = ${t}`);
  }
  assert.ok(most > 100, `có vẽ (${most} tấm lớp nhiều nhất)`);
  console.log(`10 đấu 10 ×4: nhiều nhất ${most} tấm một lớp`);
});

test("công thức: biến thể, phẩm đổi đúng hướng; cùng công pháp cùng công thức", () => {
  const a = recipe({ skill: "tam_xa", element: "loi", subs: ["quang"], variant: "bao", grade: 3 });
  assert.equal(a, recipe({ skill: "tam_xa", element: "loi", subs: ["quang"], variant: "bao", grade: 3 }));
  assert.ok(a.impact > recipe({ skill: "tam_xa", element: "loi", variant: "ben" }).impact);
  assert.ok(recipe({ skill: "tam_xa", element: "loi", variant: "toc" }).pace < 1);
  assert.ok(recipe({ skill: "tam_xa", element: "loi", variant: "toc" }).streaks > 1);
  assert.ok(recipe({ skill: "tam_xa", element: "loi", variant: "linh" }).sig > 1);
  assert.ok(recipe({ skill: "tam_xa", element: "loi", variant: "ben" }).pace > 1);
  assert.ok(recipe({ skill: "tam_xa", element: "loi", grade: 9 }).density > recipe({ skill: "tam_xa", element: "loi", grade: 1 }).density);
  assert.ok(recipe({ skill: "tam_xa", element: "loi", grade: 9 }).bright > recipe({ skill: "tam_xa", element: "loi", grade: 1 }).bright);
  assert.equal(a.trailEl, "quang");
  assert.equal(recipe({ skill: "can_don", element: "kim" }).special, false);
  assert.equal(recipe({ skill: "tran_phap", element: "kim" }).special, true);
});

function sub(el: ElementId): ElementId {
  return ELEMENT_IDS[(ELEMENT_IDS.indexOf(el) + 5) % ELEMENT_IDS.length];
}

test("replay từ sim thật: có sự kiện trạng thái, phẩm công pháp; vẫn khớp simulate()", async () => {
  const { simulate } = await import("@ktlp/sim");
  const { replayFromSim } = await import("../replay/simSource.ts");
  const { sampleBattle } = await import("../mock/sampleBattle.ts");
  for (const seed of [11, 2, 3]) {
    const battleInput = sampleBattle(seed);
    const replay = replayFromSim(battleInput);
    const result = simulate(sampleBattle(seed));
    assert.equal(replay.ticks, result.ticks, `seed ${seed}: số tick`);
    assert.equal(replay.winner, result.winner, `seed ${seed}: bên thắng`);
    const index = new ReplayIndex(replay);
    assert.ok(index.statuses.length > 0, `seed ${seed}: có trạng thái`);
    assert.ok(index.casts.every((c) => typeof c.grade === "number"), `seed ${seed}: cast có phẩm`);
    for (const s of index.statuses) assert.ok(s.until >= s.tick, "until không trước tick");
    // Pha 4 vẽ được trên trận thật.
    const e = new Emitter();
    let drawn = 0;
    for (const s of index.statuses.slice(0, 40)) {
      emitFrame(e, input(index, s.tick + 1));
      drawn += e.total > 0 ? 1 : 0;
    }
    assert.ok(drawn > 0);
  }
});

test("trạng thái bị giải sớm (until = tick, ví dụ Chuông giải choáng, trói) thì pha 4 tắt đúng lúc", async () => {
  const { activeAt, statusTrack } = await import("./trang_thai.ts");
  const replay = sampleReplay({ skill: "khong_che", element: "moc", grade: 3 });
  const stun = replay.events.find((e) => e.kind === "status" && e.status === "stun");
  const root = replay.events.find((e) => e.kind === "status" && e.status === "root");
  assert.ok(stun && stun.kind === "status" && root && root.kind === "status");
  const cut = stun.tick + 6;
  assert.ok(stun.until > cut && root.until > cut, "trận mẫu có choáng, trói dài hơn mốc giải");
  // Như simSource ghi khi sim đặt stunUntil, rootUntil về tick hiện tại.
  replay.events.push(
    { tick: cut, kind: "status", unit: stun.unit, status: "stun", until: cut },
    { tick: cut, kind: "status", unit: root.unit, status: "root", until: cut },
  );
  replay.events.sort((a, b) => a.tick - b.tick);
  const index = new ReplayIndex(replay);
  const track = statusTrack(index);
  const spans = track.list.filter((s) => s.unit === stun.unit && (s.status === "stun" || s.status === "root"));
  assert.equal(spans.length, 2);
  for (const s of spans) assert.equal(s.until, cut, `${s.status} hết đúng tick giải`);
  assert.equal(activeAt(track, cut - 1, 0).filter((s) => s.unit === stun.unit).length, 2, "trước lúc giải còn hiệu lực");
  assert.equal(activeAt(track, cut + 1, 0).filter((s) => s.unit === stun.unit).length, 0, "sau lúc giải hết hiệu lực");
});

test("mọi dáng chiêu: mỗi loại chiêu dùng được đều vẽ đủ khởi chiêu, đường bay, chạm trúng và tất định", async () => {
  const { DANG, DANG_FOR } = await import("./dang_chon.ts");
  const e = new Emitter();
  for (const dang of DANG) {
    for (const skill of DANG_FOR[dang]) {
      const element: ElementId = dang === "dau_lau" ? "am_lanh" : dang === "thien_loi" ? "loi" : "kim";
      const index = new ReplayIndex(sampleReplay({ skill, element, subs: ["hoa"], grade: 6, dang }));
      const c = index.casts[0];
      const r = recipeOf(c);
      assert.equal(r.dang, dang, `${dang} ${skill}: công thức giữ dáng ép`);
      const tl = castTimeline({ index, life: (s) => Math.min(40, s * 20) }, c, r);
      assert.ok(tl.windup < tl.hit && tl.travel <= tl.hit && tl.hit < tl.settle, `${dang} ${skill}: mốc pha`);
      for (const [name, t] of [["khởi chiêu", tl.windup + 0.7 * (tl.travel - tl.windup)], ["đường bay", tl.travel + 0.5 * (tl.hit - tl.travel)], ["chạm trúng", tl.hit + 0.5]] as const) {
        emitFrame(e, input(index, t));
        assert.ok(e.total > 0, `${dang} ${skill}: ${name} trống`);
        const a = snap(e);
        emitFrame(e, input(index, t));
        assert.equal(snap(e), a, `${dang} ${skill}: ${name} tất định`);
      }
    }
  }
});

test("chọn dáng tự động theo tài năng, vũ khí, hệ (đề xuất)", async () => {
  const { autoDang } = await import("./dang_chon.ts");
  assert.equal(autoDang("can_don", "hoa", { talent: "sat_thu" }), "huyet_tuyen");
  assert.equal(autoDang("tam_xa", "am_lanh"), "dau_lau");
  assert.equal(autoDang("dien_rong", "kim"), "mua_kiem");
  assert.equal(autoDang("bua_chu", "moc", { weapon: "kiem" }), "cu_kiem");
  assert.equal(autoDang("can_quet", "hoa", { weapon: "kiem" }), "kiem_tran");
  assert.equal(autoDang("can_quet", "hoa", { weapon: "dao" }), "dao_khi");
  assert.equal(autoDang("dien_rong", "loi"), "thien_loi");
  assert.equal(autoDang("dien_rong", "cuc_han"), "bao_tuyet");
  assert.equal(autoDang("dien_rong", "tho"), "gai_troi");
  assert.equal(autoDang("khong_che", "cuc_han"), "gai_troi");
  assert.equal(autoDang("tam_xa", "hoa"), "hoa_long");
  assert.equal(autoDang("dien_rong", "hoa"), "luu_tinh");
  assert.equal(autoDang("dien_rong", "thuy"), "thuy_long");
  assert.equal(autoDang("can_quet", "thuy", { weapon: "dao" }), "song_than");
  assert.equal(autoDang("khong_che", "moc"), "re_cay");
  assert.equal(autoDang("hoi_phuc", "moc"), "hoa_no");
  assert.equal(autoDang("bua_chu", "quang"), "phat_thu");
  assert.equal(autoDang("ho_the", "quang"), "thanh_quang");
  assert.equal(autoDang("dien_rong", "cuc_duong"), "liet_nhat");
  assert.equal(autoDang("dien_rong", "cuc_am"), "nguyet_thuc");
  assert.equal(autoDang("khong_che", "am_lanh"), "quy_thu");
  assert.equal(autoDang("can_don", "kim"), "kim_cuong_xu");
  assert.equal(autoDang("dien_rong", "phong"), "loc_xoay");
  assert.equal(autoDang("tam_xa", "hoa", { talent: "tu_kim_tien" }), "tien_dong");
  assert.equal(autoDang("hoi_phuc", "kim"), null);
  // Dáng ép không hợp loại chiêu thì bỏ, vẽ hình gốc.
  assert.equal(recipe({ skill: "hoi_phuc", element: "quang", dang: "mua_kiem" }).dang, null);
  assert.equal(recipe({ skill: "dien_rong", element: "kim", dang: null }).dang, null);
});
