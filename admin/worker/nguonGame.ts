// Đọc số liệu game từ bảng của Worker game trong D1 chung (cloudflare/migrations/0001_khoi_tao.sql, docs/api.md):
//   nguoi_choi_thu (email, lan_dau, lan_cuoi, so_phien) — bảng duy nhất có email;
//   su_kien (id, loai, an_danh, phien, luc, nhan_luc, du_lieu, phien_ban) — ẩn danh, không có email;
//   phan_hoi (id, email, loai, noi_dung, man, thiet_bi, phien_ban, luc).
// FTUE, giữ chân và người mỗi ngày tính theo an_danh (theo máy). Không nối email với an_danh.
// Bảng game chưa có (D1 báo "no such table", ví dụ khi chạy cục bộ) thì trả dữ liệu giả cùng dạng, nguon = "mau".

import type { DsPhanHoi, DsSuKien, Nguon, PhanHoi, SuKien, TongQuan, TrangThaiPhanHoi } from "../shared/hopDong.ts";
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

function thieuBang(e: unknown): boolean {
  return /no such table/i.test(String((e as Error)?.message ?? e));
}

// ---- Tổng quan ------------------------------------------------------------------------------------------------

export async function tongQuan(db: D1Database, soNgay: number, now = Date.now()): Promise<TongQuan> {
  const moi = await db.prepare("SELECT COUNT(*) AS moi, COALESCE(SUM(khoa), 0) AS khoa FROM qt_nguoi_choi").first<{ moi: number; khoa: number }>();
  const invited = { moi: moi?.moi ?? 0, khoa: moi?.khoa ?? 0 };
  try {
    return await tongQuanThat(db, soNgay, now, invited);
  } catch (e) {
    if (!thieuBang(e)) throw e;
    return tongQuanMau(soNgay, now, invited);
  }
}

async function tongQuanThat(db: D1Database, soNgay: number, now: number, invited: { moi: number; khoa: number }): Promise<TongQuan> {
  const homNay = ngayVN(now);
  const tu = (homNay - soNgay + 1) * NGAY_MS - VN_MS;
  const dauHomNay = homNay * NGAY_MS - VN_MS;

  const [nguoi, theoNgay, ftue, ngayMay, phienTb] = await db.batch([
    db.prepare("SELECT COUNT(*) AS da_choi, COALESCE(SUM(lan_cuoi >= ?), 0) AS hom_nay FROM nguoi_choi_thu").bind(dauHomNay),
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
  const n = nguoi.results[0] as { da_choi: number; hom_nay: number } | undefined;

  return {
    nguon: "that",
    nguoi_choi: { ...invited, da_choi: n?.da_choi ?? 0, hom_nay: n?.hom_nay ?? 0 },
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

/** Lần đầu, lần cuối và số phiên theo email (nguoi_choi_thu). Bảng chưa có thì rỗng, nguon = "mau". */
export async function thongKeNguoiChoi(db: D1Database): Promise<{ nguon: Nguon; theoEmail: Map<string, { lan_dau: number; lan_cuoi: number; so_phien: number }> }> {
  try {
    const r = await db.prepare("SELECT email, lan_dau, lan_cuoi, so_phien FROM nguoi_choi_thu").all<{ email: string; lan_dau: number; lan_cuoi: number; so_phien: number }>();
    return { nguon: "that", theoEmail: new Map(r.results.map((x) => [x.email.toLowerCase(), x])) };
  } catch (e) {
    if (!thieuBang(e)) throw e;
    return { nguon: "mau", theoEmail: new Map() };
  }
}

// ---- Phản hồi -----------------------------------------------------------------------------------------------

type PhanHoiGoc = Omit<PhanHoi, "trang_thai" | "sua_boi" | "sua_luc" | "ghi_chu">;

export async function dsPhanHoi(db: D1Database, q: { trangThai?: TrangThaiPhanHoi }): Promise<DsPhanHoi> {
  let nguon: Nguon = "that";
  let goc: PhanHoiGoc[];
  try {
    const r = await db.prepare("SELECT id, luc, email, loai, noi_dung, man, thiet_bi, phien_ban FROM phan_hoi ORDER BY luc DESC LIMIT 500").all<Record<string, unknown>>();
    goc = r.results.map((x) => ({
      id: String(x.id),
      luc: Number(x.luc),
      email: (x.email as string | null) ?? null,
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
    db.prepare("SELECT phan_hoi_id, email, noi_dung, luc FROM qt_phan_hoi_ghi_chu ORDER BY luc"),
  ]);
  const xuLy = new Map((xl.results as { phan_hoi_id: string; trang_thai: TrangThaiPhanHoi; sua_boi: string; sua_luc: number }[]).map((r) => [r.phan_hoi_id, r]));
  const ghiChu = new Map<string, PhanHoi["ghi_chu"]>();
  for (const r of gc.results as { phan_hoi_id: string; email: string; noi_dung: string; luc: number }[]) {
    const a = ghiChu.get(r.phan_hoi_id) ?? [];
    a.push({ email: r.email, noi_dung: r.noi_dung, luc: r.luc });
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

function tongQuanMau(soNgay: number, now: number, invited: { moi: number; khoa: number }): TongQuan {
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
    // Số mời và khóa luôn là thật (bảng qt_nguoi_choi); chỉ phần đo từ sự kiện là mẫu.
    nguoi_choi: { moi: invited.moi, khoa: invited.khoa, da_choi: 24, hom_nay: theo_ngay[theo_ngay.length - 1].nguoi },
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
    email: `nguoichoi${String(i * 3 + 2).padStart(2, "0")}@example.com`,
    loai,
    noi_dung,
    man,
    thiet_bi: i % 2 ? "Android Chrome" : "iPhone Safari",
    phien_ban: "mau",
  }));
}
