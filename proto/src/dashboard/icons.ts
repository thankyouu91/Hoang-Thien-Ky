// Bộ icon nét mảnh 24 × 24 cho dashboard (thay ký tự ⇢ ⌂ ⚒…), vẽ bằng currentColor để theo màu chữ.
const PATHS = {
  // Thanh dưới
  dong_phu: "M4 20V10.5L12 5l8 5.5V20M9 20v-5a3 3 0 0 1 6 0v5M2.5 20h19",
  ban_do: "M9 4.5 3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2-6-2Zm0 0v13m6-11v13",
  tong_mon: "M3 9.5h18M5 9.5 12 4l7 5.5M6 9.5V19m12-9.5V19M10 19v-5h4v5M3 19h18M4.5 12.5l-1.5 1M19.5 12.5l1.5 1",
  cong_phap: "M6 4h10.5A1.5 1.5 0 0 1 18 5.5V20H7.5A1.5 1.5 0 0 1 6 18.5V4Zm0 14.5A1.5 1.5 0 0 1 7.5 17H18M10 8h4m-4 3h4",
  lien_minh: "M6 21V4m0 1h9l-1.5 3L15 11H6M12 21v-6m0 0h6l-1-2 1-2h-6",
  // Việc đang chạy
  hanh_trinh: "M5 19c2-6 5-9 9-10m0 0-2.5-2.5M14 9l-2.5 2.5M17 5a2 2 0 1 0 0 .01M5 19h.01",
  xay: "M4 20h16M6 20V9l6-4 6 4v11M10 20v-6h4v6",
  ren: "M4 15h10l2-3H8L6.5 9H4v6Zm4 0v4m4-4v4M15 6l3-3m-1 5 3-1",
  luyen_dan: "M7 9h10l-1 7a4 4 0 0 1-4 3 4 4 0 0 1-4-3L7 9Zm-1 0h12M10 5c0 1 1 1 1 2m2-3c0 1 1 1 1 2",
  be_quan: "M12 4a8 8 0 1 0 0 16 4 4 0 0 1 0-8 4 4 0 0 0 0-8Zm0 4.5h.01M12 15.5h.01",
  // Khác
  chevron: "m9 6 6 6-6 6",
  back: "m15 6-6 6 6 6",
  clock: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  sword: "M14.5 4H20v5.5L9 20.5 3.5 15 14.5 4ZM6 12.5l5.5 5.5M4 20l2-2",
  mail: "M4 6h16v12H4V6Zm0 0 8 7 8-7",
  scroll: "M8 4h9a2 2 0 0 1 0 4h-1v10a2 2 0 0 1-2 2H6a2 2 0 0 1 0-4h1V6a2 2 0 0 1 1-2Zm2 6h4m-4 3h4",
  city: "M3 20h18M5 20V8l4-3 4 3v12m0-9h6v9M8 11h2m-2 3h2",
  shield: "M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0m1-9a3 3 0 1 0-1-5.8M21 20a5.5 5.5 0 0 0-4-5.3",
  vault: "M4 5h16v14H4V5Zm8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0-3h3M7 19v2m10-2v2",
  map_pin: "M12 21s-6-5.5-6-10.5a6 6 0 0 1 12 0C18 15.5 12 21 12 21Zm0-8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  logout: "M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4m-4 4h10",
  gem: "M7 4h10l4 5-9 11L3 9l4-5Zm-4 5h18M12 20 8.5 9 12 4l3.5 5L12 20",
  jade: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2.5-11.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5m0 3h.01",
  close: "M6 6l12 12M18 6 6 18",
  // Món trong túi chưa có hình PixelLab (ký hiệu tạm trên nền màu phẩm)
  ao: "M8.5 4 4 7l2 4 2-1v10h8V10l2 1 2-4-4.5-3c-.8 1.8-2 2.8-3.5 2.8S9.3 5.8 8.5 4Z",
  dai: "M3 10h18v4H3v-4Zm7.5-1.5v7h3v-7h-3Z",
  giay: "M7 4h4.5v9l6.5 3c1.2.6 2 1.7 2 3v1H7V4Zm0 12h6",
  ngoc_boi: "M12 3v3m0 0a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 3.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6ZM10 16l-1.5 5m5.5-5 1.5 5",
  dan: "M12 20a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm-3.5-8a3.5 3.5 0 0 1 3.5-3",
  quang: "M4 17 8 8l5 2 3-4 4 9-3 4H7l-3-2Zm4-9 3 9m2-7 1 9",
  duoc: "M12 21V11m0 0C12 7.5 10 5 5.5 4c0 4.5 2.5 7 6.5 7Zm0 0c0-3.5 2-6 6.5-7 0 4.5-2.5 7-6.5 7Zm-5 10h10",
  phu: "M7 3h10v18l-5-3-5 3V3Zm3 4h4m-4 3h4m-2 0v5",
  trung: "M12 3c-4 0-7 6-7 11a7 7 0 0 0 14 0c0-5-3-11-7-11Zm-3.5 10.5 2 2 1.5-2 1.5 2 2-2",
  bao_tay: "M8 21v-6.5L5.5 11V7a1.5 1.5 0 0 1 3 0v3M8.5 9V4.5a1.5 1.5 0 0 1 3 0V9m0-3.5a1.5 1.5 0 0 1 3 0V10m0-3a1.5 1.5 0 0 1 3 0v6.5L16 21H8Z",
  yen: "M4 15c2-1.5 4.5-5 8-5s6 3.5 8 5M7 15v4m10-4v4M9 10.8 12 6l3 4.8",
} as const;

export type IconName = keyof typeof PATHS;

export function icon(name: IconName, cls = "ic"): string {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${PATHS[name]}"/></svg>`;
}
