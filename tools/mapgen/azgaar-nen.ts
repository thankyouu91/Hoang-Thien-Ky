// Chạy trong trang Azgaar, không chạy bằng Node: vẽ ảnh nền bản đồ tranh kiểu bản đồ cổ (kiểu "ancient" của Azgaar) cho
// khung một vùng rồi tải về. Khung lấy từ map.frame của file điểm (diem.ts), nên điểm (x, y) nằm ở
// ((x − x0) × SCALE, (y − y0) × SCALE) trên ảnh.
//
// heightmap.ts chép file này (đã bỏ kiểu) thành public/ktlp/nen.js, cùng <vị diện>_azgaar.map. Mở bản đồ đã lưu rồi vẽ:
//   const { Load } = await import("/services/io/load.ts"); Load.uploadMap(await (await fetch("/ktlp/ha_azgaar.map")).blob())
//   await (await import("/ktlp/nen.js")).render("ha_nen_loi_dinh_coc", [249, 172, 570, 479])
// Ảnh nền không có nhãn, thị trấn, quốc gia hay đường của Azgaar: điểm và chặng do proto vẽ theo file điểm.

const STYLE = "ancient";
const LAYERS = ["ocean", "landmass", "texture", "biomes", "rivers", "relief"];
const BIOME_OPACITY = "0.45"; // biome nhạt cho hợp nền giấy cũ mà vẫn thấy màu riêng của từng vùng
const SCALE = 6; // điểm ảnh ảnh nền trên một điểm ảnh bản đồ
const QUALITY = 0.9;

type Fmg = {
  options: { map: { style: { preset: string } } };
  Layers: { all: { id: string }[]; isOn(id: string): boolean; show(id: string): void; hide(id: string): void };
};

export async function render(name: string, frame: [number, number, number, number], scale = SCALE): Promise<void> {
  const fmg = (window as unknown as { FMG: Fmg }).FMG;
  // đường dẫn mô-đun của máy chủ dev Vite (npm run dev); bản build không có
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
  canvas.width = region.width * scale;
  canvas.height = region.height * scale;
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((done, fail) => canvas.toBlob((b) => (b ? done(b) : fail(new Error("Không vẽ được ảnh"))), "image/webp", QUALITY));
  const link = document.createElement("a");
  link.download = `${name}.webp`;
  link.href = URL.createObjectURL(blob);
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 600000);
  console.log(`${name}.webp: ${canvas.width}×${canvas.height}, ${Math.round(blob.size / 1024)} KB`);
}
