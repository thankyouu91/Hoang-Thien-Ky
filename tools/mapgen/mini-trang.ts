// Chạy trong trang proto (npm run dev:proto), không chạy bằng Node: bước 2 của mini.ts. Đọc <vị diện>_mini_viec.json, thu
// ảnh nền từng vùng về cỡ mini, phủ phần ngoài vùng, kẻ viền, rồi gửi WebP thẳng vào data/maps qua máy nhận file
// nhan-file.ts (người dùng cho tải thẳng file do các phiên tự tạo, 2026-11-03).

/** Màu đậm hơn chút cho rõ ở cỡ nhỏ: ảnh nền gốc biome chỉ mờ 45% trên giấy cũ */
const FILTER = "saturate(1.35) contrast(1.08)";
const PAPER = "rgba(239, 228, 204, 0.62)";
const INK = "rgba(74, 42, 23, 0.9)";
const QUALITY = 0.85;

type Job = { code: string; image: string; width: number; height: number; outside: string; border: string };

/** Thư mục data/maps qua máy chủ dev Vite: file ngoài thư mục proto đọc qua /@fs/<đường dẫn trên máy>. Vite viết lại
 * new URL(chuỗi, import.meta.url) thành đường /@fs/… và bỏ dấu / cuối, nên thêm lại */
const DATA = new URL("../../data/maps/", import.meta.url);
const BASE = `${DATA.protocol === "file:" ? `/@fs${DATA.pathname}` : DATA.pathname}`.replace(/\/?$/, "/");

export async function run(plane: string, sink: string, base = BASE) {
  const job = (await (await fetch(`${base}${plane}_mini_viec.json`)).json()) as { regions: Job[] };
  const out: Record<string, number> = {};
  for (const r of job.regions) {
    let img: ImageBitmap | OffscreenCanvas = await createImageBitmap(await (await fetch(`${base}${r.image}`)).blob());
    // thu nhỏ từng nửa một cho mịn, lần cuối đúng cỡ
    while (img.width / 2 > r.width * 1.01) {
      const half = new OffscreenCanvas(Math.round(img.width / 2), Math.round(img.height / 2));
      const g = half.getContext("2d")!;
      g.imageSmoothingQuality = "high";
      g.drawImage(img, 0, 0, half.width, half.height);
      img = half;
    }
    const canvas = new OffscreenCanvas(r.width, r.height);
    const g = canvas.getContext("2d")!;
    g.imageSmoothingQuality = "high";
    g.filter = FILTER;
    g.drawImage(img, 0, 0, r.width, r.height);
    g.filter = "none";
    g.fillStyle = PAPER;
    g.fill(new Path2D(r.outside));
    g.strokeStyle = INK;
    g.lineWidth = 1.3;
    g.lineCap = "round";
    g.stroke(new Path2D(r.border));
    const blob = await canvas.convertToBlob({ type: "image/webp", quality: QUALITY });
    const reply = await fetch(`${sink}${plane}_mini/${r.code}.webp`, { method: "PUT", body: blob, headers: { "Content-Type": "image/webp" } });
    if (!reply.ok) throw new Error(`Máy nhận file từ chối ${r.code}: ${reply.status}`);
    out[r.code] = Math.round(blob.size / 1024);
  }
  return out;
}
