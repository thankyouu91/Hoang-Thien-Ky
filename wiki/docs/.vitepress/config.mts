// Cấu hình wiki Thiên Hoang Ký (wiki.thienhoangky.fun). Hướng dẫn: wiki/README.md.
// Trang trong docs/tra-cuu/ và đoạn trong docs/_sinh/ do scripts/sinh.ts sinh từ data/he_thong/json, đừng sửa tay.
import { defineConfig } from "vitepress";
import { SIDEBAR_TRA_CUU } from "./traCuu.ts";
import { tachMuc } from "./timKiem.ts";

/** Địa chỉ game. Đổi ở đây và trong wrangler.jsonc (biến LINK_GAME) nếu tab deploy đổi tên miền game. */
const LINK_GAME = "https://play.thienhoangky.fun";

export default defineConfig({
  lang: "vi-VN",
  title: "Wiki Thiên Hoang Ký",
  titleTemplate: ":title · Wiki Thiên Hoang Ký",
  description: "Wiki cho người chơi thử Thiên Hoang Ký: luật chơi, công pháp, tông môn, bí cảnh và bảng tra số liệu.",
  cleanUrls: true,
  // Chỉ có giao diện sáng kem như game (mẫu tranh giấy).
  appearance: false,
  lastUpdated: false,
  srcExclude: ["_sinh/**", "README.md"],
  head: [
    ["meta", { name: "robots", content: "noindex, nofollow" }],
    ["meta", { name: "theme-color", content: "#f6efdf" }],
    ["link", { rel: "icon", type: "image/svg+xml", href: "/logo.svg" }],
  ],
  markdown: {
    // Bảng to (480 tàn quyển) không cần mục lục tự động trong khối mã.
    lineNumbers: false,
  },
  themeConfig: {
    logo: { src: "/logo.svg", alt: "" },
    siteTitle: "Thiên Hoang Ký",
    nav: [
      { text: "Người mới", link: "/nhap-mon/nguoi-moi", activeMatch: "^/nhap-mon/" },
      { text: "Tra cứu", link: "/tra-cuu/", activeMatch: "^/tra-cuu/" },
      { text: "Hỏi đáp", link: "/hoi-dap/" },
      { text: "Vào game", link: LINK_GAME, target: "_self" },
    ],
    sidebar: [
      {
        text: "Nhập môn",
        items: [
          { text: "Thiên Hoang Ký là gì", link: "/nhap-mon/" },
          { text: "Hướng dẫn người mới", link: "/nhap-mon/nguoi-moi" },
          { text: "Câu hỏi thường gặp", link: "/hoi-dap/" },
        ],
      },
      {
        text: "Thế giới và bản đồ",
        collapsed: false,
        items: [
          { text: "Bốn vị diện", link: "/the-gioi/" },
          { text: "Thành chủ và sương mù", link: "/the-gioi/thanh-chu" },
          { text: "Bản đồ tranh", link: "/ban-do/" },
          { text: "Mỏ và tài nguyên", link: "/ban-do/mo" },
          { text: "Hành trình và đồ sát", link: "/ban-do/hanh-trinh" },
        ],
      },
      {
        text: "Chiến đấu và công pháp",
        collapsed: false,
        items: [
          { text: "12 hệ và khắc chế", link: "/he/" },
          { text: "10 loại chiêu", link: "/chieu-thuc/" },
          { text: "Tàn quyển và công pháp", link: "/cong-phap/" },
        ],
      },
      {
        text: "Tu luyện",
        collapsed: false,
        items: [
          { text: "Tu luyện và cảnh giới", link: "/tu-luyen/" },
          { text: "Nhân vật và tài năng", link: "/tu-luyen/nhan-vat" },
        ],
      },
      {
        text: "Tông môn",
        collapsed: false,
        items: [
          { text: "Tông môn và công trình", link: "/tong-mon/" },
          { text: "Đệ tử và chức vị", link: "/tong-mon/de-tu" },
          { text: "Chiến tranh và liên minh", link: "/chien-tranh/" },
          { text: "Trận pháp và công thành", link: "/chien-tranh/tran-phap" },
        ],
      },
      {
        text: "Phiêu lưu",
        collapsed: false,
        items: [
          { text: "Bí cảnh", link: "/bi-canh/" },
          { text: "Nhiệm vụ", link: "/nhiem-vu/" },
        ],
      },
      {
        text: "Vật phẩm",
        collapsed: false,
        items: [
          { text: "Trang bị", link: "/trang-bi/" },
          { text: "Ngọc và khảm", link: "/trang-bi/ngoc" },
          { text: "Set đồ", link: "/trang-bi/set-do" },
          { text: "Pháp bảo và pháp khí", link: "/trang-bi/phap-bao" },
          { text: "Luyện khí", link: "/trang-bi/luyen-khi" },
          { text: "Đan dược", link: "/dan-duoc/" },
          { text: "Thú cưỡi", link: "/thu-cuoi/" },
        ],
      },
      { text: "Tra cứu", collapsed: true, link: "/tra-cuu/", items: SIDEBAR_TRA_CUU },
    ],
    outline: { level: [2, 3], label: "Trong trang này" },
    docFooter: { prev: "Trang trước", next: "Trang sau" },
    sidebarMenuLabel: "Mục lục",
    returnToTopLabel: "Lên đầu trang",
    darkModeSwitchLabel: "Giao diện",
    langMenuLabel: "Ngôn ngữ",
    externalLinkIcon: false,
    notFound: {
      title: "KHÔNG THẤY TRANG",
      quote: "Đường này sương mù còn dày. Quay về trang chủ hoặc thử ô tìm kiếm.",
      linkLabel: "về trang chủ",
      linkText: "Về trang chủ",
    },
    footer: {
      message: "Bản chơi thử kín, chỉ dành cho người được mời. Số liệu có thể đổi theo từng bản cập nhật.",
    },
    search: {
      provider: "local",
      options: {
        translations: {
          button: { buttonText: "Tìm", buttonAriaLabel: "Tìm trong wiki" },
          modal: {
            displayDetails: "Hiện đoạn khớp",
            resetButtonTitle: "Xóa ô tìm",
            backButtonTitle: "Đóng",
            noResultsText: "Không thấy kết quả cho",
            footer: {
              selectText: "mở",
              selectKeyAriaLabel: "Enter",
              navigateText: "chọn",
              navigateUpKeyAriaLabel: "mũi tên lên",
              navigateDownKeyAriaLabel: "mũi tên xuống",
              closeText: "đóng",
              closeKeyAriaLabel: "Esc",
            },
          },
        },
        miniSearch: {
          // Chỉ chạy lúc build (khóa có dấu _ không gửi xuống trình duyệt): mỗi dòng bảng tra cứu thành một kết quả.
          _splitIntoSections: (file: string, html: string) => tachMuc(file, html),
          options: {
            // Gõ có dấu hay không dấu đều ra: bỏ dấu thanh, dấu mũ, móc và đổi đ thành d, cả khi lập chỉ mục lẫn khi tìm.
            // VitePress chuyển hàm này sang trình duyệt bằng toString(), nên nó không được dùng biến bên ngoài.
            processTerm(term: string) {
              return term
                .toLowerCase()
                .normalize("NFD")
                .replace(/[̀-ͯ]/g, "")
                .replace(/đ/g, "d");
            },
          },
          searchOptions: {
            // Tiếng Việt nhiều tiếng ngắn: tìm theo tiền tố, sai một chữ vẫn ra, khớp đủ mọi tiếng xếp trước.
            combineWith: "AND",
            prefix: true,
            fuzzy: 0.15,
            boost: { title: 5, titles: 2, text: 1 },
          },
        },
      },
    },
  },
});
