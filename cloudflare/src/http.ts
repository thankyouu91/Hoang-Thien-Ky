// Tiện ích HTTP dùng chung cho Worker game và Worker admin.

export class LoiApi extends Error {
  readonly status: number;
  readonly ma: string;
  constructor(status: number, ma: string, message?: string) {
    super(message ?? ma);
    this.status = status;
    this.ma = ma;
  }
}

const HEADER_CHUNG: Record<string, string> = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};

export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...HEADER_CHUNG, ...extra },
  });
}

export function loi(status: number, ma: string, thong_diep?: string): Response {
  return json({ loi: ma, ...(thong_diep ? { thong_diep } : {}) }, status);
}

export function traLoi(e: unknown): Response {
  if (e instanceof LoiApi) return loi(e.status, e.ma, e.message !== e.ma ? e.message : undefined);
  console.error("loi_server", e instanceof Error ? (e.stack ?? e.message) : String(e));
  return loi(500, "loi_server");
}

/**
 * Chặn ghi từ trang khác (CSRF): thao tác ghi phải là JSON (trang khác gửi JSON sẽ phải qua preflight CORS mà Worker
 * không cho) và Origin, nếu có, phải trùng hostname đang gọi.
 */
export function kiemGhi(req: Request): void {
  const url = new URL(req.url);
  const origin = req.headers.get("Origin");
  if (origin && origin !== url.origin) throw new LoiApi(403, "sai_nguon_goi");
  const type = (req.headers.get("Content-Type") ?? "").toLowerCase();
  if (!type.startsWith("application/json")) throw new LoiApi(415, "can_json", "Content-Type phải là application/json.");
}

/** Đọc body JSON có giới hạn kích thước (byte). */
export async function docJson(req: Request, toiDa: number): Promise<unknown> {
  const len = Number(req.headers.get("Content-Length") ?? "0");
  if (len > toiDa) throw new LoiApi(413, "qua_lon", `Body tối đa ${toiDa} byte.`);
  const text = await req.text();
  if (new TextEncoder().encode(text).length > toiDa) throw new LoiApi(413, "qua_lon", `Body tối đa ${toiDa} byte.`);
  try {
    return JSON.parse(text);
  } catch {
    throw new LoiApi(400, "json_sai");
  }
}

export function soNguyen(v: string | null, macDinh: number, min: number, max: number): number {
  if (v === null || v === "") return macDinh;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new LoiApi(400, "tham_so_sai", `Giá trị ${v} phải là số nguyên trong [${min}, ${max}].`);
  return n;
}
