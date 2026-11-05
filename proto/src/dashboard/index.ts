// Ghép dashboard vào khung proto (GDD mục 14): thanh dưới Động phủ · Bản đồ · Tông môn · Công pháp · Liên minh,
// thanh trên ở mọi màn chính, màn Nhân vật mở từ thanh trên, Trận mở từ chiến báo.
import "./dashboard.css";
import "./game.css";
import "./fonts.css";
import type { App } from "../app/app.ts";
import type { Scene } from "../app/scene.ts";
import type { Sprites } from "../assets/sprites.ts";
import { simReplaySource } from "../replay/simSource.ts";
import type { ReplaySource } from "../replay/types.ts";
import type { BattleScene } from "../scenes/battle/battleScene.ts";
import { MapScene } from "../scenes/map/mapScene.ts";
import { MockAuth } from "./auth.ts";
import { icon, type IconName } from "./icons.ts";
import { showLogin } from "./login.ts";
import { attachTerms } from "./terms.ts";
import { startRestReminder } from "./reminder.ts";
import { startTelemetry } from "./server.ts";
import { startMayChuUi } from "./mayChuUi.ts";
import { AGE_LABEL, MockDashboardSource } from "./mock/source.ts";
import { laBanMau } from "./moi/demo.ts";
import { moFtue } from "./moi/ftueUi.ts";
import { NguonTheoTaiKhoan } from "./moi/nguonMoi.ts";
import { CongPhapScene } from "./screens/congPhap.ts";
import { DongPhuScene } from "./screens/dongPhu.ts";
import { LienMinhScene } from "./screens/lienMinh.ts";
import { NhanVatScene } from "./screens/nhanVat.ts";
import { TongMonScene } from "./screens/tongMon.ts";
import { lazySource, TopBar, type DashCtx } from "./shell.ts";
import type { Go } from "./source.ts";
import { artUrl, closeSheet, ServerClock, tickCountdowns, toast } from "./ui.ts";

export interface Dashboard {
  /** Năm màn trên thanh dưới, theo thứ tự GDD. */
  tabs: Scene[];
  /** Màn không có nút: Nhân vật (và Trận do main.ts thêm). */
  offTab: Scene[];
  onShow(s: Scene): void;
  attach(app: App): void;
}

const TAB_IDS = ["dong-phu", "ban-do", "tong-mon", "cong-phap", "lien-minh"];
const TAB_ICONS: Record<string, IconName> = { "dong-phu": "dong_phu", "ban-do": "ban_do", "tong-mon": "tong_mon", "cong-phap": "cong_phap", "lien-minh": "lien_minh" };

export function createDashboard(sprites: Sprites, canvas: HTMLCanvasElement, battle: BattleScene): Dashboard {
  let app: App | undefined;
  let lastMain = "dong-phu";
  const replays = new Map<number, ReplaySource>();

  const nav = {
    go(g: Go): void {
      closeSheet();
      if (!app) return;
      switch (g.screen) {
        case "dong-phu":
        case "lien-minh":
          app.show(byId[g.screen]);
          break;
        case "ban-do":
          map.focus(g);
          app.show(map);
          break;
        case "tong-mon":
          tongMon.setTab(g.tab ?? "tong-quan");
          app.show(tongMon);
          break;
        case "cong-phap":
          congPhap.focusSection(g.section);
          app.show(congPhap);
          break;
        case "nhan-vat":
          nhanVat.setTab(g.tab ?? "phap-tuong");
          app.open("nhan-vat");
          break;
        case "thanh-chu":
          app.show(dongPhu);
          break;
        case "nhiem-vu":
          if (ftue) ftue.moBuoc();
          else app.show(dongPhu);
          break;
        case "tran":
          void openBattle(g.battleId);
          break;
      }
    },
    back(): void {
      app?.show(byId[lastMain]);
    },
  };

  const openBattle = async (id: number) => {
    let src = replays.get(id);
    if (!src) {
      const b = await ctx.source.battle(id);
      if (!b) return toast("Không tìm thấy trận này", true);
      src = simReplaySource(b.label, () => b.input, b.arena, { teams: b.teams, viewer: b.viewer });
      replays.set(id, src);
    }
    battle.open(src);
    app?.open(battle.id);
  };

  const topbar = new TopBar(
    () => nav.go({ screen: "nhan-vat" }),
    () => (history.length > 1 ? history.back() : nav.back()),
  );
  document.body.prepend(topbar.el);

  const auth = new MockAuth();
  attachTerms();
  startRestReminder(auth);
  // Sự kiện ẩn danh lên thienhoangky.fun/api (docs/api.md); chạy dev không có API thì tự tắt.
  startTelemetry(auth);
  // Màn bảo trì theo cấu hình sống, ẩn nút Góp ý khi không nối được máy chủ (mayChuUi.ts).
  startMayChuUi();
  // Người chơi mới bắt đầu từ cấp 1, tiến độ lưu theo tài khoản (moi/). Thế giới mẫu cấp 42 chỉ chạy với ?demo=1 trên máy dev.
  const banMau = laBanMau();
  const nguonMoi = banMau ? undefined : new NguonTheoTaiKhoan(auth);
  const ctx: DashCtx = {
    source: nguonMoi ?? lazySource(() => MockDashboardSource.create(Date.now(), auth)),
    auth,
    clock: new ServerClock(),
    topbar,
    nav,
  };
  const dongPhu = new DongPhuScene(ctx);
  const map = new MapScene(ctx, canvas);
  const tongMon = new TongMonScene(ctx);
  const congPhap = new CongPhapScene(ctx);
  const lienMinh = new LienMinhScene(ctx);
  const nhanVat = new NhanVatScene(ctx, sprites);
  const byId: Record<string, Scene> = { "dong-phu": dongPhu, "ban-do": map, "tong-mon": tongMon, "cong-phap": congPhap, "lien-minh": lienMinh };
  const reloadScene = () => (app?.scene as { reload?: () => void } | undefined)?.reload?.();
  // Thẻ Nhiệm vụ nhập môn (FTUE bước 2–8) cho người chơi mới.
  const ftue = nguonMoi && moFtue({ nguon: nguonMoi, auth, nav, reload: reloadScene });

  // Lúc rảnh sau khi vào game: tải trước file điểm, ảnh nền và hình đảo của vùng, để mở tab Bản đồ là có ngay.
  const idle = (fn: () => void) => ("requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 1500));
  idle(() => void ctx.source.banDo().then((v) => map.prefetch(v.map.region)));

  // Đếm ngược trong bảng trượt (thẻ điểm, chi tiết) chạy chung một nhịp.
  setInterval(() => {
    const sheet = document.getElementById("sheet");
    if (sheet) tickCountdowns(sheet, ctx.clock.now());
  }, 1000);

  return {
    tabs: [dongPhu, map, tongMon, congPhap, lienMinh],
    offTab: [nhanVat],
    onShow(s: Scene): void {
      closeSheet();
      if (TAB_IDS.includes(s.id)) lastMain = s.id;
      ftue?.onShow(s.id);
    },
    attach(a: App): void {
      app = a;
      // Icon cho 5 nút của thanh dưới (App chỉ tạo nút chữ): hình vẽ Canva (assets/icon_ve/ui/tab), nút đang mở sáng lên
      // (game.css); ảnh lỗi thì còn icon nét SVG bên dưới.
      for (const b of document.querySelectorAll<HTMLButtonElement>("#tabbar button")) {
        const name = TAB_ICONS[b.dataset.scene ?? ""];
        if (name && !b.querySelector(".tab-art"))
          b.innerHTML = `<span class="tab-art">${icon(name, "tab-ic")}<img class="tab-ve" src="${artUrl(`ui/tab/${name}`)}" alt="" onerror="this.remove()"></span><span>${b.textContent}</span>`;
      }
      if (!auth.session()) showLogin(auth, AGE_LABEL, () => (reloadScene(), ftue?.capNhat()));
    },
  };
}
