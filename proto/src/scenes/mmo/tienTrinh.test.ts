import assert from "node:assert/strict";
import { test } from "node:test";
import { Bai } from "../bai/bai.ts";
import { bayTuDong, bossTuDong, choVao, macDinh, trongCam } from "./mapKhu.ts";
import { BAI } from "../bai/thamSo.ts";
import * as L from "./tienTrinh.ts";
import { atkOf, buyPot, hpOf, kill, newSave, nextCombat, QUEST_N, upgrade, wpnPrice, xpNeed, zone, ZONE_COUNT } from "./tienTrinh.ts";

test("dải thế giới: sơn môn an toàn, cấp quái tăng dần, cửa bí cảnh có thủ lĩnh", () => {
  assert.equal(ZONE_COUNT, 117);
  assert.ok(zone(0).safe && zone(8).safe && zone(9).safe);
  assert.ok(zone(7).boss);
  let last = 0;
  for (let i = 0; i < ZONE_COUNT; i++) {
    const z = zone(i);
    if (z.safe) continue;
    assert.ok(z.level >= last, `khu ${i}`);
    last = z.level;
  }
  assert.equal(nextCombat(8), 10);
  assert.ok(!zone(nextCombat(ZONE_COUNT - 1)).safe);
});

test("giết quái: lên cấp, xong nhiệm vụ thì sang khu kế", () => {
  const s = newSave("  A  ", "hoa");
  assert.equal(s.name, "A");
  let levels = 0;
  for (let i = 0; i < QUEST_N; i++) levels += kill(s, zone(1)).levels;
  assert.equal(s.quest.zone, 2);
  assert.ok(levels >= 1 && s.lv === 1 + levels && s.xp < xpNeed(s.lv));
  assert.ok(s.gold > 0);
});

test("rơi đồ: linh thạch luôn rơi, thủ lĩnh chắc chắn rơi trang bị lam hoặc tím; nhặt, mặc, gỡ, bán", () => {
  const s = newSave("A", "moc");
  // rnd = 0.99: quái thường không trúng tỷ lệ nào ngoài linh thạch.
  const only = L.rollDrop(zone(1), false, () => 0.99);
  assert.deepEqual(only.map((x) => x.code), ["linh_thach"]);
  assert.ok(L.pickUp(s, only[0]) && s.gold === only[0].count && s.bag.length === 0);
  // rnd = 0: trúng mọi tỷ lệ.
  const all = L.rollDrop(zone(1), false, () => 0);
  assert.deepEqual(all.map((x) => x.type), ["linh_thach", "dan_duoc", "khoang_thach", "trang_bi", "tan_quyen"]);
  const boss = L.rollDrop(zone(7), true, () => 0.5);
  const g = boss.find((x) => x.type === "trang_bi")!;
  assert.ok(["lam", "tim"].includes(g.rarity) && g.slot && Object.keys(g.stats!).length > 0);
  const pots = s.pots;
  for (const it of boss) assert.ok(L.pickUp(s, it));
  assert.equal(s.pots, pots + 1);
  // Nguyên liệu cùng mã xếp chồng một ô.
  const ore = all[2];
  L.pickUp(s, { ...ore, id: "a" });
  L.pickUp(s, { ...ore, id: "b" });
  assert.equal(s.bag.filter((x) => x.code === ore.code).length, 1);
  assert.equal(s.bag.find((x) => x.code === ore.code)!.count, 2);
  const before = L.stats(s);
  assert.ok(L.equip(s, g.id) && s.equips[g.slot!] === g && !s.bag.includes(g));
  const after = L.stats(s);
  assert.ok(after.atk + after.hp + after.def + after.crit > before.atk + before.hp + before.def + before.crit);
  assert.ok(L.unequip(s, g.slot!) && s.bag.includes(g));
  assert.deepEqual(L.stats(s), before);
  const gold = s.gold;
  assert.ok(L.sell(s, g.id) && s.gold === gold + L.sellPrice(g) && !s.bag.includes(g));
  // Túi đầy thì trang bị không nhặt được, linh thạch vẫn nhặt được.
  while (s.bag.length < L.BAG_MAX) s.bag.push({ ...g, id: String(s.bag.length) });
  assert.equal(L.pickUp(s, { ...g, id: "x" }), false);
  assert.equal(L.pickUp(s, only[0]), true);
});

test("truyền tống: khu an toàn đã tới; ngoài khu an toàn tốn phù", () => {
  const s = newSave("A", "moc");
  s.maxZone = 9;
  assert.equal(L.teleport(s, 1), false); // khu có quái
  assert.equal(L.teleport(s, 18), false); // chưa tới
  assert.equal(L.teleport(s, 8), true); // đang ở sơn môn: miễn phí
  assert.equal(s.phu, 3);
  s.zone = 1;
  assert.equal(L.teleport(s, 0), true);
  assert.equal(s.phu, 2);
  s.phu = 0;
  assert.equal(L.teleport(s, 0), false);
  assert.ok(L.mineHolder(2) && !L.mineHolder(0) && !L.mineHolder(7));
});

test("tông môn: nhiệm vụ thủ lĩnh và nộp nguyên liệu, Bảo Khố không làm tụt cấp bậc, ghép tàn quyển cộng công", () => {
  const s = newSave("A", "moc");
  s.lv = 10;
  assert.ok(L.joinSect(s, "thanh_van"));
  assert.equal(L.sectKill(s, "d1", true), L.SECT.bossCong);
  assert.equal(L.sectKill(s, "d1", true), 0);
  assert.equal(L.submitOre(s, "d1"), false);
  const ore = L.rollDrop(zone(1), false, () => 0)[2];
  L.pickUp(s, { ...ore, count: 15 });
  assert.equal(L.submitOre(s, "d1"), true);
  assert.equal(L.submitOre(s, "d1"), false);
  assert.equal(L.oreCount(s), 5);
  assert.ok(L.donateOre(s) && L.oreCount(s) === 0 && s.bag.length === 0);
  s.sect!.cong = s.sect!.tong = 400;
  assert.equal(L.rankOf(s)![1], "Nội môn đệ tử");
  assert.equal(L.sectLevel(s), 5);
  assert.equal(L.buySect(s, "gear2"), false); // chưa đủ bậc
  assert.ok(L.buySect(s, "scroll") && s.sect!.cong === 250 && L.rankOf(s)![1] === "Nội môn đệ tử");
  const atk = L.stats(s).atk;
  assert.equal(L.combine(s, "moc"), false); // mới 1 tàn quyển
  s.bag.find((x) => x.code === "tan_quyen_moc")!.count = 10;
  assert.ok(L.combine(s, "moc") && s.ngo!.moc === 1 && L.scrollCount(s, "moc") === 0);
  assert.ok(L.stats(s).atk > atk);
});

test("hoạt động: giờ sự kiện, tháp theo thứ tự, bế quan có trần 8 giờ mỗi ngày", () => {
  assert.ok(L.eventOn("bi_canh", 725) && L.eventOn("bi_canh", 1200) && !L.eventOn("bi_canh", 750));
  assert.equal(L.eventIn("bi_canh", 700), 20);
  assert.equal(L.eventIn("bi_canh", 1300), 1440 - 1300 + 720);
  assert.equal(L.eventIn("chien", 1270), 0);
  assert.equal(L.rollDrop(zone(7), true, () => 0.1, true)[1].rarity, "tim");
  const s = newSave("A", "moc");
  assert.equal(L.towerKill(s, zone(L.towerZone(1))), 0); // sai thứ tự
  assert.equal(L.towerKill(s, zone(7)), L.towerGold(0));
  assert.equal(L.towerKill(s, zone(7)), 0);
  assert.ok(s.thap === 1 && L.title(s) === L.TOWER[0] && L.scrollCount(s, "moc") === 2);
  const H = 3600e3;
  assert.equal(L.afkHarvest(s, 0, "d1").xp, 0); // bắt đầu tích
  const p = L.afkPending(s, 2 * H, "d1");
  assert.ok(p.sec === 7200 && p.xp === Math.floor(xpNeed(s.lv) * 0.02 * 2) && !p.buff);
  assert.equal(L.afkHarvest(s, 2 * H, "d1").xp, p.xp);
  assert.equal(L.afkPending(s, 20 * H, "d1").sec, 6 * 3600); // trần 8 giờ
  L.afkHarvest(s, 20 * H, "d1");
  assert.equal(L.afkPending(s, 23 * H, "d1").sec, 0);
  assert.equal(L.afkPending(s, 25 * H, "d2").sec, 5 * 3600); // sang ngày thì tính lại
});

test("tiệm: thiếu linh thạch thì không mua được", () => {
  const s = newSave("A", "moc");
  assert.equal(buyPot(s, zone(0)), false);
  s.gold = wpnPrice(s);
  assert.equal(upgrade(s), true);
  assert.equal(s.gold, 0);
  assert.ok(atkOf(1, 1) > atkOf(1, 0));
});

test("khu của thế giới: quái đứng trong dải đi được, thủ lĩnh một con, treo auto tự giết quái", () => {
  const z = zone(1);
  const b = new Bai(1, "moc", 2, { w: 1376, h: 768, top: 280, monsterLevel: z.level, hp: hpOf(1), atk: atkOf(1, 0), bots: [], elements: [z.element] });
  let kills = 0;
  b.onKill = () => kills++;
  b.auto = true;
  for (let i = 0; i < 60 * 60; i++) b.step(1 / 60);
  for (const a of b.actors) assert.ok(a.y >= 280 && a.y <= 768 && a.x >= 0 && a.x <= 1376);
  assert.ok(kills > 0, "treo auto phải giết được quái");
  const boss = new Bai(1, "moc", 2, { boss: true, bots: [] });
  assert.equal(boss.actors.filter((a) => a.kind === "monster").length, 1);
  assert.equal(new Bai(1, "moc", 2, { packs: 0, bots: [] }).actors.length, 1);
  // Bãi rộng 5×4 tấm: 48 bầy rải khắp cả hai chiều, không dồn một dải.
  const big = new Bai(1, "moc", 2, { w: 6880, h: 3072, packs: 48, bots: [] });
  const homes = big.actors.filter((a) => a.kind === "monster").map((a) => a.home);
  assert.equal(homes.length, 48 * BAI.perPack);
  for (const hm of homes) assert.ok(hm.x > 0 && hm.x < 6880 && hm.y > 0 && hm.y < 3072);
  assert.ok(Math.min(...homes.map((hm) => hm.y)) < 600 && Math.max(...homes.map((hm) => hm.y)) > 2400);
  assert.ok(Math.min(...homes.map((hm) => hm.x)) < 800 && Math.max(...homes.map((hm) => hm.x)) > 6000);
});

test("map khu: mặc định có dải cấm, bầy tự rải và chỗ vào đều nằm ngoài vùng cấm; người không đi vào vùng cấm", () => {
  const m = macDinh(zone(1));
  assert.equal(macDinh(zone(0)).vat.length, 2);
  const homes = bayTuDong(m);
  assert.equal(homes.length, 24);
  for (const p of homes) assert.ok(!trongCam(m, p.x, p.y));
  const e = choVao(m, 70);
  assert.ok(!trongCam(m, e.x, e.y));
  // Boss tự đặt nằm ngoài vùng cấm, xa cửa trái; là một con riêng, máu gấp BAI.bossHp, hồi sinh chậm.
  const bo = bossTuDong(m);
  assert.equal(bo.length, 1);
  assert.ok(!trongCam(m, bo[0].x, bo[0].y) && bo[0].x > m.w / 2);
  assert.deepEqual(bossTuDong({ ...m, boss: [{ x: 5, y: 5, ten: "Lão Hổ" }] }), [{ x: 5, y: 5, ten: "Lão Hổ" }]);
  const b = new Bai(1, "moc", 2, { w: m.w, h: m.h, homes, blocked: m.cam, entry: e, bots: [], bosses: bo });
  assert.equal(b.actors.filter((a) => a.kind === "monster").length, 24 * BAI.perPack + 1);
  const boss = b.actors.find((a) => a.boss)!;
  assert.equal(boss.name, "Thủ lĩnh");
  assert.equal(boss.hpMax, BAI.monsterHp(b.mLevel) * BAI.bossHp);
  b.player.atk = boss.hpMax * 2;
  boss.x = b.player.x + 10;
  boss.y = b.player.y;
  b.attack(boss.id);
  for (let i = 0; i < 60 * 3 && boss.alive; i++) b.step(1 / 60);
  assert.equal(boss.alive, false);
  assert.ok(boss.respawnAt - b.t > BAI.respawn);
  assert.equal(b.tuVi, BAI.tuVi(b.mLevel) * BAI.bossTuVi);
  b.moveTo(e.x, 10);
  for (let i = 0; i < 60 * 30; i++) b.step(1 / 60);
  assert.ok(!trongCam(m, b.player.x, b.player.y) && b.player.y < e.y);
});

test("điểm tiềm năng và tầng chiêu theo luật bản cũ", async () => {
  const t = await import("./tienTrinh.ts");
  const s = t.newSave("A", "moc");
  assert.equal(t.statPoints(s), 0);
  assert.equal(t.addStat(s, "the_phach"), false);
  s.lv = 11;
  assert.equal(t.statPoints(s), 10);
  const hp0 = t.stats(s).hp;
  for (let i = 0; i < 10; i++) assert.equal(t.addStat(s, "the_phach"), true);
  assert.equal(t.addStat(s, "the_phach"), false);
  assert.equal(t.stats(s).hp, Math.round(hp0 * 1.01));
  assert.equal(t.resetStats(s), true);
  assert.equal(t.statPoints(s), 10);
  // 10 cấp × 20 điểm luyện = 200: tầng 2 (10) + 3 (20) + 4 (30) + 5 (40) + 6 (50) = 150, tầng 7 cần 60 thì thiếu.
  assert.equal(t.skillPoints(s), 200);
  for (let i = 0; i < 5; i++) assert.equal(t.upSkill(s, "can_quet"), true);
  assert.equal(t.layerOf(s, "can_quet"), 6);
  assert.equal(t.skillPoints(s), 50);
  assert.equal(t.upSkill(s, "can_quet"), false);
  assert.equal(t.upSkill(s, "khong_co"), false);
  t.resetSkills(s);
  assert.equal(t.skillPoints(s), 200);
});

test("chiêu đã học theo cấp và xếp ô", async () => {
  const t = await import("./tienTrinh.ts");
  const s = t.newSave("A", "moc");
  assert.deepEqual(t.slotsOf(s), ["can_quet", "tam_xa", "dien_rong", "ho_the", "hoi_phuc", null]);
  assert.equal(t.learned(s).length, 5);
  assert.equal(t.setSlot(s, 5, "can_don"), false); // chưa học
  s.lv = 5;
  assert.equal(t.setSlot(s, 5, "can_don"), true);
  assert.equal(t.setSlot(s, 0, "can_don"), true); // đổi chỗ với ô 0
  assert.deepEqual(t.slotsOf(s), ["can_don", "tam_xa", "dien_rong", "ho_the", "hoi_phuc", "can_quet"]);
  t.clearSlot(s, 1);
  assert.equal(t.slotsOf(s)[1], null);
  assert.equal(t.setSlot(s, 9, "can_don"), false);
});

test("cảnh giới, tông môn, thư", async () => {
  const t = await import("./tienTrinh.ts");
  assert.equal(t.realm(1), "Luyện Khí · Sơ kỳ");
  assert.equal(t.realm(50), "Luyện Khí · Hậu kỳ");
  assert.equal(t.realm(70), "Trúc Cơ · Trung kỳ");
  const s = t.newSave("A", "moc");
  assert.equal(t.joinSect(s, "thanh_van"), false); // chưa đủ cấp
  s.lv = 10;
  const atk0 = t.stats(s).atk;
  assert.equal(t.joinSect(s, "khong_co"), false);
  assert.equal(t.joinSect(s, "thanh_van"), true);
  assert.equal(t.stats(s).atk, Math.round(atk0 * 1.02));
  assert.equal(t.checkIn(s, "2026-11-11"), true);
  assert.equal(t.checkIn(s, "2026-11-11"), false);
  assert.equal(t.checkIn(s, "2026-11-12"), true);
  assert.equal(s.sect!.cong, 100);
  let done = 0;
  for (let i = 0; i < 40; i++) if (t.sectKill(s, "2026-11-12")) done++;
  assert.equal(done, 1);
  assert.equal(s.sect!.cong, 200);
  assert.equal(t.sectKills(s, "2026-11-13"), 0);
  s.gold = 100;
  assert.equal(t.donate(s), true);
  assert.equal(t.donate(s), false);
  assert.equal(t.rankOf(s)![1], "Ngoại môn đệ tử");
  s.sect!.cong = s.sect!.tong = 300;
  assert.equal(t.rankOf(s)![1], "Nội môn đệ tử");
  assert.deepEqual(t.mails(s).map((m) => m.id), ["lv10", "lv5", "chao"]);
  const pots = s.pots;
  assert.equal(t.claimMail(s, "chao"), true);
  assert.equal(t.claimMail(s, "chao"), false);
  assert.equal(t.claimMail(s, "lv50"), false);
  assert.equal(s.pots, pots + 3);
});
