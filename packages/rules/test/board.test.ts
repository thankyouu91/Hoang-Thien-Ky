import { test } from "node:test";
import assert from "node:assert/strict";
import {
  boardBonus, boardCellOpen, connectedCells, gearStats, machBetween,
  type BoardPiece, type BoardSetup, type EquipItem, type Progress,
} from "../src/index.ts";
import DAO from "../../../data/he_thong/json/dao_co_ban.json" with { type: "json" };
import SET from "../../../data/he_thong/json/set.json" with { type: "json" };

// Đạo Cơ Bàn (GDD tab Trang bị, phần 8; dao_co_ban.json). Ấn: 001 Tụ Bảo (Kim), 003 Bàn Thạch (Thổ), 015 Huyết Ảnh (Cực âm),
// 017 Vạn Kiếm (Kim), 019 Phá Quân (Cực dương), 020 Hỗn Độn (không hệ).

const ALL_OPEN: Progress = { viDien: "thanh", cap: 1, canhGioi: 9 };
const an = (ma: string): BoardPiece => ({ loai: "an", ma });
const ngoc = (he: "kim" | "moc" | "tho", cap = 1): BoardPiece => ({ loai: "ngoc", he, cap });
const board = (cells: Record<string, BoardPiece>, progress = ALL_OPEN): BoardSetup => ({ cells, progress });
const SLOT_KIEU = ["TB-KI-001", "TB-MU-001", "TB-AO-001", "TB-DA-001", "TB-BT-001", "TB-GI-001", "TB-NB-001"];
/** Mặc lần lượt các ô, mỗi món mang một ấn theo danh sách. */
const sealed = (...seals: string[]): EquipItem[] =>
  seals.map((ma, i) => ({ kieu: SLOT_KIEU[i], nac: 0, doBen: 100, biCanh: 0, dongThem: 0, kham: [{ loai: "an", ma }] }));
const LV = 100;
/** Số ở mốc `so` của bộ `bo` trong set.json. */
const MOC = (bo: string, so: number) => (SET.bo.find((b) => b.id === bo)!.moc.find((m) => m.so === so)!.tham_so as Record<string, number>);
/** Công lực cộng thẳng của set: phần nghìn `giaTri` (đã nhân hệ số `heSo`) của công lực chuẩn `chuan`. */
const atkSet = (giaTri: number, heSo = 1000, chuan = 500) => Math.trunc((chuan * Math.trunc((giaTri * heSo) / 1000)) / 1000);

/** Mana tối đa Âm Dương trừ, theo dao_co_ban.json (phần nghìn của mana chuẩn 300). */
const AM_DUONG_MANA = Math.trunc((300 * (DAO.cong_huong.find((c) => c.mach === "cuc") as { manaMax: number }).manaMax) / 1000);
/** Mana tối đa hợp bộ Đối cực trừ (set.json hop_bo). */
const HOP_CUC_MANA = Math.trunc((300 * ((SET as unknown as { hop_bo: { quan_he: string; mana_max?: number }[] }).hop_bo.find((h) => h.quan_he === "doi_cuc")!.mana_max ?? 0)) / 1000);

test("bàn 19 ô, ô tâm kề 6 ô; quan hệ hệ ra loại mạch, không hệ là trung", () => {
  assert.equal(DAO.o.length, 19);
  assert.equal(connectedCells({ O: an("NG-AN-020"), T1: ngoc("kim"), T2: ngoc("kim"), T3: ngoc("kim"), T4: ngoc("kim"), T5: ngoc("kim"), T6: ngoc("kim") }).length, 7);
  assert.deepEqual([machBetween("kim", "kim"), machBetween("tho", "kim"), machBetween("cuc_duong", "cuc_am"), machBetween("kim", "moc"), machBetween(null, "moc")],
    ["thuan", "sinh", "cuc", "dut", "trung"]);
});

test("ô mở theo vị diện, cấp, rồi cảnh giới ở Thần vực", () => {
  const open = (p: Progress) => DAO.o.filter((o) => boardCellOpen(o.ma, p)).length;
  assert.equal(open({ viDien: "ha", cap: 19, canhGioi: 1 }), 0);
  assert.equal(open({ viDien: "ha", cap: 20, canhGioi: 1 }), 1);
  assert.equal(open({ viDien: "ha", cap: 51, canhGioi: 2 }), 3);
  assert.equal(open({ viDien: "ha", cap: 250, canhGioi: 5 }), 10);
  assert.equal(open({ viDien: "trung", cap: 1, canhGioi: 6 }), 13);
  assert.equal(open({ viDien: "trung", cap: 101, canhGioi: 7 }), 16);
  assert.equal(open({ viDien: "than", cap: 0, canhGioi: 8 }), 18);
  assert.equal(open({ viDien: "than", cap: 0, canhGioi: 9 }), 19);
});

test("đặt sai thì báo lỗi: ô chưa mở, ô tâm nhận ngọc, ô hoặc ấn không có", () => {
  const pieces = { van_kiem: 2 };
  assert.throws(() => boardBonus(board({ T1: ngoc("kim") }, { viDien: "ha", cap: 20, canhGioi: 1 }), pieces));
  assert.throws(() => boardBonus(board({ O: ngoc("kim") }), pieces));
  assert.throws(() => boardBonus(board({ X9: an("NG-AN-017") }), pieces));
  assert.throws(() => boardBonus(board({ O: an("NG-AN-999") }), pieces));
});

test("ô thông: nối về ô tâm, cặp kề tương khắc làm đứt; ô tâm trống thì không ô nào thông", () => {
  // Ô tâm Kim; T1 ngọc Mộc (Kim khắc Mộc) đứt, nên N1 chỉ kề T1 cũng không thông; T4 ngọc Thổ (Thổ sinh Kim) thông; N8 kề T4, cùng Thổ, thông.
  const cells = { O: an("NG-AN-017"), T1: ngoc("moc"), T4: ngoc("tho"), N1: ngoc("kim"), N8: ngoc("tho") };
  assert.deepEqual(connectedCells(cells), ["O", "T4", "N8"]);
  assert.deepEqual(connectedCells({ T1: ngoc("kim"), T4: ngoc("kim") }), []);
  // Hỗn Độn không hệ: kề gì cũng thông.
  assert.deepEqual(connectedCells({ O: an("NG-AN-020"), T1: ngoc("moc") }), ["O", "T1"]);
});

test("ấn thông thêm 1 món cho bộ, tối đa 2 món mỗi bộ, chỉ khi bộ có ít nhất 2 món trên đồ", () => {
  const cells = { O: an("NG-AN-017"), T4: an("NG-AN-017"), T1: an("NG-AN-017"), T2: an("NG-AN-001") };
  const r = boardBonus(board(cells), { van_kiem: 2, tu_bao: 1 });
  assert.deepEqual(r.monThem, { van_kiem: 2 });
  const g = gearStats(sealed("NG-AN-017", "NG-AN-017"), LV, [], board(cells));
  assert.deepEqual(g.sets.map((s) => [s.bo, s.mon, s.moc]), [["van_kiem", 4, 4]]);
  // Không có bàn: 2 món, mốc 2.
  assert.deepEqual(gearStats(sealed("NG-AN-017", "NG-AN-017"), LV, []).sets.map((s) => [s.bo, s.mon, s.moc]), [["van_kiem", 2, 2]]);
});

test("Đồng Khí (Thuần): mốc 2 ×1,25 cho cả hai bộ, làm tròn về 0; kháng hệ đó +3%", () => {
  const items = sealed("NG-AN-017", "NG-AN-017", "NG-AN-001", "NG-AN-001");
  const plain = gearStats(items, LV, []);
  const g = gearStats(items, LV, [], board({ O: an("NG-AN-017"), T1: an("NG-AN-001") }));
  assert.deepEqual(g.board!.congHuong, [{ a: "tu_bao", b: "van_kiem", mach: "thuan", ten: "Đồng Khí", he: "kim" }]);
  assert.deepEqual(g.board!.heSo, { tu_bao: 1250, van_kiem: 1250 });
  // Vạn Kiếm công lực mốc 2 ×1,25 trên bàn; không bàn là hợp bộ Thuần ×1,1. Tụ Bảo thuế chợ −10 ×1,25 = −12,5 → −12.
  const vk = MOC("van_kiem", 2).atk;
  assert.equal(g.atk - plain.atk, atkSet(vk, 1250) - atkSet(vk, 1100));
  assert.deepEqual(g.sets.find((s) => s.bo === "tu_bao")!.hieuUng[0].tham_so, { thueCho: -12 });
  assert.equal(g.resist.kim, 30);
});

test("Tương Dưỡng (Sinh) ×1,5; Âm Dương (Cực) ×2 và giảm mana tối đa; mốc 4 và 7 không đổi", () => {
  const sinh = gearStats(sealed("NG-AN-003", "NG-AN-003", "NG-AN-001", "NG-AN-001"), LV, [], board({ O: an("NG-AN-003"), T1: an("NG-AN-001") }));
  assert.equal(sinh.board!.congHuong[0].ten, "Tương Dưỡng");
  const bt2 = (SET.bo.find((b) => b.id === "ban_thach")!.moc[0].tham_so as Record<string, number>).hp;
  assert.equal(sinh.sets.find((s) => s.bo === "ban_thach")!.hieuUng[0].tham_so.hp, Math.trunc((bt2 * 1500) / 1000)); // ×1,5
  const items = sealed("NG-AN-019", "NG-AN-019", "NG-AN-015", "NG-AN-015");
  const bare = gearStats(items.map((it) => ({ ...it, kham: [] })), LV, []);
  const plain = gearStats(items, LV, []);
  const cuc = gearStats(items, LV, [], board({ O: an("NG-AN-019"), T1: an("NG-AN-015") }));
  assert.equal(cuc.board!.congHuong[0].ten, "Âm Dương");
  // Huyết Ảnh hút máu mốc 2: trên bàn Âm Dương ×2; không bàn là hợp bộ Đối cực ×1,3.
  const ha = MOC("huyet_anh", 2).lifesteal;
  assert.deepEqual([cuc.bonuses.lifestealFlat, plain.bonuses.lifestealFlat], [Math.trunc((ha * 2000) / 1000), Math.trunc((ha * 1300) / 1000)]);
  // Mana tối đa −2%: Âm Dương trên bàn thay hợp bộ Đối cực, cùng một lần cho cặp.
  assert.deepEqual([cuc.manaMax - bare.manaMax, plain.manaMax - bare.manaMax], [AM_DUONG_MANA, HOP_CUC_MANA]);
  // Mốc 4 của Huyết Ảnh (4 món: 2 trên đồ + 2 trên bàn) không nhân.
  const four = gearStats(items, LV, [], board({ O: an("NG-AN-015"), T4: an("NG-AN-015"), T1: an("NG-AN-019") }));
  const moc4 = (g: ReturnType<typeof gearStats>) => g.sets.find((s) => s.bo === "huyet_anh")!.hieuUng.find((m) => m.so === 4);
  assert.ok(moc4(four));
  assert.deepEqual(moc4(four), moc4(gearStats(sealed(...Array(4).fill("NG-AN-015")), LV, [])));
});

test("mỗi bộ lấy cộng hưởng mạnh nhất; tác dụng phụ tính một lần cho mỗi cặp được chọn", () => {
  // Huyết Ảnh (Cực âm) ở tâm kề Phá Quân (Cực dương, Âm Dương) và Vạn Kiếm (Kim, Tương Dưỡng vì Kim sinh Cực âm).
  const items = sealed("NG-AN-015", "NG-AN-015", "NG-AN-019", "NG-AN-019", "NG-AN-017", "NG-AN-017");
  const g = gearStats(items, LV, [], board({ O: an("NG-AN-015"), T1: an("NG-AN-019"), T4: an("NG-AN-017") }));
  assert.deepEqual(g.board!.heSo, { huyet_anh: 2000, van_kiem: 1500, pha_quan: 2000 });
  assert.deepEqual(g.board!.congHuong.map((c) => [c.a, c.b, c.ten]), [["huyet_anh", "pha_quan", "Âm Dương"], ["huyet_anh", "van_kiem", "Tương Dưỡng"]]);
  const bare = gearStats(items.map((it) => ({ ...it, kham: [] })), LV, []);
  assert.equal(g.manaMax - bare.manaMax, AM_DUONG_MANA); // một cặp Âm Dương; bàn thay hợp bộ nên không trừ thêm
});

test("ấn không thông hoặc bộ chưa kích thì không cộng hưởng", () => {
  const items = sealed("NG-AN-017", "NG-AN-017", "NG-AN-001");
  // Tụ Bảo chỉ 1 món trên đồ: không được thêm món từ bàn, nên chưa kích.
  assert.deepEqual(gearStats(items, LV, [], board({ O: an("NG-AN-017"), T1: an("NG-AN-001") })).board!.congHuong, []);
  // T1 bị đứt (ngọc Mộc ở giữa), N1 không về được tâm.
  const two = sealed("NG-AN-017", "NG-AN-017", "NG-AN-001", "NG-AN-001");
  const r = gearStats(two, LV, [], board({ O: an("NG-AN-017"), T1: ngoc("moc"), N1: an("NG-AN-001") })).board!;
  assert.deepEqual([r.thong, r.congHuong], [["O"], []]);
});
