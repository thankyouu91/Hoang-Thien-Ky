// Bộ nạp hình PixelLab. Đọc assets/pixellab/manifest.json (docs/KE_HOACH.md mục 6), nạp từng ảnh song song;
// manifest hay ảnh nào lỗi thì bỏ qua để người vẽ dùng khối màu thay thế.
//
// Khoá tra hình là đường dẫn file bỏ đuôi, theo nhóm (định dạng chốt ở ghi chú chung pixellab-tu-si.md):
//   nhan_vat/<thân>/<áo>/<hoạt ảnh>  dải khung ngang: dung, ra_chieu, trung_don, nga; có frames, fps, neo
//   do/mu/<mã>, do/vu_khi/<mã>      đồ ghép rời, có slot, neo, pivot
//   tu_si/<tài năng>                 hình tĩnh cũ, chỉ còn tu_the
//   he/<hệ>                          12 icon hệ, mã như ELEMENT_IDS
//   chieu/<loại chiêu>               10 icon loại chiêu, mã như SKILL_IDS

/** Điểm neo của một khung hoạt ảnh, toạ độ trong khung: tâm đầu (kèm góc nghiêng, độ) và cổ tay phía trước. */
export interface FrameAnchor {
  dau: [number, number, number];
  /** null khi tay không còn cầm được vũ khí (đang ngã) */
  tay: [number, number] | null;
}

/** Một dòng trong manifest: nguồn gốc từng ảnh để làm hồ sơ bản quyền và thay dần bằng hình của họa sĩ. */
export interface ManifestEntry {
  /** Đường dẫn trong assets/pixellab/, ví dụ "he/kim.png" */
  file: string;
  description?: string;
  /** Công cụ PixelLab, ví dụ create_image_pixflux */
  tool?: string;
  params?: Record<string, unknown>;
  /** Ngày tạo, YYYY-MM-DD */
  created?: string;
  pixellab_id?: string;
  /** Dải hoạt ảnh: số khung, cỡ khung (px), tốc độ gợi ý */
  frames?: number;
  frame_w?: number;
  frame_h?: number;
  fps?: number;
  /** Dải hoạt ảnh: neo từng khung; đồ ghép: neo vào "dau" hay "tay" */
  neo?: FrameAnchor[] | "dau" | "tay";
  /** Đồ ghép: ô trang bị và điểm xoay trong ảnh đồ (px) */
  slot?: string;
  pivot?: [number, number];
  /** Hiệu ứng vfx/: số cột của lưới khung (mặc định một hàng), điểm gốc (px), lặp hay không, có tô theo hệ không */
  cols?: number;
  anchor?: [number, number];
  loop?: boolean;
  tint?: boolean;
}

export interface Manifest {
  assets: ManifestEntry[];
}

export interface Asset {
  img: HTMLImageElement;
  meta: ManifestEntry;
}

/**
 * Hình của các màn DOM (dashboard nạp qua CSS khi cần: hình nền, khung cuộn giấy) và bản đồ chiến trường theo vùng (màn Trận
 * nạp đúng tấm của trận): bộ nạp này bỏ qua để khỏi tải thừa. Đảo nổi diem/ (439 hình) đã bỏ khỏi bản đồ (người dùng 2026-11-05:
 * không cần đảo), không màn nào dùng nữa nên cũng bỏ qua, đỡ hàng trăm lượt tải lúc mở game.
 */
export const SKIP_GROUPS = ["cong_trinh/", "diem_nen/", "diem/", "bang_mau/", "ui/", "chien_truong/"];

/**
 * Bộ áo nạp ngay lúc mở: áo mặc định hai đội và thân trống. Các bộ áo tài năng (gói 3, khoảng 270 dải, 1,3 MB) nạp sau:
 * màn cần gọi ensure() để nạp trước bộ của mình (màn Trận: các bộ có trong trận), phần còn lại nạp dần lúc rảnh, nên màn nào
 * không gọi ensure() cũng có đủ hình sau ít giây. Trong lúc chờ, resolveLook (character.ts) lùi về đạo bào.
 */
const EAGER_OUTFITS = ["dao_bao", "vo_phuc", "tron"];
const LATER_BATCH = 8; // số ảnh nạp cùng lúc trong hàng nạp sau (mỗi dải vài KB), để không tranh mạng với màn đang mở

function later(file: string): boolean {
  const m = /^nhan_vat\/[^/]+\/([^/.]+)/.exec(file);
  return !!m && !EAGER_OUTFITS.includes(m[1]);
}

/** Chờ lúc trình duyệt rảnh (có hạn chờ, vì pane ẩn hay máy bận có thể không bao giờ rảnh). */
function idle(): Promise<void> {
  return new Promise((resolve) => {
    if ("requestIdleCallback" in window) requestIdleCallback(() => resolve(), { timeout: 500 });
    else setTimeout(resolve, 30);
  });
}

export class Sprites {
  private assets = new Map<string, Asset>();
  private base = "";
  /** Dòng manifest chưa nạp (bộ áo tài năng), theo file */
  private pending = new Map<string, ManifestEntry>();
  /** Tiền tố màn đang cần (ensure) trước khi đọc xong manifest */
  private urgent = new Set<string>();
  private draining = false;

  get(key: string | undefined): HTMLImageElement | undefined {
    return key === undefined ? undefined : this.assets.get(key)?.img;
  }

  /** Ảnh kèm dòng manifest (khung hình, điểm neo, pivot). */
  asset(key: string): Asset | undefined {
    return this.assets.get(key);
  }

  get size(): number {
    return this.assets.size;
  }

  /**
   * Không ném lỗi: thiếu manifest hay ảnh hỏng thì chỉ ghi cảnh báo.
   * Dòng manifest có `file` bắt đầu bằng một tiền tố trong `skip` thì không nạp. Bộ áo tài năng không chờ: xem `later`.
   */
  async load(base = import.meta.env.BASE_URL + "pixellab/", skip: readonly string[] = SKIP_GROUPS): Promise<void> {
    let manifest: Manifest;
    try {
      const res = await fetch(base + "manifest.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      manifest = (await res.json()) as Manifest;
    } catch (e) {
      console.warn("Không đọc được manifest PixelLab, dùng khối màu thay thế:", e);
      return;
    }
    this.base = base;
    const wanted = (manifest.assets ?? []).filter((meta) => !skip.some((p) => meta.file.startsWith(p)));
    const now: ManifestEntry[] = [];
    for (const meta of wanted) {
      if (later(meta.file) && ![...this.urgent].some((p) => meta.file.startsWith(p))) this.pending.set(meta.file, meta);
      else now.push(meta);
    }
    await Promise.all(now.map((meta) => this.loadOne(meta)));
    void this.drain();
  }

  /**
   * Nạp ngay các ảnh còn chờ có `file` bắt đầu bằng `prefix` (ví dụ "nhan_vat/nam_khoe/tu_ren"); gọi trước khi đọc xong
   * manifest cũng được. Không chờ: hình hiện khi nạp xong, màn vẽ lại mỗi khung.
   */
  ensure(prefix: string): void {
    this.urgent.add(prefix);
    for (const [file, meta] of this.pending) {
      if (!file.startsWith(prefix)) continue;
      this.pending.delete(file);
      void this.loadOne(meta);
    }
  }

  private async loadOne(meta: ManifestEntry): Promise<void> {
    const img = new Image();
    img.src = this.base + meta.file;
    try {
      await img.decode();
      this.assets.set(meta.file.replace(/\.[^./]+$/, ""), { img, meta });
    } catch {
      console.warn("Không nạp được ảnh PixelLab:", meta.file);
    }
  }

  /** Nạp dần các ảnh còn chờ lúc rảnh, mỗi lượt vài ảnh. */
  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    while (this.pending.size > 0) {
      await idle();
      const batch = [...this.pending.values()].slice(0, LATER_BATCH);
      for (const meta of batch) this.pending.delete(meta.file);
      await Promise.all(batch.map((meta) => this.loadOne(meta)));
    }
    this.draining = false;
  }
}
