// Máy chủ nhận file chạy trên máy (chỉ 127.0.0.1): trang Azgaar gửi thẳng ảnh nền vẽ được vào data/maps, không qua hộp thoại
// lưu của trình duyệt (người dùng cho tải thẳng file do các phiên tự tạo, 2026-11-03). Chỉ ghi trong data/maps, chỉ các đuôi
// ảnh và dữ liệu bản đồ; mỗi lần chạy sinh một mã ngẫu nhiên, địa chỉ gửi phải có mã đó.
//
// Chạy: node --experimental-strip-types tools/mapgen/nhan-file.ts [cổng]   (mặc định 5199; dừng bằng Ctrl+C)
// Trang gửi: fetch(`http://127.0.0.1:<cổng>/<mã>/<đường dẫn trong data/maps>`, { method: "PUT", body: blob })
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const port = Number(process.argv[2] ?? 5199);
const root = resolve(fileURLToPath(new URL("../../data/maps/", import.meta.url)));
const token = randomBytes(8).toString("hex");
const ALLOWED = /\.(webp|png|json|map)$/;
const MAX_BYTES = 64 * 1024 * 1024;

createServer((req, res) => {
  const origin = req.headers.origin ?? "";
  if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "PUT");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return void res.writeHead(204).end();
  const [, key, ...rest] = decodeURIComponent((req.url ?? "").split("?")[0]).split("/");
  const target = resolve(root, rest.join("/"));
  if (req.method !== "PUT" || key !== token || !target.startsWith(root + sep) || !ALLOWED.test(target)) return void res.writeHead(403).end();
  const chunks: Buffer[] = [];
  let size = 0;
  req.on("data", (chunk: Buffer) => {
    size += chunk.length;
    if (size > MAX_BYTES) req.destroy();
    else chunks.push(chunk);
  });
  req.on("end", () => {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, Buffer.concat(chunks));
    console.log(`ghi ${target.slice(root.length + 1)} (${Math.round(size / 1024)} KB)`);
    res.writeHead(200).end("ok");
  });
}).listen(port, "127.0.0.1", () => console.log(`nhận file vào ${root} tại http://127.0.0.1:${port}/${token}/`));
