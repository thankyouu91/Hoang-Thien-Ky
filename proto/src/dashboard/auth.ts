// Đăng nhập (GDD mục 14, FTUE bước 1): số điện thoại + OTP, ngày sinh; dưới 16 tuổi đăng ký bằng thông tin người giám hộ.
// Bản prototype không gửi SMS: MockAuth tạo mã thử và hiện ngay trên màn, phiên lưu trong localStorage của máy.
// Khối M1/M7 thay bằng xác thực của Nakama với OTP SMS thật, giữ nguyên interface AuthSource.

export interface Guardian {
  name: string;
  phoneMasked: string;
}

export interface Session {
  phoneMasked: string;
  birthDate: string; // YYYY-MM-DD
  guardian?: Guardian;
  since: number;
}

export type OtpResult = { ok: true; resendAfter: number; devCode?: string } | { ok: false; error: string };
export type VerifyResult = { ok: true; needsProfile: boolean } | { ok: false; error: string };

export interface AuthSource {
  session(): Session | null;
  requestOtp(phone: string): Promise<OtpResult>;
  verifyOtp(phone: string, code: string): Promise<VerifyResult>;
  /** Lần đầu của số điện thoại: ngày sinh và người giám hộ (bắt buộc dưới 16 tuổi). */
  completeProfile(phone: string, birthDate: string, guardian?: { name: string; phone: string }): Promise<{ ok: true } | { ok: false; error: string }>;
  logout(): void;
  /** Phút đã chơi hôm nay; bộ đếm thật chạy ở server (GDD mục 14), bản mẫu đếm trên máy. */
  playedMinutesToday(): number;
}

/** Tuổi đăng ký bằng người giám hộ (GDD mục 14) và tuổi được coi là người lớn (G1). */
export const GUARDIAN_AGE = 16;
export const ADULT_AGE = 18;
/** Phút chơi tối đa mỗi ngày của người dưới 18 tuổi cho một trò chơi (đề xuất, theo Nghị định 147/2024; cần kiểm lại khi xin G1). */
export const MINOR_DAILY_MINUTES = 60;
const RESEND_SECONDS = 60;

/** Số di động Việt Nam: 0 hoặc +84, rồi 9 chữ số bắt đầu bằng 3, 5, 7, 8, 9. Trả về dạng 0xxxxxxxxx hoặc null. */
export function normalizePhone(input: string): string | null {
  const d = input.replace(/[\s.-]/g, "").replace(/^\+?84/, "0");
  return /^0[35789]\d{8}$/.test(d) ? d : null;
}

export function maskPhone(p: string): string {
  return `${p.slice(0, 2)}•• ••• ${p.slice(-3)}`;
}

export function ageOn(birthDate: string, now = new Date()): number {
  const b = new Date(`${birthDate}T00:00:00`);
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}

const KEY_SESSION = "ktlp.session";
const KEY_ACCOUNTS = "ktlp.accounts";
const KEY_PLAY = "ktlp.play";

function read<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Trình duyệt chặn bộ nhớ: phiên chỉ sống tới khi đóng trang.
  }
}

/** Khoá tài khoản theo số điện thoại đã băm, để máy không giữ số thật. */
function accountKey(phone: string): string {
  let h = 2166136261;
  for (let i = 0; i < phone.length; i++) h = Math.imul(h ^ phone.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export class MockAuth implements AuthSource {
  private current: Session | null = read<Session>(KEY_SESSION);
  private pending = new Map<string, { code: string; at: number }>();
  private verified = new Set<string>();

  constructor() {
    // Đếm giờ chơi khi trang đang hiện.
    let last = performance.now();
    setInterval(() => {
      const now = performance.now();
      if (this.current && document.visibilityState === "visible") this.addPlay(now - last);
      last = now;
    }, 15_000);
  }

  session(): Session | null {
    return this.current;
  }

  async requestOtp(phone: string): Promise<OtpResult> {
    const p = normalizePhone(phone);
    if (!p) return { ok: false, error: "Số điện thoại chưa đúng (10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09)." };
    const prev = this.pending.get(p);
    if (prev && Date.now() - prev.at < RESEND_SECONDS * 1000) return { ok: true, resendAfter: prev.at + RESEND_SECONDS * 1000, devCode: prev.code };
    const code = String(Math.floor(100000 + Math.random() * 900000));
    this.pending.set(p, { code, at: Date.now() });
    return { ok: true, resendAfter: Date.now() + RESEND_SECONDS * 1000, devCode: code };
  }

  async verifyOtp(phone: string, code: string): Promise<VerifyResult> {
    const p = normalizePhone(phone);
    const sent = p ? this.pending.get(p) : undefined;
    if (!p || !sent) return { ok: false, error: "Hãy nhận mã trước." };
    if (code.trim() !== sent.code) return { ok: false, error: "Mã chưa đúng." };
    this.pending.delete(p);
    this.verified.add(p);
    const account = read<Record<string, { birthDate: string; guardian?: Guardian }>>(KEY_ACCOUNTS)?.[accountKey(p)];
    if (account) this.start(p, account.birthDate, account.guardian);
    return { ok: true, needsProfile: !account };
  }

  async completeProfile(phone: string, birthDate: string, guardian?: { name: string; phone: string }) {
    const p = normalizePhone(phone);
    if (!p || !this.verified.has(p)) return { ok: false as const, error: "Hãy xác thực số điện thoại trước." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return { ok: false as const, error: "Hãy nhập ngày sinh." };
    const age = ageOn(birthDate);
    if (age < 6 || age > 100) return { ok: false as const, error: "Ngày sinh chưa hợp lệ." };
    let g: Guardian | undefined;
    if (age < GUARDIAN_AGE) {
      const gp = guardian ? normalizePhone(guardian.phone) : null;
      if (!guardian || guardian.name.trim().length < 2 || !gp) return { ok: false as const, error: "Dưới 16 tuổi cần họ tên và số điện thoại người giám hộ." };
      if (gp === p) return { ok: false as const, error: "Số của người giám hộ phải khác số của bạn." };
      g = { name: guardian.name.trim(), phoneMasked: maskPhone(gp) };
    }
    const accounts = read<Record<string, { birthDate: string; guardian?: Guardian }>>(KEY_ACCOUNTS) ?? {};
    accounts[accountKey(p)] = { birthDate, guardian: g };
    write(KEY_ACCOUNTS, accounts);
    this.start(p, birthDate, g);
    return { ok: true as const };
  }

  logout(): void {
    this.current = null;
    write(KEY_SESSION, null);
  }

  playedMinutesToday(): number {
    const play = read<{ date: string; ms: number }>(KEY_PLAY);
    return play && play.date === new Date().toDateString() ? Math.floor(play.ms / 60_000) : 0;
  }

  private start(phone: string, birthDate: string, guardian?: Guardian): void {
    this.current = { phoneMasked: maskPhone(phone), birthDate, guardian, since: Date.now() };
    write(KEY_SESSION, this.current);
  }

  private addPlay(ms: number): void {
    const today = new Date().toDateString();
    const play = read<{ date: string; ms: number }>(KEY_PLAY);
    write(KEY_PLAY, { date: today, ms: (play && play.date === today ? play.ms : 0) + ms });
  }
}
