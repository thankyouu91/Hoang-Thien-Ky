#!/usr/bin/env node
// Dựng máy chủ Discord "Thiên Hoang Ký" từ cau_hinh.json bằng bot và REST API v10.
// Chạy lại được: lần sau chỉ sửa chỗ lệch. Không xóa gì. Không in token.
//
//   node tools/discord/thiet_lap.mjs kiem                 kiểm token, máy chủ, quyền (chỉ đọc)
//   node tools/discord/thiet_lap.mjs link-bot             in link mời bot (đọc id ứng dụng từ token)
//   node tools/discord/thiet_lap.mjs dung [--ghi]         dựng máy chủ; thiếu --ghi thì chỉ in kế hoạch
//   node tools/discord/thiet_lap.mjs moi [--vai-tro thanh_vien|choi_thu] [--luot 0..100]
//                                                         tạo link mời không hết hạn, gán vai trò khi vào
//   node tools/discord/thiet_lap.mjs moi --liet-ke        liệt kê link mời đang có
//   node tools/discord/thiet_lap.mjs bieu-tuong <tệp.png> đặt biểu tượng máy chủ
//
// Token: biến môi trường DISCORD_BOT_TOKEN, hoặc dòng DISCORD_BOT_TOKEN=... trong
// %USERPROFILE%\.thienhoangky\discord.env. Máy chủ: DISCORD_GUILD_ID hoặc theo tên trong cấu hình.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const THU_MUC = dirname(fileURLToPath(import.meta.url));
const API = process.env.DISCORD_API_BASE || "https://discord.com/api/v10";
const THU_MUC_RIENG = process.env.THK_DISCORD_HOME || join(homedir(), ".thienhoangky");
const TEP_ENV = join(THU_MUC_RIENG, "discord.env");
const TEP_TRANG_THAI = join(THU_MUC_RIENG, "discord-state.json");
const LY_DO = "tools/discord/thiet_lap.mjs";

// ---------- Quyền ----------
const BIT = {
  CREATE_INSTANT_INVITE: 0, KICK_MEMBERS: 1, BAN_MEMBERS: 2, ADMINISTRATOR: 3, MANAGE_CHANNELS: 4,
  MANAGE_GUILD: 5, ADD_REACTIONS: 6, VIEW_AUDIT_LOG: 7, PRIORITY_SPEAKER: 8, STREAM: 9,
  VIEW_CHANNEL: 10, SEND_MESSAGES: 11, SEND_TTS_MESSAGES: 12, MANAGE_MESSAGES: 13, EMBED_LINKS: 14,
  ATTACH_FILES: 15, READ_MESSAGE_HISTORY: 16, MENTION_EVERYONE: 17, USE_EXTERNAL_EMOJIS: 18,
  VIEW_GUILD_INSIGHTS: 19, CONNECT: 20, SPEAK: 21, MUTE_MEMBERS: 22, DEAFEN_MEMBERS: 23,
  MOVE_MEMBERS: 24, USE_VAD: 25, CHANGE_NICKNAME: 26, MANAGE_NICKNAMES: 27, MANAGE_ROLES: 28,
  MANAGE_WEBHOOKS: 29, MANAGE_GUILD_EXPRESSIONS: 30, USE_APPLICATION_COMMANDS: 31,
  REQUEST_TO_SPEAK: 32, MANAGE_EVENTS: 33, MANAGE_THREADS: 34, CREATE_PUBLIC_THREADS: 35,
  CREATE_PRIVATE_THREADS: 36, USE_EXTERNAL_STICKERS: 37, SEND_MESSAGES_IN_THREADS: 38,
  USE_EMBEDDED_ACTIVITIES: 39, MODERATE_MEMBERS: 40, USE_SOUNDBOARD: 42, CREATE_GUILD_EXPRESSIONS: 43,
  CREATE_EVENTS: 44, USE_EXTERNAL_SOUNDS: 45, SEND_VOICE_MESSAGES: 46, SET_VOICE_CHANNEL_STATUS: 48,
  SEND_POLLS: 49, USE_EXTERNAL_APPS: 50, PIN_MESSAGES: 51, BYPASS_SLOWMODE: 52,
};
const TAT_CA_QUYEN = Object.values(BIT).reduce((a, b) => a | (1n << BigInt(b)), 0n);
function quyen(ten) {
  let n = 0n;
  for (const t of ten || []) {
    if (!(t in BIT)) throw new Error(`Quyền không biết: ${t}`);
    n |= 1n << BigInt(BIT[t]);
  }
  return n;
}
function tenQuyen(n) {
  return Object.entries(BIT).filter(([, b]) => n & (1n << BigInt(b))).map(([t]) => t);
}

const LOAI_KENH = { text: 0, voice: 2, category: 4, announcement: 5, forum: 15, media: 16 };
const LOAI_AUTOMOD = { KEYWORD: 1, SPAM: 3, KEYWORD_PRESET: 4, MENTION_SPAM: 5 };
const BO_CO_SAN = { PROFANITY: 1, SEXUAL_CONTENT: 2, SLURS: 3 };
const CO_KENH_HE_THONG = {
  SUPPRESS_JOIN_NOTIFICATIONS: 1, SUPPRESS_PREMIUM_SUBSCRIPTIONS: 2,
  SUPPRESS_GUILD_REMINDER_NOTIFICATIONS: 4, SUPPRESS_JOIN_NOTIFICATION_REPLIES: 8,
};
const REQUIRE_TAG = 16;
const SUPPRESS_EMBEDS = 4;

// ---------- Tiện ích ----------
const doi = (ms) => new Promise((r) => setTimeout(r, ms));
const so = (s) => BigInt(s);
const theoId = (a, b) => (so(a.id) < so(b.id) ? -1 : so(a.id) > so(b.id) ? 1 : 0);
const chuanTen = (s) => String(s).replace(/️/g, "").trim().toLowerCase();
const chuanTenKenh = (s) => chuanTen(s).replace(/\s+/g, "-");
const mauSo = (hex) => parseInt(String(hex).replace("#", ""), 16);

function docToken() {
  if (process.env.DISCORD_BOT_TOKEN) return process.env.DISCORD_BOT_TOKEN.trim();
  if (existsSync(TEP_ENV)) {
    const dong = readFileSync(TEP_ENV, "utf8").replace(/^﻿/, "").split(/\r?\n/);
    for (const d of dong) {
      const m = d.match(/^\s*DISCORD_BOT_TOKEN\s*=\s*"?([^"\s]+)"?\s*$/);
      if (m) return m[1];
    }
  }
  console.error(`Chưa có token. Đặt biến DISCORD_BOT_TOKEN hoặc tạo ${TEP_ENV} (xem tools/discord/README.md, bước 3).`);
  process.exit(2);
}
function docEnvPhu(ten) {
  if (process.env[ten]) return process.env[ten].trim();
  if (!existsSync(TEP_ENV)) return undefined;
  for (const d of readFileSync(TEP_ENV, "utf8").split(/\r?\n/)) {
    const m = d.match(new RegExp(`^\\s*${ten}\\s*=\\s*"?([^"\\s]+)"?\\s*$`));
    if (m) return m[1];
  }
  return undefined;
}

class LoiApi extends Error {
  constructor(phuongThuc, duong, trangThai, duLieu) {
    const ma = duLieu && typeof duLieu === "object" ? duLieu.code : undefined;
    const tin = duLieu && typeof duLieu === "object" ? duLieu.message : String(duLieu).slice(0, 300);
    const chiTiet = duLieu && typeof duLieu === "object" && duLieu.errors ? ` ${JSON.stringify(duLieu.errors)}` : "";
    super(`${phuongThuc} ${duong} → ${trangThai}${ma ? ` (mã ${ma})` : ""}: ${tin}${chiTiet}`);
    this.trangThai = trangThai;
    this.ma = ma;
  }
}

let TOKEN = null;
async function api(phuongThuc, duong, than) {
  for (let lan = 0; lan < 6; lan++) {
    const res = await fetch(API + duong, {
      method: phuongThuc,
      headers: {
        Authorization: `Bot ${TOKEN}`,
        "User-Agent": "DiscordBot (https://github.com/thankyouu91/LapTong.Official, 1.0)",
        "X-Audit-Log-Reason": encodeURIComponent(LY_DO),
        ...(than === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: than === undefined ? undefined : JSON.stringify(than),
    });
    if (res.status === 429) {
      const j = await res.json().catch(() => ({}));
      await doi(Math.ceil((j.retry_after ?? 1) * 1000) + 200);
      continue;
    }
    const conLai = res.headers.get("x-ratelimit-remaining");
    const datLai = res.headers.get("x-ratelimit-reset-after");
    if (conLai === "0" && datLai) await doi(Math.ceil(parseFloat(datLai) * 1000) + 50);
    if (res.status === 204) return null;
    const chu = await res.text();
    let duLieu;
    try { duLieu = chu ? JSON.parse(chu) : null; } catch { duLieu = chu; }
    if (!res.ok) throw new LoiApi(phuongThuc, duong, res.status, duLieu);
    return duLieu;
  }
  throw new Error(`${phuongThuc} ${duong}: bị giới hạn tốc độ quá nhiều lần`);
}

function docCauHinh() {
  return JSON.parse(readFileSync(join(THU_MUC, "cau_hinh.json"), "utf8"));
}
function docTrangThai() {
  if (!existsSync(TEP_TRANG_THAI)) return { may_chu: {} };
  try { return JSON.parse(readFileSync(TEP_TRANG_THAI, "utf8")); } catch { return { may_chu: {} }; }
}
function ghiTrangThai(tt) {
  mkdirSync(THU_MUC_RIENG, { recursive: true });
  writeFileSync(TEP_TRANG_THAI, JSON.stringify(tt, null, 2) + "\n");
}

function thamSo(argv) {
  const ra = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      ra[k] = v;
    } else ra._.push(a);
  }
  return ra;
}

// ---------- Ngữ cảnh máy chủ ----------
async function napNguCanh(ch) {
  const toi = await api("GET", "/users/@me");
  const dsMayChu = await api("GET", "/users/@me/guilds");
  const idDat = docEnvPhu("DISCORD_GUILD_ID");
  let mc = idDat ? dsMayChu.find((g) => g.id === idDat) : null;
  if (!mc) {
    const trung = dsMayChu.filter((g) => chuanTen(g.name) === chuanTen(ch.may_chu.ten));
    if (trung.length === 1) mc = trung[0];
    else if (!idDat && dsMayChu.length === 1) mc = dsMayChu[0];
  }
  if (!mc) {
    console.error(`Bot (${toi.username}) chưa ở trong máy chủ "${ch.may_chu.ten}".`);
    console.error(`Máy chủ bot đang ở: ${dsMayChu.map((g) => `${g.name} (${g.id})`).join(", ") || "không có"}.`);
    console.error("Mời bot theo README bước 4, hoặc đặt DISCORD_GUILD_ID nếu có nhiều máy chủ trùng tên.");
    process.exit(3);
  }
  const guild = await api("GET", `/guilds/${mc.id}`);
  const kenh = await api("GET", `/guilds/${mc.id}/channels`);
  const thanhVienBot = await api("GET", `/guilds/${mc.id}/members/${toi.id}`);
  const vaiTroTheoId = new Map(guild.roles.map((r) => [r.id, r]));
  const vaiTroBot = thanhVienBot.roles.map((id) => vaiTroTheoId.get(id)).filter(Boolean);
  const vaiTroRiengBot = vaiTroBot.find((r) => r.tags && r.tags.bot_id === toi.id) || null;
  const everyone = vaiTroTheoId.get(guild.id);
  let quyenBot = so(everyone.permissions);
  for (const r of vaiTroBot) quyenBot |= so(r.permissions);
  const laAdmin = (quyenBot & quyen(["ADMINISTRATOR"])) !== 0n || guild.owner_id === toi.id;
  if (laAdmin) quyenBot = TAT_CA_QUYEN;
  const viTriBot = Math.max(0, ...vaiTroBot.map((r) => r.position));
  return { toi, guild, kenh, vaiTroTheoId, vaiTroRiengBot, quyenBot, viTriBot, laAdmin };
}

// ---------- Lệnh: kiem ----------
async function lenhKiem(ch) {
  const nc = await napNguCanh(ch);
  const { guild, toi, quyenBot } = nc;
  console.log(`Bot: ${toi.username} (${toi.id})`);
  console.log(`Máy chủ: ${guild.name} (${guild.id}), chủ ${guild.owner_id}`);
  const tinhNang = guild.features || [];
  console.log(`Cộng đồng (COMMUNITY): ${tinhNang.includes("COMMUNITY") ? "đã bật" : "CHƯA BẬT, làm README bước 1"}`);
  console.log(`Khám phá (DISCOVERABLE): ${tinhNang.includes("DISCOVERABLE") ? "ĐANG BẬT, hãy tắt để máy chủ kín" : "tắt (đúng)"}`);
  console.log(`Vai trò của bot: ${nc.vaiTroRiengBot ? `${nc.vaiTroRiengBot.name}, vị trí ${nc.viTriBot}` : "không thấy"}`);
  const can = quyen(ch.quyen_bot);
  const thieu = tenQuyen(can & ~quyenBot);
  console.log(thieu.length ? `Bot thiếu quyền: ${thieu.join(", ")}` : "Bot đủ quyền cần.");
  console.log(`Số kênh: ${nc.kenh.length}, số vai trò: ${guild.roles.length}`);
}

// ---------- Lệnh: link-bot ----------
async function lenhLinkBot(ch, ts) {
  let id = ts["client-id"];
  if (!id) {
    const ud = await api("GET", "/oauth2/applications/@me");
    id = ud.id;
  }
  const n = quyen(ch.quyen_bot);
  console.log(`https://discord.com/oauth2/authorize?client_id=${id}&scope=bot&permissions=${n}`);
}

// ---------- Kế hoạch / ghi ----------
class KeHoach {
  constructor(ghi) { this.ghi = ghi; this.so = 0; this.canhBao = []; }
  async lam(moTa, fn) {
    this.so++;
    console.log(`${this.ghi ? "•" : "○"} ${moTa}`);
    if (!this.ghi) return undefined;
    const kq = await fn();
    await doi(250);
    return kq;
  }
  bao(tin) { this.canhBao.push(tin); console.log(`! ${tin}`); }
}

// Ghép quyền kênh từ cấu hình
function ghepQuyen(ch, banQuyen, idVaiTro, guildId, idVaiTroBot) {
  const ra = new Map();
  for (const [khoa, nhom] of Object.entries(banQuyen || {})) {
    const id = khoa === "@everyone" ? guildId : idVaiTro[khoa];
    if (!id) throw new Error(`Không thấy vai trò "${khoa}" khi ghép quyền kênh`);
    const ds = Array.isArray(nhom) ? nhom : [nhom];
    let cho = 0n, cam = 0n;
    for (const n of ds) {
      const g = typeof n === "string" ? ch.nhom_quyen[n] : n;
      if (!g) throw new Error(`Không thấy nhóm quyền "${n}"`);
      cho |= quyen(g.cho); cam |= quyen(g.cam);
    }
    cam &= ~cho;
    ra.set(id, { id, type: 0, allow: cho, deny: cam });
  }
  if (idVaiTroBot) ra.set(idVaiTroBot, { id: idVaiTroBot, type: 0, allow: quyen(ch.quyen_kenh_cua_bot), deny: 0n });
  return ra;
}

function quyenKenhMoi(hienCo, muonMap) {
  const giu = (hienCo || []).filter((o) => !muonMap.has(o.id));
  const moi = [...muonMap.values()].map((o) => ({ id: o.id, type: o.type, allow: o.allow.toString(), deny: o.deny.toString() }));
  return [...giu.map((o) => ({ id: o.id, type: o.type, allow: String(o.allow), deny: String(o.deny) })), ...moi];
}
function quyenKenhKhac(hienCo, muonMap) {
  const theoId = new Map((hienCo || []).map((o) => [o.id, o]));
  for (const [id, m] of muonMap) {
    const o = theoId.get(id);
    if (!o) return true;
    if (so(o.allow) !== m.allow || so(o.deny) !== m.deny || o.type !== m.type) return true;
  }
  return false;
}

function dienMau(chu, idKenh, idVaiTro, tenKenh, tenVaiTro) {
  return chu
    .replace(/\{\{kenh:([a-z_0-9]+)\}\}/g, (_, k) => {
      const id = idKenh[k];
      if (!id) throw new Error(`Nội dung nhắc kênh không có: ${k}`);
      return id.startsWith("moi:") ? `#${tenKenh[k]}` : `<#${id}>`;
    })
    .replace(/\{\{vai_tro:([a-z_0-9]+)\}\}/g, (_, k) => {
      const id = idVaiTro[k];
      if (!id) throw new Error(`Nội dung nhắc vai trò không có: ${k}`);
      return id.startsWith("moi:") ? `@${tenVaiTro[k]}` : `<@&${id}>`;
    });
}
function docTin(tep) {
  const chu = readFileSync(join(THU_MUC, tep), "utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n");
  return chu.split(/^===\s*$/m).map((s) => s.trim()).filter(Boolean);
}
function docTuKhoa(tep) {
  return readFileSync(join(THU_MUC, tep), "utf8").split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith("#"));
}

// ---------- Lệnh: dung ----------
async function lenhDung(ch, ts) {
  const kh = new KeHoach(Boolean(ts.ghi));
  const nc = await napNguCanh(ch);
  const { guild, toi } = nc;
  let { kenh } = nc;
  const tt = docTrangThai();
  const ttMc = (tt.may_chu[guild.id] ||= { vai_tro: {}, kenh: {}, automod: {} });
  console.log(`Máy chủ: ${guild.name} (${guild.id}) · ${kh.ghi ? "GHI THẬT" : "chạy thử, thêm --ghi để ghi"}`);

  const tinhNang = guild.features || [];
  if (!tinhNang.includes("COMMUNITY")) {
    kh.bao("Máy chủ chưa bật Cộng đồng (COMMUNITY). Làm README bước 1 trước.");
    if (kh.ghi) process.exit(4);
  }
  if (tinhNang.includes("DISCOVERABLE")) kh.bao("Máy chủ đang bật Khám phá (Discovery). Tắt trong Cài đặt máy chủ → Khám phá để giữ máy chủ kín.");
  const thieu = tenQuyen(quyen(ch.quyen_bot) & ~nc.quyenBot);
  if (thieu.length) kh.bao(`Bot thiếu quyền: ${thieu.join(", ")}. Mời lại bot bằng link trong README bước 4.`);

  // 1. Vai trò
  const idVaiTro = {};
  const tenVaiTro = {};
  const daNhanVaiTro = new Set();
  const vaiTroHienCo = [...nc.guild.roles];
  for (const vt of ch.vai_tro) {
    tenVaiTro[vt.khoa] = vt.ten;
    let r = vaiTroHienCo.find((x) => x.id === ttMc.vai_tro[vt.khoa]);
    if (!r) r = vaiTroHienCo.find((x) => !daNhanVaiTro.has(x.id) && !x.managed && chuanTen(x.name) === chuanTen(vt.ten));
    const muonQuyen = quyen(vt.quyen);
    const quyenDat = muonQuyen & nc.quyenBot;
    const bo = tenQuyen(muonQuyen & ~quyenDat);
    if (bo.length) kh.bao(`Vai trò ${vt.ten}: bot không có ${bo.join(", ")} nên không trao được; chủ máy chủ tự bật nếu cần.`);
    const muon = { name: vt.ten, permissions: quyenDat.toString(), colors: { primary_color: mauSo(vt.mau), secondary_color: null, tertiary_color: null }, hoist: vt.hien_rieng, mentionable: vt.nhac_duoc };
    if (!r) {
      const moi = await kh.lam(`tạo vai trò ${vt.ten}`, () => api("POST", `/guilds/${guild.id}/roles`, muon));
      r = moi || { id: `moi:${vt.khoa}`, name: vt.ten, position: 1, permissions: muon.permissions };
      if (moi) vaiTroHienCo.push(moi);
    } else {
      if (r.position >= nc.viTriBot && !nc.laAdmin) {
        kh.bao(`Vai trò ${r.name} nằm trên vai trò của bot nên bot không sửa được. Kéo vai trò của bot lên trên trong Cài đặt máy chủ → Vai trò.`);
      } else {
        const giuQuyenKhac = so(r.permissions) & ~nc.quyenBot; // quyền chủ máy chủ tự bật (vd Administrator): giữ nguyên
        muon.permissions = (quyenDat | giuQuyenKhac).toString();
        const khac = [];
        const sua = {};
        if (r.name !== muon.name) { khac.push("tên"); sua.name = muon.name; }
        if (String(r.permissions) !== muon.permissions) { khac.push("quyền"); sua.permissions = muon.permissions; }
        const mauHien = r.colors ? r.colors.primary_color : r.color;
        if (mauHien !== muon.colors.primary_color) { khac.push("màu"); sua.colors = muon.colors; }
        if (r.hoist !== muon.hoist) { khac.push("hiện riêng"); sua.hoist = muon.hoist; }
        if (r.mentionable !== muon.mentionable) { khac.push("nhắc được"); sua.mentionable = muon.mentionable; }
        if (khac.length) await kh.lam(`sửa vai trò ${vt.ten} (${khac.join(", ")})`, () => api("PATCH", `/guilds/${guild.id}/roles/${r.id}`, sua));
      }
    }
    idVaiTro[vt.khoa] = r.id;
    daNhanVaiTro.add(r.id);
    if (!r.id.startsWith("moi:")) ttMc.vai_tro[vt.khoa] = r.id;
  }
  // thứ tự vai trò: theo cấu hình, ngay dưới bot
  {
    let dsVaiTro = vaiTroHienCo;
    let viTriBot = nc.viTriBot;
    if (kh.ghi) {
      dsVaiTro = await api("GET", `/guilds/${guild.id}/roles`);
      const cuaBot = dsVaiTro.filter((r) => nc.vaiTroRiengBot && r.id === nc.vaiTroRiengBot.id);
      if (cuaBot.length) viTriBot = cuaBot[0].position;
    }
    const ds = ch.vai_tro.map((vt) => dsVaiTro.find((x) => x.id === idVaiTro[vt.khoa])).filter(Boolean);
    const sapHienTai = [...ds].sort((a, b) => b.position - a.position || theoId(b, a)).map((x) => x.id);
    const dung = ds.map((x) => x.id);
    const duoiBot = ds.every((x) => x.position < viTriBot) || nc.laAdmin;
    if (ds.length === ch.vai_tro.length && (sapHienTai.join() !== dung.join())) {
      if (!duoiBot) kh.bao("Có vai trò cấu hình nằm trên vai trò của bot, bỏ qua xếp thứ tự.");
      else if (viTriBot <= ds.length && !nc.laAdmin) kh.bao("Vai trò của bot nằm quá thấp để xếp vai trò; kéo vai trò của bot lên đầu danh sách trong Cài đặt máy chủ → Vai trò rồi chạy lại.");
      else {
        const n = ds.length;
        const than = ds.map((x, i) => ({ id: x.id, position: n - i }));
        await kh.lam(`xếp thứ tự vai trò: ${ch.vai_tro.map((v) => v.ten).join(" > ")}`, () => api("PATCH", `/guilds/${guild.id}/roles`, than));
      }
    }
  }
  // @everyone: bỏ quyền nhắc @everyone và tạo link mời
  {
    const ev = nc.vaiTroTheoId.get(guild.id);
    const bo = quyen(ch.may_chu.bo_quyen_everyone);
    const hien = so(ev.permissions);
    const moi = hien & ~bo;
    if (moi !== hien) {
      await kh.lam(`bỏ quyền ${tenQuyen(hien & bo).join(", ")} của @everyone`, () => api("PATCH", `/guilds/${guild.id}/roles/${guild.id}`, { permissions: moi.toString() }));
    }
  }

  // 2. Nhận kênh: theo id đã nhớ → tên → tên cũ → kênh hệ thống của Discord → tạo mới
  const daNhan = new Set();
  const theoIdKenh = () => new Map(kenh.map((c) => [c.id, c]));
  const hopLoai = (c, loai) => c.type === loai || (loai === 0 && c.type === 5) || (loai === 5 && c.type === 0);
  function timKenh(muc, loai, laDanhMuc) {
    const tk = theoIdKenh();
    const chuan = loai === 2 || laDanhMuc ? chuanTen : chuanTenKenh;
    const conTrong = (c) => c && !daNhan.has(c.id) && hopLoai(c, loai);
    let c = tk.get(ttMc.kenh[muc.khoa]);
    if (conTrong(c)) return c;
    const tenMuon = [muc.ten, ...(muc.ten_cu || [])].map(chuan);
    for (const t of tenMuon) {
      c = kenh.filter(conTrong).sort((a, b) => a.position - b.position || theoId(a, b)).find((x) => chuan(x.name) === t);
      if (c) return c;
    }
    const goi = { rules: guild.rules_channel_id, updates: guild.public_updates_channel_id, system: guild.system_channel_id };
    if (muc.nhan && goi[muc.nhan]) {
      c = tk.get(goi[muc.nhan]);
      if (conTrong(c)) return c;
    }
    if (muc.nhan === "voice_dau") {
      c = kenh.filter((x) => conTrong(x) && x.type === 2).sort((a, b) => a.position - b.position || theoId(a, b))[0];
      if (c) return c;
    }
    return null;
  }
  const idKenh = {};
  const tenKenh = {};
  const kenhCon = new Map(); // khoa -> channel
  for (const dm of ch.danh_muc) {
    for (const k of dm.kenh) {
      tenKenh[k.khoa] = k.ten;
      const c = timKenh(k, LOAI_KENH[k.loai], false);
      if (c) { daNhan.add(c.id); kenhCon.set(k.khoa, c); }
    }
  }
  const danhMucCo = new Map();
  for (const dm of ch.danh_muc) {
    let c = timKenh(dm, 4, true);
    if (!c && dm.nhan_cha_cua) {
      const con = kenhCon.get(dm.nhan_cha_cua);
      const cha = con && con.parent_id ? theoIdKenh().get(con.parent_id) : null;
      if (cha && !daNhan.has(cha.id) && cha.type === 4) c = cha;
    }
    if (c) { daNhan.add(c.id); danhMucCo.set(dm.khoa, c); }
  }

  const idBotRole = nc.vaiTroRiengBot ? nc.vaiTroRiengBot.id : null;
  if (!idBotRole) kh.bao("Không thấy vai trò riêng của bot; kênh ẩn có thể bot không thấy.");

  // 3. Danh mục
  for (const dm of ch.danh_muc) {
    const qMuon = ghepQuyen(ch, dm.quyen, idVaiTro, guild.id, idBotRole);
    let c = danhMucCo.get(dm.khoa);
    if (!c) {
      const than = { name: dm.ten, type: 4, permission_overwrites: quyenKenhMoi([], qMuon) };
      const moi = await kh.lam(`tạo danh mục ${dm.ten}`, () => api("POST", `/guilds/${guild.id}/channels`, than));
      c = moi || { id: `moi:${dm.khoa}`, name: dm.ten, type: 4, position: 999 };
      if (moi) kenh.push(moi);
    } else {
      const sua = {};
      if (c.name !== dm.ten) sua.name = dm.ten;
      if (quyenKenhKhac(c.permission_overwrites, qMuon)) sua.permission_overwrites = quyenKenhMoi(c.permission_overwrites, qMuon);
      if (Object.keys(sua).length) {
        const moTa = [sua.name ? `tên "${c.name}" → "${dm.ten}"` : null, sua.permission_overwrites ? "quyền" : null].filter(Boolean).join(", ");
        const moi = await kh.lam(`sửa danh mục ${dm.ten} (${moTa})`, () => api("PATCH", `/channels/${c.id}`, sua));
        if (moi) Object.assign(c, moi);
      }
    }
    idKenh[dm.khoa] = c.id;
    tenKenh[dm.khoa] = dm.ten;
    danhMucCo.set(dm.khoa, c);
    if (!c.id.startsWith("moi:")) ttMc.kenh[dm.khoa] = c.id;
  }

  // 4. Kênh con
  for (const dm of ch.danh_muc) {
    const cha = danhMucCo.get(dm.khoa);
    for (const k of dm.kenh) {
      const loai = LOAI_KENH[k.loai];
      const qMuon = ghepQuyen(ch, { ...dm.quyen, ...(k.quyen || {}) }, idVaiTro, guild.id, idBotRole);
      let c = kenhCon.get(k.khoa);
      const muon = { name: k.ten };
      if (loai !== 2) muon.topic = k.chu_de || "";
      if (loai === 0 || loai === 15) muon.rate_limit_per_user = k.cham || 0;
      if (loai === 15) {
        muon.default_reaction_emoji = { emoji_id: null, emoji_name: "👍" };
        muon.default_sort_order = 0;
        muon.default_forum_layout = 1;
      }
      if (!c) {
        const than = { ...muon, type: loai, parent_id: cha.id.startsWith("moi:") ? undefined : cha.id, permission_overwrites: quyenKenhMoi([], qMuon) };
        if (loai === 15) {
          than.available_tags = (k.the || []).map((t) => ({ name: t.ten, moderated: Boolean(t.chi_quan_tri), emoji_id: null, emoji_name: t.emoji || null }));
          if (k.bat_buoc_the) than.flags = REQUIRE_TAG;
        }
        if (kh.ghi && cha.id.startsWith("moi:")) throw new Error(`Danh mục ${dm.ten} chưa có id`);
        const moi = await kh.lam(`tạo kênh ${k.ten} (${k.loai}) trong ${dm.ten}`, () => api("POST", `/guilds/${guild.id}/channels`, than));
        c = moi || { id: `moi:${k.khoa}`, name: k.ten, type: loai, position: 999, parent_id: cha.id };
        if (moi) kenh.push(moi);
      } else {
        const sua = {};
        const khac = [];
        const chuan = loai === 2 ? chuanTen : chuanTenKenh;
        if (chuan(c.name) !== chuan(muon.name)) { sua.name = muon.name; khac.push(`tên "${c.name}" → "${muon.name}"`); }
        if (c.type !== loai && hopLoai(c, loai)) { sua.type = loai; khac.push("loại"); }
        if (c.parent_id !== cha.id && !cha.id.startsWith("moi:")) { sua.parent_id = cha.id; khac.push(`chuyển vào ${dm.ten}`); }
        if ("topic" in muon && (c.topic || "") !== muon.topic) { sua.topic = muon.topic; khac.push("chủ đề"); }
        if ("rate_limit_per_user" in muon && (c.rate_limit_per_user || 0) !== muon.rate_limit_per_user) { sua.rate_limit_per_user = muon.rate_limit_per_user; khac.push("chế độ chậm"); }
        if (loai === 15) {
          if (!c.default_reaction_emoji || c.default_reaction_emoji.emoji_name !== "👍") { sua.default_reaction_emoji = muon.default_reaction_emoji; khac.push("biểu cảm mặc định"); }
          if (c.default_sort_order !== 0) { sua.default_sort_order = 0; khac.push("thứ tự bài"); }
          if (c.default_forum_layout !== 1) { sua.default_forum_layout = 1; khac.push("kiểu xem"); }
          const coSan = c.available_tags || [];
          const daDung = new Set();
          const theMuon = (k.the || []).map((t) => {
            const cu = coSan.find((x) => chuanTen(x.name) === chuanTen(t.ten));
            if (cu) daDung.add(cu.id);
            return { ...(cu ? { id: cu.id } : {}), name: t.ten, moderated: Boolean(t.chi_quan_tri), emoji_id: null, emoji_name: t.emoji || null };
          });
          const thua = coSan.filter((x) => !daDung.has(x.id));
          if (thua.length) kh.bao(`Diễn đàn ${k.ten} có thẻ ngoài cấu hình: ${thua.map((x) => x.name).join(", ")} (giữ nguyên).`);
          const theDich = [...theMuon, ...thua.map((x) => ({ id: x.id, name: x.name, moderated: x.moderated, emoji_id: x.emoji_id, emoji_name: x.emoji_name }))];
          const ky = (ds) => JSON.stringify(ds.map((t) => [t.name, Boolean(t.moderated), t.emoji_id || null, t.emoji_name ? t.emoji_name.replace(/️/g, "") : null]));
          if (ky(coSan) !== ky(theDich)) { sua.available_tags = theDich; khac.push("thẻ"); }
          const coMuon = ((c.flags || 0) & ~REQUIRE_TAG) | (k.bat_buoc_the ? REQUIRE_TAG : 0);
          if ((c.flags || 0) !== coMuon) { sua.flags = coMuon; khac.push(k.bat_buoc_the ? "bắt buộc chọn thẻ" : "bỏ bắt buộc thẻ"); }
        }
        if (quyenKenhKhac(c.permission_overwrites, qMuon)) { sua.permission_overwrites = quyenKenhMoi(c.permission_overwrites, qMuon); khac.push("quyền"); }
        if (khac.length) {
          const moi = await kh.lam(`sửa kênh ${k.ten} (${khac.join(", ")})`, () => api("PATCH", `/channels/${c.id}`, sua));
          if (moi) { Object.assign(c, moi); const i = kenh.findIndex((x) => x.id === c.id); if (i >= 0) kenh[i] = c; }
        }
      }
      idKenh[k.khoa] = c.id;
      kenhCon.set(k.khoa, c);
      if (!c.id.startsWith("moi:")) ttMc.kenh[k.khoa] = c.id;
    }
  }

  // 5. Thứ tự danh mục và kênh
  if (kh.ghi) kenh = await api("GET", `/guilds/${guild.id}/channels`);
  {
    const tk = new Map(kenh.map((c) => [c.id, c]));
    const sap = (ds) => [...ds].sort((a, b) => a.position - b.position || theoId(a, b)).map((c) => c.id);
    const than = [];
    const dsDm = ch.danh_muc.map((dm) => tk.get(idKenh[dm.khoa])).filter(Boolean);
    if (dsDm.length === ch.danh_muc.length && sap(dsDm).join() !== dsDm.map((c) => c.id).join()) {
      dsDm.forEach((c, i) => than.push({ id: c.id, position: i }));
    }
    for (const dm of ch.danh_muc) {
      const con = dm.kenh.map((k) => tk.get(idKenh[k.khoa])).filter(Boolean);
      for (const nhom of [con.filter((c) => c.type !== 2), con.filter((c) => c.type === 2)]) {
        if (nhom.length && sap(nhom).join() !== nhom.map((c) => c.id).join()) nhom.forEach((c, i) => than.push({ id: c.id, position: i }));
      }
    }
    if (than.length) await kh.lam(`xếp thứ tự ${than.length} danh mục/kênh theo cấu hình`, () => api("PATCH", `/guilds/${guild.id}/channels`, than));
  }

  // 6. Cài đặt máy chủ
  {
    const m = ch.may_chu;
    const co = (m.co_kenh_he_thong || []).reduce((a, t) => a | CO_KENH_HE_THONG[t], 0);
    const muon = {
      verification_level: m.muc_xac_minh,
      explicit_content_filter: m.loc_noi_dung,
      default_message_notifications: m.thong_bao_mac_dinh,
      system_channel_id: idKenh[m.kenh_he_thong],
      system_channel_flags: co,
      rules_channel_id: idKenh[m.kenh_luat],
      public_updates_channel_id: idKenh[m.kenh_cap_nhat_cong_dong],
      safety_alerts_channel_id: idKenh[m.kenh_canh_bao_an_toan],
      description: m.mo_ta,
      preferred_locale: m.ngon_ngu,
    };
    if (guild.name !== m.ten) muon.name = m.ten;
    let bamBieuTuong = null;
    if (m.bieu_tuong) {
      const anh = docAnh(join(THU_MUC, "..", "..", m.bieu_tuong));
      bamBieuTuong = anh.bam;
      if (!guild.icon || ttMc.bieu_tuong !== anh.bam) muon.icon = anh.dataUri;
    }
    const sua = {};
    for (const [k, v] of Object.entries(muon)) {
      if (v === undefined) continue;
      if (typeof v === "string" && v.startsWith("moi:")) { sua[k] = v; continue; }
      if ((guild[k] ?? null) !== v) sua[k] = v;
    }
    if (Object.keys(sua).length) {
      const ten = Object.keys(sua).map((k) => (k === "icon" ? `biểu tượng ← ${m.bieu_tuong}` : k));
      const kq = await kh.lam(`sửa cài đặt máy chủ (${ten.join(", ")})`, () => {
        for (const v of Object.values(sua)) if (typeof v === "string" && v.startsWith("moi:")) throw new Error("Thiếu id kênh");
        return api("PATCH", `/guilds/${guild.id}`, sua);
      });
      if (kq && sua.icon) ttMc.bieu_tuong = bamBieuTuong;
    }
  }

  // 7. AutoMod
  {
    const coSan = await api("GET", `/guilds/${guild.id}/auto-moderation/rules`);
    const daNhanRule = new Set();
    const DUY_NHAT = new Set([3, 4, 5]);
    for (const a of ch.automod) {
      const loai = LOAI_AUTOMOD[a.loai];
      let r = coSan.find((x) => x.id === ttMc.automod[a.khoa]) || coSan.find((x) => !daNhanRule.has(x.id) && x.name === a.ten && x.trigger_type === loai);
      if (!r && DUY_NHAT.has(loai)) r = coSan.find((x) => !daNhanRule.has(x.id) && x.trigger_type === loai);
      const meta = {};
      if (loai === 1) {
        meta.keyword_filter = [...(a.tu_khoa || []), ...(a.tu_khoa_tep ? docTuKhoa(a.tu_khoa_tep) : [])];
        meta.regex_patterns = a.regex || [];
        meta.allow_list = a.cho_phep || [];
        if (meta.keyword_filter.length > 1000 || meta.keyword_filter.some((s) => s.length > 60)) throw new Error(`${a.ten}: quá 1000 từ hoặc từ dài quá 60 ký tự`);
      }
      if (loai === 4) { meta.presets = a.bo_co_san.map((p) => BO_CO_SAN[p]); meta.allow_list = a.cho_phep || []; }
      if (loai === 5) { meta.mention_total_limit = a.gioi_han_nhac; meta.mention_raid_protection_enabled = Boolean(a.chong_dot_kich); }
      const hanhDong = [];
      if (a.chan) hanhDong.push({ type: 1, metadata: { custom_message: a.chan } });
      if (a.bao_kenh) hanhDong.push({ type: 2, metadata: { channel_id: idKenh[a.bao_kenh] } });
      if (a.khoa_tam_giay) hanhDong.push({ type: 3, metadata: { duration_seconds: a.khoa_tam_giay } });
      const muon = {
        name: a.ten,
        event_type: 1,
        trigger_metadata: meta,
        actions: hanhDong,
        enabled: true,
        exempt_roles: (a.mien_vai_tro || []).map((k) => idVaiTro[k]),
        exempt_channels: (a.mien_kenh || []).map((k) => idKenh[k]),
      };
      const coIdMoi = JSON.stringify(muon).includes('"moi:');
      if (!r) {
        const moi = await kh.lam(`tạo AutoMod: ${a.ten}`, () => {
          if (coIdMoi) throw new Error("Thiếu id");
          return api("POST", `/guilds/${guild.id}/auto-moderation/rules`, { ...muon, trigger_type: loai });
        });
        if (moi) { ttMc.automod[a.khoa] = moi.id; daNhanRule.add(moi.id); }
      } else {
        daNhanRule.add(r.id);
        ttMc.automod[a.khoa] = r.id;
        const ky = (x) => JSON.stringify({
          name: x.name, event_type: x.event_type, enabled: x.enabled,
          exempt_roles: [...(x.exempt_roles || [])].sort(), exempt_channels: [...(x.exempt_channels || [])].sort(),
          actions: (x.actions || []).map((h) => ({ type: h.type, m: h.type === 1 ? (h.metadata?.custom_message || "") : h.type === 2 ? h.metadata?.channel_id : h.type === 3 ? h.metadata?.duration_seconds : null })),
          meta: {
            kf: [...(x.trigger_metadata?.keyword_filter || [])].sort(), rx: [...(x.trigger_metadata?.regex_patterns || [])].sort(),
            al: [...(x.trigger_metadata?.allow_list || [])].sort(), pr: [...(x.trigger_metadata?.presets || [])].sort(),
            ml: x.trigger_metadata?.mention_total_limit ?? null, mr: Boolean(x.trigger_metadata?.mention_raid_protection_enabled),
          },
        });
        if (ky(r) !== ky(muon)) {
          await kh.lam(`sửa AutoMod: ${a.ten}${r.name !== a.ten ? ` (từ "${r.name}")` : ""}`, () => {
            if (coIdMoi) throw new Error("Thiếu id");
            return api("PATCH", `/guilds/${guild.id}/auto-moderation/rules/${r.id}`, muon);
          });
        }
      }
    }
    const ngoai = coSan.filter((x) => !daNhanRule.has(x.id));
    if (ngoai.length) kh.bao(`AutoMod ngoài cấu hình (giữ nguyên): ${ngoai.map((x) => x.name).join(", ")}`);
  }

  // 8. Tin nhắn soạn sẵn
  for (const dm of ch.danh_muc) {
    for (const k of dm.kenh) {
      if (!k.tin) continue;
      const id = idKenh[k.khoa];
      const tin = docTin(k.tin).map((t) => dienMau(t, idKenh, idVaiTro, tenKenh, tenVaiTro));
      for (const [i, t] of tin.entries()) if (t.length > 2000) throw new Error(`${k.tin} tin ${i + 1} dài ${t.length} ký tự, quá 2000`);
      if (id.startsWith("moi:")) { await kh.lam(`đăng ${tin.length} tin ở ${k.ten}${k.ghim ? ", ghim tin đầu" : ""}`, async () => {}); continue; }
      // Tin của bot: theo id đã nhớ (kênh đông người thì tin cũ trôi khỏi 100 tin gần nhất); chưa nhớ thì tìm trong 100 tin gần nhất.
      ttMc.tin ||= {};
      let cuaBot;
      if (ttMc.tin[k.khoa] && ttMc.tin[k.khoa].length) {
        cuaBot = [];
        for (const mid of ttMc.tin[k.khoa]) {
          try { cuaBot.push(await api("GET", `/channels/${id}/messages/${mid}`)); }
          catch (e) { if (e.trangThai !== 404) throw e; }
        }
      } else {
        const ds = await api("GET", `/channels/${id}/messages?limit=100`);
        cuaBot = ds.filter((m) => m.author && m.author.id === toi.id && !m.webhook_id).sort(theoId);
      }
      for (const [i, t] of tin.entries()) {
        const m = cuaBot[i];
        if (!m) {
          const moi = await kh.lam(`đăng tin ${i + 1}/${tin.length} ở ${k.ten}`, () => api("POST", `/channels/${id}/messages`, { content: t, allowed_mentions: { parse: [] }, flags: SUPPRESS_EMBEDS }));
          if (moi) cuaBot[i] = moi;
        } else if (m.content !== t) {
          await kh.lam(`sửa tin ${i + 1}/${tin.length} ở ${k.ten}`, () => api("PATCH", `/channels/${id}/messages/${m.id}`, { content: t, allowed_mentions: { parse: [] }, flags: SUPPRESS_EMBEDS }));
        }
      }
      if (cuaBot.length > tin.length) kh.bao(`${k.ten}: bot có ${cuaBot.length - tin.length} tin thừa so với ${k.tin} (giữ nguyên).`);
      const conLai = cuaBot.filter(Boolean);
      if (kh.ghi && conLai.length) ttMc.tin[k.khoa] = conLai.map((m) => m.id);
      const dau = cuaBot[0];
      if (k.ghim && !dau && !kh.ghi) await kh.lam(`ghim tin đầu ở ${k.ten}`, async () => {});
      if (k.ghim && dau && !dau.pinned) {
        await kh.lam(`ghim tin đầu ở ${k.ten}`, async () => {
          try { return await api("PUT", `/channels/${id}/messages/pins/${dau.id}`); }
          catch (e) { if (e.trangThai === 404) return api("PUT", `/channels/${id}/pins/${dau.id}`); throw e; }
        });
      }
    }
  }

  // 9. Báo phần ngoài cấu hình
  {
    const daQuanLy = new Set(Object.values(idKenh));
    const ngoai = kenh.filter((c) => !daQuanLy.has(c.id) && ![11, 12, 10].includes(c.type));
    if (ngoai.length) kh.bao(`Kênh ngoài cấu hình (không xóa, tự quyết): ${ngoai.map((c) => c.name).join(", ")}`);
    const vaiTroNgoai = vaiTroHienCo.filter((r) => r.id !== guild.id && !r.managed && !Object.values(idVaiTro).includes(r.id));
    if (vaiTroNgoai.length) kh.bao(`Vai trò ngoài cấu hình: ${vaiTroNgoai.map((r) => r.name).join(", ")}`);
  }

  if (kh.ghi) ghiTrangThai(tt);
  console.log(`\n${kh.so ? `${kh.so} thay đổi ${kh.ghi ? "đã ghi" : "sẽ ghi khi chạy với --ghi"}` : "Không có gì cần đổi: máy chủ khớp cấu hình."}${kh.canhBao.length ? ` · ${kh.canhBao.length} cảnh báo` : ""}`);
  return kh;
}

// ---------- Lệnh: moi ----------
async function lenhMoi(ch, ts) {
  const nc = await napNguCanh(ch);
  const { guild } = nc;
  if (ts["liet-ke"]) {
    const ds = await api("GET", `/guilds/${guild.id}/invites`);
    if (!ds.length) console.log("Chưa có link mời.");
    for (const v of ds) {
      const vt = (v.roles || v.role_ids || []).map((r) => (typeof r === "string" ? nc.vaiTroTheoId.get(r)?.name : r.name)).filter(Boolean);
      console.log(`https://discord.gg/${v.code} · kênh #${v.channel?.name} · ${v.uses}/${v.max_uses || "∞"} lượt · ${v.max_age ? `hết hạn sau ${v.max_age}s` : "không hết hạn"}${vt.length ? ` · gán ${vt.join(", ")}` : ""}`);
    }
    return;
  }
  const loai = ts["vai-tro"] && ts["vai-tro"] !== true ? ts["vai-tro"] : "thanh_vien";
  const dsKhoa = ch.link_moi[loai];
  if (!dsKhoa) { console.error(`--vai-tro phải là: ${Object.keys(ch.link_moi).join(", ")}`); process.exit(2); }
  const tt = docTrangThai().may_chu[guild.id];
  if (!tt) { console.error("Chưa dựng máy chủ. Chạy `dung --ghi` trước."); process.exit(2); }
  const roleIds = dsKhoa.map((k) => tt.vai_tro[k]);
  if (roleIds.some((x) => !x || !nc.vaiTroTheoId.has(x))) { console.error("Thiếu vai trò, chạy `dung --ghi` trước."); process.exit(2); }
  const luot = ts.luot === undefined || ts.luot === true ? 0 : Number(ts.luot);
  if (!Number.isInteger(luot) || luot < 0 || luot > 100) { console.error("--luot là số nguyên 0–100 (0 = không giới hạn)."); process.exit(2); }
  const idKenh = tt.kenh[ch.may_chu.kenh_link_moi];
  const v = await api("POST", `/channels/${idKenh}/invites`, { max_age: 0, max_uses: luot, unique: true, role_ids: roleIds });
  const daGan = (v.roles || []).map((r) => r.name);
  console.log(`https://discord.gg/${v.code}`);
  console.log(`không hết hạn · ${luot ? `${luot} lượt` : "không giới hạn lượt"} · gán vai trò: ${daGan.length ? daGan.join(", ") : dsKhoa.map((k) => ch.vai_tro.find((x) => x.khoa === k).ten).join(", ") + " (Discord không trả danh sách, kiểm bằng --liet-ke)"}`);
}

// ---------- Lệnh: bieu-tuong ----------
function docAnh(duong) {
  const kieu = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif" }[extname(duong).toLowerCase()];
  if (!kieu) throw new Error(`Biểu tượng phải là .png, .jpg hoặc .gif: ${duong}`);
  const du = readFileSync(duong);
  if (du.length > 10 * 1024 * 1024) throw new Error(`Tệp biểu tượng quá 10 MB: ${duong}`);
  return { dataUri: `data:${kieu};base64,${du.toString("base64")}`, bam: createHash("sha256").update(du).digest("hex").slice(0, 16) };
}
async function lenhBieuTuong(ch, ts) {
  const tep = ts._[1];
  if (!tep) { console.error("Cần đường dẫn tệp PNG/JPG/GIF."); process.exit(2); }
  const anh = docAnh(resolve(process.cwd(), tep));
  const nc = await napNguCanh(ch);
  await api("PATCH", `/guilds/${nc.guild.id}`, { icon: anh.dataUri });
  const tt = docTrangThai();
  (tt.may_chu[nc.guild.id] ||= { vai_tro: {}, kenh: {}, automod: {} }).bieu_tuong = anh.bam;
  ghiTrangThai(tt);
  console.log(`Đã đặt biểu tượng máy chủ từ ${tep}.`);
}

// ---------- Chạy ----------
async function main() {
  const ts = thamSo(process.argv.slice(2));
  const lenh = ts._[0];
  const ch = docCauHinh();
  const bang = { kiem: lenhKiem, "link-bot": lenhLinkBot, dung: lenhDung, moi: lenhMoi, "bieu-tuong": lenhBieuTuong };
  if (!bang[lenh]) {
    console.log("Lệnh: kiem | link-bot | dung [--ghi] | moi [--vai-tro thanh_vien|choi_thu] [--luot N] | moi --liet-ke | bieu-tuong <tệp>");
    process.exit(lenh ? 2 : 0);
  }
  TOKEN = docToken();
  await bang[lenh](ch, ts);
}

main().catch((e) => {
  const tin = String(e && e.message ? e.message : e);
  console.error(`Lỗi: ${TOKEN ? tin.split(TOKEN).join("<token>") : tin}`);
  if (e && e.ma === 50013) console.error("Bot thiếu quyền, hoặc vai trò cần sửa nằm trên vai trò của bot.");
  if (e && e.trangThai === 401) console.error("Token sai hoặc đã bị đặt lại. Lấy token mới ở Developer Portal và ghi lại file discord.env.");
  process.exit(1);
});
