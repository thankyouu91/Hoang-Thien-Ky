// Bộ nạp hình PixelLab. Đọc assets/pixellab/manifest.json (docs/KE_HOACH.md mục 6), nạp từng ảnh song song;
// manifest hay ảnh nào lỗi thì bỏ qua để người vẽ dùng khối màu thay thế.
//
// Khoá tra hình là đường dẫn file bỏ đuôi, theo nhóm:
//   tu_si/<tài năng>   8 tu sĩ: tu_the, tu_phap, tu_tran, tu_dan, sat_thu, tu_ren, tu_duoc, tu_kim_tien (GDD mục 6)
//   he/<hệ>            12 icon hệ, mã như ELEMENT_IDS
//   chieu/<loại chiêu> 10 icon loại chiêu, mã như SKILL_IDS
// Hoạt ảnh (đứng, ra chiêu, trúng đòn, ngã) sẽ thêm trường khung hình khi có ảnh thật từ animate_character.

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
}

export interface Manifest {
  assets: ManifestEntry[];
}

export class Sprites {
  private images = new Map<string, HTMLImageElement>();

  get(key: string | undefined): HTMLImageElement | undefined {
    return key === undefined ? undefined : this.images.get(key);
  }

  get size(): number {
    return this.images.size;
  }

  /** Không ném lỗi: thiếu manifest hay ảnh hỏng thì chỉ ghi cảnh báo. */
  async load(base = import.meta.env.BASE_URL + "pixellab/"): Promise<void> {
    let manifest: Manifest;
    try {
      const res = await fetch(base + "manifest.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      manifest = (await res.json()) as Manifest;
    } catch (e) {
      console.warn("Không đọc được manifest PixelLab, dùng khối màu thay thế:", e);
      return;
    }
    await Promise.all(
      (manifest.assets ?? []).map(async (entry) => {
        const img = new Image();
        img.src = base + entry.file;
        try {
          await img.decode();
          this.images.set(entry.file.replace(/\.[^./]+$/, ""), img);
        } catch {
          console.warn("Không nạp được ảnh PixelLab:", entry.file);
        }
      }),
    );
  }
}
