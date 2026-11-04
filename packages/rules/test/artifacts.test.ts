import { test } from "node:test";
import assert from "node:assert/strict";
import { baseStats, composeTechnique, simulate, type UnitSpec } from "@ktlp/sim";
import { artifactSpecs, phapBaoInfo, phapBaoSlots, spendLinhLuc, withArtifacts, type PhapBaoItem } from "../src/index.ts";
import PHAP_BAO from "../../../data/he_thong/json/phap_bao.json" with { type: "json" };

const pb = (ma: string, extra: Partial<PhapBaoItem> = {}): PhapBaoItem => ({ ma, linhLuc: 20, teLuyen: true, tuRen: false, ...extra });

test("ô pháp bảo: 1 ô ở Hạ vị, 2 ô từ Trung vị", () => {
  assert.equal(phapBaoSlots(false), 1);
  assert.equal(phapBaoSlots(true), 2);
  assert.throws(() => artifactSpecs([pb("PB-TH-001"), pb("PB-CH-001")], false));
  assert.equal(artifactSpecs([pb("PB-TH-001"), pb("PB-CH-001")], true).length, 2);
});

test("mọi pháp bảo trong phap_bao.json đổi được sang sim", () => {
  for (const m of PHAP_BAO.mon) {
    const [spec] = artifactSpecs([pb(m.ma_vp, { linhLuc: m.phu.linh_luc_toi_da })], false);
    assert.equal(spec.kind, m.loai, m.ma_vp);
    assert.equal(spec.uses, m.phu.so_lan_moi_tran, m.ma_vp);
  }
});

test("chỉ số chính theo đơn vị của sim; vàng, đỏ thêm 1 lần; tự rèn +10%", () => {
  assert.deepEqual(artifactSpecs([pb("PB-TH-001")], false), [{ kind: "thuan", power: 500, uses: 2, cooldownTicks: 160, energy: 20, minCooldownTicks: 96 }]);
  assert.equal(artifactSpecs([pb("PB-TH-005")], false)[0].uses, 3);
  assert.equal(artifactSpecs([pb("PB-LU-004")], false)[0].power, 2000); // 2 ô = 2.000 milli-ô
  assert.equal(artifactSpecs([pb("PB-TH-001", { tuRen: true })], false)[0].power, 550);
  assert.equal(artifactSpecs([pb("PB-LU-001", { tuRen: true })], false)[0].power, 1100);
  assert.equal(phapBaoInfo("PB-TH-005").linhLucToiDa, 50);
});

test("linh lực giới hạn số lần kích hoạt; chưa tế luyện, linh lực sai, mã sai thì báo lỗi", () => {
  assert.equal(artifactSpecs([pb("PB-TH-001", { linhLuc: 1 })], false)[0].uses, 1);
  assert.equal(artifactSpecs([pb("PB-TH-001", { linhLuc: 0 })], false)[0].uses, 0);
  assert.throws(() => artifactSpecs([pb("PB-TH-001", { teLuyen: false })], false));
  assert.throws(() => artifactSpecs([pb("PB-TH-001", { linhLuc: 21 })], false));
  assert.throws(() => artifactSpecs([pb("PB-XX-001")], false));
});

test("vào trận rồi trừ linh lực theo số lần sim báo về", () => {
  const blade = composeTechnique({ element: "kim", type: "can_don", variant: "bao", grade: 1 }, [{ element: "kim", type: "can_don", variant: "ben", grade: 1 }]);
  const spec = (id: number, row: 0 | 1): UnitSpec => ({ id, level: 100, element: "kim", row, ...baseStats(100), techniques: [blade] });
  const items = [pb("PB-TH-001", { linhLuc: 5 })];
  const teamA = [1, 2, 3].map((id) => ({ ...spec(id, 0), bonuses: { critBonus: 500 } }));
  const teamB = [withArtifacts(spec(101, 0), items, false), spec(102, 0), spec(103, 1)];
  const r = simulate({ seed: 7, teamA, teamB });
  const uses = r.artifactUses!.find((x) => x.unitId === 101)!.uses;
  assert.ok(uses[0] > 0 && uses[0] <= 2, `dùng ${uses[0]} lần`);
  assert.deepEqual(spendLinhLuc(items, uses), [{ ...items[0], linhLuc: 5 - uses[0] }]);
  assert.throws(() => spendLinhLuc(items, [6]));
});
