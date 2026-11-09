// Mã chạy chung của website: mục lục trên điện thoại, cảnh sơn thủy đầu trang chủ, hộp xem hình lớn, mục đang xem ở
// thư viện, và form góp ý. Trang vẫn đọc được khi tắt JavaScript (nội dung là HTML tĩnh).
import "./styles.css";

document.documentElement.classList.add("co-js");

function mucLuc(): void {
  const nut = document.querySelector<HTMLButtonElement>(".mo-muc");
  const nav = document.getElementById("muc-luc");
  if (!nut || !nav) return;
  const dat = (mo: boolean) => {
    nut.setAttribute("aria-expanded", String(mo));
    nav.classList.toggle("mo", mo);
  };
  nut.addEventListener("click", () => dat(nut.getAttribute("aria-expanded") !== "true"));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("mo")) {
      dat(false);
      nut.focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (nav.classList.contains("mo") && !nav.contains(e.target as Node) && !nut.contains(e.target as Node)) dat(false);
  });
}

/** Hộp xem lớn cho mọi nút `.phong` (thư viện, dải hình, trang Điểm riêng). */
function xemLon(): void {
  const nut = document.querySelectorAll<HTMLButtonElement>(".phong[data-src]");
  if (!nut.length || typeof HTMLDialogElement !== "function") return;
  const hop = document.createElement("dialog");
  hop.className = "xem-lon";
  hop.innerHTML = `<figure><div class="khung-anh"><img alt=""></div><figcaption><span></span><button type="button" class="dong" aria-label="Đóng">×</button></figcaption></figure>`;
  document.body.append(hop);
  const img = hop.querySelector("img")!;
  const ten = hop.querySelector("figcaption span")!;
  hop.querySelector(".dong")!.addEventListener("click", () => hop.close());
  hop.addEventListener("click", (e) => {
    if (e.target === hop) hop.close();
  });
  for (const b of nut) {
    b.addEventListener("click", () => {
      const nho = b.querySelector("img");
      const pix = !!b.closest(".anh-pix");
      img.src = b.dataset.src!;
      img.alt = b.dataset.ten ?? "";
      img.className = pix ? "pix" : "";
      // Hình pixel nhỏ phóng nguyên lần cho vừa khung (tối đa 6 lần), hình lớn để trình duyệt tự co.
      if (pix && nho) {
        const w = nho.naturalWidth || Number(nho.getAttribute("width")) || 64;
        const h = nho.naturalHeight || Number(nho.getAttribute("height")) || 64;
        const k = Math.max(1, Math.min(6, Math.floor(Math.min((window.innerWidth * 0.9) / w, (window.innerHeight * 0.75) / h))));
        img.style.width = `${w * k}px`;
        img.style.height = "auto";
      } else img.removeAttribute("style");
      ten.textContent = b.dataset.ten ?? "";
      hop.showModal();
    });
  }
}

/** Trang Thế giới: chạm một thẻ vị diện (hoặc một tầng trong hình) thì tầng tương ứng sáng lên. */
function tangViDien(): void {
  const the = [...document.querySelectorAll<HTMLElement>("[data-dong-tang] [data-tang]")];
  const tang = [...document.querySelectorAll<SVGGElement>(".tang-vi-dien [data-tang]")];
  if (!the.length || !tang.length) return;
  const tatCa = [...the, ...tang];
  const dat = (k: string | null) => {
    for (const e of tatCa) e.classList.toggle("sang", !!k && e.dataset.tang === k);
  };
  for (const e of tatCa) {
    e.addEventListener("mouseenter", () => dat(e.dataset.tang ?? null));
    e.addEventListener("mouseleave", () => dat(null));
    e.addEventListener("click", () => dat(e.dataset.tang ?? null));
  }
  for (const e of the) {
    e.addEventListener("focus", () => dat(e.dataset.tang ?? null));
    e.addEventListener("blur", () => dat(null));
  }
}

/** Thư viện: sáng nút nhóm đang xem trên thanh chọn nhóm. */
function nhomDangXem(): void {
  const chon = document.querySelectorAll<HTMLAnchorElement>(".chon-nhom a[href^='#']");
  if (!chon.length) return;
  const theo = new Map<Element, HTMLAnchorElement>();
  for (const a of chon) {
    const s = document.getElementById(a.hash.slice(1));
    if (s) theo.set(s, a);
  }
  const io = new IntersectionObserver(
    (ds) => {
      for (const d of ds) {
        if (!d.isIntersecting) continue;
        for (const a of chon) a.classList.remove("dang");
        const a = theo.get(d.target);
        if (!a) continue;
        a.classList.add("dang");
        // Chỉ cuộn ngang thanh chọn cho nút sáng vào giữa; scrollIntoView sẽ kéo cả trang theo.
        const thanh = a.closest("ul");
        if (thanh) thanh.scrollTo({ left: a.parentElement!.offsetLeft - (thanh.clientWidth - a.offsetWidth) / 2, behavior: "smooth" });
      }
    },
    { rootMargin: "-30% 0px -60% 0px" },
  );
  for (const s of theo.keys()) io.observe(s);
}

mucLuc();
tangViDien();
xemLon();
nhomDangXem();
// Linh khí bay chậm trên tranh hero; tranh giữ tĩnh theo ý người dùng (2026-11-05 tối).
if (document.querySelector(".hero-anh")) void import("./heroCanh.ts").then((x) => x.ganHeroCanh());
if (document.querySelector("form[data-gop-y]")) void import("./gopY.ts").then((m) => m.ganGopY());
