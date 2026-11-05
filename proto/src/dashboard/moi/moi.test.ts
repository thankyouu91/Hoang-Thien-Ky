// node --test src/dashboard/moi/moi.test.ts (trong proto/): thế giới người mới, chuỗi nhập môn 0.1–0.7, lưu tiến độ.
import assert from "node:assert/strict";
import { test } from "node:test";
import { simulate } from "@ktlp/sim";
import type { RegionMap } from "../../scenes/map/region.ts";
import REGION_JSON from "../../../../data/maps/ha_diem_loi_dinh_coc.json" with { type: "json" };
import {
  biCanhKe, buocHienTai, CHUOI, danhDauXong, lamChiemMo, lamChonVung, lamDatNhac, lamGhepTanThu, lamGiaNhap, lamGieoQue, lamTaoHinh,
  lamThuChieu, TAN_THU, themMon, xemTruocTanThu, lamBeQuan, chotBeQuan,
} from "./ftue.ts";
import { donBanCu, docTienDo, ghiTienDo, khoaLuu, PHIEN_BAN_LUU, TIEN_TO, xoaTienDo } from "./luu.ts";
import { chang, PLAYER, SECT, taoTheGioiMoi, VUNG_MO } from "./theGioiMoi.ts";

const REGION = REGION_JSON as unknown as RegionMap;
const NOW = new Date(2026, 10, 5, 9, 30).getTime();

test("người mới: cấp 1, chưa vào tông, ở thành chủ, có 2 tàn quyển tặng", () => {
  const { world: w, moi } = taoTheGioiMoi(42, REGION, NOW);
  const me = w.rules.members[PLAYER];
  assert.equal(me.level, 1);
  assert.equal(me.sectId, null);
  assert.equal(me.role, null);
  assert.equal(me.learned.length, 0);
  assert.equal(me.loadout.length, 0);
  assert.equal(me.bag.length, 2);
  assert.deepEqual(me.bag.map((s) => s.uid), moi.quaTanThu);
  assert.equal(w.player.exp, 0);
  assert.deepEqual(w.player.roots, []);
  assert.equal(w.player.mounts.filter(Boolean).length, 0);
  assert.equal(Object.keys(w.player.board).length, 0);
  const thanhChu = REGION.points.find((p) => p.type === "thanh_chu")!.id;
  assert.equal(w.travel.to, thanhChu);
  // Tông gợi ý là NPC, có công pháp truyền thụ; mỏ mục tiêu do dị thú giữ, trong tầm 1 chặng của sơn môn.
  assert.equal(w.rules.sects[SECT].transmission.length, 4);
  assert.ok(Object.values(w.rules.members).filter((m) => m.id !== PLAYER).every((m) => w.npc[m.id]));
  assert.equal(chang(REGION, w.sonMon).get(moi.moMucTieu), 1);
  assert.equal(REGION.points[moi.moMucTieu].type, "mo_linh_thach");
  assert.ok(!w.held.some((h) => h.pointId === moi.moMucTieu));
  assert.equal(moi.moNpc[0].by, "Dị thú");
  assert.equal(w.alliance.joined, false);
});

test("cùng hạt giống thì cùng thế giới; khác hạt giống thì quẻ khác", () => {
  const a = taoTheGioiMoi(7, REGION, NOW);
  const b = taoTheGioiMoi(7, REGION, NOW);
  assert.deepEqual(a.moi.que, b.moi.que);
  assert.equal(a.world.sonMon, b.world.sonMon);
  const ques = new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(taoTheGioiMoi(1000 + i, REGION, NOW).moi.que)));
  assert.ok(ques.size > 20);
});

/** Đi hết chuỗi chương 0 như người chơi, trả tổng thưởng. */
function diHetChuoi(seed: number) {
  const { world: w, moi } = taoTheGioiMoi(seed, REGION, NOW);
  let exp = 0;
  let stone = 0;
  const xong = (id: string) => {
    const r = danhDauXong(moi, id);
    assert.ok(r, `chưa xong được ${id}`);
    exp += r.exp ?? 0;
    stone += r.linhThach ?? 0;
    if (r.items) themMon(w, r.items);
  };
  assert.equal(buocHienTai(moi)?.viec, "chon_vung");
  assert.equal(lamChonVung(moi, "xich_viem_son", VUNG_MO).ok, false);
  assert.ok(lamChonVung(moi, "loi_dinh_coc", VUNG_MO).ok);
  xong("chinh.0.1");
  assert.equal(buocHienTai(moi)?.viec, "gieo_que");
  assert.equal(lamTaoHinh(w, moi, moi.look, "Lăng Vân").ok, false, "phải gieo quẻ trước khi tạo hình");
  assert.ok(lamGieoQue(w, moi).ok);
  assert.deepEqual(w.player.roots, moi.que.roots);
  assert.ok(lamTaoHinh(w, moi, { body: "nu_manh", outfit: "vo_phuc" }, "  Tô   Dao ").ok);
  assert.equal(w.player.name, "Tô Dao");
  xong("chinh.0.2");
  assert.ok(lamGiaNhap(w, moi, SECT, NOW).ok);
  assert.equal(w.rules.members[PLAYER].role, "ngoai_mon");
  assert.equal(w.travel.to, w.sonMon);
  xong("chinh.0.3");
  const xem = xemTruocTanThu(w, moi)!;
  assert.ok(xem.tech.damage > 0);
  assert.ok(lamGhepTanThu(w, moi, NOW).ok);
  const me = w.rules.members[PLAYER];
  assert.equal(me.bag.length, 0);
  assert.equal(me.learned[0].sectId, TAN_THU);
  assert.equal(me.loadout.length, 1);
  xong("chinh.0.4");
  const t = lamThuChieu(w, moi, NOW);
  assert.ok(t.ok && t.battleId);
  assert.equal(simulate(moi.tran[t.battleId!]).winner, "A");
  xong("chinh.0.5");
  const c = lamChiemMo(w, moi, NOW);
  assert.ok(c.ok && c.battleId);
  assert.equal(simulate(moi.tran[c.battleId!]).winner, "A");
  assert.ok(w.held.some((h) => h.pointId === moi.moMucTieu && h.level === 1));
  assert.equal(buocHienTai(moi)?.viec, "thu_mo");
  xong("chinh.0.6");
  const n = lamDatNhac(moi, NOW);
  assert.ok(n.ok && n.at! > NOW);
  xong("chinh.0.7");
  assert.equal(buocHienTai(moi), undefined);
  assert.equal(moi.xong.length, CHUOI.length);
  return { w, exp, stone };
}

test("đi hết chương 0 không kẹt, trận 0.5 và 0.6 thắng (20 hạt giống)", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { w, exp, stone } = diHetChuoi(seed * 7919);
    assert.equal(exp, 2500);
    assert.equal(stone, 850);
    assert.equal(w.player.bag.find((b) => b.code === "DA-DD-001")?.count, 3 + 5);
    assert.equal(w.player.bag.find((b) => b.code === "PH-CH-006")?.count, 2);
  }
});

test("không làm được bước sau khi bước trước chưa xong", () => {
  const { world: w, moi } = taoTheGioiMoi(5, REGION, NOW);
  assert.equal(lamGiaNhap(w, moi, SECT, NOW).ok, false);
  assert.equal(lamGhepTanThu(w, moi, NOW).ok, false);
  assert.equal(danhDauXong(moi, "chinh.0.3"), undefined);
});

test("bí cảnh kế: 12:00 rồi 20:00 rồi 12:00 hôm sau", () => {
  const d = (h: number, m = 0, day = 5) => new Date(2026, 10, day, h, m).getTime();
  assert.equal(biCanhKe(d(9, 30)), d(12));
  assert.equal(biCanhKe(d(12, 10)), d(20));
  assert.equal(biCanhKe(d(21)), d(12, 0, 6));
});

class KhoGia {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

test("lưu tiến độ theo tài khoản, có phiên bản; bản cũ bị bỏ", () => {
  const kho = new KhoGia();
  const { w } = diHetChuoi(99);
  const { moi } = taoTheGioiMoi(99, REGION, NOW);
  assert.ok(ghiTienDo(kho, "acc1", w, moi, NOW));
  assert.equal(docTienDo(kho, "acc2"), null);
  const ban = docTienDo(kho, "acc1")!;
  assert.equal(ban.phienBan, PHIEN_BAN_LUU);
  assert.equal(ban.vung, "loi_dinh_coc");
  assert.equal("region" in ban.world, false);
  assert.equal(ban.world.player.name, w.player.name);
  // Bản lưu của phiên bản khác (kể cả bản cấp 42 nếu từng lưu) bị bỏ, bản hiện tại giữ nguyên.
  kho.setItem(`${TIEN_TO}v0.acc1`, "{}");
  kho.setItem(`${TIEN_TO}v${PHIEN_BAN_LUU + 7}.acc1`, "{}");
  kho.setItem("ktlp.session", "{}");
  assert.equal(donBanCu(kho), 2);
  assert.ok(kho.getItem(khoaLuu("acc1")));
  assert.ok(kho.getItem("ktlp.session"));
  // Bản ghi sai phiên bản đọc ra null.
  kho.setItem(khoaLuu("acc3"), JSON.stringify({ ...ban, phienBan: PHIEN_BAN_LUU - 1 }));
  assert.equal(docTienDo(kho, "acc3"), null);
  xoaTienDo(kho, "acc1");
  assert.equal(docTienDo(kho, "acc1"), null);
});

test("sơn môn tông gợi ý có cấp nguy hiểm thấp (40 hạt giống)", () => {
  for (let s = 1; s <= 40; s++) {
    const { world: w } = taoTheGioiMoi(s * 7919, REGION, NOW);
    assert.ok(REGION.points[w.sonMon].danger <= 40, `hạt giống ${s * 7919}: ${REGION.points[w.sonMon].danger}`);
  }
});

test("bế quan sau chương 0: cộng tu vi khi hết giờ, chỉ một lượt một lúc", () => {
  const { w } = diHetChuoi(4242);
  const { moi } = taoTheGioiMoi(4242, REGION, NOW);
  assert.equal(lamBeQuan(w, moi, 1, 114, NOW).ok, false, "chưa xong chương 0 thì chưa bế quan");
  moi.xong = CHUOI.map((q) => q.id);
  assert.equal(lamBeQuan(w, moi, 3, 114, NOW).ok, false);
  assert.ok(lamBeQuan(w, moi, 8, 114, NOW).ok);
  assert.equal(lamBeQuan(w, moi, 1, 114, NOW).ok, false);
  assert.ok(w.jobs.some((j) => j.kind === "be_quan"));
  assert.equal(chotBeQuan(w, moi, NOW + 3600_000), 0);
  assert.equal(chotBeQuan(w, moi, NOW + 8 * 3600_000), 912);
  assert.ok(!w.jobs.some((j) => j.kind === "be_quan"));
  assert.equal(moi.beQuan, undefined);
});

test("bế quan không trừ tu vi khi mốc kết thúc trước mốc bắt đầu (đồng hồ máy bị lùi)", () => {
  const { w } = diHetChuoi(777);
  const { moi } = taoTheGioiMoi(777, REGION, NOW);
  moi.beQuan = { batDau: NOW, ketThuc: NOW - 3600_000, moiGio: 114 };
  assert.equal(chotBeQuan(w, moi, NOW), 0);
  assert.equal(moi.beQuan, undefined);
});
