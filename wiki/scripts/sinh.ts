// Sinh trang tra cứu (docs/tra-cuu/*.md) và đoạn chèn (docs/_sinh/*.md) từ số liệu game data/he_thong/json, rồi chép
// đúng những hình được dùng từ assets/icon_ve và assets/pixellab sang docs/public/hinh. Ba thư mục đó không commit
// (wiki/.gitignore): chạy lại mỗi lần build, nên số trên wiki luôn khớp số game.
//
// Đơn vị JSON như packages/sim: phần nghìn (1000 = 100% hoặc ×1), 20 tick = 1 giây, 1000 milli-ô = 1 ô.
// Cột nào trong file Excel số liệu còn ô vàng (đề xuất) thì tiêu đề cột mang nhãn thử nghiệm (scripts/deXuat.ts).
// Chạy: node scripts/sinh.ts   (npm run build tự chạy trước vitepress build)
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { TRANG_TRA_CUU } from "../docs/.vitepress/traCuu.ts";
import { docDeXuat, type BangDeXuat } from "./deXuat.ts";

const WIKI = join(import.meta.dirname, "..");
const REPO = join(WIKI, "..");
const JSON_DIR = join(REPO, "data/he_thong/json");
const ASSETS = join(REPO, "assets");
const DOCS = join(WIKI, "docs");
const SINH = join(DOCS, "_sinh");
const TRA = join(DOCS, "tra-cuu");
const HINH = join(DOCS, "public/hinh");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const doc = (f: string): Any => JSON.parse(readFileSync(join(JSON_DIR, f), "utf8"));

const D = {
  he: doc("he.json"),
  khac: doc("khac_che.json"),
  chieu: doc("loai_chieu.json"),
  bien: doc("bien_the.json"),
  tq: doc("tan_quyen.json") as Any[],
  cpm: doc("cong_phap_mau.json") as Any[],
  pham: doc("pham.json") as Any[],
  qh: doc("quan_he_to_hop.json"),
  toHop: doc("to_hop.json"),
  viDien: doc("vi_dien.json"),
  vung: doc("vung.json"),
  taiNang: doc("tai_nang.json"),
  capTm: doc("cap_tong_mon.json") as Any[],
  mo: doc("mo.json") as Any[],
  biCanh: doc("bi_canh.json"),
  tb: doc("trang_bi.json"),
  vuKhi: doc("vu_khi.json"),
  ngoc: doc("ngoc.json"),
  set: doc("set.json"),
  pb: doc("phap_bao.json"),
  pk: doc("phap_khi.json"),
  vp: doc("vat_pham.json"),
  linhDon: doc("linh_don.json"),
  thu: doc("thu_cuoi.json") as Any[],
  thuPham: doc("thu_pham.json"),
  thuCg: doc("thu_canh_gioi.json") as Any[],
};

const HE_ID = Object.keys(D.he);
const CHIEU_ID = Object.keys(D.chieu);
const BIEN_ID = Object.keys(D.bien);

// ---------- định dạng ----------

const fmt = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const so = (n: number): string => fmt.format(n);
/** Phần nghìn → phần trăm. */
const pt = (pm: number): string => `${so(pm / 10)}%`;
/** Phần nghìn có dấu: +5%, −10%. */
const ptDau = (pm: number): string => `${pm > 0 ? "+" : "−"}${so(Math.abs(pm) / 10)}%`;
const heSo = (pm: number): string => `×${so(pm / 1000)}`;
const giay = (tick: number): string => `${so(tick / 20)} giây`;
const oDai = (milli: number): string => `${so(milli / 1000)} ô`;

/** Chữ từ dữ liệu vào ô bảng Markdown: thoát ký tự HTML và dấu |, bỏ ghi chú nội bộ trong ngoặc. */
function t(s: unknown): string {
  return sach(String(s ?? ""))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\|/g, "\\|")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

/**
 * Bỏ phần ngoặc chứa chữ nội bộ (GDD, đề xuất, chốt, "mục 13" trỏ vào GDD, sim…) khỏi chữ lấy từ dữ liệu.
 * Ranh giới chữ viết bằng \p{L} vì \b của JS chỉ hiểu chữ không dấu.
 */
const NOI_BO = /\s*\((?:[^()]*?(?<![\p{L}\p{N}])(?:GDD|đề xuất|đã chốt|chốt|chờ duyệt|người dùng|sim|code|MVP|prototype|tab|mục \d+)(?![\p{L}\p{N}])[^()]*?)\)/giu;
export function sach(s: string): string {
  return s.replace(NOI_BO, "").replace(/\s{2,}/g, " ");
}

const heTen = (id: string): string => D.he[id]?.name ?? id;
const he = (id: string): string => `<span class="he he-${id}">${t(heTen(id))}</span>`;
const chieuTen = (id: string): string => D.chieu[id]?.name ?? id;
const bienTen = (id: string): string => D.bien[id]?.name ?? id;
const doHiem = Object.fromEntries((D.tb.do_hiem as Any[]).map((x) => [x.id, x]));
const dh = (id: string): string => (doHiem[id] ? `<span class="dh dh-${id}">${t(doHiem[id].ten)}</span>` : t(id));
const tqTen = Object.fromEntries(D.tq.map((x) => [x.id, x.name]));
const phamTen = Object.fromEntries(D.pham.map((x) => [x.grade, x.name]));
const oTen = Object.fromEntries((D.tb.o as Any[]).map((x) => [x.id, x.ten]));
const khiHinh = Object.fromEntries((D.vuKhi.khi_hinh as Any[]).map((x) => [x.id, x]));
const taiNangTen = (id: string): string => D.taiNang[id]?.name ?? id;
const viDienTen = (id: string): string => D.viDien[id]?.name ?? id;

const BI_CANH_TEN = Object.fromEntries(Object.values(D.biCanh as Record<string, Any>).map((b) => [b.id, b.name]));
const NGUON: Record<string, string> = {
  ...BI_CANH_TEN,
  bao_giam_trang_tuan: "Thưởng tuần Bảo Giám",
  bi_canh_the_manh_cung_nghe: "Bí cảnh có thế mạnh cùng nghề",
  cho: "Chợ người chơi",
  cho_npc: "Chợ NPC",
  dan_phuong_dan_tien_dong_phu: "Đan phương từ Đan Tiên Động Phủ",
  diem_hoa_ngoc_cap_10: "Điểm hóa ngọc cấp 10",
  doi_cong_hien_khi_tong_giu_bi_canh: "Đổi cống hiến khi tông môn giữ bí cảnh",
  "ghep_10_MA-PB-001": "Ghép 10 mảnh trấn giáo",
  hop_ngoc: "Hợp ngọc",
  linh_duoc_vien: "Linh Dược Viên",
  luyen_dan: "Luyện đan",
  luyen_dan_cap_8_10: "Luyện đan cấp 8–10",
  luyen_danh_khi: "Luyện danh khí",
  mo_quang: "Mỏ quặng",
  nen_ngoc: "Nén ngọc",
  nhiem_vu: "Nhiệm vụ",
  phan_giai: "Phân giải đồ",
  ren_lo_1_4: "Rèn ở lò cấp 1–4",
  ren_lo_5_tro_len: "Rèn ở lò cấp 5 trở lên",
  ren_luyen_khi_cac: "Rèn ở Luyện Khí Các",
  roi_bi_canh: "Rơi trong bí cảnh",
  roi_bi_canh_cap_1_3: "Rơi trong bí cảnh cấp 1–3",
  roi_ngoai_bi_canh: "Rơi ngoài bí cảnh",
  san_di_thu: "Săn dị thú",
  san_linh_thu: "Săn linh thú",
  san_than_thu: "Săn thần thú",
  shop_npc: "Shop NPC ở thành chủ",
  theo_bac_an: "Theo bậc ấn",
  thuong_tien_thanh_chu: "Thượng tiên ở thành chủ",
  tu_ren_ren: "Người có tài năng Tu rèn rèn",
  yeu_trieu: "Yêu triều",
};
const thieuNguon = new Set<string>();
function nguon(x: unknown): string {
  const list = (Array.isArray(x) ? x : x == null ? [] : [x]) as string[];
  return list
    .map((c) => {
      if (NGUON[c]) return NGUON[c];
      if (/^[a-z0-9_]+$/.test(c)) {
        thieuNguon.add(c);
        return c.replace(/_/g, " ");
      }
      return sach(c);
    })
    .map(t)
    .join(", ");
}

// ---------- đề xuất ----------

let DE_XUAT: BangDeXuat = new Map();
/** Cột GDD ghi là đề xuất mà ô Excel chưa tô vàng (GDD mục 11: "tên và tỷ lệ rơi gốc dưới đây là đề xuất"). */
const DE_XUAT_THEM: Record<string, string[]> = { "Bí cảnh": ["Tỷ lệ rơi gốc"] };
const NHAN = ` <ThuNghiem text="thử nghiệm" />`;

/** Cột (sheet, tiêu đề Excel) có ô đề xuất mà giá trị hiện ra có chữ số. */
function laDeXuat(nguonCot: [string, string][] | undefined, giaTri: string[]): boolean {
  if (!nguonCot) return false;
  const coSo = giaTri.some((v) => /\d/.test(v.replace(/<[^>]+>/g, "")));
  if (!coSo) return false;
  return nguonCot.some(([sheet, h]) => {
    if (DE_XUAT_THEM[sheet]?.includes(h)) return true;
    if (!DE_XUAT.size) return false;
    const cots = DE_XUAT.get(sheet);
    if (!cots) canhBao.add(`Không có sheet "${sheet}" trong file Excel số liệu`);
    else if (!cots.has(h)) canhBao.add(`Sheet "${sheet}" không có cột "${h}" (có: ${[...cots.keys()].join(" / ")})`);
    const c = cots?.get(h);
    return !!c && c.so + c.chu > 0;
  });
}

// ---------- bảng ----------

interface Cot<T> {
  ten: string;
  lay: (r: T) => string;
  /** Ô Excel nguồn: [sheet, tiêu đề cột]. */
  nguon?: [string, string][];
}

/** Chữ không dấu, nối gạch: "Kiếm Thanh Cương" → "kiem-thanh-cuong". */
export function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
/** Neo đã dùng trong trang đang sinh (xóa trước mỗi trang). */
const NEO = new Set<string>();
function neoMoi(ten: string): string {
  const goc = slug(ten) || "muc";
  let id = goc;
  for (let i = 2; NEO.has(id); i++) id = `${goc}-${i}`;
  NEO.add(id);
  return id;
}

/**
 * Bảng Markdown. `neo` (chỉ dùng ở trang tra cứu): mỗi dòng mang một neo theo tên món, để ô tìm kiếm trả về đúng dòng
 * (docs/.vitepress/timKiem.ts tách mỗi dòng có neo thành một kết quả) và để dẫn link thẳng tới món.
 */
function bang<T>(rows: T[], cots: Cot<T>[], neo?: (r: T) => string): string {
  const o = rows.map((r) => cots.map((c) => c.lay(r)));
  if (neo) rows.forEach((r, i) => (o[i][0] = `<span class="neo" id="${neoMoi(neo(r))}"></span>${o[i][0]}`));
  const dau = cots.map((c, i) => c.ten + (laDeXuat(c.nguon, o.map((x) => x[i])) ? NHAN : ""));
  const dong = (cells: string[]) => `| ${cells.map((x) => x || " ").join(" | ")} |`;
  return [dong(dau), dong(cots.map(() => "---")), ...o.map(dong)].join("\n");
}

const canhBao = new Set<string>();
const hinhDung = new Set<string>(); // đường dẫn tương đối trong assets/, vd icon_ve/trang_bi/kiem/01.webp

/** Icon vẽ theo mã vật phẩm (assets/icon_ve). Món chưa vẽ thì ô trống cùng nền độ hiếm. */
const ICON = new Map<string, string>();
{
  const man = JSON.parse(readFileSync(join(ASSETS, "icon_ve/manifest.json"), "utf8"));
  for (const a of man.assets ?? []) if (a.ma_vp && a.file && existsSync(join(ASSETS, "icon_ve", a.file))) ICON.set(a.ma_vp, a.file);
  const ds = JSON.parse(readFileSync(join(ASSETS, "icon_ve/danh_sach.json"), "utf8"));
  for (const i of ds.icon ?? []) {
    const f = `${i.ma}.webp`;
    if (i.ma_vp && !ICON.has(i.ma_vp) && existsSync(join(ASSETS, "icon_ve", f))) ICON.set(i.ma_vp, f);
  }
}

function anh(rel: string, alt = ""): string {
  hinhDung.add(rel);
  return `<img src="/hinh/${rel}" alt="${t(alt)}" loading="lazy" width="40" height="40">`;
}
function oHinh(ma: string | null, doHiemId?: string, alt = ""): string {
  const f = ma ? ICON.get(ma) : undefined;
  const lop = `o-hinh${doHiemId ? ` dh-${doHiemId}` : ""}`;
  return `<span class="${lop}">${f ? anh(`icon_ve/${f}`, alt) : ""}</span>`;
}
function oFile(rel: string, lop = "", alt = ""): string {
  if (!existsSync(join(ASSETS, rel))) return `<span class="o-hinh ${lop}"></span>`;
  return `<span class="o-hinh ${lop}">${anh(rel, alt)}</span>`;
}

function trang(tieuDe: string, moTa: string, than: string): string {
  return `---
title: ${JSON.stringify(tieuDe)}
description: ${JSON.stringify(moTa)}
---

<!-- Trang sinh tự động bởi wiki/scripts/sinh.ts từ data/he_thong/json. Đừng sửa tay: sửa số liệu rồi build lại. -->

# ${tieuDe}

${than.trim()}
`;
}

const GHI_CHU_SO_LIEU = `::: info Số liệu
Bảng sinh thẳng từ số liệu của bản chơi thử hiện hành, nên khớp với game. Cột gắn nhãn <ThuNghiem text="thử nghiệm" /> là số đang thử, có thể đổi ở bản sau.
:::`;

function nhay(muc: { ten: string; id: string }[]): string {
  return `<ul class="nhay">${muc.map((m) => `<li><a href="#${m.id}">${t(m.ten)}</a></li>`).join("")}</ul>`;
}
/** Tiêu đề có id cố định (không dấu) để nhảy tới. */
const tieuDeId = (cap: number, ten: string, id: string): string => `${"#".repeat(cap)} ${ten} {#${id}}`;

// ---------- đoạn chèn ----------

const HIEU_UNG: Record<string, (e: Any) => string> = {
  kim: (e) => `Xuyên giáp ${pt(e.value)}`,
  moc: (e) => `Trói chân ${giay(e.value)}`,
  thuy: (e) => `Làm chậm ${pt(e.value)} trong ${giay(e.ticks)}`,
  hoa: (e) => `Thiêu đốt ${pt(e.value)} sát thương đòn mỗi giây, trong ${giay(e.ticks)}`,
  tho: (e) => `Khiên cho bản thân bằng ${pt(e.value)} máu tối đa`,
  loi: (e) => `Tê liệt ${giay(e.value)} khi chí mạng`,
  phong: (e) => `Đẩy lùi ${oDai(e.value)}`,
  quang: (e) => `Hồi máu bằng ${pt(e.value)} sát thương gây ra`,
  am_lanh: (e) => `Hút máu ${pt(e.value)}`,
  cuc_duong: (e) => `Xuyên kháng ${pt(e.value)}`,
  cuc_am: (e) => `Giảm ${pt(e.value)} hồi máu của mục tiêu trong ${giay(e.ticks)}`,
  cuc_han: (e) => `${pt(e.value)} cơ hội đóng băng ${giay(e.ticks)}`,
};
function chiSoHe(s: Any): string {
  const out: string[] = [];
  if (s.dmg) out.push(`Sát thương ${ptDau(s.dmg)}`);
  if (s.crit) out.push(`Chí mạng ${ptDau(s.crit)}`);
  if (s.cd) out.push(`Hồi chiêu ${ptDau(s.cd)}`);
  if (s.mana) out.push(`Tốn mana ${ptDau(s.mana)}`);
  if (s.range) out.push(`Tầm +${oDai(s.range)}`);
  return out.join("; ") || "—";
}

const doanHe = (): string =>
  bang(HE_ID.map((id) => D.he[id]), [
    { ten: "Hệ", lay: (x) => `${he(x.id)}<small>${t(x.group)}</small>` },
    { ten: "Bản sắc", lay: (x) => t(x.identity) },
    { ten: "Hiệu ứng riêng", lay: (x) => t(HIEU_UNG[x.id]?.(x.effect) ?? x.effect.desc), nguon: [["Hệ", "Giá trị hiệu ứng"], ["Hệ", "Thời gian hiệu ứng (giây)"]] },
    {
      ten: "Chỉ số chiêu · Linh căn trùng hệ",
      lay: (x) => `${t(chiSoHe(x.stats))}<small>Linh căn: ${t(x.rootBuff.desc)} ${ptDau(x.rootBuff.value)}</small>`,
      nguon: [["Hệ", "Chỉ số kèm: sát thương"], ["Hệ", "Chỉ số kèm: chí mạng"], ["Hệ", "Chỉ số kèm: hồi chiêu"], ["Hệ", "Chỉ số kèm: mana"], ["Hệ", "Giá trị buff"]],
    },
  ]);

function doanKhacChe(): string {
  return bang(HE_ID, [
    { ten: "Hệ đánh", lay: (a) => he(a) },
    {
      ten: "Đánh mạnh vào",
      lay: (a) =>
        Object.entries(D.khac[a] as Record<string, number>)
          .filter(([, v]) => v > 1000)
          .sort((x, y) => y[1] - x[1])
          .map(([b, v]) => `${he(b)} ${heSo(v)}`)
          .join("<br>") || "—",
      nguon: HE_ID.map((h) => ["Khắc chế", heTen(h)] as [string, string]),
    },
    {
      ten: "Đánh yếu vào",
      lay: (a) =>
        Object.entries(D.khac[a] as Record<string, number>)
          .filter(([, v]) => v < 1000)
          .sort((x, y) => x[1] - y[1])
          .map(([b, v]) => `${he(b)} ${heSo(v)}`)
          .join("<br>") || "—",
    },
  ]);
}

function maTranKhacChe(): string {
  const dau = `| Đánh \\ Bị đánh | ${HE_ID.map((b) => t(D.he[b].short ?? heTen(b))).join(" | ")} |`;
  const ke = `| --- | ${HE_ID.map(() => ":-:").join(" | ")} |`;
  const dong = HE_ID.map((a) => `| ${he(a)} | ${HE_ID.map((b) => (D.khac[a][b] === 1000 ? "·" : `**${so(D.khac[a][b] / 1000)}**`)).join(" | ")} |`);
  return [dau, ke, ...dong].join("\n");
}

const doanLoaiChieu = (): string =>
  bang(CHIEU_ID.map((id) => D.chieu[id]), [
    {
      ten: "Loại chiêu",
      lay: (x) => `${oFile(`icon_ve/chieu/${x.id}.webp`, "", x.name)} **${t(x.name)}**<small>đuôi tên: ${t(x.suffix)}</small>`,
    },
    {
      ten: "Mục tiêu · tầm",
      lay: (x) =>
        `${x.ally ? "Đồng đội" : "Địch"}: ${x.targets}<small>Tầm ${oDai(x.range)}${x.radius ? `, vùng ${oDai(x.radius)}` : ""}</small>`,
      nguon: [["Loại chiêu", "Số mục tiêu"], ["Loại chiêu", "Tầm (ô)"]],
    },
    {
      ten: "Hồi chiêu · mana",
      lay: (x) =>
        `${giay(x.cooldownTicks)}<small>Mana ${so(x.mana)}${x.critPerMille ? `, chí mạng ${ptDau(x.critPerMille)}` : ""}</small>`,
      nguon: [["Loại chiêu", "Hồi chiêu (giây)"], ["Loại chiêu", "Mana"]],
    },
    {
      ten: "Luật riêng",
      lay: (x) =>
        `${t(x.rule)}<small>${x.loai_sat_thuong === "ngoai" ? "Sát thương ngoại" : x.loai_sat_thuong === "noi" ? "Sát thương nội" : "Không gây sát thương"} · hệ số ${heSo(x.k)}</small>`,
      nguon: [["Loại chiêu", "Hệ số sát thương k"]],
    },
  ]);

function moTaBien(x: Any): string {
  const out: string[] = [];
  if (x.dmg) out.push(`Sát thương ${ptDau(x.dmg)}`);
  if (x.cd) out.push(`Hồi chiêu ${ptDau(x.cd)}`);
  if (x.crit) out.push(`Chí mạng ${ptDau(x.crit)}`);
  if (x.mana) out.push(`Mana ${ptDau(x.mana)}`);
  if (x.effectPower !== 1000) out.push(`Sức hiệu ứng hệ ${heSo(x.effectPower)}`);
  return out.join("; ") || "—";
}
const doanBienThe = (): string =>
  bang(BIEN_ID.map((id) => D.bien[id]), [
    { ten: "Biến thể", lay: (x) => `**${t(x.name)}**` },
    { ten: "Thay đổi so với chiêu gốc", lay: (x) => t(moTaBien(x)), nguon: [["Biến thể", "Sát thương"], ["Biến thể", "Hồi chiêu"]] },
  ]);

const roiVd = (drop: Record<string, number>): string =>
  Object.entries(drop)
    .map(([vd, v]) => `${t(viDienTen(vd))} ${pt(v)}`)
    .join("<br>");
const doanPham = (): string =>
  bang(D.pham, [
    { ten: "Phẩm", lay: (x) => `**${t(x.name)}**<small>${t(x.techniqueName)}</small>` },
    {
      ten: "Vị diện · cấp học",
      lay: (x) => `${t(x.plane)}<small>${x.learnLevel ? `từ cấp ${x.learnLevel}` : "không còn cấp"}</small>`,
      nguon: [["Phẩm", "Cấp học được ở vị diện đó"]],
    },
    { ten: "Sức mạnh", lay: (x) => heSo(x.power), nguon: [["Phẩm", "Hệ số sát thương"]] },
    { ten: "Tỷ lệ rơi · cống hiến", lay: (x) => `${roiVd(x.drop)}<small>Cống hiến ${so(x.contribution)}</small>`, nguon: [["Phẩm", "Rơi ở Hạ vị"]] },
  ]);

const doanQuanHe = (): string =>
  bang(Object.values(D.qh as Record<string, Any>), [
    { ten: "Quan hệ", lay: (x) => `**${t(x.name)}**` },
    { ten: "Khi nào", lay: (x) => t(x.rule) },
    {
      ten: "Hệ số công pháp",
      lay: (x) => `${heSo(x.t)}${x.manaMul !== 1000 ? `<small>Mana ${heSo(x.manaMul)}</small>` : ""}`,
      nguon: [["Quan hệ tổ hợp", "Hệ số tổ hợp t"]],
    },
  ]);

const vungTheo = (vd: string): Any[] => Object.values(D.vung as Record<string, Any>).filter((v) => v.plane === vd).sort((a, b) => a.ring - b.ring);

/** Bản đồ điểm thật của 12 vùng Hạ vị (data/maps/ha_diem_<vùng>.json, tools/mapgen sinh). Vùng cấm không đưa lên wiki. */
interface VungBanDo {
  code: string;
  name: string;
  element: string;
  thanhChu: string;
  diem: number;
  dem: Record<string, number>;
}
const BAN_DO_HA: VungBanDo[] = (() => {
  const vd = JSON.parse(readFileSync(join(REPO, "data/maps/ha_vi_dien.json"), "utf8"));
  return (vd.regions as Any[]).map((r) => {
    const d = JSON.parse(readFileSync(join(REPO, "data/maps", r.file), "utf8"));
    return { code: r.code, name: r.name, element: r.element, thanhChu: r.capital?.name ?? "", diem: d.points.length, dem: d.counts ?? {} };
  });
})();
const tbHa = (f: (v: VungBanDo) => number): number => Math.round(BAN_DO_HA.reduce((s, v) => s + f(v), 0) / BAN_DO_HA.length);
/** Số đo trên bản đồ thật thay cho số ước lượng trong vi_dien.json (Hạ vị đã có bản đồ; vị diện trên chưa có). */
function soVung(x: Any): { diem: number; biCanh: number; mo: Record<string, number>; theoBanDo: boolean } {
  if (x.id === "ha" && BAN_DO_HA.length) {
    return {
      diem: tbHa((v) => v.diem),
      biCanh: tbHa((v) => v.dem.cua_bi_canh ?? 0),
      mo: {
        linh_thach: tbHa((v) => v.dem.mo_linh_thach ?? 0),
        quang: tbHa((v) => v.dem.mo_quang ?? 0),
        duoc: tbHa((v) => v.dem.mo_duoc ?? 0),
        linh_tuyen: tbHa((v) => v.dem.linh_tuyen ?? 0),
      },
      theoBanDo: true,
    };
  }
  return { diem: x.pointsPerRegion, biCanh: x.secretRealmsPerRegion, mo: x.mines, theoBanDo: false };
}

const doanViDien = (): string =>
  bang(Object.values(D.viDien as Record<string, Any>), [
    { ten: "Vị diện", lay: (x) => `**${t(x.name)}**<small>Linh khí ${heSo(x.qi)}</small>`, nguon: [["Vị diện", "Linh khí"]] },
    {
      ten: "Vùng · điểm",
      lay: (x) => {
        const s = soVung(x);
        return `${x.regions} vùng<small>~${so(s.diem)} điểm, ~${s.biCanh} cửa bí cảnh mỗi vùng${s.theoBanDo ? " (đo trên bản đồ)" : ""}</small>`;
      },
      nguon: [["Vị diện", "Điểm cố định mỗi vùng (trung bình)"]],
    },
    {
      ten: "Mỏ mỗi vùng (trung bình)",
      lay: (x) => {
        const m = soVung(x).mo;
        return `${so(m.linh_thach)} linh thạch, ${so(m.quang)} quặng, ${so(m.duoc)} dược, ${so(m.linh_tuyen)} linh tuyền<small>Mỏ tối đa cấp ${x.maxMineLevel}; linh thạch ${t(x.stoneGrade)}</small>`;
      },
      nguon: [["Vị diện", "Mỏ linh thạch mỗi vùng (trung bình)"], ["Vị diện", "Mỏ quặng mỗi vùng"]],
    },
    {
      ten: "Cảnh giới · công pháp",
      lay: (x) => `${t(x.realms)}<small>Phẩm công pháp tối đa: ${t(phamTen[x.maxTechniqueGrade] ?? x.maxTechniqueGrade)}</small>`,
    },
  ]);

const heRoi = (v: Any): string =>
  Object.entries(v.dropWeights as Record<string, number>)
    .sort((a, b) => b[1] - a[1])
    .map(([h, w]) => `${he(h)} ${pt(w)}`)
    .join("<br>");
const bangVung = (vd: string): string =>
  bang(vungTheo(vd), [
    { ten: "Vùng", lay: (v) => `**${t(v.name)}**<small>thứ ${v.ring} trên vòng</small>` },
    { ten: "Hệ của vùng", lay: (v) => v.elements.map(he).join("<br>"), nguon: [["Vùng", "Hệ của vùng"]] },
    { ten: "Tàn quyển rơi theo hệ", lay: heRoi, nguon: [["Vùng", "Tỷ lệ hệ đầu (trống = chia đều)"]] },
  ]);

/** 12 vùng Hạ vị đếm trên bản đồ điểm thật: thành chủ, số điểm, mỏ, cửa bí cảnh, hang dị thú, vị trí sơn môn. */
const doanVungBanDo = (): string => {
  const thuTu = vungTheo("ha").map((v) => v.id);
  const ds = [...BAN_DO_HA].sort((a, b) => thuTu.indexOf(a.code) - thuTu.indexOf(b.code));
  return bang(ds, [
    { ten: "Vùng · thành chủ", lay: (v) => `**${t(v.name)}**<small>${he(v.element)}</small><small>${t(v.thanhChu)}</small>` },
    { ten: "Điểm", lay: (v) => `${so(v.diem)}<small>${so(v.dem.son_mon ?? 0)} chỗ đặt sơn môn</small>` },
    {
      ten: "Mỏ · nơi khác",
      lay: (v) =>
        `${so(v.dem.mo_linh_thach ?? 0)} linh thạch, ${so(v.dem.mo_quang ?? 0)} quặng, ${so(v.dem.mo_duoc ?? 0)} dược, ${so(v.dem.linh_tuyen ?? 0)} linh tuyền<small>${so(v.dem.cua_bi_canh ?? 0)} cửa bí cảnh, ${so(v.dem.hang_di_thu ?? 0)} hang dị thú, ${so(v.dem.deo ?? 0)} đèo, ${so(v.dem.ben_do ?? 0)} bến đò</small>`,
    },
  ]);
};

const doanKhiHinh = (): string =>
  bang(D.vuKhi.khi_hinh as Any[], [
    { ten: "Khí hình", lay: (x) => `**${t(x.ten)}**` },
    { ten: "Hợp loại chiêu", lay: (x) => t(chieuTen(x.loai_chieu)) },
    { ten: "Hình dáng", lay: (x) => t(x.mo_ta), nguon: [["Khí hình", "Mô tả"]] },
    { ten: "Số kiểu", lay: (x) => String(x.so_kieu), nguon: [["Khí hình", "Số kiểu vũ khí"]] },
  ]);

const doanVuKhiTaiNang = (): string =>
  bang(D.vuKhi.hinh_khi_cam as Any[], [
    { ten: "Tài năng", lay: (x) => `**${t(taiNangTen(x.tai_nang))}**` },
    { ten: "Cầm trên người", lay: (x) => t(x.ten) },
  ]);

const QH_NGAN: Record<string, string> = { thuan: "Thuần", tuong_sinh: "Sinh", tuong_hop: "Hợp", trung_tinh: "·", tuong_khac: "Khắc", doi_cuc: "Đối" };
/** Ma trận quan hệ khi ghép hệ chủ quyển (hàng) với hệ phụ quyển (cột). */
function doanToHop(): string {
  const dau = `| Chủ \\ Phụ | ${HE_ID.map((b) => t(D.he[b].short ?? heTen(b))).join(" | ")} |`;
  const ke = `| --- | ${HE_ID.map(() => ":-:").join(" | ")} |`;
  const dong = HE_ID.map((a) => `| ${he(a)} | ${HE_ID.map((b) => QH_NGAN[D.toHop.relation[a][b]] ?? t(D.toHop.relation[a][b])).join(" | ")} |`);
  return `${[dau, ke, ...dong].join("\n")}\n\nThuần: cùng hệ. Sinh: tương sinh. Hợp: tương hợp. Khắc: tương khắc. Đối: đối cực. Dấu chấm: trung tính.`;
}

/** Tên tàn quyển: phần đầu theo hệ và biến thể, phần cuối theo loại chiêu (đọc từ tên thật trong tan_quyen.json). */
function doanTenTanQuyen(): string {
  const dauTen = (h: string, b: string): string => {
    const x = D.tq.find((q) => q.element === h && q.variant === b && q.type === "can_don");
    const duoi = D.chieu.can_don.suffix as string;
    return x ? String(x.name).replace(new RegExp(`\\s*${duoi}$`), "") : "—";
  };
  // Phần cuối = tên trừ phần đầu (hệ × biến thể). Hầu hết các hệ dùng chung một đuôi; hệ nào khác thì ghi kèm.
  const duoiTen = (c: string): string => {
    const theoDuoi = new Map<string, Set<string>>();
    for (const q of D.tq.filter((x) => x.type === c)) {
      const dau = dauTen(q.element, q.variant);
      const duoi = String(q.name).startsWith(dau) ? String(q.name).slice(dau.length).trim() : String(q.name);
      if (!theoDuoi.has(duoi)) theoDuoi.set(duoi, new Set());
      theoDuoi.get(duoi)!.add(q.element);
    }
    const ds = [...theoDuoi].sort((a, b) => b[1].size - a[1].size);
    return ds.map(([duoi, hes], i) => (i === 0 ? duoi : `${duoi} (hệ ${[...hes].map(heTen).join(", ")})`)).join("; ");
  };
  const bangDau = bang(HE_ID, [{ ten: "Hệ", lay: (h) => he(h) }, ...BIEN_ID.map((b) => ({ ten: bienTen(b), lay: (h: string) => t(dauTen(h, b)) }))]);
  const bangDuoi = bang(CHIEU_ID, [
    { ten: "Loại chiêu", lay: (c) => `**${t(chieuTen(c))}**` },
    { ten: "Chữ cuối tên", lay: (c) => t(duoiTen(c)) },
  ]);
  return `${bangDau}\n\n${bangDuoi}`;
}

const doanTaiNang = (): string =>
  bang(Object.values(D.taiNang as Record<string, Any>), [
    { ten: "Tài năng", lay: (x) => `**${t(x.name)}**<small>Tỷ lệ ra ${pt(x.chance)}</small>`, nguon: [["Tài năng", "Tỷ lệ có"]] },
    { ten: "Chiến đấu", lay: (x) => t(x.combat), nguon: [["Tài năng", "Chiến đấu"]] },
    { ten: "Kinh tế", lay: (x) => t(x.economy), nguon: [["Tài năng", "Kinh tế"]] },
    { ten: "Đặc quyền", lay: (x) => t(x.privilege), nguon: [["Tài năng", "Đặc quyền"]] },
  ]);

const COT_CAP_TM: Cot<Any>[] = [
  { ten: "Cấp", lay: (x) => `**${x.level}**<small>${t(x.scale)}</small>` },
  {
    ten: "Đệ tử · lãnh thổ",
    lay: (x) =>
      `${x.members} đệ tử<small>Giữ tối đa ${x.maxPoints} điểm; Truyền Tống Trận tầm ${x.range} chặng${x.miniPortals ? `; ${x.miniPortals} tiểu Truyền Tống Trận` : ""}</small>`,
    nguon: [["Cấp tông môn", "Thành viên tối đa"], ["Cấp tông môn", "Điểm giữ tối đa (Hạ vị)"]],
  },
  {
    ten: "Chức vị · lực lượng",
    lay: (x) =>
      `${x.viceMasters} phó tông chủ, ${x.elders} trưởng lão, ${x.hallMasters} đường chủ<small>${x.combatNpcs} NPC chiến; ${x.transmissionSlots} suất công pháp truyền thụ</small>`,
  },
  {
    ten: "Mở khóa",
    lay: (x) => `${t(x.unlocks || "—")}<small>${x.xpToNext ? `Lên cấp kế: ${so(x.xpToNext)} kinh nghiệm` : "Cấp cao nhất"}${x.days ? ` · khoảng ${so(Math.round(x.days))} ngày từ lúc lập` : ""}</small>`,
    nguon: [["Cấp tông môn", "XP lên cấp kế"], ["Cấp tông môn", "Ngày ước tính"]],
  },
];
const doanCapTmMoc = (): string => bang(D.capTm.filter((x) => x.unlocks), COT_CAP_TM);

const COT_MO: Cot<Any>[] = [
  { ten: "Cấp mỏ", lay: (x) => `**${x.level}**` },
  { ten: "Mỗi giờ", lay: (x) => so(x.perHour), nguon: [["Mỏ", "Sản lượng mỗi giờ"]] },
  { ten: "Mỗi ngày", lay: (x) => so(x.perDay), nguon: [["Mỏ", "Sản lượng mỗi ngày"]] },
  { ten: "Phí nâng lên cấp kế", lay: (x) => (x.upgradeCost ? so(x.upgradeCost) : "—"), nguon: [["Mỏ", "Chi phí nâng lên cấp kế"]] },
];
const doanMoCap = (): string => bang(D.mo.slice(0, 10), COT_MO);

const doanBiCanh = (): string =>
  bang(Object.values(D.biCanh as Record<string, Any>), [
    { ten: "Bí cảnh", lay: (x) => `**${t(x.name)}**` },
    { ten: "Tỷ lệ rơi gốc", lay: (x) => pt(x.dropRate), nguon: [["Bí cảnh", "Tỷ lệ rơi gốc"]] },
    { ten: "Thế mạnh", lay: (x) => t(x.strength) },
    {
      ten: "Phần thưởng chia theo loại",
      lay: (x) => `Tàn quyển ${pt(x.share.tanQuyen)}<small>Linh cấp ${pt(x.share.linhCap)} · Thiên cấp ${pt(x.share.thienCap)} · Thần vật ${pt(x.share.thanVat)}</small>`,
      nguon: [["Bí cảnh", "Tàn quyển"], ["Bí cảnh", "Thần vật khi rơi"]],
    },
  ]);

const doanDoHiem = (): string =>
  bang(D.tb.do_hiem as Any[], [
    { ten: "Độ hiếm", lay: (x) => `${dh(x.id)}<small>bậc ${x.bac}</small>`, nguon: [["Độ hiếm", "Bậc"]] },
    { ten: "Chỉ số gốc", lay: (x) => heSo(x.he_so), nguon: [["Độ hiếm", "Hệ số chỉ số"]] },
    { ten: "Dòng khảm", lay: (x) => String(x.dong_kham), nguon: [["Độ hiếm", "Số dòng khảm"]] },
    { ten: "Lấy ở đâu", lay: (x) => t(x.nguon), nguon: [["Độ hiếm", "Nguồn"]] },
  ]);

const NL_TEN = new Map<string, string>([...(D.vp.nguyen_lieu as Any[])].map((x) => [x.ma_vp, x.ten]));
function congThucRen(ct: Record<string, number> | undefined): string {
  if (!ct) return "—";
  const TEN: Record<string, string> = { quang: "quặng", linh_moc: "linh mộc", yeu_thu_cot: "yêu thú cốt", da_thu: "da thú", tho_cam: "thổ cẩm", linh_ngoc: "linh ngọc" };
  return Object.entries(ct)
    .map(([k, v]) => `${v} ${TEN[k] ?? NL_TEN.get(k) ?? k.replace(/_/g, " ")}`)
    .join(", ");
}
const doanOTrangBi = (): string =>
  bang(D.tb.o as Any[], [
    { ten: "Ô", lay: (x) => `**${t(x.ten)}**${x.hien_tren_nguoi ? "" : "<small>không hiện trên người</small>"}` },
    {
      ten: "Chỉ số chính · phụ",
      lay: (x) => `${t(x.chinh.ten)} ${pt(x.chinh.gia_tri)}<small>${t(x.phu.ten)} ${pt(x.phu.gia_tri)} chỉ số chuẩn cùng cấp</small>`,
      nguon: [["Ô trang bị", "Chỉ số chính (theo chỉ số chuẩn cùng cấp)"], ["Ô trang bị", "Chỉ số phụ (theo chỉ số chuẩn cùng cấp)"]],
    },
    { ten: "Ngọc khảm vào", lay: (x) => (x.ngoc === "cong" ? "Ngọc công: tăng sát thương hệ" : "Ngọc thủ: tăng kháng hệ") },
    { ten: "Nguyên liệu rèn", lay: (x) => t(congThucRen(x.cong_thuc_ren)), nguon: [["Ô trang bị", "Công thức rèn (khóa: số lượng)"]] },
  ]);

const doanThuPham = (): string =>
  bang(Object.values(D.thuPham as Record<string, Any>), [
    { ten: "Phẩm", lay: (x) => `**${t(x.name)}**<small>${x.species} loài</small>`, nguon: [["Thú phẩm", "Số loài"]] },
    { ten: "Gặp ở", lay: (x) => t(x.habitat) },
    {
      ten: "Cộng chỉ số",
      lay: (x) => `+${so(x.statBonus)}% ở đỉnh<small>Luyện hóa thêm +${so(x.refineBonus)}%</small>`,
      nguon: [["Thú phẩm", "Cộng chỉ số mỗi thú ở đỉnh"]],
    },
    { ten: "Bán trên chợ", lay: (x) => t(x.market) },
  ]);

const doanThuCanhGioi = (): string =>
  bang(D.thuCg, [
    { ten: "Cảnh giới", lay: (x) => `**${t(x.name)}**<small>tầng ${x.fromStage}–${x.toStage}</small>` },
    { ten: "Mở khi chủ đạt", lay: (x) => `cấp ${x.unlockLevel}`, nguon: [["Thú cảnh giới", "Mở ở Hạ vị khi chủ đạt cấp"]] },
    {
      ten: "Tốc độ cưỡi · công thành",
      lay: (x) => `${heSo(x.speed)} tốc độ đi đường<small>Công thành ${so(x.siegePerMinute)} mỗi phút</small>`,
      nguon: [["Thú cảnh giới", "Tốc độ hành trình khi cưỡi"]],
    },
    {
      ten: "Đột phá",
      lay: (x) => (x.breakthroughChance ? `${pt(x.breakthroughChance)} thành công<small>cần Phá Cảnh Đơn cấp ${x.breakPillLevel}</small>` : "—"),
    },
  ]);

const doanLinhDon = (): string =>
  bang(Object.values(D.linhDon as Record<string, Any>), [
    { ten: "Linh đơn", lay: (x) => `**${t(x.name)}**<small>cấp ${t(x.levels)}</small>`, nguon: [["Linh đơn", "Cấp"]] },
    { ten: "Công dụng", lay: (x) => t(x.use), nguon: [["Linh đơn", "Công dụng"]] },
    { ten: "Nguyên liệu", lay: (x) => t(x.materials) },
    { ten: "Chợ", lay: (x) => t(x.market), nguon: [["Linh đơn", "Chợ"]] },
  ]);

const NHOM_DAN: Record<string, string> = { dan_duoc: "Đan dược", linh_dan: "Linh đan", than_dan: "Thần đan", dac_biet: "Đan đặc biệt" };
const COT_DAN: Cot<Any>[] = [
  { ten: "Hình", lay: (x) => oHinh(x.ma_vp, undefined, x.ten) },
  { ten: "Đan", lay: (x) => `**${t(x.ten)}**<small>${t(x.mo_ta)}</small>`, nguon: [["Đan", "Mô tả"]] },
  { ten: "Cấp", lay: (x) => t(x.cap ?? "—"), nguon: [["Đan", "Cấp"]] },
  { ten: "Nguồn", lay: (x) => `${nguon(x.nguon)}${x.khoa ? "<small>khóa vào nhân vật</small>" : ""}` },
];
function doanDanDuoc(): string {
  const nhom = [...new Set((D.vp.dan as Any[]).map((d) => d.nhom))];
  return nhom
    .map((n) => {
      const ds = (D.vp.dan as Any[]).filter((d) => d.nhom === n);
      return `**${NHOM_DAN[n] ?? n}** (${ds.length} loại)\n\n${bang(ds.slice(0, 8), COT_DAN)}${ds.length > 8 ? `\n\nCòn ${ds.length - 8} loại nữa ở [bảng đan dược đầy đủ](/tra-cuu/dan-duoc#${n.replace(/_/g, "-")}).` : ""}`;
    })
    .join("\n\n");
}

const doanNgocCap = (): string =>
  bang(D.ngoc.cap as Any[], [
    { ten: "Cấp", lay: (x) => `**${x.cap}**` },
    { ten: "Sát thương hoặc kháng hệ", lay: (x) => ptDau(x.gia_tri), nguon: [["Ngọc cấp", "Sát thương hoặc kháng hệ"]] },
    { ten: "Tỷ lệ nén lên cấp này", lay: (x) => (x.ty_le_nen_len == null ? "—" : pt(x.ty_le_nen_len)), nguon: [["Ngọc cấp", "Tỷ lệ nén lên cấp này"]] },
    { ten: "Giao dịch", lay: (x) => (x.khoa ? "Khóa vào nhân vật" : "Bán được") },
  ]);

const doanYChau = (): string =>
  bang(D.ngoc.y_chau as Any[], [
    { ten: "Hình", lay: (x) => oHinh(x.ma_vp, undefined, x.ten) },
    { ten: "Ý châu", lay: (x) => `**${t(x.ten)}**<small>${t(khiHinh[x.khi_hinh]?.ten ?? x.khi_hinh)} · ${t(chieuTen(x.loai_chieu))}</small>` },
    { ten: "Tác dụng", lay: (x) => t(x.mo_ta), nguon: [["Ý châu", "Mô tả"]] },
    { ten: "Nguồn", lay: (x) => `${nguon(x.nguon)}${x.ban_cho ? "" : "<small>không bán ở chợ</small>"}` },
  ]);

const doanBacAn = (): string =>
  bang(D.set.bac_an as Any[], [
    { ten: "Bậc", lay: (x) => dh(x.ma) },
    { ten: "Hệ số mốc 2, 4", lay: (x) => heSo(x.he_so), nguon: [["Bậc ấn", "Hệ số mốc 2, 4"]] },
    { ten: "Luật", lay: (x) => `${x.tinh_moc_7 ? "Tính mốc 7" : "Không tính mốc 7"}${x.ghep_len ? "; ghép 3 thành 1 lên bậc trên" : ""}<small>${x.giao_dich === "khoa" ? "Khóa vào nhân vật" : x.giao_dich === "ban_duoc" ? "Bán được" : "Không bán lại"}</small>` },
    { ten: "Nguồn", lay: (x) => t(x.nguon) },
  ]);

const doanBinhBo = (): string =>
  bang(D.set.binh_bo as Any[], [
    { ten: "Hình", lay: (x) => oHinh(x.an, undefined, x.ten) },
    { ten: "Binh bộ", lay: (x) => `**${t(x.ten)}**<small>${(x.lo as string[]).map((l) => t(LO[l] ?? l)).join(", ")}</small>` },
    { ten: "2 món", lay: (x) => t(x.moc_2.mo_ta), nguon: [["Binh bộ", "Mốc 2 (2 món)"]] },
    { ten: "3 món", lay: (x) => t(x.moc_3.mo_ta), nguon: [["Binh bộ", "Mốc 3 (đủ 3 món)"]] },
  ]);

const doanHopBo = (): string =>
  bang(D.set.hop_bo as Any[], [
    { ten: "Quan hệ", lay: (x) => `**${t(x.ten)}**` },
    {
      ten: "Mốc 2 nhân",
      lay: (x) => `${heSo(x.he_so)}${x.mana_max ? `<small>mana tối đa ${ptDau(x.mana_max)}</small>` : ""}`,
      nguon: [["Hợp bộ", "Mốc 2 nhân"], ["Hợp bộ", "Mana tối đa"]],
    },
    { ten: "Ghi chú", lay: (x) => t(x.mo_ta) },
  ]);

const doanPhu = (): string =>
  bang(D.vp.phu as Any[], [
    { ten: "Hình", lay: (x) => oHinh(x.ma_vp, undefined, x.ten) },
    { ten: "Phù", lay: (x) => `**${t(x.ten)}**<small>${t(x.mo_ta)}</small>`, nguon: [["Phù", "Mô tả"]] },
    { ten: "Nguồn", lay: (x) => nguon(x.nguon) },
  ]);

const doanNguyenLieu = (): string =>
  bang(D.vp.nguyen_lieu as Any[], [
    { ten: "Hình", lay: (x) => oHinh(x.ma_vp, undefined, x.ten) },
    { ten: "Nguyên liệu", lay: (x) => `**${t(x.ten)}**<small>${t(NHOM_NL[x.ma_vp.slice(0, 5)] ?? "")}</small>` },
    { ten: "Dùng để", lay: (x) => t(x.mo_ta), nguon: [["Nguyên liệu rèn", "Mô tả"]] },
    { ten: "Nguồn", lay: (x) => nguon(x.nguon) },
  ]);

// ---------- trang tra cứu ----------

function trangTanQuyen(): string {
  const moi = HE_ID.map((h) => {
    const ds = D.tq
      .filter((x) => x.element === h)
      .sort((a, b) => CHIEU_ID.indexOf(a.type) - CHIEU_ID.indexOf(b.type) || BIEN_ID.indexOf(a.variant) - BIEN_ID.indexOf(b.variant));
    const vungRoi = Object.values(D.vung as Record<string, Any>)
      .filter((v) => v.plane === "ha" && (v.dropWeights?.[h] ?? 0) > 0)
      .sort((a, b) => b.dropWeights[h] - a.dropWeights[h])
      .map((v) => `${t(v.name)} (${pt(v.dropWeights[h])})`);
    return `${tieuDeId(2, heTen(h), h.replace(/_/g, "-"))}

${oFile(`icon_ve/tan_quyen/${h}.webp`, "", `Tàn quyển ${heTen(h)}`)} ${ds.length} tàn quyển hệ ${he(h)}. Ở Hạ vị hay rơi ở: ${vungRoi.join(", ") || "—"}.

${bang(ds, [
  { ten: "Tàn quyển", lay: (x) => `**${t(x.name)}**` },
  { ten: "Loại chiêu", lay: (x) => t(chieuTen(x.type)) },
  { ten: "Biến thể", lay: (x) => t(bienTen(x.variant)) },
], (x) => x.name)}`;
  }).join("\n\n");
  return trang(
    "480 tàn quyển",
    "Bảng tra mọi tàn quyển theo 12 hệ, 10 loại chiêu và 4 biến thể, kèm vùng Hạ vị hay rơi.",
    `Mỗi tàn quyển là một tổ hợp hệ × loại chiêu × biến thể: ${HE_ID.length} hệ × ${CHIEU_ID.length} loại chiêu × ${BIEN_ID.length} biến thể = ${D.tq.length} tàn quyển. Cách ghép tàn quyển thành công pháp xem ở [Tàn quyển và công pháp](/cong-phap/); loại chiêu và biến thể xem ở [Loại chiêu và biến thể](/tra-cuu/chieu).

${GHI_CHU_SO_LIEU}

${nhay(HE_ID.map((h) => ({ ten: heTen(h), id: h.replace(/_/g, "-") })))}

${moi}`,
  );
}

function trangCongPhapMau(): string {
  const nhom = [...new Set(D.cpm.map((x) => x.group))];
  const id = (n: string) => (n.startsWith("3") ? "ba-quyen" : n.includes("thuần") ? "thuan-he" : "ghep-he");
  const tenNhom = (n: string) => (n.startsWith("3") ? "Ba quyển (tông môn cấp 100)" : n.includes("thuần") ? "Hai quyển thuần hệ" : "Hai quyển ghép hệ");
  const quyen = (q: string) => {
    const [h] = q.split(".");
    return `${he(h)} ${t(tqTen[q] ?? q)}`;
  };
  const than = nhom
    .map((n) => {
      const ds = D.cpm.filter((x) => x.group === n);
      return `${tieuDeId(2, tenNhom(n), id(n))}

${ds.length} công pháp.

${bang(ds, [
  { ten: "Công pháp", lay: (x) => `**${t(x.name)}**<small>${t(chieuTen(x.main.split(".")[1]))}</small>` },
  { ten: "Chủ quyển", lay: (x) => quyen(x.main) },
  { ten: "Phụ quyển", lay: (x) => x.subs.map(quyen).join("<br>") },
  { ten: "Phẩm", lay: (x) => t(phamTen[x.grade] ?? x.grade), nguon: [["Công pháp mẫu", "Phẩm"]] },
], (x) => x.name)}`;
    })
    .join("\n\n");
  return trang(
    "Công pháp ghép mẫu",
    "300 công pháp ghép sẵn làm ví dụ: chủ quyển, phụ quyển và phẩm.",
    `Đây là các công pháp ghép mẫu để tham khảo; tông môn của bạn tự ghép từ tàn quyển đang có. Luật ghép xem ở [Tàn quyển và công pháp](/cong-phap/).

${GHI_CHU_SO_LIEU}

${nhay(nhom.map((n) => ({ ten: tenNhom(n), id: id(n) })))}

${than}`,
  );
}

function trangHe(): string {
  return trang(
    "12 hệ và khắc chế",
    "Bản sắc, hiệu ứng riêng của 12 hệ, lợi ích linh căn và bảng khắc chế đầy đủ.",
    `Giải thích cách dùng hệ xem ở [12 hệ và khắc chế](/he/).

${GHI_CHU_SO_LIEU}

## Bản sắc từng hệ

${doanHe()}

## Khắc chế theo hệ

Hệ số nhân vào sát thương khi chiêu của hệ bên trái đánh trúng mục tiêu mang hệ đó.

${doanKhacChe()}

## Bảng khắc chế đầy đủ

Hàng là hệ đánh, cột là hệ bị đánh. Dấu chấm là ×1 (không khắc). Trên điện thoại, vuốt ngang để xem hết bảng.

${maTranKhacChe()}

## Ghép hai hệ trong một công pháp

${doanQuanHe()}`,
  );
}

function trangChieu(): string {
  return trang(
    "Loại chiêu và biến thể",
    "10 loại chiêu với mục tiêu, tầm, hồi chiêu, mana, luật riêng; 4 biến thể Bạo, Tốc, Linh, Bền.",
    `Giải thích cách chọn loại chiêu xem ở [10 loại chiêu](/chieu-thuc/).

${GHI_CHU_SO_LIEU}

## 10 loại chiêu

${doanLoaiChieu()}

## 4 biến thể

Mỗi tàn quyển mang một biến thể, đổi chút chỉ số so với chiêu gốc.

${doanBienThe()}`,
  );
}

function trangTrangBi(): string {
  const kieu = D.tb.kieu as Any[];
  const thuong = kieu.filter((k) => !/danh khí/i.test(k.mo_ta ?? "") && !(k.nguon ?? []).includes("luyen_danh_khi"));
  const danhKhi = kieu.filter((k) => !thuong.includes(k));
  const cot: Cot<Any>[] = [
    { ten: "Hình", lay: (x) => oHinh(x.ma_vp, x.do_hiem, x.ten) },
    {
      ten: "Tên",
      lay: (x) =>
        `**${t(x.ten)}**<small>${x.o === "vu_khi" && khiHinh[x.khi_hinh] ? `${t(khiHinh[x.khi_hinh].ten)} · ` : ""}${t(x.mo_ta)}</small>`,
    },
    { ten: "Độ hiếm", lay: (x) => dh(x.do_hiem) },
    { ten: "Nguồn", lay: (x) => nguon(x.nguon) },
  ];
  const oDs = D.tb.o as Any[];
  const than = oDs
    .map((o) => {
      const ds = thuong.filter((k) => k.o === o.id);
      const dem = (D.tb.do_hiem as Any[]).map((d) => `${ds.filter((k) => k.do_hiem === d.id).length} ${d.ten.toLowerCase()}`).join(", ");
      return `${tieuDeId(2, o.ten, o.id.replace(/_/g, "-"))}

${ds.length} kiểu (${dem}). Kiểu chỉ đổi hình và tên; chỉ số theo ô và độ hiếm.

${bang(ds, cot, (x) => x.ten)}`;
    })
    .join("\n\n");
  return trang(
    "Trang bị",
    "Mọi kiểu trang bị theo 7 ô và danh khí, có hình, độ hiếm và nguồn.",
    `Luật trang bị, rèn và độ bền xem ở [Trang bị](/trang-bi/). Độ hiếm là màu nền ô: Lục < Lam < Tím < Vàng < Đỏ. Món chưa có hình hiện ô trống.

${GHI_CHU_SO_LIEU}

${nhay([...oDs.map((o) => ({ ten: o.ten, id: o.id.replace(/_/g, "-") })), ...(danhKhi.length ? [{ ten: "Danh khí", id: "danh-khi" }] : [])])}

## Chỉ số theo ô

${doanOTrangBi()}

## Độ hiếm

${doanDoHiem()}

${than}

${danhKhi.length ? `${tieuDeId(2, "Danh khí", "danh-khi")}\n\nThần binh có tên, luyện từ đồ phổ danh khí. Mỗi món có một danh văn riêng.\n\n${bang(danhKhi, cot, (x) => x.ten)}` : ""}`,
  );
}

function giaTriDonVi(v: number, donVi: string): string {
  if (donVi === "phan_nghin") return pt(v);
  if (donVi === "tick") return giay(v);
  if (donVi === "o") return `${so(v)} ô`;
  return so(v);
}
const doanTranGiao = (): string =>
  bang(D.pb.tran_giao as Any[], [
    { ten: "Hình", lay: (x) => oHinh(x.ma_vp, undefined, x.ten) },
    { ten: "Pháp bảo trấn giáo", lay: (x) => `**${t(x.ten)}**` },
    { ten: "Tác dụng", lay: (x) => t(x.mo_ta), nguon: [["Pháp bảo trấn giáo", "Mô tả"]] },
    { ten: "Nguồn", lay: (x) => nguon(x.nguon) },
  ]);

function trangPhapBao(): string {
  const loai = D.pb.loai as Any[];
  const mon = D.pb.mon as Any[];
  const bangLoai = bang(loai, [
    { ten: "Loại", lay: (x) => `**${t(x.ten)}**<small>khắc ${t(chieuTen(x.khac_loai_chieu))}</small>` },
    { ten: "Kích hoạt khi", lay: (x) => t(x.kich_hoat), nguon: [["Pháp bảo loại", "Kích hoạt khi"]] },
    { ten: "Hiệu ứng", lay: (x) => t(x.hieu_ung) },
    {
      ten: "Số theo độ hiếm",
      lay: (x) =>
        `${t(x.chinh.ten)}: ${x.chinh.theo_do_hiem.map((v: number) => giaTriDonVi(v, x.chinh.don_vi)).join(" / ")}<small>${x.so_lan_moi_tran} lần mỗi trận, hồi ${giay(x.hoi_chieu_ticks)}</small>`,
      nguon: [["Pháp bảo loại", "Chỉ số chính · Lục"], ["Pháp bảo loại", "Số lần mỗi trận"]],
    },
  ]);
  const than = loai
    .map((l) => {
      const ds = mon.filter((m) => m.loai === l.id);
      if (!ds.length) return "";
      return `${tieuDeId(3, l.ten, `pb-${l.id}`)}

${bang(ds, [
  { ten: "Hình", lay: (x) => oHinh(x.ma_vp, x.do_hiem, x.ten) },
  { ten: "Pháp bảo", lay: (x) => `**${t(x.ten)}**<small>${t(x.mo_ta)}</small>` },
  {
    ten: "Chỉ số",
    lay: (x) =>
      `${dh(x.do_hiem)} ${t(x.chinh.ten)} ${giaTriDonVi(x.chinh.gia_tri, x.chinh.don_vi)}<small>${x.phu?.so_lan_moi_tran ?? "?"} lần mỗi trận · hồi ${giay(x.phu?.hoi_chieu_ticks ?? 0)} · linh lực ${x.phu?.linh_luc_toi_da ?? "?"}</small>`,
    nguon: [["Pháp bảo", "Giá trị chính"], ["Pháp bảo", "Linh lực tối đa"]],
  },
  { ten: "Nguồn", lay: (x) => `${nguon(x.nguon)}${x.khoa ? "<small>khóa vào nhân vật</small>" : ""}` },
], (x) => x.ten)}`;
    })
    .filter(Boolean)
    .join("\n\n");
  const tranGiao = doanTranGiao();
  return trang(
    "Pháp bảo",
    "10 loại pháp bảo, từng món theo độ hiếm và pháp bảo trấn giáo của tông môn.",
    `Pháp bảo nằm ở ô riêng, tự kích hoạt trong trận khi gặp đúng điều kiện. Mỗi loại khắc một loại chiêu của địch. Cách chọn xem ở [Pháp bảo và pháp khí](/trang-bi/phap-bao).

${GHI_CHU_SO_LIEU}

## 10 loại pháp bảo

${bangLoai}

## Từng món

${than}

## Pháp bảo trấn giáo

Đặt ở Chính Điện của tông môn, không phải đồ cá nhân.

${tranGiao}`,
  );
}

function trangPhapKhi(): string {
  const mon = D.pk.mon as Any[];
  const loai = [...new Set(mon.map((m) => m.loai))];
  const than = loai
    .map(
      (l) => `${tieuDeId(2, l, `pk-${loai.indexOf(l) + 1}`)}

${bang(mon.filter((m) => m.loai === l), [
  { ten: "Hình", lay: (x) => oHinh(x.ma_vp, x.do_hiem, x.ten) },
  { ten: "Pháp khí", lay: (x) => `**${t(x.ten)}**<small>Hợp tài năng ${t(taiNangTen(x.tai_nang_hop))} (×2)</small>` },
  { ten: "Tác dụng", lay: (x) => `${dh(x.do_hiem)} ${t(x.chinh.ten)} ${ptDau(x.chinh.gia_tri)}`, nguon: [["Pháp khí", "Giá trị chính"]] },
  { ten: "Nguồn", lay: (x) => nguon(x.nguon) },
], (x) => x.ten)}`,
    )
    .join("\n\n");
  return trang(
    "Pháp khí",
    "Pháp khí là công cụ ngoài trận: khai khoáng, dò đường, bày trận, luyện đan, rèn, thu hoạch, buôn bán.",
    `Pháp khí nằm ở một ô riêng, chỉ có tác dụng ngoài trận và không có độ bền. Ai cũng dùng được; người có đúng tài năng nhận gấp đôi. Xem thêm [Pháp bảo và pháp khí](/trang-bi/phap-bao).

${GHI_CHU_SO_LIEU}

${than}`,
  );
}

function trangNgoc(): string {
  const n = D.ngoc;
  return trang(
    "Ngọc",
    "Ngọc hệ 12 hệ và 10 cấp, Song Hệ Ngọc, Ngọc Phách, Ý châu, ấn bộ và binh ấn.",
    `Cách khảm và chọn ngọc xem ở [Ngọc và khảm](/trang-bi/ngoc).

${GHI_CHU_SO_LIEU}

${nhay([
  { ten: "Ngọc hệ", id: "ngoc-he" },
  { ten: "Cấp ngọc", id: "cap-ngoc" },
  { ten: "Song Hệ Ngọc", id: "song-he" },
  { ten: "Ngọc Phách", id: "ngoc-phach" },
  { ten: "Ý châu", id: "y-chau" },
  { ten: "Ấn bộ", id: "an-bo" },
  { ten: "Binh ấn", id: "binh-an" },
])}

${tieuDeId(2, "Ngọc hệ", "ngoc-he")}

Ngọc khảm vào ô công (vũ khí, bao tay, ngọc bội) tăng sát thương chiêu cùng hệ; khảm vào ô thủ (mũ, áo, đai, giày) tăng kháng hệ đó.

${bang(n.he as Any[], [
  { ten: "Hình", lay: (x) => oHinh(x.ma_vp, undefined, x.ten) },
  { ten: "Ngọc", lay: (x) => `**${t(x.ten)}**<small>${t(x.ten_han_viet)}</small>` },
  { ten: "Hệ", lay: (x) => he(x.he) },
  { ten: "Nguồn", lay: (x) => nguon(x.nguon) },
])}

${tieuDeId(2, "Cấp ngọc", "cap-ngoc")}

Nén ngọc cấp dưới để lên cấp trên; thất bại thì mất ngọc, trừ khi có Bảo Ngọc Phù.

${doanNgocCap()}

${tieuDeId(2, "Song Hệ Ngọc", "song-he")}

${bang(n.song_he as Any[], [
  { ten: "Hình", lay: (x) => oHinh(x.ma_vp, undefined, x.ten) },
  { ten: "Ngọc", lay: (x) => `**${t(x.ten)}**<small>Mỗi hệ bằng ${pt(x.moi_he)} một viên thường</small>`, nguon: [["Song hệ ngọc", "Mỗi hệ so với một viên thường"]] },
  { ten: "Cách có", lay: (x) => `${t(x.mo_ta)}<small>Tỷ lệ đậu ${pt(x.ty_le_dau)}</small>`, nguon: [["Song hệ ngọc", "Tỷ lệ đậu (cố định, không theo bảng nén)"]] },
])}

${tieuDeId(2, "Ngọc Phách", "ngoc-phach")}

${bang(n.phach as Any[], [
  { ten: "Hình", lay: (x) => oHinh(x.ma_vp, undefined, x.ten) },
  { ten: "Ngọc Phách", lay: (x) => `**${t(x.ten)}**` },
  { ten: "Hệ", lay: (x) => he(x.he) },
  {
    ten: "Tác dụng",
    lay: (x) => `Sát thương hệ ${ptDau(x.gia_tri)}<small>nâng trần sát thương hệ đó lên ${pt(x.tran_toi_da)}${x.khoa ? "; khóa vào nhân vật" : ""}</small>`,
    nguon: [["Ngọc Phách", "Sát thương hệ"], ["Ngọc Phách", "Trần sát thương hệ đó nâng lên"]],
  },
])}

${tieuDeId(2, "Ý châu", "y-chau")}

Chỉ khảm vào vũ khí, mỗi khí hình một viên, mạnh lên loại chiêu của khí hình đó.

${doanYChau()}

${tieuDeId(2, "Ấn bộ", "an-bo")}

Ấn bộ khảm vào dòng khảm để kích set. Hiệu ứng từng bộ xem ở [bảng set đồ](/tra-cuu/set-do).

${bang(n.an_bo as Any[], [
  { ten: "Hình", lay: (x) => oHinh(x.ma_vp, undefined, x.ten) },
  { ten: "Ấn", lay: (x) => `**${t(x.ten)}**${x.he ? `<small>${he(x.he)}</small>` : ""}` },
  { ten: "Nguồn", lay: (x) => `${nguon(x.nguon)}${x.ban_cho ? "" : "<small>không bán ở chợ</small>"}` },
])}

${tieuDeId(2, "Binh ấn", "binh-an")}

${bang(n.binh_an as Any[], [
  { ten: "Hình", lay: (x) => oHinh(x.ma_vp, undefined, x.ten) },
  { ten: "Binh ấn", lay: (x) => `**${t(x.ten)}**` },
  { ten: "Khảm vào", lay: (x) => (x.chi_kham_vao as string[]).map((o) => t(oTen[o] ?? o)).join(", ") },
  { ten: "Nguồn", lay: (x) => nguon(x.nguon) },
])}`,
  );
}

const LO: Record<string, string> = {
  kinh_te: "Kinh tế",
  hap_thu: "Hấp thu",
  thu_ngoai: "Thủ ngoại",
  ngoai_cong: "Ngoại công",
  phan_chan: "Phản chấn",
  noi_cong: "Nội công",
  thu_noi: "Thủ nội",
  khong_toc: "Khống tốc",
  khac_che: "Khắc chế",
};
const LOAI_MOC: Record<string, string> = { kinh_te: "Kinh tế", chi_so: "Chỉ số", khac_che: "Khắc chế", hanh_vi: "Hành vi", ho_tran: "Hộ trận" };
const VAI_TRO: Record<string, string> = {
  san_di_thu: "săn dị thú",
  tien_tuyen: "đứng tiền tuyến",
  hoi_phuc: "hồi phục",
  thu_cuoi: "thú cưỡi",
  phap_bao: "pháp bảo",
  do_kiep: "độ kiếp",
  sat_thuong_don: "sát thương đơn mục tiêu",
  cong_thanh: "công thành",
};
const HE_DAC_BIET: Record<string, string> = { theo_linh_can: "hệ theo linh căn", moi_he: "mọi hệ" };
function ganVoi(g: Record<string, string | string[]> | null): string {
  if (!g) return "";
  const out: string[] = [];
  const mot = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v);
  if (g.tai_nang) out.push(`tài năng ${taiNangTen(mot(g.tai_nang))}`);
  if (g.vai_tro) {
    const v = mot(g.vai_tro);
    if (!VAI_TRO[v]) thieuNguon.add(`vai_tro:${v}`);
    out.push(VAI_TRO[v] ?? v.replace(/_/g, " "));
  }
  if (g.loai_chieu) out.push(`chiêu ${chieuTen(mot(g.loai_chieu))}`);
  if (g.he) {
    const ds = Array.isArray(g.he) ? g.he : [g.he];
    out.push(ds.map((h) => HE_DAC_BIET[h] ?? `hệ ${heTen(h)}`).join(" hoặc "));
  }
  return out.join(", ");
}
function trangSetDo(): string {
  const s = D.set;
  const bo = s.bo as Any[];
  const anTen = Object.fromEntries((D.ngoc.an_bo as Any[]).map((a) => [a.ma_vp, a.ten]));
  const cacBo = bo
    .map(
      (b) => `${tieuDeId(3, b.ten, `bo-${b.id.replace(/_/g, "-")}`)}

${oHinh(b.an, undefined, anTen[b.an] ?? "")} Lộ **${t(LO[b.lo] ?? b.lo)}**${b.than ? " · bộ thần" : ""} · ấn rơi ở ${nguon(b.nguon)}${ganVoi(b.gan_voi) ? ` · hợp ${t(ganVoi(b.gan_voi))}` : ""}${b.rang_buoc ? `\n\n::: warning Ràng buộc\n${t(b.rang_buoc)}\n:::` : ""}

${bang(b.moc as Any[], [
  { ten: "Số món", lay: (m) => `**${m.so}**` },
  { ten: "Loại", lay: (m) => t(LOAI_MOC[m.loai] ?? m.loai) },
  { ten: "Hiệu ứng", lay: (m) => t(m.mo_ta), nguon: [["Set mốc", "Mô tả"]] },
])}`,
    )
    .join("\n\n");
  return trang(
    "Set đồ",
    "Bậc ấn, 20 bộ set với hiệu ứng mốc 2, 4, 7 món, binh bộ và hợp bộ.",
    `Set đồ dựa trên ấn bộ: khảm cùng một ấn vào nhiều món đang mặc thì mở hiệu ứng theo số món (${(s.moc as number[]).join(", ")}). Luật đầy đủ xem ở [Set đồ](/trang-bi/set-do).

${GHI_CHU_SO_LIEU}

${nhay([
  { ten: "Bậc ấn", id: "bac-an" },
  { ten: "20 bộ", id: "cac-bo" },
  { ten: "Binh bộ", id: "binh-bo" },
  { ten: "Hợp bộ", id: "hop-bo" },
  { ten: "Bộ trọn ở shop", id: "bo-tron" },
])}

${tieuDeId(2, "Bậc ấn", "bac-an")}

${doanBacAn()}

${tieuDeId(2, "20 bộ set", "cac-bo")}

${nhay(bo.map((b) => ({ ten: b.ten, id: `bo-${b.id.replace(/_/g, "-")}` })))}

${cacBo}

${tieuDeId(2, "Binh bộ", "binh-bo")}

Binh ấn khảm vào vũ khí, bao tay, ngọc bội. Mỗi người chỉ kích được 1 binh bộ.

${doanBinhBo()}

${tieuDeId(2, "Hợp bộ", "hop-bo")}

Mặc hai bộ cùng lúc thì quan hệ hệ của hai ấn đổi sức mốc 2.

${doanHopBo()}

${tieuDeId(2, "Bộ trọn ở shop", "bo-tron")}

${bang(s.bo_tron as Any[], [
  { ten: "Hình", lay: (x) => oHinh(x.ma_vp, x.bac, x.ten) },
  { ten: "Bộ", lay: (x) => `**${t(x.ten)}**<small>${t(x.mo_ta)}</small>` },
  { ten: "Nguồn", lay: (x) => nguon(x.nguon) },
])}`,
  );
}

function trangDanDuoc(): string {
  const nhom = [...new Set((D.vp.dan as Any[]).map((d) => d.nhom))];
  return trang(
    "Đan dược và phù",
    "Mọi loại đan dược, linh đan, thần đan, phù chú và linh đơn cho thú: tác dụng, cấp, nguồn.",
    `Cách luyện đan và dùng đan xem ở [Đan dược](/dan-duoc/).

${GHI_CHU_SO_LIEU}

${nhay([...nhom.map((n) => ({ ten: NHOM_DAN[n] ?? n, id: n.replace(/_/g, "-") })), { ten: "Phù chú", id: "phu-chu" }, { ten: "Linh đơn cho thú", id: "linh-don" }])}

${nhom
  .map((n) => {
    const ds = (D.vp.dan as Any[]).filter((d) => d.nhom === n);
    return `${tieuDeId(2, NHOM_DAN[n] ?? n, n.replace(/_/g, "-"))}\n\n${ds.length} loại.\n\n${bang(ds, COT_DAN, (x) => x.ten)}`;
  })
  .join("\n\n")}

${tieuDeId(2, "Phù chú", "phu-chu")}

${doanPhu()}

${tieuDeId(2, "Linh đơn cho thú", "linh-don")}

${doanLinhDon()}`,
  );
}

const NHOM_NL: Record<string, string> = {
  "QU-BA": "Quặng rèn",
  "NL-LK": "Luyện khí thạch",
  "NL-TB": "Tu bổ sa",
  "NL-KM": "Khai mạch đinh",
  "NL-GL": "Nguyên liệu gia công",
  "NL-PB": "Phôi pháp bảo",
  "NL-DB": "Rèn lại đồ bí cảnh",
  "NL-KT": "Khí tinh và linh văn thạch",
  "NL-DP": "Danh khí đồ phổ",
};
function trangNguyenLieu(): string {
  const ds = D.vp.nguyen_lieu as Any[];
  const nhom = [...new Set(ds.map((x) => x.ma_vp.slice(0, 5)))];
  return trang(
    "Nguyên liệu",
    "Quặng rèn, luyện khí thạch, tu bổ sa, phôi pháp bảo, khí tinh và các nguyên liệu rèn, luyện khác.",
    `Nguyên liệu dùng để rèn, sửa, nâng và luyện đồ. Xem [Trang bị](/trang-bi/) và [Luyện khí](/trang-bi/luyen-khi).

${GHI_CHU_SO_LIEU}

${doanNguyenLieu()}

Nhóm: ${nhom.map((n) => NHOM_NL[n] ?? n).join(", ")}.`,
  );
}

function trangThuCuoi(): string {
  const pham = Object.values(D.thuPham as Record<string, Any>);
  const than = pham
    .map((p) => {
      const ds = D.thu.filter((x) => x.grade === p.id);
      return `${tieuDeId(2, `Phẩm ${p.name}`, `pham-${p.id}`)}

${ds.length} loài. Gặp ở: ${t(p.habitat)}.

${bang(ds, [
  { ten: "Hình", lay: (x) => oFile(`pixellab/${x.asset}.png`, "px", x.name) },
  { ten: "Thú", lay: (x) => `**${t(x.name)}**<small>${t(x.desc)}</small>` },
  { ten: "Hệ", lay: (x) => he(x.element) },
  { ten: "Dáng · nơi gặp", lay: (x) => `${t(x.form)}<small>${t(x.habitat)}</small>` },
], (x) => x.name)}`;
    })
    .join("\n\n");
  return trang(
    "100 thú cưỡi",
    "Mọi loài thú cưỡi theo 5 phẩm, có hình, hệ, dáng và nơi gặp.",
    `Luật nuôi, cưỡi và phát triển thú xem ở [Thú cưỡi](/thu-cuoi/).

${GHI_CHU_SO_LIEU}

${nhay(pham.map((p) => ({ ten: p.name, id: `pham-${p.id}` })))}

## 5 phẩm thú

${doanThuPham()}

## Cảnh giới thú

${doanThuCanhGioi()}

${than}`,
  );
}

function trangBiCanh(): string {
  return trang(
    "20 loại bí cảnh",
    "Tỷ lệ rơi gốc, thế mạnh và cách chia phần thưởng của 20 loại bí cảnh.",
    `Bí cảnh rơi nhiều thì chủ yếu ra nguyên liệu; bí cảnh hiếm mới là nơi ra thần vật. Luật vào và đi nhóm xem ở [Bí cảnh](/bi-canh/).

${GHI_CHU_SO_LIEU}

${doanBiCanh()}

Cột cuối là phần thưởng chia theo loại khi bí cảnh rơi đồ: tàn quyển, đồ linh cấp, đồ thiên cấp và thần vật.`,
  );
}

function trangMo(): string {
  const toiDa = Object.values(D.viDien as Record<string, Any>).map((v) => `${t(v.name)} tối đa cấp ${v.maxMineLevel}`).join(", ");
  return trang(
    "Mỏ theo cấp",
    "Sản lượng mỗi giờ, mỗi ngày và phí nâng của mỏ từ cấp 1 tới 100.",
    `Mỏ càng cấp cao càng ra nhiều. Cấp mỏ tối đa theo vị diện: ${toiDa}. Luật chiếm và giữ mỏ xem ở [Mỏ và tài nguyên](/ban-do/mo).

${GHI_CHU_SO_LIEU}

${bang(D.mo, COT_MO)}`,
  );
}

function trangCapTongMon(): string {
  const khuc = [1, 51, 101, 151];
  return trang(
    "200 cấp tông môn",
    "Số đệ tử, điểm giữ, tầm Truyền Tống Trận, chức vị và mở khóa theo từng cấp tông môn.",
    `Tông môn lên cấp bằng kinh nghiệm chung của cả môn. Tới cấp 200 cả môn phi thăng. Luật tông môn xem ở [Tông môn](/tong-mon/).

${GHI_CHU_SO_LIEU}

${nhay(khuc.map((k) => ({ ten: `Cấp ${k}–${k + 49}`, id: `cap-${k}` })))}

${khuc.map((k) => `${tieuDeId(2, `Cấp ${k}–${k + 49}`, `cap-${k}`)}\n\n${bang(D.capTm.filter((x) => x.level >= k && x.level < k + 50), COT_CAP_TM)}`).join("\n\n")}`,
  );
}

function trangVung(): string {
  return trang(
    "Vị diện và vùng",
    "4 vị diện và 28 vùng: linh khí, số vùng, mỏ, cảnh giới, hệ của từng vùng và tàn quyển hay rơi.",
    `Giải thích về thế giới xem ở [Bốn vị diện](/the-gioi/).

${GHI_CHU_SO_LIEU}

## Bốn vị diện

${doanViDien()}

${Object.values(D.viDien as Record<string, Any>)
  .map((vd) => `${tieuDeId(2, `Vùng ở ${vd.name}`, `vung-${vd.id}`)}\n\n${bangVung(vd.id)}`)
  .join("\n\n")}`,
  );
}

function trangMucLuc(): string {
  return `---
title: Tra cứu
description: "Bảng tra số liệu sinh thẳng từ dữ liệu game: tàn quyển, trang bị, thú, bí cảnh, mỏ, cấp tông môn."
---

<!-- Trang sinh tự động bởi wiki/scripts/sinh.ts. -->

# Tra cứu

Các bảng dưới đây sinh thẳng từ số liệu của bản chơi thử hiện hành, nên luôn khớp với game. Gõ tên món vào ô **Tìm** (có dấu hay không dấu đều được) để nhảy thẳng tới dòng cần xem.

<div class="the-luoi">
${TRANG_TRA_CUU.map((x) => `<a class="the" href="/tra-cuu/${x.duong}"><b>${t(x.ten)}</b><span>${t(x.mo_ta)}</span></a>`).join("\n")}
</div>
`;
}

const TRANG: Record<string, () => string> = {
  "tan-quyen": trangTanQuyen,
  "cong-phap-mau": trangCongPhapMau,
  he: trangHe,
  chieu: trangChieu,
  "trang-bi": trangTrangBi,
  "phap-bao": trangPhapBao,
  "phap-khi": trangPhapKhi,
  ngoc: trangNgoc,
  "set-do": trangSetDo,
  "dan-duoc": trangDanDuoc,
  "nguyen-lieu": trangNguyenLieu,
  "thu-cuoi": trangThuCuoi,
  "bi-canh": trangBiCanh,
  mo: trangMo,
  "cap-tong-mon": trangCapTongMon,
  vung: trangVung,
};

const DOAN: Record<string, () => string> = {
  he: doanHe,
  "khac-che": doanKhacChe,
  "loai-chieu": doanLoaiChieu,
  "bien-the": doanBienThe,
  pham: doanPham,
  "quan-he-to-hop": doanQuanHe,
  "vi-dien": doanViDien,
  "vung-ha-vi": () => bangVung("ha"),
  "tai-nang": doanTaiNang,
  "cap-tong-mon-moc": doanCapTmMoc,
  "mo-cap": doanMoCap,
  "bi-canh": doanBiCanh,
  "do-hiem": doanDoHiem,
  "o-trang-bi": doanOTrangBi,
  "thu-pham": doanThuPham,
  "thu-canh-gioi": doanThuCanhGioi,
  "linh-don": doanLinhDon,
  "dan-duoc": doanDanDuoc,
  "tran-giao": doanTranGiao,
  "ngoc-cap": doanNgocCap,
  "y-chau": doanYChau,
  "bac-an": doanBacAn,
  "binh-bo": doanBinhBo,
  "hop-bo": doanHopBo,
  phu: doanPhu,
  "nguyen-lieu": doanNguyenLieu,
  "vung-ha-vi-ban-do": doanVungBanDo,
  "khi-hinh": doanKhiHinh,
  "vu-khi-tai-nang": doanVuKhiTaiNang,
  "to-hop": doanToHop,
  "ten-tan-quyen": doanTenTanQuyen,
};

// ---------- chạy ----------

function lamMoi(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

function cacFileMd(dir: string, out: string[] = []): string[] {
  for (const ten of readdirSync(dir)) {
    if (ten === "node_modules" || ten === ".vitepress" || ten === "public") continue;
    const p = join(dir, ten);
    if (statSync(p).isDirectory()) cacFileMd(p, out);
    else if (ten.endsWith(".md")) out.push(p);
  }
  return out;
}

async function chay(): Promise<void> {
  try {
    DE_XUAT = await docDeXuat(REPO);
  } catch (e) {
    canhBao.add(`Không đọc được màu ô đề xuất từ file Excel (${(e as Error).message}); bảng sẽ không có nhãn thử nghiệm theo cột`);
  }
  const thieu = TRANG_TRA_CUU.filter((x) => !TRANG[x.duong]).map((x) => x.duong);
  if (thieu.length) throw new Error(`traCuu.ts có trang chưa có hàm sinh: ${thieu.join(", ")}`);

  lamMoi(SINH);
  lamMoi(TRA);
  for (const [ten, f] of Object.entries(DOAN)) {
    writeFileSync(join(SINH, `${ten}.md`), `<!-- Đoạn sinh tự động bởi wiki/scripts/sinh.ts, đừng sửa tay. -->\n\n${f().trim()}\n`);
  }
  writeFileSync(join(TRA, "index.md"), trangMucLuc());
  for (const x of TRANG_TRA_CUU) {
    NEO.clear();
    writeFileSync(join(TRA, `${x.duong}.md`), TRANG[x.duong]());
  }

  // Dấu ấn và favicon của game (assets/brand, thay ô đỏ chữ Hán cũ): logo, trang chủ, trang cổng của Worker.
  for (const f of ["dau_an_128.png", "dau_an_256.png", "favicon.ico", "favicon-16.png", "favicon-32.png"]) hinhDung.add(`brand/${f}`);
  // Hình người viết chèn tay trong trang nội dung (/hinh/icon_ve/..., /hinh/pixellab/...).
  for (const f of cacFileMd(DOCS)) {
    const s = readFileSync(f, "utf8");
    for (const m of s.matchAll(/\/hinh\/((?:icon_ve|pixellab)\/[^\s"')<>]+?\.(?:webp|png|jpg|svg))/g)) {
      if (existsSync(join(ASSETS, m[1]))) hinhDung.add(m[1]);
      else canhBao.add(`${relative(WIKI, f)}: hình không có: ${m[1]}`);
    }
  }
  lamMoi(HINH);
  let bytes = 0;
  const sharp = (await import("sharp")).default;
  for (const rel of hinhDung) {
    const den = join(HINH, rel);
    mkdirSync(dirname(den), { recursive: true });
    const goc = join(ASSETS, rel);
    // Icon vẽ gốc 512 px (~25–60 KB): thu về 128 px (đủ nét cho ô 48 px trên màn mật độ cao), lưu đệm ở .cache/hinh.
    // Hình pixel PixelLab giữ nguyên (đã nhỏ, phóng bằng image-rendering: pixelated).
    if (rel.startsWith("icon_ve/") && /\.(webp|png)$/.test(rel)) {
      const dem = join(WIKI, ".cache/hinh", rel);
      if (!existsSync(dem) || statSync(dem).mtimeMs < statSync(goc).mtimeMs) {
        mkdirSync(dirname(dem), { recursive: true });
        const anhGoc = sharp(goc).resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, withoutEnlargement: true });
        await (rel.endsWith(".png") ? anhGoc.png({ palette: true, quality: 85 }) : anhGoc.webp({ quality: 82 })).toFile(dem);
      }
      copyFileSync(dem, den);
    } else copyFileSync(goc, den);
    bytes += statSync(den).size;
  }
  if (thieuNguon.size) canhBao.add(`Mã nguồn chưa có tên tiếng Việt trong NGUON: ${[...thieuNguon].join(", ")}`);
  console.log(
    `sinh: ${Object.keys(DOAN).length} đoạn chèn, ${TRANG_TRA_CUU.length + 1} trang tra cứu, ${hinhDung.size} hình (${so(Math.round(bytes / 1024))} KB)`,
  );
  for (const c of canhBao) console.warn(`  cảnh báo: ${c}`);
}

await chay();
