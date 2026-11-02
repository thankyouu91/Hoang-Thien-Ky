// Đầu vào mẫu cho trận thật của @ktlp/sim: 10 đấu 10 cùng cấp, mỗi người 2 công pháp ghép từ tàn quyển phẩm 3.
// Chỉ số do proto tự chọn để trận dài khoảng nửa phút tới một phút; đội hình thật sẽ lấy từ packages/rules.
import {
  composeTechnique, ELEMENTS, Rng, VARIANTS,
  type BattleInput, type Element, type SkillType, type Talent, type Technique, type UnitSpec,
} from "@ktlp/sim";

// Mỗi vị trí trong hàng: chiêu đặc biệt trước, chiêu thường sau (thứ tự ưu tiên), kèm tài năng hợp vai.
const FRONT: { types: SkillType[]; talent: Talent }[] = [
  { types: ["can_quet", "can_don"], talent: "tu_the" },
  { types: ["ho_the", "can_don"], talent: "tu_the" },
  { types: ["khong_che", "can_don"], talent: "tu_ren" },
  { types: ["than_phap", "can_don"], talent: "sat_thu" },
  { types: ["can_quet", "can_don"], talent: "tu_kim_tien" },
];
const BACK: { types: SkillType[]; talent: Talent }[] = [
  { types: ["dien_rong", "tam_xa"], talent: "tu_phap" },
  { types: ["bua_chu", "tam_xa"], talent: "tu_phap" },
  { types: ["tran_phap", "tam_xa"], talent: "tu_tran" },
  { types: ["hoi_phuc", "tam_xa"], talent: "tu_duoc" },
  { types: ["dien_rong", "tam_xa"], talent: "tu_dan" },
];

function technique(r: Rng, type: SkillType, element: Element): Technique {
  const sub = ELEMENTS[r.int(ELEMENTS.length)];
  return composeTechnique(
    { element, type, variant: VARIANTS[r.int(VARIANTS.length)], grade: 3 },
    [{ element: sub, type, variant: VARIANTS[r.int(VARIANTS.length)], grade: 3 }],
  );
}

export function sampleBattle(seed = 11): BattleInput {
  const r = new Rng(seed);
  const team = (base: number): UnitSpec[] =>
    [...FRONT, ...BACK].map((slot, i) => {
      const element = ELEMENTS[r.int(ELEMENTS.length)];
      return {
        id: base + i,
        level: 60,
        element,
        talents: [slot.talent],
        hp: 30000 + r.int(10000),
        atk: 800 + r.int(300),
        def: 600 + r.int(400),
        row: (i < FRONT.length ? 0 : 1) as 0 | 1,
        techniques: slot.types.map((t) => technique(r, t, element)),
      };
    });
  const teamA = team(1);
  const teamB = team(101);
  // Tông chủ đội A tung chiêu cuối một lần ở giây thứ 10.
  return { seed, teamA, teamB, commands: [{ tick: 200, unitId: teamA[0].id }] };
}
