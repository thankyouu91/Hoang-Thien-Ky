// Gọi API admin cùng nguồn. Cookie Access đi kèm tự động; Access thêm JWT ở edge, Worker xác minh.
// "Xem như Vận hành" gửi header X-Xem-Nhu để server tự hạ quyền: thử được việc chặn ở server mà không cần email thứ hai.

let xemNhuVanHanh = false;
try {
  xemNhuVanHanh = sessionStorage.getItem("qt.xemNhu") === "van_hanh";
} catch {
  // bộ nhớ phiên bị chặn: mặc định tắt
}

export function dangXemNhu(): boolean {
  return xemNhuVanHanh;
}
export function datXemNhu(on: boolean): void {
  xemNhuVanHanh = on;
  try {
    if (on) sessionStorage.setItem("qt.xemNhu", "van_hanh");
    else sessionStorage.removeItem("qt.xemNhu");
  } catch {
    // bỏ qua
  }
}

export class ApiLoi extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function goi<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (xemNhuVanHanh) headers["X-Xem-Nhu"] = "van_hanh";
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: "same-origin", redirect: "manual" });
  } catch {
    throw new ApiLoi(0, "Không gọi được máy chủ admin. Kiểm tra mạng rồi thử lại.");
  }
  // Phiên Access hết hạn: Access trả chuyển hướng tới trang đăng nhập (opaqueredirect với redirect: "manual").
  if (res.type === "opaqueredirect" || res.status === 0) throw new ApiLoi(401, "Phiên đăng nhập Access đã hết. Tải lại trang để đăng nhập lại.");
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiLoi(res.status, res.ok ? "Máy chủ trả dữ liệu lạ." : `Lỗi ${res.status}.`);
  }
  if (!res.ok) throw new ApiLoi(res.status, (data as { loi?: string })?.loi ?? `Lỗi ${res.status}.`);
  return data as T;
}

export const api = {
  get: <T>(path: string) => goi<T>("GET", path),
  post: <T>(path: string, body: unknown) => goi<T>("POST", path, body),
};
