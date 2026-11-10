// Tham số bãi quái mẫu (người dùng chốt 2026-11-09: đánh tay thời gian thực thay trận tự động). Mọi số là đề xuất, chưa có
// trong GDD; sửa ở đây. Toạ độ theo đơn vị thế giới của màn (1 ô sân của sim = 64 đơn vị).
import type { SkillType } from "@htk/sim";

export const BAI = {
  /** Cỡ bãi */
  w: 1400,
  h: 900,
  /** Cửa bãi: chỗ người chơi vào và hồi sinh */
  entry: { x: 120, y: 450 },
  /** Ô sân của sim ra đơn vị thế giới, để đổi tầm và bán kính chiêu (milli-ô) */
  cell: 64,

  /** Bầy quái: số bầy, số con mỗi bầy, bán kính đi loanh quanh quanh tổ, quá xa tổ thì bỏ đuổi về tổ */
  packs: 4,
  perPack: 6,
  roam: 130,
  leash: 360,
  /** Giây chờ hồi sinh sau khi chết */
  respawn: 6,
  /** Boss của khu (thủ lĩnh đứng một mình): bội máu, bội công, bội tu vi, giây hồi sinh */
  bossHp: 10,
  bossAtk: 2.2,
  bossTuVi: 12,
  bossRespawn: 90,
  /** Cấp quái của bãi mẫu (hang dị thú gần thành chủ) */
  level: 10,
  /** Quái theo cấp L: máu, công, giây giữa hai đòn, tốc độ đi loanh quanh và đuổi */
  monsterHp: (l: number) => 400 + 60 * l,
  monsterAtk: (l: number) => 20 + 4 * l,
  monsterHitEvery: 1.2,
  monsterWalk: 60,
  monsterChase: 120,
  /** Tu vi mỗi con theo cấp: chưa có bảng thưởng giết quái nên đề xuất 5 + 2 × cấp */
  tuVi: (l: number) => 5 + 2 * l,

  /** Người chơi và bot: máu, công, tốc độ, tầm và nhịp đánh thường, giây chờ hồi sinh */
  hp: 2000,
  atk: 100,
  speed: 170,
  meleeRange: 52,
  hitEvery: 1,
  revive: 3,

  /** Thanh chiêu: chiêu đánh và chiêu buff, định nghĩa lấy từ SKILL_SPECS của sim (Mana, hồi chiêu, tầm, hệ số) */
  skills: ["can_quet", "tam_xa", "dien_rong", "ho_the", "hoi_phuc"] as SkillType[],
  /** Sát thương chiêu = công × hệ số của SKILL_SPECS × chừng này (chiêu tay nên mạnh hơn đánh thường rõ) */
  skillScale: 2,
  /** Hồi phục: hồi chừng này phần máu tối đa. Hộ thể: khiên chừng này phần máu tối đa, giữ chừng này giây */
  healPct: 0.2,
  shieldPct: 0.25,
  shieldSec: 6,

  /** Chiêu cuối: thanh nội tại đầy sau chừng này sát thương gây ra; mở ở cấp 150 với 1 điểm, mỗi 10 cấp sau +1 điểm */
  ultFill: 4000,
  ultLevel: 150,
  ultEvery: 10,
  /** Hệ số sát thương (phần nghìn công) và bán kính; mỗi điểm sau điểm đầu cộng 10% */
  ultK: 5000,
  ultRadius: 220,
  ultPerPoint: 0.1,

  /** Bot (người chơi khác giả lập trong trình duyệt) */
  bots: ["Lạc Vân", "Tô Hàn", "Mạc Kỳ", "Diệp Thanh", "Hoa Ảnh", "Trần Phong", "Liễu Sương"],
};

/** Điểm chiêu cuối theo cấp: 0 dưới cấp 150, rồi 1 điểm và mỗi 10 cấp thêm 1. */
export function ultPoints(level: number): number {
  return level < BAI.ultLevel ? 0 : 1 + Math.floor((level - BAI.ultLevel) / BAI.ultEvery);
}
