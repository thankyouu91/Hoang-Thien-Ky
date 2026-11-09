// Soát nhịp đạo đồ đột phá bằng hàm dò khung (chạy: node --test src/dashboard/daoDoNhip.test.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { khungCham, NHIP_MAN, NHIP_SAN, nhipLen, probe, type DaoDoNhip } from "./daoDoNhip.ts";

for (const [ten, n] of [["màn đột phá", NHIP_MAN], ["sân Pháp tướng", NHIP_SAN]] as [string, DaoDoNhip][]) {
  const fr = probe(n);
  const c = khungCham(n);
  const s = n.tu + n.giu;

  test(`${ten}: khung cuối đúng trạng thái tĩnh (lộ hết, phóng 1, hết nhòe, không chấm, không vòng)`, () => {
    const z = fr[nhipLen(n)];
    assert.equal(z.r, 1);
    assert.ok(Math.abs(z.scale - 1) < 1e-9);
    assert.ok(Math.abs(z.blur) < 1e-9);
    assert.equal(z.dot, 0);
    assert.equal(z.ringA, 0);
    assert.equal(z.oldR, 0);
  });

  test(`${ten}: chưa chạm thì bức mới chưa lộ; giữ khung lúc chạm`, () => {
    for (let f = 0; f <= s; f++) assert.equal(fr[f].r, 0, `khung ${f}`);
    for (let f = c + 1; f < s; f++) assert.deepEqual(fr[f], fr[c], `khung giữ ${f}`);
  });

  test(`${ten}: anticipation — chấm dẹt lại ngay trước chạm, đậm nhất lúc chạm (không mờ dần)`, () => {
    assert.ok(fr[c].dotSy < 1 && fr[c].dot > 0.5);
    assert.ok(fr[c - 3].dotSy === 1);
    // Lúc bung chấm vươn dọc rồi bị cắt hẳn, không có khung nào chấm nhỏ dần về 0.
    assert.ok(fr[s].dotSy > 1);
    const tat = fr.findIndex((x, i) => i > s && x.dot === 0);
    assert.ok(tat > s && fr[tat - 1].dot === 1);
  });

  test(`${ten}: mép lộ chỉ tiến, có easing (không đều từng khung)`, () => {
    const d: number[] = [];
    for (let f = s + 1; f <= s + n.no; f++) {
      assert.ok(fr[f].r >= fr[f - 1].r, `khung ${f}`);
      d.push(fr[f].r - fr[f - 1].r);
    }
    assert.ok(d[0] > d[d.length - 1] * 4, "đầu nhanh, cuối chậm");
  });

  test(`${ten}: overlap — phóng vượt 1 rồi về, nhòe còn sau khi đã lộ hết`, () => {
    const max = Math.max(...fr.map((x) => x.scale));
    assert.ok(max > 1.004 && max < 1.03, `vượt ${max}`);
    assert.ok(fr[s + n.no].blur > 0, "còn nhòe khi lộ hết");
  });

  test(`${ten}: vòng mực nhạt dần theo đường chạy, đậm nhất lúc bung`, () => {
    const a = fr.slice(s, s + n.no).map((x) => x.ringA);
    for (let i = 1; i < a.length; i++) assert.ok(a[i] <= a[i - 1]);
    assert.ok(a[0] > 0.7);
  });
}

test("sân: bức cũ thu vào tâm trước khi chạm", () => {
  const fr = probe(NHIP_SAN);
  assert.equal(fr[0].oldR, 1);
  assert.equal(fr[khungCham(NHIP_SAN)].oldR, 0);
  for (let f = 1; f <= khungCham(NHIP_SAN); f++) assert.ok(fr[f].oldR <= fr[f - 1].oldR);
});

test("quầng sau chữ: màn đột phá hiện đủ ở khung cuối, chưa có trước khi nở; sân không có", () => {
  const man = probe(NHIP_MAN);
  assert.equal(man[nhipLen(NHIP_MAN)].halo, 1);
  assert.equal(man[NHIP_MAN.tu + NHIP_MAN.giu].halo, 0);
  assert.ok(probe(NHIP_SAN).every((x) => x.halo === 0));
});

test("màn đột phá: chạm trùng chớp thiên kiếp đầu của capDo (đỉnh ≈ 238 ms)", () => {
  const ms = (khungCham(NHIP_MAN) / 30) * 1000;
  assert.ok(Math.abs(ms - 238) < 34, `${ms} ms`);
});
