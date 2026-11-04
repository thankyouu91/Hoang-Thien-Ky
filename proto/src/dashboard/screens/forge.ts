// Lò danh khí ở Luyện Khí Các (màn Tông môn; GDD tab Trang bị phần 13 mục Danh khí, đặc tả luyen-khi.md): 10 thần binh
// có tên, mỗi khí hình vũ khí một món. Bảng luyện gồm đồ phổ, phôi (vũ khí đỏ cùng khí hình), Thiên Ngoại Vẫn Thiết,
// Khí Tinh, một Tu rèn chủ lò và 3 thành viên hộ lô cùng tông. Trạng thái (Khí Tinh, đồ phổ, người luyện) là mẫu TẠM
// dùng chung với mục Luyện khí ở màn Nhân vật (luyenKhi.ts).
import { REALMS } from "../daoCoBan.ts";
import { icon } from "../icons.ts";
import { DANH_KHI, DANH_KHI_COST, doPhoCode, khiHinhOf, LO_MIN, loRate, lkPreview, lkState, reached, UNLOCK } from "../luyenKhi.ts";
import type { NhanVatView, SectMember } from "../source.ts";
import { artUrl, closeSheet, esc, fmt, openSheet, pctText, ROLE_NAMES, toast } from "../ui.ts";

/** Chủ lò và 3 hộ lô đang mời (TẠM ở màn). */
const crew: (string | null)[] = [null, null, null, null];
/** Lần đầu mở bảng: người chơi là Tu rèn thì tự ngồi ghế chủ lò. */
let seeded = false;

const art = (i: number) => `<span class="bag-cell r-do lk-dk-art">${icon("sword", "glyph")}<img class="ve" src="${artUrl(`trang_bi/kiem/${61 + i}`)}" alt="" onerror="this.remove()"></span>`;

/** Phần lò danh khí trong bảng chi tiết Luyện Khí Các. */
export function forgeHtml(lv: number, nv: NhanVatView): string {
  const st = lkState(nv);
  const rate = loRate(lv);
  return `
    <h3>Lò danh khí</h3>
    <p class="muted">${rate ? `Lò cấp ${lv}: tỷ lệ thành ${pctText(rate)}.` : `Lò cấp ${lv}: cần cấp ${LO_MIN} (thành ${pctText(loRate(9))}), cấp 10 là ${pctText(loRate(10))}.`} Danh khí là vũ khí đỏ có sẵn Ý của khí hình mạnh gấp 1,5 lần Ý châu, không chiếm dòng khảm, cộng 1 danh văn riêng. Mỗi người chỉ mặc 1 danh khí.</p>
    <ul class="list lk-dks">${DANH_KHI.map(
      (d, i) => `<li><button type="button" class="row" data-a="dk" data-i="${i}">${art(i)}<span class="grow"><b>${esc(d.ten)}</b><span class="muted block">${esc(d.hinh)} · ${st.doPho.has(doPhoCode(i)) ? "có đồ phổ" : "chưa có đồ phổ"}</span></span>${icon("chevron", "chev")}</button></li>`,
    ).join("")}</ul>`;
}

/** Bảng luyện một danh khí; `back` mở lại bảng Luyện Khí Các. */
export function openDanhKhi(i: number, lv: number, nv: NhanVatView, members: SectMember[], back: () => void): void {
  const d = DANH_KHI[i];
  const st = lkState(nv);
  const phoi = nv.bag.items.find((it) => it.gear?.slot === "vu_khi" && it.gear.rarity === "do" && !st.gone.has(it.uid) && khiHinhOf(it.code) === d.khiHinh);
  const tuRen = lkPreview.tuRen ?? nv.talent.id === "tu_ren";
  if (!seeded && tuRen) crew[0] = "me";
  seeded = true;
  const who = (id: string | null) => (id === "me" ? nv.name : members.find((m) => m.id === id)?.name);
  const need = [
    { ok: reached(REALMS[lkPreview.realm].p, UNLOCK.danhKhi), ten: "Cảnh giới", co: `Từ ${UNLOCK.danhKhi.ten}`, thieu: `cần ${UNLOCK.danhKhi.ten}` },
    { ok: lv >= LO_MIN, ten: "Lò của tông", co: `cấp ${lv}`, thieu: `cấp ${lv}, cần ${LO_MIN}` },
    { ok: st.doPho.has(doPhoCode(i)), ten: `Đồ phổ ${d.ten}`, co: "Có", thieu: "Chưa có (rơi ở Thượng Cổ Chiến Trường, Hỗn Độn Bí Cảnh)" },
    { ok: !!phoi, ten: `Phôi: vũ khí đỏ khí hình ${d.hinh}`, co: phoi?.name ?? "", thieu: "Chưa có" },
    { ok: st.vanThiet >= DANH_KHI_COST.vanThiet, ten: "Thiên Ngoại Vẫn Thiết", co: `${st.vanThiet} / ${DANH_KHI_COST.vanThiet}`, thieu: `${st.vanThiet} / ${DANH_KHI_COST.vanThiet}` },
    { ok: st.khiTinh >= DANH_KHI_COST.khiTinh, ten: "Khí Tinh", co: `${fmt(st.khiTinh)} / ${DANH_KHI_COST.khiTinh}`, thieu: `${fmt(st.khiTinh)} / ${DANH_KHI_COST.khiTinh}` },
    { ok: crew.every(Boolean), ten: "Người luyện", co: "Đủ 4 người", thieu: `${crew.filter(Boolean).length} / 4 người` },
  ];
  const ready = need.every((x) => x.ok);
  const seat = (k: number) => {
    const name = who(crew[k]);
    return `<button type="button" class="lk-seat${name ? " full" : ""}" data-a="seat" data-k="${k}"><span class="muted">${k === 0 ? "Chủ lò · Tu rèn" : `Hộ lô ${k}`}</span><b>${name ? esc(name) : "Mời"}</b></button>`;
  };
  const body = openSheet(
    d.ten,
    `<div class="bd-head">${art(i)}<span class="grow"><b class="r-do">${esc(d.ten)}</b><span class="block muted">${esc(d.hinh)} · vũ khí đỏ · ${esc(d.ma)}</span></span></div>
     <p><b>Danh văn:</b> ${esc(d.van)}</p>
     <h3>Cần có</h3>
     <ul class="list lk-need">${need.map((x) => `<li class="row ${x.ok ? "ok" : "bad"}"><span class="grow">${esc(x.ten)}</span><b>${esc(x.ok ? x.co : x.thieu)}</b></li>`).join("")}</ul>
     <h3>Người luyện <span class="muted">cùng tông, trụ cột 3</span></h3>
     <div class="lk-crew">${[0, 1, 2, 3].map(seat).join("")}</div>
     <p class="muted">Thành ${pctText(loRate(lv) || loRate(LO_MIN))} ở lò cấp ${Math.max(lv, LO_MIN)}. Thất bại mất Khí Tinh và Vẫn Thiết, giữ phôi và đồ phổ. Danh khí khóa vào nhân vật.</p>
     <div class="actions"><button type="button" data-a="back">‹ Luyện Khí Các</button><button type="button" class="seal" data-a="forge"${ready ? "" : " disabled"}>Khai lò</button></div>`,
  );
  body.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>("[data-a]");
    if (!a || (a as HTMLButtonElement).disabled) return;
    const reopen = () => openDanhKhi(i, lv, nv, members, back);
    if (a.dataset.a === "back") back();
    else if (a.dataset.a === "seat") pickCrew(Number(a.dataset.k), nv, members, reopen);
    else if (a.dataset.a === "forge") {
      closeSheet();
      st.khiTinh -= DANH_KHI_COST.khiTinh;
      st.vanThiet -= DANH_KHI_COST.vanThiet;
      if (Math.random() * 1000 < loRate(lv)) {
        st.gone.add(phoi!.uid);
        st.owned.add(d.ma);
        toast(`Luyện thành ${d.ten}.`);
      } else toast("Lò không thành: mất Khí Tinh và Vẫn Thiết, còn phôi và đồ phổ.", true);
    }
  });
}

function pickCrew(k: number, nv: NhanVatView, members: SectMember[], done: () => void): void {
  const taken = new Set(crew.filter((x, j) => x && j !== k));
  const pool = members.filter((m) => !m.npc && !taken.has(m.id)).sort((a, b) => Number(b.online) - Number(a.online) || b.level - a.level);
  const body = openSheet(
    k === 0 ? "Mời chủ lò" : `Mời hộ lô ${k}`,
    `<p class="muted">${k === 0 ? "Chủ lò phải có tài năng Tu rèn; nguồn đọc chưa có tài năng của thành viên nên prototype chưa lọc." : "Thành viên cùng tông, đang online thì vào lò ngay."}</p>
     <ul class="list">${k === 0 ? `<li><button type="button" class="row" data-id="me"><span class="grow"><b>${esc(nv.name)}</b><span class="muted block">Bản thân · ${esc(nv.talent.name)}</span></span></button></li>` : ""}${pool
       .map((m) => `<li><button type="button" class="row" data-id="${m.id}"><span class="online${m.online ? " on" : ""}" aria-hidden="true"></span><span class="grow"><b>${esc(m.name)}</b><span class="muted block">${ROLE_NAMES[m.role]} · cấp ${m.level}${m.online ? "" : " · offline"}</span></span></button></li>`)
       .join("")}</ul>
     ${crew[k] ? `<div class="actions"><button type="button" data-id="">Bỏ người này</button></div>` : ""}`,
  );
  body.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-id]");
    if (!b) return;
    crew[k] = b.dataset.id || null;
    done();
  });
}
