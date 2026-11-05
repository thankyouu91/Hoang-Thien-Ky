// Chặn lỗi tải chunk JS sau một lần deploy: người chơi đang mở game thì bản mới lên, chunk cũ bị xoá và máy chủ trả trang
// HTML thay cho file JS, nên import() động hỏng (màn Trận kẹt ở "Đang tải…"). Lần đầu: tự tải lại trang một lần, giữ màn
// đang mở. Lỗi lặp lại trong vòng một phút (cờ trong sessionStorage, chống tải lại vòng tròn): không tải lại nữa mà hiện câu
// báo kèm nút tải lại; lỗi vẫn ném cho nơi gọi để các lớp có bản dự phòng (hiệu ứng 2D, nền PixelLab) dùng tiếp.
// Bản build gói mọi import() động trong __vitePreload, hàm này phát sự kiện "vite:preloadError" khi tải chunk hay CSS lỗi.

const KEY = "ktlp.chunkReload";
const WINDOW_MS = 60_000;

let installed = false;
let notice: HTMLElement | null = null;
/** Màn đang mở không dựng lại được sau khi tải lại (ví dụ trận mở từ chiến báo) thì trả hash để về; null thì giữ nguyên. */
let returnHash: () => string | null = () => null;

export function setReturnHash(fn: () => string | null): void {
  returnHash = fn;
}

/** Lỗi của import() động hay preload: thông báo khác nhau theo trình duyệt. */
export function isChunkError(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  return /dynamically imported module|Importing a module script failed|module script|MIME type|Unable to preload CSS/i.test(m);
}

function reloadedRecently(): boolean {
  try {
    return Date.now() - Number(sessionStorage.getItem(KEY) ?? 0) < WINDOW_MS;
  } catch {
    // Không đọc được bộ nhớ phiên: coi như vừa tải lại để khỏi tải vòng tròn.
    return true;
  }
}

function markReload(): void {
  try {
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // bỏ qua: reloadedRecently() cũng sẽ trả true
  }
}

function showNotice(): void {
  if (notice) return;
  notice = document.createElement("div");
  notice.setAttribute("role", "alert");
  Object.assign(notice.style, {
    position: "fixed", left: "50%", top: "72px", transform: "translateX(-50%)", zIndex: "1000", width: "min(340px, calc(100vw - 32px))",
    padding: "14px 16px", background: "#fffaf0", color: "#2a211a", border: "1px solid #b3261e", borderRadius: "10px",
    boxShadow: "0 6px 20px rgba(0, 0, 0, 0.35)", font: "15px/1.4 serif", textAlign: "center",
  });
  notice.innerHTML = `<p style="margin:0 0 10px">Game vừa có bản mới. Tải lại trang để chơi tiếp.</p>
<button type="button" style="min-width:140px;height:40px;border:0;border-radius:8px;background:#b3261e;color:#fffaf0;font:600 16px serif">Tải lại</button>`;
  notice.querySelector("button")!.addEventListener("click", reload);
  document.body.append(notice);
}

/** Tải lại trang, về màn đã mở nếu màn hiện tại không dựng lại được. */
function reload(): void {
  const hash = returnHash();
  if (hash && location.hash !== hash) history.replaceState(history.state, "", hash);
  location.reload();
}

/** Xử lý một lỗi tải chunk: true khi đã cho tải lại trang (nơi gọi có thể nuốt lỗi), false khi chỉ hiện câu báo. */
export function onChunkError(): boolean {
  if (!reloadedRecently()) {
    markReload();
    reload();
    return true;
  }
  showNotice();
  return false;
}

/** Gắn một lần lúc mở app. */
export function installChunkGuard(): void {
  if (installed) return;
  installed = true;
  window.addEventListener("vite:preloadError", (e) => {
    if (onChunkError()) e.preventDefault();
  });
  // import() không đi qua __vitePreload (lúc chạy dev, hay mã ngoài Vite) mà không ai bắt.
  window.addEventListener("unhandledrejection", (e) => {
    if (isChunkError(e.reason) && onChunkError()) e.preventDefault();
  });
}
