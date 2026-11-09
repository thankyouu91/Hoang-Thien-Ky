#!/usr/bin/env node
// Thử thiet_lap.mjs với một máy chủ Discord giả lập (không gọi Discord thật).
// Trạng thái đầu giống máy chủ mới tạo bằng "Tạo của riêng tôi → Cho câu lạc bộ hoặc cộng đồng"
// rồi bật Cộng đồng với "Tạo giúp tôi" cho kênh luật và kênh cập nhật.
//   node tools/discord/thu_gia_lap.mjs
import http from "node:http";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const THU_MUC = dirname(fileURLToPath(import.meta.url));
const CH = JSON.parse(readFileSync(join(THU_MUC, "cau_hinh.json"), "utf8"));
let dem = 1000n;
const id = () => String(++dem * 4194304n);
const bit = (...b) => b.reduce((a, x) => a | (1n << BigInt(x)), 0n);

const G = id(), BOT = id(), CHU = id(), NGUOI = id();
const BIT = { VIEW_CHANNEL: 10, SEND_MESSAGES: 11, MENTION_EVERYONE: 17, CREATE_INSTANT_INVITE: 0, ADMINISTRATOR: 3 };
const QUYEN_EVERYONE = bit(0, 6, 9, 10, 11, 14, 15, 16, 17, 18, 20, 21, 25, 26, 31, 35, 36, 37, 38, 39, 42, 46, 49);
// quyền bot = quyen_bot trong cấu hình (tên → bit tra từ thiet_lap qua bảng nhỏ ở đây)
const BANG = { CREATE_INSTANT_INVITE: 0, KICK_MEMBERS: 1, BAN_MEMBERS: 2, MANAGE_CHANNELS: 4, MANAGE_GUILD: 5, ADD_REACTIONS: 6, VIEW_AUDIT_LOG: 7, VIEW_CHANNEL: 10, SEND_MESSAGES: 11, MANAGE_MESSAGES: 13, EMBED_LINKS: 14, ATTACH_FILES: 15, READ_MESSAGE_HISTORY: 16, MENTION_EVERYONE: 17, CONNECT: 20, SPEAK: 21, MANAGE_NICKNAMES: 27, MANAGE_ROLES: 28, MANAGE_WEBHOOKS: 29, MANAGE_THREADS: 34, CREATE_PUBLIC_THREADS: 35, CREATE_PRIVATE_THREADS: 36, SEND_MESSAGES_IN_THREADS: 38, MODERATE_MEMBERS: 40, PIN_MESSAGES: 51 };
const QUYEN_BOT = CH.quyen_bot.reduce((a, t) => a | (1n << BigInt(BANG[t])), 0n);

const s = {
  guild: { id: G, name: "Thiên Hoang Ký", owner_id: CHU, features: ["COMMUNITY", "NEWS"], verification_level: 1, explicit_content_filter: 2, default_message_notifications: 0, system_channel_flags: 0, description: null, preferred_locale: "en-US", safety_alerts_channel_id: null },
  roles: [
    { id: G, name: "@everyone", permissions: String(QUYEN_EVERYONE), position: 0, color: 0, colors: { primary_color: 0, secondary_color: null, tertiary_color: null }, hoist: false, mentionable: false, managed: false },
    { id: id(), name: "Thiên Hoang Ký – Trợ lý", permissions: String(QUYEN_BOT), position: 1, color: 0, colors: { primary_color: 0, secondary_color: null, tertiary_color: null }, hoist: false, mentionable: false, managed: true, tags: { bot_id: BOT } },
  ],
  channels: [],
  messages: new Map(),
  automod: [],
  invites: [],
  goi: [],
};
const ROLE_BOT = s.roles[1].id;
const kenh = (o) => { const c = { id: id(), guild_id: G, position: 0, permission_overwrites: [], parent_id: null, topic: null, rate_limit_per_user: 0, flags: 0, ...o }; s.channels.push(c); return c; };
const dmChat = kenh({ name: "Text Channels", type: 4, position: 0 });
const dmThoai = kenh({ name: "Voice Channels", type: 4, position: 1 });
const general = kenh({ name: "general", type: 0, parent_id: dmChat.id, position: 0 });
const voice = kenh({ name: "General", type: 2, parent_id: dmThoai.id, position: 0, bitrate: 64000, user_limit: 0 });
const rules = kenh({ name: "rules", type: 0, parent_id: dmChat.id, position: 1, permission_overwrites: [{ id: G, type: 0, allow: "0", deny: String(bit(11)) }] });
const modOnly = kenh({ name: "moderator-only", type: 0, parent_id: dmChat.id, position: 2, permission_overwrites: [{ id: G, type: 0, allow: "0", deny: String(bit(10)) }] });
Object.assign(s.guild, { system_channel_id: general.id, rules_channel_id: rules.id, public_updates_channel_id: modOnly.id });
// Discord tự bật vài luật AutoMod cho máy chủ cộng đồng mới
s.automod.push({ id: id(), guild_id: G, name: "Block Mention Spam", creator_id: CHU, event_type: 1, trigger_type: 5, trigger_metadata: { mention_total_limit: 20, mention_raid_protection_enabled: true }, actions: [{ type: 1, metadata: {} }], enabled: true, exempt_roles: [], exempt_channels: [] });

const loi = (res, st, code, message) => { res.writeHead(st, { "content-type": "application/json" }); res.end(JSON.stringify({ code, message })); };
const tra = (res, data, st = 200) => { if (data === null) { res.writeHead(204); return res.end(); } res.writeHead(st, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };
const chuanTenKenh = (n, t) => (t === 2 || t === 4 ? n : n.toLowerCase().replace(/\s+/g, "-"));
function kiemQuyenTrao(perm) {
  if (BigInt(perm) & ~(QUYEN_BOT | QUYEN_EVERYONE) & ~0n) {
    const thua = BigInt(perm) & ~QUYEN_BOT;
    if (thua) return false;
  }
  return true;
}
function kiemGhiDe(ows) {
  for (const o of ows || []) {
    if ((BigInt(o.allow || 0) | BigInt(o.deny || 0)) & ~QUYEN_BOT) return false;
    if (BigInt(o.allow || 0) & bit(28)) return false;
  }
  return true;
}
function apKenh(c, b) {
  for (const k of ["name", "topic", "parent_id", "permission_overwrites", "rate_limit_per_user", "available_tags", "default_reaction_emoji", "default_sort_order", "default_forum_layout", "flags", "type", "position", "user_limit", "bitrate"]) {
    if (k in b) c[k] = b[k];
  }
  c.name = chuanTenKenh(c.name, c.type);
  if (c.permission_overwrites) c.permission_overwrites = c.permission_overwrites.map((o) => ({ id: o.id, type: o.type, allow: String(o.allow ?? "0"), deny: String(o.deny ?? "0") }));
  if (c.available_tags) c.available_tags = c.available_tags.map((t) => ({ id: t.id || id(), name: t.name, moderated: Boolean(t.moderated), emoji_id: t.emoji_id ?? null, emoji_name: t.emoji_name ?? null }));
}

const server = http.createServer(async (req, res) => {
  let body = "";
  for await (const ch of req) body += ch;
  const b = body ? JSON.parse(body) : undefined;
  const u = new URL(req.url, "http://x");
  const p = u.pathname.replace(/^\/api\/v10/, "");
  const m = req.method;
  s.goi.push(`${m} ${p}`);
  if (req.headers.authorization !== "Bot token-thu") return loi(res, 401, 0, "401: Unauthorized");
  const khop = (re) => p.match(re);
  let k;
  if (m === "GET" && p === "/users/@me") return tra(res, { id: BOT, username: "Trợ lý", bot: true });
  if (m === "GET" && p === "/users/@me/guilds") return tra(res, [{ id: G, name: s.guild.name }]);
  if (m === "GET" && p === "/oauth2/applications/@me") return tra(res, { id: BOT });
  if (m === "GET" && p === `/guilds/${G}`) return tra(res, { ...s.guild, roles: s.roles });
  if (m === "PATCH" && p === `/guilds/${G}`) {
    if ("features" in b) return loi(res, 403, 50013, "Missing Permissions");
    Object.assign(s.guild, b); return tra(res, { ...s.guild, roles: s.roles });
  }
  if (m === "GET" && p === `/guilds/${G}/channels`) return tra(res, s.channels);
  if (m === "POST" && p === `/guilds/${G}/channels`) {
    if (!kiemGhiDe(b.permission_overwrites)) return loi(res, 403, 50013, "Missing Permissions (overwrite)");
    const c = { id: id(), guild_id: G, type: b.type ?? 0, position: s.channels.filter((x) => x.parent_id === (b.parent_id ?? null)).length, parent_id: null, topic: null, permission_overwrites: [], rate_limit_per_user: 0, flags: 0 };
    if (c.type === 15) Object.assign(c, { available_tags: [], default_reaction_emoji: null, default_sort_order: null, default_forum_layout: 0 });
    apKenh(c, b); s.channels.push(c); return tra(res, c, 201);
  }
  if (m === "PATCH" && p === `/guilds/${G}/channels`) { for (const x of b) { const c = s.channels.find((y) => y.id === x.id); if (!c) return loi(res, 400, 0, "bad id"); c.position = x.position; } return tra(res, null); }
  if ((k = khop(/^\/channels\/(\d+)$/)) && m === "PATCH") {
    const c = s.channels.find((x) => x.id === k[1]); if (!c) return loi(res, 404, 10003, "Unknown Channel");
    if (b.permission_overwrites && !kiemGhiDe(b.permission_overwrites)) return loi(res, 403, 50013, "Missing Permissions (overwrite)");
    apKenh(c, b); return tra(res, c);
  }
  if ((k = khop(/^\/guilds\/\d+\/members\/(\d+)$/)) && m === "GET") return tra(res, { user: { id: k[1] }, roles: k[1] === BOT ? [ROLE_BOT] : [] });
  if (m === "GET" && p === `/guilds/${G}/roles`) return tra(res, s.roles);
  if (m === "POST" && p === `/guilds/${G}/roles`) {
    if (!kiemQuyenTrao(b.permissions || "0")) return loi(res, 403, 50013, "Missing Permissions (role)");
    for (const r of s.roles) if (r.position >= 1) r.position++;
    const r = { id: id(), name: b.name, permissions: String(b.permissions || "0"), position: 1, color: b.colors?.primary_color ?? 0, colors: { primary_color: b.colors?.primary_color ?? 0, secondary_color: null, tertiary_color: null }, hoist: Boolean(b.hoist), mentionable: Boolean(b.mentionable), managed: false };
    s.roles.push(r); return tra(res, r);
  }
  if (m === "PATCH" && p === `/guilds/${G}/roles`) {
    const viTriBot = s.roles.find((r) => r.id === ROLE_BOT).position;
    for (const x of b) { if (x.position >= viTriBot) return loi(res, 403, 50013, "Missing Permissions (position)"); }
    for (const x of b) s.roles.find((r) => r.id === x.id).position = x.position;
    return tra(res, s.roles);
  }
  if ((k = khop(/^\/guilds\/\d+\/roles\/(\d+)$/)) && m === "PATCH") {
    const r = s.roles.find((x) => x.id === k[1]); if (!r) return loi(res, 404, 10011, "Unknown Role");
    if ("permissions" in b) {
      const doi = BigInt(b.permissions) ^ BigInt(r.permissions);
      if (doi & ~QUYEN_BOT) return loi(res, 403, 50013, "Missing Permissions (role perms)");
      r.permissions = String(b.permissions);
    }
    for (const kk of ["name", "hoist", "mentionable"]) if (kk in b) r[kk] = b[kk];
    if (b.colors) { r.colors = { ...r.colors, ...b.colors }; r.color = b.colors.primary_color; }
    return tra(res, r);
  }
  if (m === "GET" && p === `/guilds/${G}/auto-moderation/rules`) return tra(res, s.automod);
  if (m === "POST" && p === `/guilds/${G}/auto-moderation/rules`) {
    if ([3, 4, 5].includes(b.trigger_type) && s.automod.some((r) => r.trigger_type === b.trigger_type)) return loi(res, 400, 20034, "Maximum number of rules of this type reached");
    if (b.trigger_type === 1 && s.automod.filter((r) => r.trigger_type === 1).length >= 6) return loi(res, 400, 20034, "Max keyword rules");
    if (b.actions.some((a) => a.type === 3) && ![1, 5].includes(b.trigger_type)) return loi(res, 400, 0, "timeout not allowed");
    const r = { id: id(), guild_id: G, creator_id: BOT, ...b }; s.automod.push(r); return tra(res, r);
  }
  if ((k = khop(/^\/guilds\/\d+\/auto-moderation\/rules\/(\d+)$/)) && m === "PATCH") {
    const r = s.automod.find((x) => x.id === k[1]); if (!r) return loi(res, 404, 10066, "Unknown rule");
    if ("trigger_type" in b) return loi(res, 400, 0, "cannot change trigger_type");
    Object.assign(r, b); return tra(res, r);
  }
  if ((k = khop(/^\/channels\/(\d+)\/messages$/))) {
    const ds = s.messages.get(k[1]) || [];
    if (m === "GET") { const lim = Number(u.searchParams.get("limit") || 50); return tra(res, [...ds].reverse().slice(0, lim)); }
    if (m === "POST") {
      if (b.content.length > 2000) return loi(res, 400, 50035, "content too long");
      const msg = { id: id(), channel_id: k[1], author: { id: BOT, bot: true }, content: b.content, pinned: false, flags: b.flags || 0 };
      ds.push(msg); s.messages.set(k[1], ds); return tra(res, msg);
    }
  }
  if ((k = khop(/^\/channels\/(\d+)\/messages\/(\d+)$/))) {
    const msg = (s.messages.get(k[1]) || []).find((x) => x.id === k[2]);
    if (!msg) return loi(res, 404, 10008, "Unknown Message");
    if (m === "GET") return tra(res, msg);
    if (m === "PATCH") { if (msg.author.id !== BOT) return loi(res, 403, 50005, "Cannot edit"); msg.content = b.content; return tra(res, msg); }
  }
  if ((k = khop(/^\/channels\/(\d+)\/messages\/pins\/(\d+)$/)) && m === "PUT") {
    const msg = (s.messages.get(k[1]) || []).find((x) => x.id === k[2]); if (!msg) return loi(res, 404, 10008, "Unknown Message");
    msg.pinned = true; return tra(res, null);
  }
  if ((k = khop(/^\/channels\/(\d+)\/invites$/)) && m === "POST") {
    const v = { code: "THU" + s.invites.length, channel: { id: k[1], name: s.channels.find((c) => c.id === k[1])?.name }, max_age: b.max_age, max_uses: b.max_uses, uses: 0, roles: (b.role_ids || []).map((rid) => { const r = s.roles.find((x) => x.id === rid); return { id: r.id, name: r.name }; }) };
    s.invites.push(v); return tra(res, v);
  }
  if (m === "GET" && p === `/guilds/${G}/invites`) return tra(res, s.invites);
  return loi(res, 404, 0, `giả lập chưa có ${m} ${p}`);
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const nha = mkdtempSync(join(tmpdir(), "thk-discord-thu-"));
const env = { ...process.env, DISCORD_API_BASE: `http://127.0.0.1:${server.address().port}/api/v10`, DISCORD_BOT_TOKEN: "token-thu", THK_DISCORD_HOME: nha };
delete env.DISCORD_GUILD_ID;
const chay = async (...a) => {
  // chạy tiến trình con bất đồng bộ để máy chủ giả lập vẫn trả lời được
  const { spawn } = await import("node:child_process");
  return new Promise((ok) => {
    const p = spawn(process.execPath, [join(THU_MUC, "thiet_lap.mjs"), ...a], { env });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => ok({ code, out, err }));
  });
};
const tim = (ten) => s.channels.find((c) => c.name.replace(/️/g, "") === ten.replace(/️/g, "").toLowerCase().replace(/\s+/g, "-") || c.name === ten);
let loiCo = 0;
const buoc = async (ten, fn) => { try { await fn(); console.log(`✓ ${ten}`); } catch (e) { loiCo++; console.log(`✗ ${ten}\n  ${e.message}`); } };

try {
  let r;
  await buoc("chạy thử không ghi gì", async () => {
    const truoc = s.goi.length;
    r = await chay("dung");
    assert.equal(r.code, 0, r.err + r.out);
    const ghi = s.goi.slice(truoc).filter((x) => !x.startsWith("GET"));
    assert.deepEqual(ghi, [], "chạy thử mà có lệnh ghi");
    assert.match(r.out, /thay đổi sẽ ghi/);
    if (process.env.THU_IN) console.log(r.out);
  });
  await buoc("ghi thật", async () => {
    r = await chay("dung", "--ghi");
    assert.equal(r.code, 0, r.err + r.out);
  });
  await buoc("vai trò đủ, đúng thứ tự, dưới bot", async () => {
    const ds = CH.vai_tro.map((v) => s.roles.find((x) => x.name === v.ten));
    assert.ok(ds.every(Boolean), "thiếu vai trò");
    const pos = ds.map((x) => x.position);
    assert.deepEqual([...pos].sort((a, b) => b - a), pos, `thứ tự sai ${pos}`);
    assert.ok(pos[0] < s.roles.find((x) => x.id === ROLE_BOT).position, "vai trò trên bot");
    const ev = BigInt(s.roles.find((x) => x.id === G).permissions);
    assert.equal(ev & bit(17), 0n, "@everyone còn nhắc @everyone");
    assert.equal(ev & bit(0), 0n, "@everyone còn tạo link mời");
  });
  await buoc("danh mục, kênh đúng chỗ, nhận lại kênh mặc định", async () => {
    for (const dm of CH.danh_muc) {
      const c = s.channels.find((x) => x.type === 4 && x.name === dm.ten);
      assert.ok(c, `thiếu danh mục ${dm.ten}`);
      for (const k of dm.kenh) {
        const kc = tim(k.ten);
        assert.ok(kc, `thiếu kênh ${k.ten}`);
        assert.equal(kc.parent_id, c.id, `${k.ten} sai danh mục`);
      }
    }
    assert.equal(tim("💬chung").id, general.id, "không nhận lại #general");
    assert.equal(tim("📜luật").id, rules.id, "không nhận lại #rules");
    assert.equal(tim("🛡️kiểm-duyệt").id, modOnly.id, "không nhận lại #moderator-only");
    assert.equal(tim("🍵 Trà thất").id, voice.id, "không nhận lại kênh thoại General");
    assert.equal(s.channels.find((x) => x.name === "Trò chuyện").id, dmChat.id, "không nhận lại danh mục Text Channels");
    assert.equal(s.channels.find((x) => x.name === "Thoại").id, dmThoai.id, "không nhận lại danh mục Voice Channels");
    const dms = CH.danh_muc.map((dm) => s.channels.find((x) => x.type === 4 && x.name === dm.ten).position);
    assert.deepEqual(dms, [...dms].sort((a, b) => a - b), "thứ tự danh mục sai");
  });
  await buoc("quyền kênh: ẩn/hiện theo vai trò, Thông tin chỉ đọc", async () => {
    const vt = Object.fromEntries(CH.vai_tro.map((v) => [v.khoa, s.roles.find((x) => x.name === v.ten).id]));
    const ow = (c, rid) => c.permission_overwrites.find((o) => o.id === rid);
    const thongBao = tim("📢thông-báo");
    assert.ok(BigInt(ow(thongBao, G).deny) & bit(11), "@everyone đăng được ở thông báo");
    assert.ok(BigInt(ow(thongBao, vt.van_hanh).allow) & bit(11), "Vận hành không đăng được ở thông báo");
    const phong = tim("🧪phòng-chơi-thử");
    assert.ok(BigInt(ow(phong, G).deny) & bit(10), "@everyone thấy phòng chơi thử");
    assert.ok(!ow(phong, vt.thanh_vien), "Thành viên thấy phòng chơi thử");
    assert.ok(BigInt(ow(phong, vt.choi_thu).allow) & bit(10), "Người chơi thử không thấy phòng");
    for (const c of s.channels) assert.ok(ow(c, ROLE_BOT) && BigInt(ow(c, ROLE_BOT).allow) & bit(10), `bot không thấy ${c.name}`);
  });
  await buoc("diễn đàn có thẻ, Góp ý bắt buộc thẻ, 'đã xử lý' chỉ quản trị gắn", async () => {
    const gy = tim("🐞góp-ý-và-báo-lỗi");
    assert.equal(gy.type, 15);
    assert.deepEqual(gy.available_tags.map((t) => t.name), ["lỗi", "đề xuất", "cân bằng", "giao diện", "nhiệm vụ", "đã xử lý"]);
    assert.ok(gy.available_tags.find((t) => t.name === "đã xử lý").moderated);
    assert.equal(gy.flags & 16, 16);
    const ct = tim("⚔️chiến-thuật-công-pháp");
    assert.equal(ct.available_tags.length, 12);
  });
  await buoc("cài đặt máy chủ, không đụng tính năng (không bật Discovery)", async () => {
    assert.equal(s.guild.rules_channel_id, rules.id);
    assert.equal(s.guild.public_updates_channel_id, modOnly.id);
    assert.equal(s.guild.system_channel_id, general.id);
    assert.equal(s.guild.verification_level, 2);
    assert.equal(s.guild.preferred_locale, "vi");
    assert.ok(!s.guild.features.includes("DISCOVERABLE"));
    assert.ok(String(s.guild.icon).startsWith("data:image/png;base64,"), "chưa đặt biểu tượng");
  });
  await buoc("AutoMod đủ 6 luật, nhận lại luật Discord tự tạo", async () => {
    assert.equal(s.automod.length, 6);
    const mention = s.automod.filter((x) => x.trigger_type === 5);
    assert.equal(mention.length, 1);
    assert.equal(mention[0].name, "Chặn nhắc tên hàng loạt");
    assert.equal(mention[0].trigger_metadata.mention_total_limit, 5);
    const alert = s.automod.every((x) => x.actions.some((a) => a.type === 2 && a.metadata.channel_id === modOnly.id));
    assert.ok(alert, "luật không báo về kiểm-duyệt");
  });
  await buoc("tin soạn sẵn đăng và ghim, nhắc kênh bằng <#id>", async () => {
    const luat = s.messages.get(rules.id);
    assert.equal(luat.length, 2);
    assert.ok(luat[0].pinned);
    assert.match(luat[0].content, /<#\d+>/);
    assert.match(luat[0].content, /<@&\d+>/);
    assert.ok(!/\{\{/.test(luat.map((x) => x.content).join()), "còn mẫu chưa điền");
    assert.equal(s.messages.get(general.id).length, 1);
    assert.equal(s.messages.get(tim("🧪phòng-chơi-thử").id).length, 1);
  });
  await buoc("chạy lại: không còn gì để đổi", async () => {
    r = await chay("dung");
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /Không có gì cần đổi/, r.out);
  });
  await buoc("kênh đông người: tin chào không bị đăng lại", async () => {
    const ds = s.messages.get(general.id);
    for (let i = 0; i < 150; i++) ds.push({ id: id(), channel_id: general.id, author: { id: NGUOI }, content: `tin ${i}`, pinned: false });
    r = await chay("dung", "--ghi");
    assert.match(r.out, /Không có gì cần đổi/, r.out);
    assert.equal(ds.filter((x) => x.author.id === BOT).length, 1);
  });
  await buoc("sửa nội dung thì bot sửa tin cũ, tin bị xóa thì đăng lại", async () => {
    const luat = s.messages.get(rules.id);
    luat[0].content = "cũ";
    luat.splice(1, 1);
    r = await chay("dung", "--ghi");
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /sửa tin 1\/2/);
    assert.match(r.out, /đăng tin 2\/2/);
    assert.equal(s.messages.get(rules.id).length, 2);
  });
  await buoc("đổi tên kênh bằng tay: script đổi lại, không tạo trùng", async () => {
    const c = tim("🎐ngoài-lề"); c.name = "tán-gẫu";
    const n = s.channels.length;
    r = await chay("dung", "--ghi");
    assert.equal(s.channels.length, n);
    assert.equal(c.name, "🎐ngoài-lề");
  });
  await buoc("chủ máy chủ bật Administrator cho Ban quản trị: script giữ nguyên", async () => {
    const bqt = s.roles.find((x) => x.name === "Ban quản trị");
    bqt.permissions = String(BigInt(bqt.permissions) | bit(3));
    r = await chay("dung");
    assert.match(r.out, /Không có gì cần đổi/, r.out);
  });
  await buoc("link mời gán vai trò, không hết hạn", async () => {
    r = await chay("moi", "--vai-tro", "choi_thu", "--luot", "100");
    assert.equal(r.code, 0, r.err);
    const v = s.invites.at(-1);
    assert.equal(v.max_age, 0); assert.equal(v.max_uses, 100);
    assert.deepEqual(v.roles.map((x) => x.name), ["Người chơi thử", "Thành viên"]);
    assert.match(r.out, /discord\.gg\/THU0/);
    r = await chay("moi");
    assert.deepEqual(s.invites.at(-1).roles.map((x) => x.name), ["Thành viên"]);
    assert.equal(s.invites.at(-1).max_uses, 0);
  });
  await buoc("link-bot in đúng quyền", async () => {
    r = await chay("link-bot");
    assert.match(r.out, new RegExp(`client_id=${BOT}&scope=bot&permissions=${QUYEN_BOT}`));
  });
  await buoc("token sai: báo lỗi, không in token", async () => {
    const e2 = { ...env, DISCORD_BOT_TOKEN: "token-sai-bi-mat" };
    const { spawn } = await import("node:child_process");
    const kq = await new Promise((ok) => { const p = spawn(process.execPath, [join(THU_MUC, "thiet_lap.mjs"), "kiem"], { env: e2 }); let o = ""; p.stdout.on("data", (d) => (o += d)); p.stderr.on("data", (d) => (o += d)); p.on("close", (code) => ok({ code, o })); });
    assert.notEqual(kq.code, 0);
    assert.ok(!kq.o.includes("token-sai-bi-mat"), "lộ token");
    assert.match(kq.o, /Token sai/);
  });
} finally {
  server.close();
  rmSync(nha, { recursive: true, force: true });
}
console.log(loiCo ? `\n${loiCo} bước lỗi` : "\nTất cả bước đạt.");
process.exit(loiCo ? 1 : 0);
