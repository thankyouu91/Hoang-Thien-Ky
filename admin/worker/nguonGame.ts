// Đọc số liệu game từ bảng của Worker game trong D1 chung (cloudflare/migrations/, docs/api.md):
//   loi_moi (ma, ten, toi_da, da_dung, het_han, tat, …) — link mời https://thienhoangky.fun/moi/<ma>;
//   nguoi_choi_thu (id, the_hash, ma_moi, lan_dau, lan_cuoi, so_phien, khoa, ly_do_khoa, …) — mỗi trình duyệt đã mở link;
//   su_kien (id, loai, an_danh, phien, luc, nhan_luc, du_lieu, phien_ban) — ẩn danh;
//   phan_hoi (id, nguoi_choi, loai, noi_dung, man, lien_he, thiet_bi, phien_ban, luc).
// Không có email người chơi. the_hash là băm của thẻ vào: không bao giờ SELECT.
// FTUE, giữ chân và người mỗi ngày tính theo an_danh (theo máy).
// Bảng game chưa có hoặc còn dạng cũ (D1 báo "no such table/column", ví dụ khi chạy cục bộ) thì trả dữ liệu giả cùng dạng,
// nguon = "mau"; các thao tác ghi bảng game thì báo lỗi 503.

import type { DsNguoiChoi, DsPhanHoi, DsSuKien, LoiMoi, Nguon, PhanHoi, SuKien, TongQuan, TrangThaiLink, TrangThaiPhanHoi } from "../shared/hopDong.ts";
import { BUOC_FTUE } from "../shared/hopDong.ts";

/** Lệch giờ Việt Nam (UTC+7) để chia ngày theo giờ người chơi. */
const VN_MS = 7 * 3600 * 1000;
const NGAY_MS = 86400 * 1000;
const NGAY_SQL = `((luc + ${VN_MS}) / ${NGAY_MS})`;

export function ngayVN(ms: number): number {
  return Math.floor((ms + VN_MS) / NGAY_MS);
}
export function tenNgay(d: number): string {
  return new Date(d * NGAY_MS).toISOString().slice(0, 10);
}

export function thieuBang(e: unknown): boolean {
  return /no such (table|column)/i.test(String((e as Error)?.message ?? e));
}

// ---- Tổng quan ------------------------------------------------------------------------------------------------

export async function tongQuan(db: D1Database, soNgay: number, now = Date.now()): Promise<TongQuan> {
  try {
    return await tongQuanThat(db, soNgay, now);
  } catch (e) {
    if (!thieuBang(e)) throw e;
    return tongQuanMau(soNgay, now);
  }
}

async function tongQuanThat(db: D1Database, soNgay: number, now: number): Promise<TongQuan> {
  const homNay = ngayVN(now);
  const tu = (homNay - soNgay + 1) * NGAY_MS - VN_MS;
  const dauHomNay = homNay * NGAY_MS - VN_MS;

  const [nguoi, link, theoNgay, ftue, ngayMay, phienTb] = await db.batch([
    db.prepare("SELECT COUNT(*) AS tong, COALESCE(SUM(khoa), 0) AS khoa, COALESCE(SUM(lan_cuoi >= ?), 0) AS hom_nay FROM nguoi_choi_thu").bind(dauHomNay),
    db.prepare("SELECT COUNT(*) AS mo FROM loi_moi WHERE tat = 0 AND (het_han IS NULL OR het_han > ?) AND (toi_da IS NULL OR da_dung < toi_da)").bind(now),
    db.prepare(`SELECT ${NGAY_SQL} AS d, COUNT(DISTINCT phien) AS phien, COUNT(DISTINCT an_danh) AS nguoi FROM su_kien WHERE luc >= ? GROUP BY d ORDER BY d`).bind(tu),
    db.prepare("SELECT CAST(json_extract(du_lieu, '$.buoc') AS INTEGER) AS b, COUNT(DISTINCT an_danh) AS so FROM su_kien WHERE loai = 'ftue_buoc' GROUP BY b"),
    db.prepare(`SELECT an_danh, ${NGAY_SQL} AS d FROM su_kien GROUP BY an_danh, d`),
    db.prepare(`SELECT AVG(n) AS tb FROM (SELECT COUNT(DISTINCT phien) AS n FROM su_kien WHERE luc >= ? GROUP BY an_danh, ${NGAY_SQL})`).bind(tu),
  ]);

  const map = new Map<number, { phien: number; nguoi: number }>();
  for (const r of theoNgay.results as { d: number; phien: number; nguoi: number }[]) map.set(r.d, r);
  const theo_ngay = [];
  for (let d = homNay - soNgay + 1; d <= homNay; d++) {
    const r = map.get(d);
    theo_ngay.push({ ngay: tenNgay(d), phien: r?.phien ?? 0, nguoi: r?.nguoi ?? 0 });
  }

  // Mỗi bước đếm số máy có sự kiện của đúng bước đó (không cộng dồn), để thấy chỗ rơi thật.
  const f = new Array<number>(BUOC_FTUE.length).fill(0);
  for (const r of ftue.results as { b: number; so: number }[]) if (r.b >= 1 && r.b <= f.length) f[r.b - 1] = r.so;

  const ngayTheoMay = new Map<string, Set<number>>();
  for (const r of ngayMay.results as { an_danh: string; d: number }[]) {
    let s = ngayTheoMay.get(r.an_danh);
    if (!s) ngayTheoMay.set(r.an_danh, (s = new Set()));
    s.add(r.d);
  }
  const n = nguoi.results[0] as { tong: number; khoa: number; hom_nay: number } | undefined;

  return {
    nguon: "that",
    nguoi_choi: { tong: n?.tong ?? 0, khoa: n?.khoa ?? 0, hom_nay: n?.hom_nay ?? 0, link_mo: (link.results[0] as { mo: number } | undefined)?.mo ?? 0 },
    theo_ngay,
    ftue: f,
    giu_chan: giuChan(ngayTheoMay, homNay),
    phien_moi_nguoi: Math.round(((phienTb.results[0] as { tb: number | null } | undefined)?.tb ?? 0) * 10) / 10,
  };
}

/** D1, D7 theo ngày chơi đầu của từng máy: có chơi đúng ngày đầu + 1 (+ 7). Chỉ tính máy đã đủ ngày để đo. */
export function giuChan(ngayTheoMay: Map<string, Set<number>>, homNay: number): TongQuan["giu_chan"] {
  const d1 = { tu: 0, mau: 0 };
  const d7 = { tu: 0, mau: 0 };
  for (const s of ngayTheoMay.values()) {
    const dau = Math.min(...s);
    if (dau + 1 <= homNay) {
      d1.mau++;
      if (s.has(dau + 1)) d1.tu++;
    }
    if (dau + 7 <= homNay) {
      d7.mau++;
      if (s.has(dau + 7)) d7.tu++;
    }
  }
  return { d1, d7 };
}

// ---- Sự kiện ------------------------------------------------------------------------------------------------

export async function dsSuKien(db: D1Database, q: { loai?: string; truoc?: string; gioiHan: number }): Promise<DsSuKien> {
  try {
    const where: string[] = [];
    const args: unknown[] = [];
    if (q.loai) where.push("loai = ?"), args.push(q.loai);
    if (q.truoc) where.push("id < ?"), args.push(Number(q.truoc));
    const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [dong, dem] = await db.batch([
      db.prepare(`SELECT id, luc, loai, an_danh, phien, phien_ban, du_lieu FROM su_kien ${w} ORDER BY id DESC LIMIT ?`).bind(...args, q.gioiHan + 1),
      db.prepare("SELECT loai, COUNT(*) AS so FROM su_kien GROUP BY loai ORDER BY so DESC"),
    ]);
    const rows = (dong.results as Record<string, unknown>[]).map(
      (r): SuKien => ({
        id: String(r.id),
        luc: Number(r.luc),
        loai: String(r.loai),
        an_danh: (r.an_danh as string | null) ?? null,
        phien: (r.phien as string | null) ?? null,
        phien_ban: (r.phien_ban as string | null) ?? null,
        du_lieu: docJson(r.du_lieu),
      }),
    );
    return { nguon: "that", dem: dem.results as { loai: string; so: number }[], dong: rows.slice(0, q.gioiHan), con: rows.length > q.gioiHan };
  } catch (e) {
    if (!thieuBang(e)) throw e;
    return suKienMau(q);
  }
}

export function trangThaiLink(l: { tat: boolean; toi_da: number | null; da_dung: number; het_han: number | null }, now = Date.now()): TrangThaiLink {
  if (l.tat) return "tat";
  if (l.het_han !== null && l.het_han <= now) return "het_han";
  if (l.toi_da !== null && l.da_dung >= l.toi_da) return "het_luot";
  return "mo";
}

function linkTu(r: Record<string, unknown>, now: number): LoiMoi {
  const l = {
    ma: String(r.ma),
    ten: String(r.ten),
    toi_da: r.toi_da === null ? null : Number(r.toi_da),
    da_dung: Number(r.da_dung ?? 0),
    het_han: r.het_han === null ? null : Number(r.het_han),
    tat: r.tat === 1,
    tao_boi: String(r.tao_boi),
    tao_luc: Number(r.tao_luc),
    sua_boi: (r.sua_boi as string | null) ?? null,
    sua_luc: (r.sua_luc as number | null) ?? null,
  };
  return { ...l, trang_thai: trangThaiLink(l, now) };
}

/** Link mời và người chơi thử (kèm ghi chú nội bộ và số phản hồi). Bảng game chưa có thì trả mẫu, nguon = "mau". */
export async function dsNguoiChoi(db: D1Database, now = Date.now()): Promise<Omit<DsNguoiChoi, "link_goc">> {
  try {
    const [link, nguoi, gc, ph] = await db.batch([
      db.prepare("SELECT ma, ten, toi_da, da_dung, het_han, tat, tao_boi, tao_luc, sua_boi, sua_luc FROM loi_moi ORDER BY tao_luc DESC"),
      db.prepare("SELECT id, ma_moi, lan_dau, lan_cuoi, so_phien, khoa, ly_do_khoa, sua_boi, sua_luc FROM nguoi_choi_thu ORDER BY lan_cuoi DESC LIMIT 2000"),
      db.prepare("SELECT nguoi_choi_id, ghi_chu FROM qt_ghi_chu_nguoi_choi"),
      db.prepare("SELECT nguoi_choi, COUNT(*) AS so FROM phan_hoi GROUP BY nguoi_choi"),
    ]);
    const ghiChu = new Map((gc.results as { nguoi_choi_id: string; ghi_chu: string }[]).map((r) => [r.nguoi_choi_id, r.ghi_chu]));
    const soPh = new Map((ph.results as { nguoi_choi: string; so: number }[]).map((r) => [r.nguoi_choi, r.so]));
    return {
      nguon: "that",
      link: (link.results as Record<string, unknown>[]).map((r) => linkTu(r, now)),
      dong: (nguoi.results as Record<string, unknown>[]).map((r) => {
        const id = String(r.id);
        return {
          id,
          ma_moi: String(r.ma_moi),
          lan_dau: Number(r.lan_dau),
          lan_cuoi: Number(r.lan_cuoi),
          so_phien: Number(r.so_phien ?? 0),
          khoa: r.khoa === 1,
          ly_do_khoa: (r.ly_do_khoa as string | null) ?? null,
          sua_boi: (r.sua_boi as string | null) ?? null,
          sua_luc: (r.sua_luc as number | null) ?? null,
          ghi_chu: ghiChu.get(id) ?? null,
          so_phan_hoi: soPh.get(id) ?? 0,
        };
      }),
    };
  } catch (e) {
    if (!thieuBang(e)) throw e;
    return nguoiChoiMau(db, now);
  }
}

// ---- Phản hồi -----------------------------------------------------------------------------------------------

type PhanHoiGoc = Omit<PhanHoi, "trang_thai" | "sua_boi" | "sua_luc" | "ghi_chu">;

export async function dsPhanHoi(db: D1Database, q: { trangThai?: TrangThaiPhanHoi }): Promise<DsPhanHoi> {
  let nguon: Nguon = "that";
  let goc: PhanHoiGoc[];
  try {
    const r = await db.prepare("SELECT id, luc, nguoi_choi, loai, noi_dung, man, lien_he, thiet_bi, phien_ban FROM phan_hoi ORDER BY luc DESC LIMIT 500").all<Record<string, unknown>>();
    goc = r.results.map((x) => ({
      id: String(x.id),
      luc: Number(x.luc),
      nguoi_choi: (x.nguoi_choi as string | null) ?? null,
      lien_he: (x.lien_he as string | null) ?? null,
      loai: (x.loai as string | null) ?? null,
      noi_dung: String(x.noi_dung ?? ""),
      man: (x.man as string | null) ?? null,
      thiet_bi: (x.thiet_bi as string | null) ?? null,
      phien_ban: (x.phien_ban as string | null) ?? null,
    }));
  } catch (e) {
    if (!thieuBang(e)) throw e;
    nguon = "mau";
    goc = phanHoiMau();
  }

  const [xl, gc] = await db.batch([
    db.prepare("SELECT phan_hoi_id, trang_thai, sua_boi, sua_luc FROM qt_phan_hoi_xu_ly"),
    db.prepare("SELECT phan_hoi_id, nguoi, noi_dung, luc FROM qt_phan_hoi_ghi_chu ORDER BY luc"),
  ]);
  const xuLy = new Map((xl.results as { phan_hoi_id: string; trang_thai: TrangThaiPhanHoi; sua_boi: string; sua_luc: number }[]).map((r) => [r.phan_hoi_id, r]));
  const ghiChu = new Map<string, PhanHoi["ghi_chu"]>();
  for (const r of gc.results as { phan_hoi_id: string; nguoi: string; noi_dung: string; luc: number }[]) {
    const a = ghiChu.get(r.phan_hoi_id) ?? [];
    a.push({ nguoi: r.nguoi, noi_dung: r.noi_dung, luc: r.luc });
    ghiChu.set(r.phan_hoi_id, a);
  }
  let dong: PhanHoi[] = goc.map((p) => {
    const x = xuLy.get(p.id);
    return { ...p, trang_thai: x?.trang_thai ?? "moi", sua_boi: x?.sua_boi ?? null, sua_luc: x?.sua_luc ?? null, ghi_chu: ghiChu.get(p.id) ?? [] };
  });
  if (q.trangThai) dong = dong.filter((p) => p.trang_thai === q.trangThai);
  return { nguon, dong };
}

/** Phản hồi có tồn tại không (để không gắn trạng thái cho id bịa). Bảng game chưa có thì chỉ nhận id mẫu. */
export async function coPhanHoi(db: D1Database, id: string): Promise<boolean> {
  try {
    // id phản hồi thật là số; id khác (như "mau-1") chỉ hợp lệ khi bảng game chưa có. Câu truy vấn chạy cả khi id lạ
    // để còn biết bảng có hay chưa.
    const so = /^\d{1,15}$/.test(id) ? Number(id) : -1;
    return (await db.prepare("SELECT 1 AS c FROM phan_hoi WHERE id = ?").bind(so).first()) !== null;
  } catch (e) {
    if (!thieuBang(e)) throw e;
    return phanHoiMau().some((p) => p.id === id);
  }
}

function docJson(v: unknown): Record<string, unknown> | null {
  if (typeof v !== "string" || !v) return null;
  try {
    const o = JSON.parse(v);
    return o && typeof o === "object" ? (o as Record<string, unknown>) : { gia_tri: o };
  } catch {
    return { tho: v };
  }
}

// ---- Dữ liệu giả cùng dạng -------------------------------------------------------------------------------------
// Sinh theo hạt giống cố định để mỗi lần tải ra cùng số. Email mẫu dùng tên miền example.com (RFC 2606), không phải người thật.

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tongQuanMau(soNgay: number, now: number): TongQuan {
  const r = rng(19);
  const homNay = ngayVN(now);
  const theo_ngay = [];
  for (let d = homNay - soNgay + 1; d <= homNay; d++) {
    const tuoi = d - (homNay - soNgay + 1);
    const nguoi = Math.round(6 + tuoi * 1.1 + r() * 4);
    theo_ngay.push({ ngay: tenNgay(d), nguoi, phien: Math.round(nguoi * (2.4 + r() * 1.4)) });
  }
  return {
    nguon: "mau",
    nguoi_choi: { tong: 24, khoa: 1, hom_nay: theo_ngay[theo_ngay.length - 1].nguoi, link_mo: 2 },
    theo_ngay,
    ftue: [24, 23, 22, 19, 18, 17, 13, 12],
    giu_chan: { d1: { tu: 9, mau: 22 }, d7: { tu: 2, mau: 14 } },
    phien_moi_nguoi: 2.8,
  };
}

const LOAI_MAU = ["mo_phien", "ftue_buoc", "cham_the", "tran_dau", "ghep_cong_phap", "bi_canh", "tan_quyen_roi", "chiem_mo", "dong_phien", "chiem_diem"];

function suKienMau(q: { loai?: string; truoc?: string; gioiHan: number }): DsSuKien {
  const r = rng(7);
  const now = Date.now();
  const all: SuKien[] = [];
  for (let i = 0; i < 240; i++) {
    const loai = LOAI_MAU[Math.floor(r() * LOAI_MAU.length)];
    const may = Math.floor(r() * 24) + 1;
    const du: Record<string, unknown> =
      loai === "ftue_buoc"
        ? { buoc: Math.floor(r() * 8) + 1 }
        : loai === "tran_dau"
          ? { he: ["kim", "moc", "thuy", "hoa", "tho", "loi"][Math.floor(r() * 6)], ket_qua: r() < 0.6 ? "thang" : "thua" }
          : loai === "cham_the"
            ? { the: ["viec_nen_lam", "mo", "lich"][Math.floor(r() * 3)], man: "dong-phu" }
            : {};
    all.push({
      id: String(240 - i),
      luc: now - i * 7 * 60 * 1000 - Math.floor(r() * 300000),
      loai,
      an_danh: `mau${String(may).padStart(2, "0")}x${(may * 2654435761).toString(36).slice(-6)}`,
      phien: `p${may}-${Math.floor(i / 9)}`,
      phien_ban: "mau",
      du_lieu: du,
    });
  }
  let rows = all;
  if (q.loai) rows = rows.filter((x) => x.loai === q.loai);
  if (q.truoc) rows = rows.filter((x) => Number(x.id) < Number(q.truoc));
  const dem = new Map<string, number>();
  for (const x of all) dem.set(x.loai, (dem.get(x.loai) ?? 0) + 1);
  return {
    nguon: "mau",
    dem: [...dem].map(([loai, so]) => ({ loai, so })).sort((a, b) => b.so - a.so),
    dong: rows.slice(0, q.gioiHan),
    con: rows.length > q.gioiHan,
  };
}

function phanHoiMau(): PhanHoiGoc[] {
  const now = Date.now();
  const h = 3600 * 1000;
  const mau: [string, string, string][] = [
    ["loi", "Bấm Thu mỏ hai lần liền thì linh thạch cộng hai lần.", "dong-phu"],
    ["gop_y", "Bước ghép công pháp đầu khó hiểu, không biết kéo tàn quyển vào đâu.", "cong-phap"],
    ["loi", "Trên điện thoại, chữ ở bảng Luyện khí bị cắt mất dòng cuối.", "nhan-vat"],
    ["gop_y", "Muốn có nút tắt nhạc nền ngay ở Động phủ.", "dong-phu"],
    ["khac", "Không thấy giờ bí cảnh tối nay ở đâu.", "dong-phu"],
    ["loi", "Trận PvE đầu bị đứng ở giây 42, phải tải lại trang.", "tran"],
  ];
  return mau.map(([loai, noi_dung, man], i) => ({
    id: `mau-${i + 1}`,
    luc: now - (i * 5 + 2) * h,
    nguoi_choi: ID_MAU[(i * 3 + 2) % ID_MAU.length],
    lien_he: i === 0 ? "zalo 09xx (mẫu)" : null,
    loai,
    noi_dung,
    man,
    thiet_bi: i % 2 ? "Android Chrome" : "iPhone Safari",
    phien_ban: "mau",
  }));
}

const ID_MAU = Array.from({ length: 24 }, (_, i) => "mau" + ((i + 1) * 2654435761).toString(36).slice(-7).padStart(7, "0"));

/** Link và người chơi mẫu (chỉ đọc). Ghi chú nội bộ vẫn đọc từ bảng thật qt_ghi_chu_nguoi_choi. */
async function nguoiChoiMau(db: D1Database, now: number): Promise<Omit<DsNguoiChoi, "link_goc">> {
  const r = rng(11);
  const ngay = 86400 * 1000;
  const link: LoiMoi[] = [
    { ma: "maumoi-discord1", ten: "Discord đợt 1 (mẫu)", toi_da: 30, da_dung: 18, het_han: now + 9 * ngay, tat: false, tao_boi: "admin", tao_luc: now - 6 * ngay, sua_boi: null, sua_luc: null },
    { ma: "maumoi-banbe00", ten: "Bạn bè (mẫu)", toi_da: null, da_dung: 6, het_han: null, tat: false, tao_boi: "admin", tao_luc: now - 5 * ngay, sua_boi: null, sua_luc: null },
    { ma: "maumoi-cu00000", ten: "Link cũ đã tắt (mẫu)", toi_da: 10, da_dung: 10, het_han: null, tat: true, tao_boi: "admin", tao_luc: now - 12 * ngay, sua_boi: "admin", sua_luc: now - 6 * ngay },
  ].map((l) => ({ ...l, trang_thai: trangThaiLink(l, now) }));
  let ghiChu = new Map<string, string>();
  try {
    const gc = await db.prepare("SELECT nguoi_choi_id, ghi_chu FROM qt_ghi_chu_nguoi_choi").all<{ nguoi_choi_id: string; ghi_chu: string }>();
    ghiChu = new Map(gc.results.map((x) => [x.nguoi_choi_id, x.ghi_chu]));
  } catch {
    // bảng qt_ chưa có: bỏ qua
  }
  const dong = ID_MAU.map((id, i) => {
    const dau = now - Math.floor(r() * 6 * ngay);
    return {
      id,
      ma_moi: i < 18 ? link[0].ma : link[1].ma,
      lan_dau: dau,
      lan_cuoi: Math.min(now, dau + Math.floor(r() * 3 * ngay)),
      so_phien: 1 + Math.floor(r() * 14),
      khoa: i === 7,
      ly_do_khoa: i === 7 ? "spam phản hồi (mẫu)" : null,
      sua_boi: i === 7 ? "admin" : null,
      sua_luc: i === 7 ? now - ngay : null,
      ghi_chu: ghiChu.get(id) ?? null,
      so_phan_hoi: i % 5 === 2 ? 1 : 0,
    };
  });
  dong.sort((a, b) => b.lan_cuoi - a.lan_cuoi);
  return { nguon: "mau", link, dong };
}
