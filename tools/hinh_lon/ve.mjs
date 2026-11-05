// Vẽ hình lớn Pháp tướng (192 × 256, dáng lơ lửng) bằng PixelLab create_image_pro, gọi máy chủ MCP qua HTTP (JSON-RPC
// tools/call; token đọc từ ~/.claude.json mcpServers.pixellab, không in ra). Đọc lời mô tả ở ao.json.
//   - 13 dáng theo món áo × 3 bậc × 4 thân: tham chiếu là thân trống 64 px (tron.png), trang phục tả bằng lời.
//   - Áo theo nghề (6 áo riêng) bậc 2, 3 cho 4 thân, và bậc 1 cho 2 thân nữ (da sáng): tham chiếu là ảnh nghỉ 64 px của
//     thân mặc áo đó.
//   Bức đạo bào đã duyệt của cùng thân (<thân>/dao_bao/lon.png) làm mẫu nét: style_copy outline, detail, shading (không lấy
//   màu). Thân nữ ghi rõ "young female ... fair porcelain skin" (người dùng muốn da nữ sáng; không ghi thì có bức ra mặt nam).
// Ra: assets/pixellab/nhan_vat/<thân>/lon/<mã>_<bậc>.png; có rồi thì bỏ qua (chạy lại để vẽ tiếp phần thiếu).
// Chạy: node tools/hinh_lon/ve.mjs [số việc cùng lúc, mặc định 4] [lọc mã,...] [--thu]   (--thu: chỉ in danh sách)
// Mỗi bức 10 lượt (hết lượt gói thì $0,08 credit). Soát từng bức sau khi vẽ: mặt, khung, đúng áo; bức hỏng thì xoá và chạy lại.
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../assets/pixellab/nhan_vat");
const AO = JSON.parse(readFileSync(join(HERE, "ao.json"), "utf8"));
const SONG = Number(process.argv[2] ?? 4);
const LOC = process.argv[3] && process.argv[3] !== "--thu" ? process.argv[3].split(",") : null;
const THU = process.argv.includes("--thu");
const THAN = ["nam_khoe", "nam_manh", "nu_khoe", "nu_manh"];

/** Danh sách việc: { body, ma, bac, ao, ref } */
function danhSach() {
  const v = [];
  for (const body of THAN) {
    for (const [ma, ao] of Object.entries(AO.dang)) for (const bac of [1, 2, 3]) v.push({ body, ma, bac, ao, ref: "tron" });
    for (const [ma, ao] of Object.entries(AO.nghe)) for (const bac of body.startsWith("nu") ? [1, 2, 3] : [2, 3]) v.push({ body, ma, bac, ao, ref: ma });
  }
  return v.filter((x) => !LOC || LOC.includes(x.ma));
}

const cfg = JSON.parse(readFileSync(join(process.env.USERPROFILE ?? process.env.HOME ?? "", ".claude.json"), "utf8")).mcpServers.pixellab;
let rid = 0;
async function call(name, args) {
  const r = await fetch(cfg.url, {
    method: "POST",
    headers: { ...cfg.headers, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rid, method: "tools/call", params: { name, arguments: args } }),
  });
  const t = await r.text();
  const line = t.split("\n").find((l) => l.startsWith("data: ")) ?? t;
  const j = JSON.parse(line.replace(/^data: /, ""));
  if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 300));
  return (j.result?.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b64 = (f) => readFileSync(f).toString("base64");
const LOG = join(HERE, "jobs.log");

async function mot(x) {
  const ra = join(ROOT, x.body, "lon", `${x.ma}_${x.bac}.png`);
  if (existsSync(ra)) return { ...x, ok: true, note: "đã có" };
  const nu = x.body.startsWith("nu");
  const args = {
    description:
      `Full-body pixel art portrait of the same ${nu ? "young female " : ""}xianxia cultivator as the reference: same face, hair and body type${nu ? ", with fair porcelain skin" : ""}, wearing ${x.ao}, in ${AO.bac[x.bac]}. ` +
      `Floating in mid-air in a calm levitating pose: legs hanging loosely, feet pointing down, arms relaxed at the sides, cloth fluttering gently. ` +
      `Rich harmonious colours, not neon. Large detailed sprite filling the tall frame, body turned slightly toward the lower right. No weapon, no helmet, no text, transparent background.`,
    width: 192,
    height: 256,
    no_background: true,
    reference_images: [
      x.ref === "tron"
        ? { base64: b64(join(ROOT, x.body, "tron.png")), usage: "character: face, hair and body type (ignore the plain clothes)" }
        : { base64: b64(join(ROOT, x.body, `${x.ref}.png`)), usage: "character and outfit: copy the face, hair, body type and the outfit design" },
    ],
    style_image_base64: b64(join(ROOT, x.body, "dao_bao", "lon.png")),
    style_copy: ["outline", "detail", "shading"],
  };
  let job;
  for (let lan = 0; lan < 30; lan++) {
    try {
      const t = await call("create_image_pro", args);
      job = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/.exec(t)?.[1];
      if (!job) throw new Error("không thấy job: " + t.slice(0, 200));
      appendFileSync(LOG, `${new Date().toISOString()} ${x.body} ${x.ma}_${x.bac} ${job}\n`);
      break;
    } catch (e) {
      if (/concurrent|Maximum|heavy load|429/i.test(String(e))) { await sleep(20000); continue; }
      return { ...x, ok: false, note: String(e).slice(0, 200) };
    }
  }
  if (!job) return { ...x, ok: false, note: "không gửi được việc" };
  for (let i = 0; i < 90; i++) {
    await sleep(10000);
    const t = await call("get_image", { job_id: job });
    // Ảnh xong thì có link tải không cần đăng nhập: https://api.pixellab.ai/mcp/images/<job>/download
    const url = /(https:\/\/api\.pixellab\.ai\/mcp\/images\/[^\s"'\]),]+)/.exec(t)?.[1];
    if (url) {
      const r = await fetch(url);
      mkdirSync(dirname(ra), { recursive: true });
      writeFileSync(ra, Buffer.from(await r.arrayBuffer()));
      return { ...x, ok: true, job };
    }
    if (/status:\s*failed/i.test(t)) return { ...x, ok: false, job, note: t.slice(0, 200) };
  }
  return { ...x, ok: false, job, note: "hết giờ chờ" };
}

const viec = danhSach();
const con = viec.filter((x) => !existsSync(join(ROOT, x.body, "lon", `${x.ma}_${x.bac}.png`)));
console.log(`${viec.length} bức, còn thiếu ${con.length} (khoảng ${con.length * 10} lượt)`);
if (THU) process.exit(0);
let i = 0;
await Promise.all(Array.from({ length: Math.min(SONG, con.length) }, async () => {
  while (i < con.length) {
    const r = await mot(con[i++]);
    console.log(JSON.stringify({ body: r.body, ma: `${r.ma}_${r.bac}`, ok: r.ok, job: r.job, note: r.note }));
  }
}));
