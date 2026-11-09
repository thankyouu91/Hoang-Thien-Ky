// Soát bộ tra dịch (chạy: node --test src/dashboard/i18nTra.test.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import EN_JSON from "./i18n/en.json" with { type: "json" };
import EN_BD from "./i18n/en_ban_do.json" with { type: "json" };
import AM_TIET from "./i18n/am_tiet.json" with { type: "json" };
import { BoTra, type AmTiet } from "./i18nTra.ts";

const EN = EN_JSON as Record<string, string>;

test("bảng en.json: mọi mẫu có cùng số chỗ biến hai bên", () => {
  for (const [k, v] of Object.entries(EN)) {
    const nk = (k.match(/\{\}/g) ?? []).length;
    const nv = (v.match(/\{\d*\}/g) ?? []).length;
    assert.equal(nv, nk, `${k} → ${v}`);
  }
});

test("chữ cố định, giữ khoảng trắng đầu cuối", () => {
  const b = new BoTra({ "Đăng xuất": "Sign out" });
  assert.equal(b.tr(" Đăng xuất "), " Sign out ");
  assert.equal(b.tr("Đăng   xuất"), "Sign out");
});

test("mẫu có biến: số giữ nguyên, tên có trong bảng thì dịch, đổi thứ tự bằng {1}{2}", () => {
  const b = new BoTra({ "Cấp {}": "Level {}", "{}, đang cưỡi": "{}, riding", "Thiểm Điện Báo": "Lightning Leopard", "{} của {}": "{2}'s {1}" });
  assert.equal(b.tr("Cấp 51"), "Level 51");
  assert.equal(b.tr("Thiểm Điện Báo, đang cưỡi"), "Lightning Leopard, riding");
  assert.equal(b.tr("Lăng Vân, đang cưỡi"), "Lăng Vân, riding");
  assert.equal(b.tr("Kiếm của Lăng Vân"), "Lăng Vân's Kiếm");
});

test("mẫu chỉ có ký hiệu chỉ nhận khi dịch được một phần; không thì vẫn ghi thiếu", () => {
  const b = new BoTra({ "{}: {}": "{}: {}", "Máu": "HP" });
  assert.equal(b.tr("Máu: 9,703"), "HP: 9,703");
  assert.equal(b.tr("Chưa dịch: ở đây"), "Chưa dịch: ở đây");
  assert.ok(b.thieu.has("Chưa dịch: ở đây"));
});

test("chuỗi nối bằng · dịch từng phần, cả khi bắt đầu bằng ·", () => {
  const b = new BoTra({ "10 đấu 10": "10 vs 10", "Thắng": "Victory" });
  assert.equal(b.tr("· 10 đấu 10 · 2h ago"), "· 10 vs 10 · 2h ago");
  assert.equal(b.tr("Thắng · Lăng Vân"), "Victory · Lăng Vân");
});

test("mẫu nhiều chữ cố định thắng mẫu chung", () => {
  const b = new BoTra({ "{} phá trận, còn": "{} broke the formation, ends in", "{}, còn": "{}, ends in" });
  assert.equal(b.tr("Huyết Sát Môn phá trận, còn"), "Huyết Sát Môn broke the formation, ends in");
});

test("tên bản đồ: đủ nghĩa, không còn chữ Việt, bảng chính thắng khi trùng", () => {
  const bd = EN_BD as Record<string, string>;
  assert.ok(Object.keys(bd).length > 4000);
  for (const [k, v] of Object.entries(bd)) assert.ok(v && !/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(v), `${k} → ${v}`);
  const b = new BoTra({ ...bd, ...EN });
  assert.equal(b.tr("Hạc Huyền Thiết Sơn"), "Crane Profound Iron Mountain");
  assert.equal(b.tr("Lôi Đình Cốc"), "Thunderclap Valley");
  assert.equal(b.tr("Thần vực 3"), "Divine Domain 3");
});

test("tên ghép lúc chạy: tông NPC, tên không dấu, không đụng chuỗi giao diện thường", () => {
  const b = new BoTra(EN, AM_TIET as AmTiet);
  assert.equal(b.tr("Liệt Lâm Đài"), "Fierce Forest Terrace");
  assert.ok(b.can("Ma Linh Quan"));
  assert.equal(b.tr("Ma Linh Quan"), "Demon Spirit Pass");
  assert.equal(b.tr("Thanh Phong Các"), EN["Thanh Phong Các"]);
  // Chuỗi không dấu không phải tên ghép (âm tiết lạ) thì không đụng tới.
  assert.ok(!b.can("Xin chao ban"));
  assert.equal(b.tr("Xin chao ban"), "Xin chao ban");
  assert.equal(b.tr("Lăng Vân"), "Lăng Vân");
});

test("bảng thật: vài nhãn chính", () => {
  const b = new BoTra(EN);
  assert.equal(b.tr("Đăng xuất"), "Sign out");
  assert.equal(b.tr("Ô 3"), "Slot 3");
  assert.equal(b.tr("Lôi + Hỏa"), "Lightning + Fire");
});

test("không ra câu lai: mẫu không khớp giữa từ, phần biến là câu thường chưa dịch thì để nguyên tiếng Việt", () => {
  const b = new BoTra({ "{} đồ{}": "{} gear{}", "{} của {}": "{2}'s {1}", "{} với {}": "{1} with {2}", "Linh thạch": "Spirit Stones", "Thử {}": "Try {}" });
  // "đồ" nằm trong "đồng": không phải ranh giới từ
  assert.equal(b.tr("Cùng đồng môn đánh chiếm mỏ"), "Cùng đồng môn đánh chiếm mỏ");
  // phần biến là câu thường (chữ thường đầu) chưa có trong bảng: giữ nguyên cả câu và ghi thiếu
  assert.equal(b.tr("rồi tới thành chủ của vùng đó"), "rồi tới thành chủ của vùng đó");
  assert.ok(b.thieu.has("rồi tới thành chủ của vùng đó"));
  assert.equal(b.tr("Thử công pháp mới với dị thú"), "Thử công pháp mới với dị thú");
  // tên riêng (viết hoa đầu mọi chữ) vẫn được giữ trong câu dịch
  assert.equal(b.tr("Thử Lăng Vân"), "Try Lăng Vân");
});

test("bảng thật: câu người mới không thành chữ lai", () => {
  const b = new BoTra(EN, AM_TIET as AmTiet);
  for (const s of ["Cùng đồng môn đánh chiếm mỏ linh thạch cấp 1 gần sơn môn", "Chọn vùng bắt đầu, rồi tới thành chủ của vùng đó.", "Thử công pháp mới với dị thú ở bãi săn"]) {
    const t = b.tr(s);
    const lai = t !== s && /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(t) && /\b(gear|of|with|Spirit Stones)\b/.test(t);
    assert.ok(!lai, `${s} → ${t}`);
  }
});

test("phần biến không vượt qua dấu ·: mẫu chung không nuốt các phần sau", () => {
  const b = new BoTra({ "Ghép được {}": "Can merge {}", "{} cấp {}": "{} level {}", "Ngọc": "Gem", "Cấp {}": "Level {}" });
  assert.equal(b.tr("Ghép được 3 · Cấp 2"), "Can merge 3 · Level 2");
  assert.equal(b.tr("Ngọc cấp 2 · Cấp 5"), "Gem level 2 · Level 5");
});
