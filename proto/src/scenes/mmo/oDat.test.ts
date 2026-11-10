import assert from "node:assert/strict";
import { test } from "node:test";
import { camLop, chonO, datO, doO, lopMoi, toO, type BoODat } from "./oDat.ts";

const o = Array.from({ length: 16 }, (_, i) => [i % 4, i >> 2] as [number, number]);
const bo: BoODat = {
  co: 16,
  dat: [{ k: "c", ten: "Cỏ" }, { k: "d", ten: "Đất" }, { k: "n", ten: "Nước", cam: true }, { k: "b", ten: "Cát" }],
  bo: [{ f: "cd", lo: "c", up: "d", o }, { f: "nc", lo: "n", up: "c", o }, { f: "nb", lo: "n", up: "b", o }],
};

test("chonO: bốn góc theo thứ tự NW NE SW SE, bit bật là đất trên", () => {
  assert.deepEqual(chonO(bo, "cccc"), [0, 0]);
  assert.deepEqual(chonO(bo, "dddd"), [0, 15]);
  assert.deepEqual(chonO(bo, "dccc"), [0, 8]);
  assert.deepEqual(chonO(bo, "cccd"), [0, 1]);
  assert.deepEqual(chonO(bo, "nncc"), [1, 3]);
  assert.deepEqual(chonO(bo, "nbnb"), [2, 5]);
});

test("chonO: tổ hợp không có bộ nối thì góc lạc thành nền của bộ khớp nhất", () => {
  // d cạnh n: bộ c-d khớp 2 góc trước, hai góc n coi như cỏ.
  assert.deepEqual(chonO(bo, "ddnn"), [0, 12]);
  // ba loại: bộ n-c khớp 3 góc, góc d coi như cỏ.
  assert.deepEqual(chonO(bo, "ncnd"), [1, 5]);
});

test("tô, đổ và vùng cấm", () => {
  const l = lopMoi(bo, 200, 100, 48);
  assert.deepEqual([l.cot, l.hang, l.dat[0]], [5, 3, "ccccc"]);
  assert.equal(toO(l, 2, 1, "n", 3), true);
  assert.deepEqual(l.dat, ["cnnnc", "cnnnc", "cnnnc"]);
  assert.equal(toO(l, 2, 1, "n"), false);
  assert.equal(datO(l, -5, 9), "c");
  assert.deepEqual(camLop(l, bo)[0], { x: 48, y: 0, w: 144, h: 48 });
  assert.equal(camLop(l, bo).length, 3);
  assert.equal(doO(l, 0, 0, "d"), true);
  assert.deepEqual(l.dat, ["dnnnc", "dnnnc", "dnnnc"]);
});
