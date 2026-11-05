// Cờ bản mẫu: thế giới mẫu cấp 42 (mock/world.ts createWorld, tông chủ Lôi Trì Phong đủ đồ) chỉ chạy trên máy dev, để các
// phiên khác chụp được màn đầy đủ. Bật bằng ?demo=1 (nhớ trong sessionStorage tới khi đóng tab, ?demo=0 để tắt) khi chạy
// `npm run dev` hoặc mở bản build ở localhost. Bản lên mạng (play.thienhoangky.fun) luôn là người mới.
const KEY = "ktlp.demo";

function laMayDev(): boolean {
  const h = location.hostname;
  return import.meta.env.DEV || h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".localhost");
}

export function laBanMau(): boolean {
  if (!laMayDev()) return false;
  const q = new URLSearchParams(location.search).get("demo");
  try {
    if (q === "1") sessionStorage.setItem(KEY, "1");
    else if (q === "0") sessionStorage.removeItem(KEY);
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return q === "1";
  }
}
