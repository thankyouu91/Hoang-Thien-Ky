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
}

export interface Manifest {
  assets: ManifestEntry[];
}

export interface Asset {
  img: HTMLImageElement;
  meta: ManifestEntry;
}

/** Hình của các màn DOM (dashboard nạp qua CSS khi cần: hình nền, khung cuộn giấy): bộ nạp này bỏ qua để khỏi tải thừa. */
export const SKIP_GROUPS = ["cong_trinh/", "diem_nen/", "bang_mau/", "ui/"];

export class Sprites {
  private assets = new Map<string, Asset>();

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
   * Dòng manifest có `file` bắt đầu bằng một tiền tố trong `skip` thì không nạp.
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
    const wanted = (manifest.assets ?? []).filter((meta) => !skip.some((p) => meta.file.startsWith(p)));
    await Promise.all(
      wanted.map(async (meta) => {
        const img = new Image();
        img.src = base + meta.file;
        try {
          await img.decode();
          this.assets.set(meta.file.replace(/\.[^./]+$/, ""), { img, meta });
        } catch {
          console.warn("Không nạp được ảnh PixelLab:", meta.file);
        }
      }),
    );
  }
}
