// Phần giao diện nối máy chủ (server.ts của phiên deploy, hợp đồng ở docs/api.md):
// - dải thông báo đầu Động phủ: tin còn hiệu lực chưa ẩn đầu tiên (quan trọng viền son), chạm mở bảng đọc đủ; mỗi tin có
//   nút Ẩn, id đã ẩn lưu ở localStorage htk.tb_an;
// - bảng Góp ý (màn Nhân vật, mục Tài khoản): loại Báo lỗi / Góp ý / Khác, ô viết, Gửi; server.ts trả lỗi bằng câu tiếng Việt,
//   hiện thẳng trong bảng; không thu số điện thoại hay email;
// - màn bảo trì: cấu hình sống bao_tri = true thì phủ cả game, có nút Thử lại; kiểm lại mỗi phút.
// Chạy dev không có API: không có thông báo, nút Góp ý ẩn (body[data-may-chu="khong_co"]), không bảo trì.
// Chữ do người quản trị viết (tiêu đề, nội dung thông báo, lời bảo trì) gắn data-no-tr: lớp dịch giữ nguyên.
import { locale } from "./i18n.ts";
import { guiPhanHoi, layCauHinh, layThongBao, theoDoiTrangThai, trangThaiMayChu, type LoaiPhanHoi, type ThongBao } from "./server.ts";
import { clockText, closeSheet, esc, openSheet, toast } from "./ui.ts";

// ---- Thông báo ---------------------------------------------------------------------------------------------------

const AN_KEY = "htk.tb_an";
const TB_TTL = 5 * 60_000;
let tb: { at: number; list: ThongBao[] } | undefined;
let tbDang: Promise<ThongBao[]> | undefined;

function daAn(): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(AN_KEY) ?? "[]") as number[]);
  } catch {
    return new Set();
  }
}

function luuAn(s: Set<number>): void {
  try {
    localStorage.setItem(AN_KEY, JSON.stringify([...s].slice(-200)));
  } catch {
    // Không lưu được thì tin đã ẩn hiện lại ở lần tải sau.
  }
}

/** Thông báo từ máy chủ, đọc lại tối đa 5 phút một lần (các lần vẽ lại Động phủ dùng bản đã đọc). */
export function docThongBao(): Promise<ThongBao[]> {
  if (tb && Date.now() - tb.at < TB_TTL) return Promise.resolve(tb.list);
  tbDang ??= layThongBao().then((list) => {
    tb = { at: Date.now(), list };
    tbDang = undefined;
    return list;
  });
  return tbDang;
}

const conHieuLuc = (t: ThongBao, now: number) => t.bat_dau <= now && (t.ket_thuc === null || t.ket_thuc > now);
const ngay = (ms: number) => `${new Date(ms).toLocaleDateString(locale(), { day: "2-digit", month: "2-digit" })} ${clockText(ms)}`;

/** Gắn dải thông báo vào `slot`: tin chưa ẩn đầu tiên (danh sách đã xếp quan trọng trước); không có thì để trống. */
export function ganDaiThongBao(slot: HTMLElement): void {
  const ve = (list: ThongBao[]) => {
    if (!slot.isConnected) return;
    const now = Date.now();
    const an = daAn();
    const hien = list.filter((t) => conHieuLuc(t, now) && !an.has(t.id));
    if (!hien.length) {
      slot.replaceChildren();
      return;
    }
    const t = hien[0];
    slot.innerHTML = `<button type="button" class="tb-dai${t.muc === "quan_trong" ? " quan-trong" : ""}">
        <span class="tb-nhan">${t.muc === "quan_trong" ? "Quan trọng" : "Thông báo"}</span>
        <b class="tb-tieu-de" data-no-tr>${esc(t.tieu_de)}</b>${hien.length > 1 ? `<span class="tb-them">+${hien.length - 1}</span>` : ""}<span class="go" aria-hidden="true">›</span>
      </button>`;
    slot.querySelector("button")!.addEventListener("click", () => moThongBao(list, () => ve(list)));
  };
  if (tb) ve(tb.list);
  void docThongBao().then(ve);
}

/** Bảng đọc mọi thông báo còn hiệu lực; Ẩn / Hiện lại từng tin. `onDoi` gọi khi đổi để dải vẽ lại. */
function moThongBao(list: ThongBao[], onDoi: () => void): void {
  const body = openSheet("Thông báo", "");
  const ve = () => {
    const now = Date.now();
    const an = daAn();
    const hien = list.filter((t) => conHieuLuc(t, now));
    body.innerHTML = hien.length
      ? `<ul class="tb-list">${hien
          .map(
            (t) => `<li class="${t.muc === "quan_trong" ? "quan-trong" : ""}${an.has(t.id) ? " da-an" : ""}">
              <div class="tb-dau"><span class="tb-nhan">${t.muc === "quan_trong" ? "Quan trọng" : "Thông báo"}</span><span class="muted">${ngay(t.bat_dau)}</span></div>
              <h3 data-no-tr>${esc(t.tieu_de)}</h3>
              <p data-no-tr>${esc(t.noi_dung)}</p>
              <button type="button" class="btn small" data-tb="${t.id}">${an.has(t.id) ? "Hiện lại ở Động phủ" : "Ẩn khỏi Động phủ"}</button>
            </li>`,
          )
          .join("")}</ul>`
      : `<p class="muted">Chưa có thông báo.</p>`;
  };
  body.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-tb]");
    if (!b) return;
    const id = Number(b.dataset.tb);
    const an = daAn();
    if (an.has(id)) an.delete(id);
    else an.add(id);
    luuAn(an);
    ve();
    onDoi();
  });
  ve();
}

// ---- Góp ý -------------------------------------------------------------------------------------------------------

const LOAI: [LoaiPhanHoi, string][] = [
  ["loi", "Báo lỗi"],
  ["gop_y", "Góp ý"],
  ["khac", "Khác"],
];

/** Bảng Góp ý: chọn loại, viết (tối đa 2000 ký tự), Gửi. Gửi được thì đóng bảng và báo cảm ơn. */
export function moGopY(): void {
  const body = openSheet(
    "Góp ý",
    `<form class="gop-y" novalidate>
      <p class="nv-note">Đạo hữu gặp lỗi, hay muốn game có thêm gì? Viết càng cụ thể càng dễ sửa. Không cần ghi số điện thoại hay email.</p>
      <div class="seg" role="radiogroup" aria-label="Loại phản hồi">${LOAI.map(([id, t]) => `<button type="button" role="radio" data-loai="${id}" aria-checked="${id === "gop_y"}">${t}</button>`).join("")}</div>
      <textarea name="nd" rows="6" maxlength="2000" placeholder="Ví dụ: ở màn Tông môn, bấm Thu mỏ thì số linh thạch không đổi."></textarea>
      <p class="gop-y-loi bad" role="alert" hidden></p>
      <div class="actions"><span class="muted"><span class="dem">0</span>/2000</span><button type="submit" class="seal">Gửi</button></div>
    </form>`,
  );
  const form = body.querySelector<HTMLFormElement>("form")!;
  const ta = form.querySelector("textarea")!;
  const loi = form.querySelector<HTMLElement>(".gop-y-loi")!;
  const gui = form.querySelector<HTMLButtonElement>("[type=submit]")!;
  let loai: LoaiPhanHoi = "gop_y";
  form.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-loai]");
    if (!b) return;
    loai = b.dataset.loai as LoaiPhanHoi;
    for (const x of form.querySelectorAll("[data-loai]")) x.setAttribute("aria-checked", String(x === b));
  });
  ta.addEventListener("input", () => {
    form.querySelector(".dem")!.textContent = String(ta.value.length);
    loi.hidden = true;
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    gui.disabled = true;
    const r = await guiPhanHoi(loai, ta.value.trim());
    gui.disabled = false;
    if (r.ok) {
      closeSheet();
      toast("Đã gửi. Cảm ơn đạo hữu!");
      return;
    }
    // Gắn chữ vào nút mới để lớp dịch (nếu đang tiếng Anh) dịch câu lỗi.
    loi.replaceChildren(document.createTextNode(r.loi));
    loi.hidden = false;
  });
  ta.focus({ preventScroll: true });
}

// ---- Bảo trì và trạng thái máy chủ --------------------------------------------------------------------------------

let baoTriEl: HTMLElement | undefined;

async function kiemBaoTri(): Promise<void> {
  const ch = await layCauHinh();
  const on = ch?.bao_tri === true;
  if (!on) {
    baoTriEl?.remove();
    baoTriEl = undefined;
    return;
  }
  const loi = typeof ch?.loi_bao_tri === "string" && ch.loi_bao_tri.trim() ? ch.loi_bao_tri.trim() : "";
  if (!baoTriEl) {
    baoTriEl = document.createElement("div");
    baoTriEl.id = "bao-tri";
    baoTriEl.setAttribute("role", "alertdialog");
    baoTriEl.setAttribute("aria-labelledby", "bao-tri-h");
    document.body.append(baoTriEl);
  }
  baoTriEl.innerHTML = `<div class="box">
      <img class="bao-tri-an" src="${import.meta.env.BASE_URL}brand/dau_an_128.png" alt="" width="64" height="64">
      <h2 id="bao-tri-h">Đang bảo trì</h2>
      ${loi ? `<p data-no-tr>${esc(loi)}</p>` : `<p>Máy chủ đang bảo trì. Đạo hữu quay lại sau ít phút nhé.</p>`}
      <button type="button" class="seal">Thử lại</button>
    </div>`;
  baoTriEl.querySelector("button")!.addEventListener("click", () => void kiemBaoTri());
}

let daChay = false;

/** Gọi một lần lúc vào game (index.ts, sau startTelemetry): theo dõi trạng thái máy chủ và bảo trì. */
export function startMayChuUi(): void {
  if (daChay) return;
  daChay = true;
  document.body.dataset.mayChu = trangThaiMayChu();
  theoDoiTrangThai((t) => {
    document.body.dataset.mayChu = t;
  });
  void kiemBaoTri();
  setInterval(() => void kiemBaoTri(), 60_000);
}
