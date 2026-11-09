// Form góp ý (trang /gop-y/): gửi POST /api/gop-y của Worker thienhoangky-web, ghi vào bảng phan_hoi của D1 game
// (Admin Dashboard đọc ở màn Phản hồi, với man = "website"). Không hỏi tên, email hay số điện thoại.

const BAO_LOI: Record<string, string> = {
  chua_co_loi_moi: "Trình duyệt này chưa mở link mời chơi thử, nên chưa gửi được. Hãy mở link mời rồi quay lại.",
  bi_khoa: "Tài khoản chơi thử này đã bị khóa.",
  qua_nhieu: "Bạn đã gửi nhiều góp ý trong 24 giờ qua. Cảm ơn bạn, hãy thử lại sau.",
  qua_ngan: "Viết thêm vài chữ nữa nhé (ít nhất 3 ký tự).",
};

export function ganGopY(): void {
  const form = document.querySelector<HTMLFormElement>("form[data-gop-y]");
  if (!form) return;
  const vung = form.querySelector<HTMLTextAreaElement>("textarea")!;
  const dem = form.querySelector<HTMLElement>("[data-dem]");
  const bao = form.querySelector<HTMLElement>("[data-bao]")!;
  const nut = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
  const toiDa = Number(vung.maxLength) || 2000;
  const capNhat = () => {
    if (dem) dem.textContent = `${vung.value.length}/${toiDa}`;
  };
  vung.addEventListener("input", capNhat);
  capNhat();

  const hien = (loai: "tot" | "loi", chu: string) => {
    bao.hidden = false;
    bao.className = `bao ${loai}`;
    bao.textContent = chu;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const noiDung = vung.value.trim();
    if (noiDung.length < 3) {
      hien("loi", BAO_LOI.qua_ngan);
      vung.focus();
      return;
    }
    const loai = (form.elements.namedItem("loai") as RadioNodeList | null)?.value || "gop_y";
    nut.disabled = true;
    try {
      const r = await fetch("/api/gop-y", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ loai, noi_dung: noiDung, man: `website:${document.referrer ? new URL(document.referrer).pathname.slice(0, 40) : "truc-tiep"}` }),
      });
      if (r.ok) {
        form.reset();
        capNhat();
        hien("tot", "Đã nhận góp ý. Cảm ơn đạo hữu!");
        return;
      }
      const j = (await r.json().catch(() => ({}))) as { loi?: string; thong_diep?: string };
      hien("loi", BAO_LOI[j.loi ?? ""] ?? j.thong_diep ?? "Chưa gửi được. Hãy thử lại sau ít phút.");
    } catch {
      hien("loi", "Không nối được máy chủ. Kiểm tra mạng rồi thử lại.");
    } finally {
      nut.disabled = false;
    }
  });
}
