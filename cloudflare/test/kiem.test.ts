import assert from "node:assert/strict";
import { test } from "node:test";
import { LoiApi } from "../src/http.ts";
import { GIOI_HAN, kiemLoSuKien, kiemPhanHoi, rutGonUA } from "../src/kiem.ts";

const NOW = 1_762_300_000_000;
const lo = (su_kien: unknown[], extra: Record<string, unknown> = {}) => ({ an_danh: "may-abcdef12", phien: "phien-1234567", su_kien, ...extra });
const ma = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof LoiApi);
    return (e as LoiApi).ma;
  }
  return "khong_loi";
};

test("lô sự kiện hợp lệ", () => {
  const r = kiemLoSuKien(lo([{ loai: "mo_phien", luc: NOW - 1000 }, { loai: "ftue_buoc", luc: NOW, du_lieu: { buoc: 1 } }], { phien_ban: "1e20bcd" }), NOW);
  assert.equal(r.su_kien.length, 2);
  assert.equal(r.bo, 0);
  assert.equal(r.phien_ban, "1e20bcd");
  assert.deepEqual(r.su_kien[1], { loai: "ftue_buoc", luc: NOW, du_lieu: '{"buoc":1}' });
  assert.equal(r.su_kien[0].du_lieu, "{}");
});

test("sự kiện sai thì bỏ riêng, không hỏng cả lô", () => {
  const r = kiemLoSuKien(
    lo([
      { loai: "Mo Phien" },
      { loai: "x" },
      { loai: "cham_the", luc: NOW - 8 * 86400000 },
      { loai: "cham_the", luc: NOW + 2 * 86400000 },
      { loai: "cham_the", du_lieu: [1, 2] },
      { loai: "cham_the", du_lieu: { s: "a".repeat(GIOI_HAN.duLieuSuKien) } },
      { loai: "cham_the" },
    ]),
    NOW,
  );
  assert.equal(r.su_kien.length, 1);
  assert.equal(r.bo, 6);
  assert.equal(r.su_kien[0].luc, NOW);
});

test("khung lô sai thì 400/413", () => {
  assert.equal(ma(() => kiemLoSuKien(null, NOW)), "sai_kieu");
  assert.equal(ma(() => kiemLoSuKien(lo([{ loai: "mo_phien" }], { an_danh: "ngan" }), NOW)), "ma_sai");
  assert.equal(ma(() => kiemLoSuKien(lo([]), NOW)), "thieu_truong");
  assert.equal(ma(() => kiemLoSuKien(lo(new Array(51).fill({ loai: "mo_phien" })), NOW)), "qua_nhieu");
});

test("phản hồi", () => {
  assert.deepEqual(kiemPhanHoi({ noi_dung: "  Nút Nhận mã bị che  ", man: "dang-nhap", lien_he: " zalo 09x " }), { loai: "gop_y", noi_dung: "Nút Nhận mã bị che", man: "dang-nhap", lien_he: "zalo 09x", phien_ban: null });
  assert.equal(ma(() => kiemPhanHoi({ loai: "spam", noi_dung: "abc" })), "loai_sai");
  assert.equal(ma(() => kiemPhanHoi({ noi_dung: "a" })), "qua_ngan");
  assert.equal(ma(() => kiemPhanHoi({ noi_dung: "a".repeat(2001) })), "qua_dai");
  assert.equal(ma(() => kiemPhanHoi({})), "thieu_truong");
});

test("rút gọn User-Agent", () => {
  assert.equal(rutGonUA(null), null);
  assert.equal(rutGonUA("a  b\n c"), "a b c");
  assert.equal(rutGonUA("x".repeat(500))!.length, 200);
});
