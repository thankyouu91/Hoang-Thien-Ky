// Công cụ cân bằng (Sprint 2): chạy hàng nghìn trận 10 đấu 10 giữa đội mẫu và đối thủ cùng sức, xuất CSV tỷ lệ thắng theo hệ,
// loại chiêu, tổ hợp hệ chủ–phụ quyển và khắc hệ, rồi đối chiếu hai tiêu chí xong của Sprint 2 (docs/KE_HOACH.md):
//   1. Đội yếu hơn 15% chỉ số nhưng đúng hệ khắc thắng ≥ 50% (GDD mục 2, trụ cột "Trí hơn lực"): hệ nào cũng phải có ít nhất
//      một hệ đánh nó ×1,5 mà đội hệ đó, yếu hơn 15%, thắng được ≥ 50%.
//   2. Không lựa chọn nào (hệ, loại chiêu ở ưu tiên 1, tổ hợp hệ chủ–phụ) thắng quá 65% trước đội ngẫu nhiên cùng sức.
// Đội dựng qua luật của @ktlp/rules (doi.ts), tham số ở config.ts. Mỗi cặp đội đánh hai lần đổi bên để bỏ lợi thế đi trước.
//
// Chạy: npm.cmd run balance            (200 cặp mỗi ô, khoảng 76.000 trận)
//       npm.cmd run balance -- --nhanh (20 cặp mỗi ô)   hoặc   -- --n <số cặp mỗi ô>
// Ra: tools/balance/out/*.csv và tom_tat.md (sinh lại được, không commit)
import { mkdirSync, writeFileSync } from "node:fs";
import {
  simulate, Rng, ELEMENTS, SKILL_TYPES, COMBO, ONE, MAX_TICKS, TICKS_PER_SECOND, comboRelation, elementMultiplier,
  SKILL_SPECS, SKILL_RULES, BATTLE, UNIT_CURVE, ROOT_BUFFS, TALENT_RULES, VARIANT_STATS, ELEMENT_STATS, ELEMENT_EFFECTS, GRADE_POW,
  type Element,
} from "@ktlp/sim";
import { ELEMENT_NAMES, SKILL_TYPE_NAMES } from "@ktlp/rules";
import { BALANCE } from "./config.ts";
import { buildTeam, makeFrame, type Member, type Plan } from "./doi.ts";

const argN = process.argv.indexOf("--n");
const PAIRS = argN > 0 ? Number(process.argv[argN + 1]) : process.argv.includes("--nhanh") ? BALANCE.quickPairs : BALANCE.pairs;
if (!Number.isInteger(PAIRS) || PAIRS < 1) throw new Error("--n cần một số nguyên dương");
const OUT = new URL("./out/", import.meta.url);
const KHAC = 1500; // hệ số khi đánh hệ bị khắc hoặc hệ đối cực (GDD mục 8)

/** Kết quả một ô, tính theo đội mẫu. */
interface Cell { n: number; win: number; draw: number; loss: number; timeout: number; ticks: number }
const emptyCell = (): Cell => ({ n: 0, win: 0, draw: 0, loss: 0, timeout: 0, ticks: 0 });
function addCell(to: Cell, c: Cell): Cell {
  to.n += c.n; to.win += c.win; to.draw += c.draw; to.loss += c.loss; to.timeout += c.timeout; to.ticks += c.ticks;
  return to;
}

const all = emptyCell();
let simMs = 0;
let hash = 0x811c9dc5; // gộp mã băm của mọi trận theo thứ tự chạy: cùng tham số thì ra cùng số

/** FNV-1a 32 bit: seed của mỗi ô chỉ phụ thuộc tên ô, thêm bớt ô khác không đổi kết quả ô này. */
function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

const withIds = (team: Member[], base: number) => team.map((u, i) => ({ ...u, id: base + i }));

/** Đội `plan` (yếu hơn `weaker`) đánh đội `foe` cùng khung, `PAIRS` cặp, mỗi cặp hai lần đổi bên. */
function play(key: string, plan: Plan, foe: Plan, weaker = 0): Cell {
  const cell = emptyCell();
  const base = (BALANCE.seed ^ fnv(key)) >>> 0;
  for (let k = 0; k < PAIRS; k++) {
    const seed = (base ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0;
    const r = new Rng(seed);
    const frame = makeFrame(r);
    const mine = buildTeam(r, plan, frame, weaker), theirs = buildTeam(r, foe, frame);
    for (const swap of [false, true]) {
      const t = performance.now();
      const res = simulate({ seed, teamA: withIds(swap ? theirs : mine, 1), teamB: withIds(swap ? mine : theirs, 101) });
      simMs += performance.now() - t;
      if (res.winner === "draw") {
        cell.draw++;
        if (res.ticks >= MAX_TICKS) cell.timeout++;
      } else if (res.winner === (swap ? "B" : "A")) cell.win++;
      else cell.loss++;
      cell.n++;
      cell.ticks += res.ticks;
      hash = Math.imul(hash ^ res.hash, 0x01000193) >>> 0;
    }
  }
  addCell(all, cell);
  return cell;
}

/** Tỷ lệ thắng theo phần nghìn, hòa tính `drawScore`. */
const rate = (c: Cell) => Math.round((c.win * ONE + c.draw * BALANCE.drawScore) / c.n);
/** Nửa khoảng tin cậy 95% của tỷ lệ thắng (xấp xỉ chuẩn), phần nghìn. */
function margin(c: Cell): number {
  const p = rate(c) / ONE;
  return Math.round(1960 * Math.sqrt((p * (1 - p)) / c.n));
}
const pct = (perMille: number) => (perMille / 10).toFixed(1);
const seconds = (c: Cell) => (c.ticks / c.n / TICKS_PER_SECOND).toFixed(1);
const timeoutRate = (c: Cell) => Math.round((c.timeout * ONE) / c.n);
/** Số thập phân kiểu Việt trong bản tóm tắt. */
const vi = (s: string) => s.replace(".", ",");
const showRate = (c: Cell) => `${vi(pct(rate(c)))}% ± ${vi(pct(margin(c)))}`;

const CELL_HEAD = ["Số trận", "Thắng", "Hòa", "Thua", "Tỷ lệ thắng (%)", "± 95% (%)", "Giây/trận", "Hòa hết giờ (%)"];
const cellCols = (c: Cell) => [c.n, c.win, c.draw, c.loss, pct(rate(c)), pct(margin(c)), seconds(c), pct(timeoutRate(c))];
function writeCsv(name: string, head: string[], rows: (string | number)[][]): void {
  // BOM để Excel nhận UTF-8 và hiện đúng tiếng Việt.
  writeFileSync(new URL(name, OUT), "﻿" + [head, ...rows].map((r) => r.join(",")).join("\n") + "\n");
}

function relationName(main: Element, sub: Element): string {
  const { t, manaMul } = comboRelation(main, sub);
  if (manaMul !== ONE) return "Đối cực hợp nhất";
  return t === COMBO.pure ? "Thuần" : t === COMBO.harmony ? "Tương sinh/hợp" : t === COMBO.clash ? "Tương khắc" : "Trung tính";
}

mkdirSync(OUT, { recursive: true });
const t0 = performance.now();
const progress = (label: string) => console.log(`${label} (${Math.round((performance.now() - t0) / 1000)} giây)`);
console.log(`Cân bằng: ${PAIRS} cặp đội mỗi ô, mỗi cặp 2 trận`);

// Ba bảng lựa chọn, mỗi đội mẫu đánh đội ngẫu nhiên cùng sức.
interface Choice { table: string; label: string; cell: Cell }
const choices: Choice[] = [];

const byElement = ELEMENTS.map((e) => ({ e, cell: play(`he:${e}`, { element: e }, {}) }));
writeCsv("theo_he.csv", ["Hệ", "Mã", ...CELL_HEAD], byElement.map(({ e, cell }) => [ELEMENT_NAMES[e], e, ...cellCols(cell)]));
for (const { e, cell } of byElement) choices.push({ table: "Hệ", label: ELEMENT_NAMES[e], cell });
progress("Xong theo hệ");

const byType = SKILL_TYPES.map((t) => ({ t, cell: play(`loai:${t}`, { firstType: t }, {}) }));
writeCsv("theo_loai_chieu.csv", ["Loại chiêu ở ưu tiên 1", "Mã", ...CELL_HEAD], byType.map(({ t, cell }) => [SKILL_TYPE_NAMES[t], t, ...cellCols(cell)]));
for (const { t, cell } of byType) choices.push({ table: "Loại chiêu", label: SKILL_TYPE_NAMES[t], cell });
progress("Xong theo loại chiêu");

const combos = ELEMENTS.flatMap((x) => ELEMENTS.map((z) => ({ x, z, cell: play(`tohop:${x}:${z}`, { element: x, sub: z }, {}) })));
writeCsv(
  "theo_to_hop.csv",
  ["Hệ chủ", "Hệ phụ", "Quan hệ", "Hệ số tổ hợp", "Mana ×", ...CELL_HEAD],
  combos.map(({ x, z, cell }) => {
    const rel = comboRelation(x, z);
    return [ELEMENT_NAMES[x], ELEMENT_NAMES[z], relationName(x, z), (rel.t / ONE).toFixed(2), (rel.manaMul / ONE).toFixed(1), ...cellCols(cell)];
  }),
);
for (const { x, z, cell } of combos) choices.push({ table: "Tổ hợp", label: `${ELEMENT_NAMES[x]} + ${ELEMENT_NAMES[z]}`, cell });
progress("Xong theo tổ hợp hệ chủ–phụ");

// Khắc hệ: đội hệ X yếu hơn `weaker` đánh đội hệ Y đủ sức, với mọi X đánh Y ×1,5.
const counters = ELEMENTS.flatMap((y) =>
  ELEMENTS.filter((x) => x !== y && elementMultiplier(x, y) === KHAC).map((x) => ({
    x, y, oneWay: elementMultiplier(y, x) < KHAC, cell: play(`khac:${x}:${y}`, { element: x }, { element: y }, BALANCE.weaker),
  })),
);
writeCsv(
  "khac_che.csv",
  ["Hệ khắc (yếu hơn)", "Hệ bị khắc", "Loại", "Khắc đánh bị khắc ×", "Bị khắc đánh lại ×", ...CELL_HEAD],
  counters.map(({ x, y, oneWay, cell }) => [
    ELEMENT_NAMES[x], ELEMENT_NAMES[y], oneWay ? "Khắc một chiều" : "Đối cực hai chiều",
    (elementMultiplier(x, y) / ONE).toFixed(2), (elementMultiplier(y, x) / ONE).toFixed(2), ...cellCols(cell),
  ]),
);
progress("Xong khắc hệ");
const elapsedMs = performance.now() - t0;

// Bản tóm tắt.
const lines: string[] = [];
const say = (s = "") => lines.push(s);
const verdict = (ok: boolean) => (ok ? "ĐẠT" : "TRƯỢT");

say("# Kết quả cân bằng");
say();
say(
  `${BALANCE.teamSize} đấu ${BALANCE.teamSize}, cấp ${BALANCE.levelMin}–${BALANCE.levelMax} (hai đội cùng cấp), chỉ số chuẩn ±${BALANCE.statSpread / 10}% ` +
    `như nhau ở hai đội, mỗi người 4 công pháp chọn từ bộ truyền thụ của tông cấp ${BALANCE.sectLevel}. ` +
    `${PAIRS} cặp đội mỗi ô, mỗi cặp đánh hai lần đổi bên; hòa tính ${BALANCE.drawScore / 10}% trận thắng; seed ${BALANCE.seed}. ` +
    `Tham số ở tools/balance/config.ts.`,
);
say();

const perDefender = ELEMENTS.map((y) => {
  const list = counters.filter((c) => c.y === y);
  const best = list.length ? list.reduce((a, b) => (rate(b.cell) > rate(a.cell) ? b : a)) : undefined;
  return { y, best, ok: !!best && rate(best.cell) >= BALANCE.counterMin };
});
const pass1 = perDefender.every((d) => d.ok);
say(`## Tiêu chí 1: ${verdict(pass1)}`);
say();
say(
  `Đội hệ khắc yếu hơn ${BALANCE.weaker / 10}% (máu, công lực, phòng thủ) đánh đội hệ bị khắc đủ sức. ` +
    `Hệ nào cũng cần ít nhất một hệ khắc thắng ≥ ${BALANCE.counterMin / 10}%.`,
);
say();
say("| Hệ bị khắc | Hệ khắc tốt nhất | Đánh / bị đánh lại | Tỷ lệ thắng | |");
say("|---|---|---|---|---|");
for (const { y, best, ok } of perDefender) {
  if (!best) {
    say(`| ${ELEMENT_NAMES[y]} | không có | | | trượt |`);
    continue;
  }
  const mult = `×${vi((elementMultiplier(best.x, y) / ONE).toFixed(1))} / ×${vi((elementMultiplier(y, best.x) / ONE).toFixed(1))}`;
  say(`| ${ELEMENT_NAMES[y]} | ${ELEMENT_NAMES[best.x]} | ${mult} | ${showRate(best.cell)} | ${ok ? "đạt" : "trượt"} |`);
}
say();
const oneWay = counters.filter((c) => c.oneWay).reduce((acc, c) => addCell(acc, c.cell), emptyCell());
const twoWay = counters.filter((c) => !c.oneWay).reduce((acc, c) => addCell(acc, c.cell), emptyCell());
say(
  `Tham khảo, gộp các cặp: khắc một chiều (×1,5 / ×0,7, ${counters.filter((c) => c.oneWay).length} cặp) ${showRate(oneWay)}; ` +
    `đối cực hai chiều (×1,5 / ×1,5, ${counters.filter((c) => !c.oneWay).length} cặp) ${twoWay.n ? showRate(twoWay) : "không có"}.`,
);
say();

const over = choices.filter((c) => rate(c.cell) > BALANCE.choiceMax).sort((a, b) => rate(b.cell) - rate(a.cell));
say(`## Tiêu chí 2: ${verdict(over.length === 0)}`);
say();
say(
  `Đội mẫu đánh đội ngẫu nhiên cùng sức. Không lựa chọn nào được thắng quá ${BALANCE.choiceMax / 10}% ` +
    `(${choices.length} lựa chọn: 12 hệ, 10 loại chiêu ở ưu tiên 1, 144 tổ hợp hệ chủ–phụ).`,
);
say();
if (over.length) {
  say(`Vượt ${BALANCE.choiceMax / 10}% (${over.length} lựa chọn):`);
  say();
  say("| Bảng | Lựa chọn | Tỷ lệ thắng |");
  say("|---|---|---|");
  for (const c of over) say(`| ${c.table} | ${c.label} | ${showRate(c.cell)} |`);
  say();
}
const list = (items: { label: string; cell: Cell }[]) => items.map((i) => `${i.label} ${vi(pct(rate(i.cell)))}%`).join(", ");
say(`Theo hệ: ${list(byElement.map(({ e, cell }) => ({ label: ELEMENT_NAMES[e], cell })))}.`);
say();
say(`Theo loại chiêu ở ưu tiên 1: ${list(byType.map(({ t, cell }) => ({ label: SKILL_TYPE_NAMES[t], cell })))}.`);
say();
const relations: Record<string, Cell> = {};
for (const { x, z, cell } of combos) addCell((relations[relationName(x, z)] ??= emptyCell()), cell);
say(`Tổ hợp hệ chủ–phụ, gộp theo quan hệ: ${list(Object.entries(relations).map(([label, cell]) => ({ label, cell })))}.`);
say();
const sortedCombos = choices.filter((c) => c.table === "Tổ hợp").sort((a, b) => rate(b.cell) - rate(a.cell));
say(`Tổ hợp cao nhất: ${list(sortedCombos.slice(0, 5))}. Thấp nhất: ${list(sortedCombos.slice(-5).reverse())}.`);
say();

const even = choices.reduce((acc, c) => addCell(acc, c.cell), emptyCell());
say("## Số đo trận");
say();
say(`- Số trận: ${all.n.toLocaleString("vi-VN")} (${even.n.toLocaleString("vi-VN")} trận cùng sức, ${(all.n - even.n).toLocaleString("vi-VN")} trận khắc hệ).`);
say(`- Thời lượng trung bình: ${vi(seconds(even))} giây ở trận cùng sức, ${vi(seconds(all))} giây tính mọi trận.`);
say(`- Hòa vì hết giờ (${MAX_TICKS / TICKS_PER_SECOND} giây): ${vi(pct(timeoutRate(even)))}% ở trận cùng sức, ${vi(pct(timeoutRate(all)))}% tính mọi trận.`);
say(
  `- Thời gian: ${vi((simMs / all.n).toFixed(3))} ms/trận cho mô phỏng, ${vi((elapsedMs / all.n).toFixed(3))} ms/trận gồm cả dựng đội qua luật; ` +
    `tổng ${Math.round(elapsedMs / 1000)} giây trên 1 luồng.`,
);
say(`- Mã băm gộp mọi trận: ${hash.toString(16).padStart(8, "0")} (chạy lại cùng tham số phải ra cùng mã; thời gian thì đổi).`);
const simParams = { SKILL_SPECS, SKILL_RULES, BATTLE, UNIT_CURVE, ROOT_BUFFS, TALENT_RULES, VARIANT_STATS, ELEMENT_STATS, ELEMENT_EFFECTS, GRADE_POW, COMBO };
say(
  `- Tham số sim lúc đo: máu chuẩn ${UNIT_CURVE.hpBase} + ${vi((UNIT_CURVE.hpPerLevel / 10).toFixed(1))}% mỗi cấp, mana tối đa ${BATTLE.manaMax}, ` +
    `hồi ${BATTLE.manaRegenPerSec}/giây; mã băm các bảng trong packages/sim/src/config.ts: ${fnv(JSON.stringify(simParams)).toString(16).padStart(8, "0")}.`,
);
say();
say("File CSV cùng thư mục: theo_he.csv, theo_loai_chieu.csv, theo_to_hop.csv, khac_che.csv.");

writeFileSync(new URL("tom_tat.md", OUT), lines.join("\n") + "\n");
console.log();
console.log(lines.join("\n"));
