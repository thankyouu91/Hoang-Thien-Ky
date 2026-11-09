// Test động tác thân người trong trận (không cần trình duyệt): ra chiêu theo loại chiêu chạm đúng tick, người đánh khựng
// cùng nhịp với người trúng đòn, vận công thì giữ tay, đạn rời tay đúng lúc, chạy theo quãng đường; mỗi khung là hàm của
// t nên ở ×1 và ×4 đều đúng. Dải giả (số khung, khung chạm) đặt ngay trong test, không phụ thuộc hình PixelLab.
// Chạy: node --test src/scenes/battle/chuyenDong.test.ts (trong proto/)
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Sprites } from "../../assets/sprites.ts";
import { ReplayIndex } from "../../replay/timeline.ts";
import type { Look, Replay } from "../../replay/types.ts";
import { ThanNguoi } from "./chuyenDong.ts";

const STRIPS: Record<string, { frames: number; fps: number; cham?: number; giu?: number }> = {
  dung: { frames: 4, fps: 6 },
  ra_chieu: { frames: 6, fps: 10 },
  chay: { frames: 8, fps: 16 },
  ra_chieu_chem: { frames: 10, fps: 16, cham: 4 },
  ra_chieu_dam: { frames: 10, fps: 16, cham: 5 },
  ra_chieu_dap: { frames: 8, fps: 14, cham: 5, giu: 3 },
  ra_chieu_phong: { frames: 10, fps: 16, cham: 5 },
};
const sprites = {
  asset(key: string) {
    const m = /^nhan_vat\/nam_khoe\/dao_bao\/(\w+)$/.exec(key);
    const s = m && STRIPS[m[1]];
    return s ? { img: null, meta: { file: `${key}.png`, ...s } } : undefined;
  },
} as unknown as Sprites;
const look: Look = { body: "nam_khoe", outfit: "dao_bao" };

const moves = Array.from({ length: 21 }, (_, k) => ({ tick: 300 + k, kind: "move" as const, unit: 1, pos: 5000 + k * 100 }));
const replay = {
  tps: 20, ticks: 400, fieldLength: 12000, winner: "A",
  units: [
    { id: 1, team: 0, row: 0, name: "A1", element: "kim", hpMax: 1000, manaMax: 100, pos: 5000 },
    { id: 2, team: 1, row: 0, name: "B2", element: "hoa", hpMax: 1000, manaMax: 100, pos: 7000 },
  ],
  events: [
    { tick: 40, kind: "cast", unit: 1, skill: "can_don", element: "kim", targets: [2] },
    { tick: 40, kind: "hit", unit: 2, src: 1, amount: 100, crit: false, hp: 900 },
    // Cận đơn nối ngay sau, đòn nhẹ: chạm trong lúc khựng nên gộp vào lần trước.
    { tick: 41, kind: "cast", unit: 1, skill: "can_don", element: "kim", targets: [2] },
    { tick: 41, kind: "hit", unit: 2, src: 1, amount: 10, crit: false, hp: 890 },
    { tick: 100, kind: "cast", unit: 1, skill: "tam_xa", element: "kim", targets: [2] },
    { tick: 100, kind: "hit", unit: 2, src: 1, amount: 50, crit: false, hp: 840 },
    { tick: 160, kind: "cast", unit: 1, skill: "dien_rong", element: "kim", targets: [2], start: 140, center: 7000, radius: 2000 },
    { tick: 160, kind: "hit", unit: 2, src: 1, amount: 100, crit: false, hp: 740 },
    { tick: 220, kind: "cast", unit: 1, skill: "ho_the", element: "kim", targets: [1] },
    ...moves,
  ],
} as unknown as Replay;

const index = new ReplayIndex(replay);
const than = new ThanNguoi(index, sprites, () => look);
const ut1 = index.byId.get(1)!;
const ut2 = index.byId.get(2)!;
const posAt = () => ({ x: 0, y: 0 });
const place = (p: number) => ({ x: 0, y: -p / 100 });

for (const speed of [1, 4]) {
  const life = (s: number) => Math.min(40, s * 20 * speed);
  const frame = life(1 / 30);
  const act = (t: number) => than.act(ut1, t, life);

  test(`×${speed}: chém chạm đúng tick trúng đòn, người đánh khựng cùng người trúng, lần nối sau gộp vào`, () => {
    const d = 20 / 16;
    assert.equal(act(40 - 4 * d - 0.01), null, "chưa tới lúc vung");
    assert.equal(act(40 - 4 * d)?.anim, "ra_chieu_chem");
    assert.ok(act(40 - 1e-6)!.frame < 4, "trước tick 40 còn đang vung");
    assert.equal(act(40)?.frame, 4);
    let hold = 0;
    let victim = 0;
    let last = -1;
    for (let f = 0; f < 60; f++) {
      const t = 40 + f * frame;
      const p = act(t);
      if (than.motion(ut2, t, life, posAt, place).tPose === 40) victim++;
      if (p?.anim === "ra_chieu_chem" && p.frame === 4) hold++;
      if (p?.anim === "ra_chieu_chem") {
        assert.ok(p.frame >= last, `khung không lùi (${last} → ${p.frame})`);
        assert.equal(p.trail !== undefined, true, "chém có vệt vũ khí");
        last = p.frame;
      }
    }
    assert.equal(victim, 7, "người trúng khựng IMPACT_FRAMES + 5");
    // Khung chạm hiện suốt lúc khựng, cộng thêm phần còn lại của chính khung đó.
    assert.ok(hold >= victim && hold <= victim + Math.ceil(d / frame) + 1, `khung chạm ${hold} khung thực`);
    assert.ok(last >= (speed > 1 ? 8 : 9), "diễn tới cuối");
    assert.equal(act(41.5)?.frame, 4, "lần 41 không vung lại");
  });

  test(`×${speed}: phóng buông tay lúc đạn rời tay (tick trúng trừ thời gian bay)`, () => {
    // Cách 2 ô: đạn tầm xa bay round(2 × 1,5) = 3 tick.
    assert.equal(act(97)?.anim, "ra_chieu_phong");
    assert.equal(act(97)?.frame, 5);
    assert.ok(act(97 - 1e-3)!.frame < 5);
    assert.equal(act(97)?.trail, undefined, "phóng không có vệt vũ khí");
  });

  test(`×${speed}: đập giơ tay từ lúc vận công, giữ, đập đúng tick nổ`, () => {
    const d = 20 / 14;
    assert.equal(act(139.99), null);
    assert.equal(act(140)?.anim, "ra_chieu_dap");
    assert.equal(act(140 + 3 * d + 0.5)?.frame, 3);
    assert.equal(act(160 - 2 * d - 0.1)?.frame, 3, "còn giữ tay");
    assert.equal(act(160)?.frame, 5);
  });

  test(`×${speed}: hộ thể dùng dải ra chiêu chung`, () => {
    assert.equal(act(220.5)?.anim, "ra_chieu");
  });

  test(`×${speed}: chạy theo quãng đường, đứng yên thì thôi, bớt nhún`, () => {
    const seen = new Set<number>();
    for (let t = 301; t < 310; t += 0.25) {
      const g = than.gait(ut1, t);
      assert.equal(g?.anim, "chay", `tick ${t}`);
      seen.add(g!.frame);
    }
    assert.equal(seen.size, 8);
    assert.equal(than.gait(ut1, 330), null);
    const m = than.motion(ut1, 305.3, life, posAt, place);
    assert.ok(Math.abs(m.dy) <= 2.4 * 0.25 + 1e-9 && m.sx === 1);
  });
}

test("không có hình thì act và gait trả null (nơi gọi dùng cách cũ)", () => {
  const bare = new ThanNguoi(index);
  assert.equal(bare.act(ut1, 40, (s) => s * 20), null);
  assert.equal(bare.gait(ut1, 305), null);
});
