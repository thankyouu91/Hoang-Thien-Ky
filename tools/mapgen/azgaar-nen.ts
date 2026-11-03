// Chạy trong trang Azgaar, không chạy bằng Node: vẽ ảnh nền bản đồ tranh kiểu bản đồ cổ (kiểu "ancient" của Azgaar) cho
// khung một vùng rồi tải về. Khung lấy từ map.frame của file điểm (diem.ts), nên điểm (x, y) nằm ở
// ((x − x0) × SCALE, (y − y0) × SCALE) trên ảnh.
//
// heightmap.ts chép file này (đã bỏ kiểu) thành public/ktlp/nen.js, cùng <vị diện>_azgaar.map. Mở bản đồ đã lưu rồi vẽ:
//   const { Load } = await import("/services/io/load.ts"); Load.uploadMap(await (await fetch("/ktlp/ha_azgaar.map")).blob())
//   await (await import("/ktlp/nen.js")).render("ha_nen_loi_dinh_coc", [249, 172, 570, 479])
// Cả bản đồ chia ô theo mức phóng (lệnh do vi_dien.ts in ra):
//   await (await import("/ktlp/nen.js")).renderTiles("ha_nen", [1, 2, 4, 6], 1024, { sink: "http://127.0.0.1:5199/<mã>/" })
// (sink là máy nhận file nhan-file.ts, ghi thẳng vào data/maps; bỏ sink thì tải một file ZIP qua hộp thoại)
// Nhiều vùng một lần tải (một file ZIP):
//   await (await import("/ktlp/nen.js")).renderZip("ha_nen", [{ name: "ha_nen_loi_dinh_coc", frame: [249, 172, 570, 479] }, …])
// Ảnh nền không có nhãn, thị trấn, quốc gia hay đường của Azgaar: điểm và chặng do proto vẽ theo file điểm.

const STYLE = "ancient";
const LAYERS = ["ocean", "landmass", "texture", "biomes", "rivers", "relief"];
const BIOME_OPACITY = "0.45"; // biome nhạt cho hợp nền giấy cũ mà vẫn thấy màu riêng của từng vùng
const SCALE = 6; // điểm ảnh ảnh nền trên một điểm ảnh bản đồ
const QUALITY = 0.9;

type Frame = [number, number, number, number];
type Fmg = {
  options: { map: { style: { preset: string } } };
  Layers: { all: { id: string }[]; isOn(id: string): boolean; show(id: string): void; hide(id: string): void };
};

export async function render(name: string, frame: Frame, scale = SCALE): Promise<void> {
  download(await draw(frame, scale), `${name}.webp`);
}

/** Vẽ nhiều khung rồi tải một file ZIP; `dryRun` chỉ vẽ và trả kích thước, không tải */
export async function renderZip(zipName: string, items: { name: string; frame: Frame }[], dryRun = false, scale = SCALE) {
  // đường dẫn mô-đun của máy chủ dev Vite (npm run dev); bản build không có
  const { default: JSZip } = await import(/* @vite-ignore */ "/@id/jszip");
  const zip = new JSZip();
  const sizes: Record<string, number> = {};
  for (const { name, frame } of items) {
    const blob = await draw(frame, scale);
    zip.file(`${name}.webp`, blob);
    sizes[name] = Math.round(blob.size / 1024);
  }
  const archive: Blob = await zip.generateAsync({ type: "blob" }); // WebP đã nén, không nén thêm
  if (!dryRun) download(archive, `${zipName}.zip`);
  return { kb: sizes, zipKb: Math.round(archive.size / 1024) };
}

/** Ảnh nền cả bản đồ chia ô cho từng mức phóng (vi_dien.ts in sẵn lệnh): ô (col, row) ở mức `level` phủ khung bản đồ
 * [col, row, col + 1, row + 1] × tile / level, ô ở mép cắt gọn theo bản đồ, lưu <name>/x<level>/<col>_<row>.webp.
 * Có `sink` (địa chỉ của nhan-file.ts, gồm cả mã) thì gửi thẳng từng ô vào data/maps; không thì tải một file ZIP qua hộp
 * thoại của trình duyệt; `dryRun` chỉ vẽ và trả kích thước. Tiến độ ở window.__tiles */
export async function renderTiles(name: string, levels: number[], tile: number, { dryRun = false, sink = "" } = {}) {
  const { default: JSZip } = await import(/* @vite-ignore */ "/@id/jszip");
  const graph = (window as unknown as { FMG: { options: { map: { graph: { width: number; height: number } } } } }).FMG.options.map.graph;
  const jobs = levels.flatMap((level) => {
    const cols = Math.ceil((graph.width * level) / tile), rows = Math.ceil((graph.height * level) / tile);
    return Array.from({ length: cols * rows }, (_, i) => ({ level, col: i % cols, row: Math.floor(i / cols) }));
  });
  const progress = { done: 0, total: jobs.length, kb: 0 };
  (window as unknown as { __tiles: typeof progress }).__tiles = progress;
  const zip = new JSZip();
  for (const { level, col, row } of jobs) {
    const span = tile / level;
    const frame: Frame = [col * span, row * span, Math.min(graph.width, (col + 1) * span), Math.min(graph.height, (row + 1) * span)];
    const blob = await draw(frame, level);
    const path = `x${level}/${col}_${row}.webp`;
    if (sink && !dryRun) {
      const reply = await fetch(`${sink}${name}/${path}`, { method: "PUT", body: blob, headers: { "Content-Type": "image/webp" } });
      if (!reply.ok) throw new Error(`Máy nhận file từ chối ${path}: ${reply.status}`);
    } else zip.file(path, blob);
    (progress.done += 1), (progress.kb += Math.round(blob.size / 1024));
  }
  if (sink && !dryRun) return progress;
  const archive: Blob = await zip.generateAsync({ type: "blob" });
  if (!dryRun) download(archive, `${name}.zip`);
  return { ...progress, zipKb: Math.round(archive.size / 1024) };
}

async function draw(frame: Frame, scale: number): Promise<Blob> {
  const fmg = (window as unknown as { FMG: Fmg }).FMG;
  const { StylePreset } = await import(/* @vite-ignore */ "/controllers/style/style-preset.ts");
  const { ExportMap } = await import(/* @vite-ignore */ "/services/io/export.ts");
  if (fmg.options.map.style.preset !== STYLE) await StylePreset.change(STYLE);
  for (const { id } of fmg.Layers.all) {
    if (LAYERS.includes(id)) fmg.Layers.show(id);
    else if (fmg.Layers.isOn(id)) fmg.Layers.hide(id);
  }
  document.querySelector("#biomes")?.setAttribute("opacity", BIOME_OPACITY);

  const [x0, y0, x1, y1] = frame;
  const region = { x0, y0, x1, y1, width: x1 - x0, height: y1 - y0 };
  const url: string = await ExportMap.getMapURL("png", { region, noScaleBar: true, noVignette: true });
  const image = new Image(); // không dùng image.decode(): nó không xong khi khung trình duyệt đang ẩn
  await new Promise((done, fail) => ((image.onload = done), (image.onerror = fail), (image.src = url)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(region.width * scale);
  canvas.height = Math.round(region.height * scale);
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((done, fail) => canvas.toBlob((b) => (b ? done(b) : fail(new Error("Không vẽ được ảnh"))), "image/webp", QUALITY));
}

function download(blob: Blob, fileName: string): void {
  const link = document.createElement("a");
  link.download = fileName;
  link.href = URL.createObjectURL(blob);
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 600000);
  console.log(`${fileName}: ${Math.round(blob.size / 1024)} KB`);
}
