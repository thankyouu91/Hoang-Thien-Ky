// Lớp Three.js dùng chung của prototype. Màn nào cũng import được file này: three (~150 KB gzip) chỉ tải khi gọi
// một hàm bên dưới lần đầu (import() động), và chỉ khi máy có WebGL2.
//
//   renderBackground(loại, hệ, seed, { variant })  → URL ảnh (blob) cho chỗ chưa có hình PixelLab, hoặc null
//   mountBakedScene(container, cảnh)               → nền tĩnh nướng một lần, nướng lại khi đổi cỡ (màn DOM)
//   mountScene(container, cảnh)                    → cảnh động (mây trôi, hạt, thị sai); một canvas dùng chung
//   createArenaBackdrop(loại sân)                  → nền sân màn Trận vẽ theo toạ độ thế giới mỗi khung (draw/drawFront)
//   renderArena(loại sân, w, h, { vertical })      → hai lớp back/front nướng theo khung chữ nhật (ảnh tĩnh)
//   mountProgram(container, factory)               → gắn cảnh three riêng (Pháp tướng) vào renderer dùng chung
//
// Không có WebGL: các hàm trả null / ready = false và không đụng container, màn giữ nền 2D đang có.
import { enqueue, load, loaded } from "./lazy.ts";
import { deviceDpr, DPR_CAP, hasWebGL } from "./support.ts";
import type {
  ArenaKind,
  ArenaLayers,
  ArenaOptions,
  BackgroundOptions,
  BgKind,
  ElementId,
  MountOptions,
  SceneHandle,
  SceneName,
  SceneParams,
} from "./types.ts";
import type { Program } from "./engine/program.ts";
import type { Host, LiveMount } from "./engine/host.ts";

export type * from "./types.ts";
export type { Program } from "./engine/program.ts";
export type { Host, LiveMount } from "./engine/host.ts";
export { hasWebGL, prefersReducedMotion } from "./support.ts";
export { createArenaBackdrop, type ArenaBackdrop, type ArenaBackdropOptions, type BackdropRenderOptions } from "./backdrop.ts";

function toUrl(canvas: HTMLCanvasElement): Promise<string | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ? URL.createObjectURL(b) : null), "image/webp", 0.88));
}

const bgCache = new Map<string, Promise<string | null>>();

/**
 * Hình nền cho chỗ chưa có hình PixelLab: cảnh theo hệ, có bóng công trình (kind "cong_trinh", variant = LocationId)
 * hoặc điểm bản đồ (kind "diem", variant = loại điểm). seed là số hoặc chuỗi (mã mô hình tông môn, mã vùng) để mỗi
 * tông môn một bố cục. Trả URL blob (WebP) dùng được cho <img> hay background-image;
 * cùng tham số thì trả lại cùng URL. Trả null khi máy không có WebGL hoặc vẽ lỗi.
 */
export function renderBackground(kind: BgKind, element: ElementId, seed: number | string, opts: BackgroundOptions = {}): Promise<string | null> {
  if (!hasWebGL()) return Promise.resolve(null);
  const w = opts.width ?? 320;
  const h = opts.height ?? 192;
  const dpr = opts.dpr ?? deviceDpr(DPR_CAP.bake);
  const key = [kind, element, seed, opts.variant ?? "", w, h, dpr].join("|");
  let p = bgCache.get(key);
  if (!p) {
    p = load()
      .then((e) => enqueue(() => e.getHost().bake(e.placeFactory(kind, element, seed, opts.variant), w, h, dpr)))
      .then(toUrl)
      .catch((err) => {
        console.warn("renderBackground lỗi", key, err);
        return null;
      });
    bgCache.set(key, p);
  }
  return p;
}

/** Vẽ một cảnh ra canvas cỡ w × h px CSS (nhân dpr). null khi không có WebGL. */
export async function bakeScene(name: SceneName, params: SceneParams, w: number, h: number, dpr = deviceDpr(DPR_CAP.bake)): Promise<HTMLCanvasElement | null> {
  if (!hasWebGL()) return null;
  try {
    const e = await load();
    return await enqueue(() => e.getHost().bake(e.sceneFactory(name, params), w, h, dpr, { transparent: name === "linh_khi" }));
  } catch (err) {
    console.warn("bakeScene lỗi", name, err);
    return null;
  }
}

/**
 * Chế độ nướng cho màn DOM: vẽ cảnh một lần thành background-image của container, vẽ lại khi container đổi cỡ
 * (chờ 200 ms sau lần đổi cuối). Không tốn GPU khi màn đứng yên. Không có WebGL thì không đụng container.
 */
export function mountBakedScene(container: HTMLElement, name: SceneName, params: SceneParams = {}, opts: Pick<MountOptions, "onFallback"> = {}): SceneHandle {
  let url: string | null = null;
  let timer = 0;
  let gen = 0;
  let disposed = false;
  let cur = { name, params };
  let resolveReady!: (ok: boolean) => void;
  const ready = new Promise<boolean>((r) => (resolveReady = r));
  const draw = async () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h || disposed) return;
    const my = ++gen;
    const canvas = await bakeScene(cur.name, cur.params, w, h);
    if (!canvas) {
      resolveReady(false);
      opts.onFallback?.();
      return;
    }
    const next = await toUrl(canvas);
    if (my !== gen || disposed || !next) {
      if (next) URL.revokeObjectURL(next);
      return;
    }
    container.style.backgroundImage = `url("${next}")`;
    container.style.backgroundSize = "cover";
    container.style.backgroundPosition = "center";
    if (url) URL.revokeObjectURL(url);
    url = next;
    resolveReady(true);
  };
  if (!hasWebGL()) {
    resolveReady(false);
    opts.onFallback?.();
    return { ready, set() {}, setScroll() {}, dispose() {} };
  }
  const ro = new ResizeObserver(() => {
    clearTimeout(timer);
    timer = window.setTimeout(draw, url ? 200 : 0);
  });
  ro.observe(container);
  return {
    ready,
    set(n, p = {}) {
      cur = { name: n, params: p };
      void draw();
    },
    setScroll() {},
    dispose() {
      disposed = true;
      ro.disconnect();
      clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
      container.style.backgroundImage = "";
    },
  };
}

/**
 * Chế độ động: canvas WebGL dùng chung chèn vào container (dưới nội dung, hoặc phủ trên nếu layer "front").
 * Dừng vẽ khi container bị ẩn hay tab trình duyệt ẩn; prefers-reduced-motion thì vẽ một khung tĩnh.
 * Nhiều màn cùng gắn thì màn gắn sau cùng mà đang thấy được giữ canvas.
 */
export function mountScene(container: HTMLElement, name: SceneName, params: SceneParams = {}, opts: MountOptions = {}): SceneHandle {
  let live: LiveMount | null = null;
  let disposed = false;
  let pendingScroll = 0;
  const ready = (async () => {
    if (!hasWebGL()) return false;
    try {
      const e = await load();
      if (disposed) return false;
      live = e.getHost().mount(container, e.sceneFactory(name, params), { layer: opts.layer ?? (name === "linh_khi" ? "front" : "back"), scrollEl: opts.scrollEl, dprCap: name === "linh_khi" ? 1.25 : undefined });
      if (pendingScroll) live.setScroll(pendingScroll);
      return true;
    } catch (err) {
      console.warn("mountScene lỗi", name, err);
      return false;
    }
  })().then((ok) => {
    if (!ok) opts.onFallback?.();
    return ok;
  });
  return {
    ready,
    set(n, p = {}) {
      void load().then((e) => live?.replace(e.sceneFactory(n, p)));
    },
    setScroll(s) {
      pendingScroll = s;
      live?.setScroll(s);
    },
    dispose() {
      disposed = true;
      live?.dispose();
      live = null;
    },
  };
}

/**
 * Gắn một chương trình vẽ riêng (ví dụ Pháp tướng ở màn Nhân vật) vào renderer dùng chung, để cả prototype chỉ có
 * một WebGL context. factory nhận Host (host.renderer là WebGLRenderer của three@0.186.1). null khi không có WebGL.
 */
export async function mountProgram(container: HTMLElement, factory: (host: Host) => Program, opts: Pick<MountOptions, "layer" | "scrollEl"> & { dprCap?: number } = {}): Promise<LiveMount | null> {
  if (!hasWebGL()) return null;
  const e = await load();
  return e.getHost().mount(container, factory, opts);
}

const arenaCache = new Map<string, Promise<ArenaLayers | null>>();

/**
 * Nền sân đấu cho màn Trận, nướng sẵn hai lớp cùng cỡ w × h px CSS (khung sân, fieldRect): vẽ back trước,
 * rồi người và hiệu ứng, rồi front. vertical: trục sân chạy dọc ảnh. Kết quả được nhớ theo tham số.
 */
export function renderArena(kind: ArenaKind, w: number, h: number, opts: ArenaOptions = {}): Promise<ArenaLayers | null> {
  if (!hasWebGL()) return Promise.resolve(null);
  const dpr = opts.dpr ?? deviceDpr(DPR_CAP.bake);
  const vertical = !!opts.vertical;
  const seed = opts.seed ?? 1;
  const key = [kind, Math.round(w), Math.round(h), dpr, vertical, seed].join("|");
  let p = arenaCache.get(key);
  if (!p) {
    p = load()
      .then(async (e) => {
        const host = e.getHost();
        const back = await enqueue(() => host.bake(e.arenaBackFactory(kind, vertical, seed), w, h, dpr));
        const front = await enqueue(() => host.bake(e.arenaFrontFactory(kind, vertical, seed), w, h, dpr, { transparent: true }));
        return { back, front };
      })
      .catch((err) => {
        console.warn("renderArena lỗi", key, err);
        return null;
      });
    arenaCache.set(key, p);
    // giữ tối đa 6 bộ (đổi cỡ, xoay máy), bỏ bộ cũ nhất
    if (arenaCache.size > 6) arenaCache.delete(arenaCache.keys().next().value!);
  }
  return p;
}

/** Trang thử: thời gian vẽ một khung của cảnh ở cỡ w × h px CSS, dpr cho trước (ms; cpu là phần JS gửi lệnh). */
export async function benchScene(name: SceneName, params: SceneParams, w: number, h: number, dpr: number): Promise<{ avg: number; cpu: number } | null> {
  if (!hasWebGL()) return null;
  const e = await load();
  return enqueue(() => e.getHost().bench(e.sceneFactory(name, params), w, h, dpr));
}

/** Số liệu cho trang thử: số khung đã vẽ ở chế độ động, tỉ lệ độ phân giải hiện tại. */
export async function threeStats(): Promise<{ frames: number; scale: number } | null> {
  const p = loaded();
  if (!p) return null;
  const e = await p;
  const h = e.getHost();
  return { frames: h.frames, scale: h.resolutionScale };
}
