// Sinh assets/icon_ve/danh_sach.json. Chạy: node tools/icon_ve/danh_sach.cjs (mặc định ghi vào assets/icon_ve/danh_sach.json)
const fs = require("fs");
const path = require("path");
const RA = process.argv[2] || path.resolve(__dirname, "../../assets/icon_ve/danh_sach.json");

const HE = [
  ["kim", "Kim", "silver-white", "a perfect circle", "gleaming silver"],
  ["moc", "Mộc", "verdant green", "a sprouting leaf", "living green"],
  ["thuy", "Thủy", "deep blue", "flowing wave ripples", "deep sapphire blue"],
  ["hoa", "Hỏa", "vermilion red", "a blazing flame", "fiery vermilion"],
  ["tho", "Thổ", "earthy ochre yellow", "a solid square", "earthy ochre"],
  ["loi", "Lôi", "electric violet", "a lightning bolt", "crackling violet"],
  ["phong", "Phong", "pale jade teal", "a spiral whirlwind", "pale jade-teal"],
  ["quang", "Quang", "radiant gold", "radiating light rays", "radiant golden"],
  ["am_lanh", "Âm lãnh", "cold grey-blue", "a ghostly will-o'-wisp flame", "eerie grey-blue"],
  ["cuc_duong", "Cực dương", "blazing orange", "a blazing sun disc", "blazing orange"],
  ["cuc_am", "Cực âm", "dark charcoal purple", "a crescent moon", "shadowy charcoal-purple"],
  ["cuc_han", "Cực hàn", "icy pale blue", "a snowflake", "frosty ice-blue"],
];

const MAU = {
  "tan_quyen/loi": "MAHZ1mhFoQs",
  "ngoc/cuc_han": "MAHZ1s6bCF0",
  "lo_dinh/trung": "MAHZ1p5PxeA",
};

const ds = [];
const add = (ma, ten, uu_tien, nguon, mo_ta, ghi_chu) => {
  const [nhom] = ma.split("/");
  const o = { ma, nhom, ten, uu_tien, nguon, mo_ta };
  if (ghi_chu) o.ghi_chu = ghi_chu;
  if (MAU[ma]) o.mau_da_duyet = MAU[ma];
  ds.push(o);
};

// 1. Trang bị: 6 ô × linh, thiên, thần. Hình trong túi theo cấp đồ; hình cầm trên người theo tài năng (nhóm vu_khi_tai_nang).
const TB = [
  ["vu_khi", "Vũ khí", [
    "a plain but well-forged cultivator's straight sword (jian) with a steel blade and a simple bronze guard, red silk tassel on the pommel",
    "an elegant spirit sword (jian) with a blade of translucent white jade and silver cloud engravings, faint blue glow along the edge",
    "a legendary divine sword (jian) with a radiant golden blade, dragon-carved hilt and swirling celestial aura, glowing runes along the blade",
  ]],
  ["mu", "Mũ", [
    "a black lacquered gauze scholar-official cap (wusha hat) with two short side wings and a small jade bead",
    "an ornate jade crown hairpiece (guan) of carved white jade with a silver hairpin through it",
    "a divine golden crown of a celestial immortal, phoenix and cloud filigree, glowing pearl at the front and soft golden aura",
  ]],
  ["ao", "Áo", [
    "a flowing Taoist cultivator robe folded and displayed upright, deep indigo silk with silver cloud embroidery and a jade clasp at the collar",
    "a heavy dark iron lamellar armor vest with bronze-trimmed plates and shoulder guards, xianxia warrior style",
    "a divine immortal's robe of shimmering white and gold silk woven with feathers of light, floating ribbons and a soft radiant aura",
  ]],
  ["dai", "Đai", [
    "a coiled leather cultivator belt with a carved green jade buckle and a small hanging pouch",
    "an ornate silver-plated belt engraved with thunder-cloud patterns and a round dark jade buckle",
    "a divine golden dragon belt laid out in a gentle S-curve, a long strap of linked golden plates with dragon-scale engraving, the buckle shaped like a dragon head holding a glowing pearl, celestial aura",
  ]],
  ["giay", "Giày", [
    "a pair of black cloth cultivator boots with white soles and simple stitched cloud motif",
    "a pair of cloud-stepping boots of pale blue silk with silver cloud embroidery and wisps of mist around the soles",
    "a pair of divine phoenix-feather boots in crimson and gold with flame-like plumes at the heels, soft golden aura",
  ]],
  ["ngoc_boi", "Ngọc bội", [
    "a round carved green jade pendant disc (bi) with a hole in the center, hanging from a red knotted cord",
    "an intricately carved white jade pendant shaped like a coiled qilin, silver cap and a blue silk tassel",
    "a divine glowing jade pendant carved with a dragon and phoenix, radiating soft golden light, golden tassel",
  ]],
];
// Đổi ngày 2026-11-03 theo người dùng: mỗi loại trang bị 50–70 kiểu, độ hiếm là màu nền ô (lục, lam, tím, vàng, đỏ),
// thuộc tính chỉ hiện khi khảm ngọc; thêm loại bao tay. 18 hình linh/thiên/thần đã vẽ thành các kiểu trong danh sách mới.
const CAP = ["linh", "thien", "than"];
const cuMoTa = {};
for (const [slot, , ms] of TB) CAP.forEach((c, i) => { cuMoTa[`trang_bi/${slot}_${c}`] = ms[i]; });
const { kieuTrangBi, TEN_DO_HIEM } = require("./trang_bi_ten.cjs");
const UU_TIEN_1 = new Set(["01", "02", "03", "04", "25", "26", "41", "42", "53", "58"]);
for (const k of kieuTrangBi(cuMoTa)) {
  const so = k.ma.slice(-2);
  add(k.ma, k.ten, UU_TIEN_1.has(so) ? 1 : 2, "Người dùng 2026-11-03: 50–70 kiểu mỗi loại, độ hiếm theo màu nền", k.mo_ta,
    k.tu_hinh_cu ? `Hình vẽ trước với mã ${k.tu_hinh_cu}` : undefined);
  Object.assign(ds[ds.length - 1], { loai: k.loai, do_hiem: k.do_hiem, khi_hinh: k.khi_hinh });
}

// 2. Ngọc khảm 12 hệ (mẫu: Cực hàn).
for (const [id, ten, mau, kh, tt] of HE)
  add(`ngoc/${id}`, `Ngọc ${ten}`, 1, "GDD mục 12 (Ngọc và khảm)",
    `a faceted ${mau} spirit gemstone set in an ornate silver filigree setting, ${kh} symbol glowing inside the crystal, a silk tassel hanging below`);

// 3. Tàn quyển 12 hệ (mẫu: Lôi).
for (const [id, ten, mau, kh, tt] of HE)
  add(`tan_quyen/${id}`, `Tàn quyển hệ ${ten}`, 1, "GDD mục 9; data/he_thong/json/tan_quyen.json",
    `a torn ancient cultivation scroll fragment, aged parchment unrolling from a carved bronze rod, ${kh} sigil drawn on it glowing ${tt}, ${tt} energy around it`);

// 4. Linh thạch 4 phẩm.
const LT = [
  ["ha", "Linh thạch hạ phẩm", "a small rough cluster of pale translucent spirit crystals with a faint white glow"],
  ["trung", "Linh thạch trung phẩm", "a cluster of clear blue-green spirit crystals with a steady soft glow"],
  ["thuong", "Linh thạch thượng phẩm", "a large cluster of brilliant violet spirit crystals pulsing with bright energy"],
  ["cuc", "Linh thạch cực phẩm", "a flawless radiant golden spirit crystal cluster blazing with dense spiritual energy and tiny floating motes"],
];
for (const [id, ten, m] of LT) add(`linh_thach/${id}`, ten, 1, "GDD mục 12 (mỗi vị diện một phẩm linh thạch)", m);

// 5. Quặng 4 bậc (tên theo GDD mục 12).
const QU = [
  ["thiet_tinh", "Thiết tinh", "a chunk of dark refined iron ore with metallic grey veins"],
  ["huyen_thiet", "Huyền thiết", "a heavy chunk of black mysterious iron ore with deep blue metallic sheen"],
  ["tinh_kim", "Tinh kim", "a chunk of star-gold ore, pale gold metal with twinkling starlike specks"],
  ["than_kim", "Thần kim", "a chunk of divine metal ore glowing white-gold with ethereal runes on its surface"],
];
for (const [id, ten, m] of QU) add(`quang/${id}`, ten, 1, "GDD mục 12 (Chất lượng theo vị diện)", m);

// 6. Dược liệu 4 bậc (GDD chỉ ghi "4 bậc tương ứng"; tên bậc 2–4 là đề xuất) và dược liệu hiếm.
const DU = [
  ["linh_thao", "Linh thảo", 1, "a bundle of fresh green spirit herbs tied with straw string, dewdrops on the leaves", ""],
  ["huyen_chi", "Huyền chi (đề xuất)", 1, "a dark purple lingzhi mushroom with glossy concentric rings and a faint mystical glow", "Tên bậc 2 là đề xuất"],
  ["ngoc_sam", "Ngọc sâm (đề xuất)", 1, "a translucent jade-white ginseng root shaped like a tiny person, soft green glow", "Tên bậc 3 là đề xuất"],
  ["than_lien", "Thần liên (đề xuất)", 1, "a divine lotus flower with luminous white and gold petals and a glowing seed pod, floating motes of light", "Tên bậc 4 là đề xuất"],
  ["tu_loi_thao", "Tử Lôi Thảo", 1, "a violet spirit herb with jagged lightning-shaped leaves crackling with small purple sparks", "Có trong túi mẫu của prototype"],
  ["long_tuy_thao", "Long Tủy Thảo", 2, "a rare crimson spirit herb with scale-like leaves coiling like a small dragon, a golden glowing bulb at the root", "Nguyên liệu tẩy tủy (GDD mục 6)"],
  ["thien_dia_linh_tuy", "Thiên Địa Linh Tủy", 2, "a small crystal vial holding a glowing milky-white liquid of condensed heaven and earth essence, swirling light inside", "Nguyên liệu tẩy tủy (GDD mục 6)"],
  ["dan_thu", "Đan thú", 2, "a glowing beast core, a round amber-red inner pill of a spirit beast with swirling energy and claw-like veins", "Rơi ở Thú Lâm (GDD mục 11), luyện linh đơn"],
];
for (const [id, ten, u, m, g] of DU) add(`duoc/${id}`, ten, u, "GDD mục 6, 11, 12", m, g || undefined);

// 7. Đan: vẽ theo nhóm công dụng; vật chứa theo nhóm (đan dược: đĩa sứ; linh đan: hộp ngọc; thần đan: đài sen vàng).
const DAN = [
  ["dan_duoc_hoi_mau", "Đan dược hồi máu (Bổ Huyết Đan)", 1, "three round crimson red healing pills on a small white porcelain dish"],
  ["dan_duoc_hoi_mana", "Đan dược hồi mana (Hồi Khí Đan)", 1, "three round sky-blue qi recovery pills on a small white porcelain dish, faint blue mist"],
  ["dan_duoc_tang_chi_so", "Đan dược tăng chỉ số tạm thời", 2, "three round amber-orange strength pills on a small white porcelain dish, faint orange glow"],
  ["dan_duoc_giai_doc", "Đan dược giải độc", 2, "three round pale green antidote pills on a small white porcelain dish, a sprig of herb beside them"],
  ["linh_dan_tri_thuong", "Linh đan trị thương", 2, "a single glowing rose-red spirit pill resting on silk inside an open carved green jade box"],
  ["linh_dan_kinh_nghiem", "Linh đan tăng kinh nghiệm", 2, "a single glowing golden-yellow spirit pill resting on silk inside an open carved green jade box"],
  ["linh_dan_tu_luyen", "Linh đan tăng tốc tu luyện (Tụ Linh Đan)", 1, "a single glowing cyan spirit pill with swirling qi resting on silk inside an open carved green jade box"],
  ["than_dan_pha_canh", "Thần đan vượt cảnh giới (Phá Cảnh Đan)", 1, "a radiant divine pill with nine golden pill-patterns on its surface, floating above a golden lotus pedestal, blazing aura"],
  ["than_dan_ngo_dao", "Thần đan tăng ngộ đạo", 2, "a radiant translucent white divine pill with a tiny taiji swirl inside, floating above a golden lotus pedestal, soft aura"],
  ["than_dan_giam_loi_kiep", "Thần đan giảm lôi kiếp", 2, "a radiant deep violet divine pill wrapped in tiny lightning arcs, floating above a golden lotus pedestal"],
  ["tay_tuy_dan", "Tẩy Tủy Đan", 2, "a pearl-white marrow-cleansing pill glowing with rainbow iridescence inside a small open celadon porcelain bottle gourd"],
  ["dich_dung_dan", "Dịch Dung Đan", 2, "a shimmering iridescent face-changing pill that reflects many colors, resting in a small lacquered black box with a mirror lid"],
];
for (const [id, ten, u, m] of DAN) {
  add(`dan/${id}`, ten, u, "GDD mục 12 (Đan dược và lô đỉnh), mục 6, 7, 13", m);
  ds[ds.length - 1].loai = id.startsWith("dan_duoc") ? "Đan dược" : id.startsWith("linh_dan") ? "Linh đan" : id.startsWith("than_dan") ? "Thần đan" : "Đan đặc biệt";
}

// 8. Linh đơn cho thú.
const LD = [
  ["duong_linh_don", "Dưỡng Linh Đơn", "a cluster of small round jade-green beast nourishing pills with paw-print markings in a little woven bamboo basket"],
  ["pha_canh_don", "Phá Cảnh Đơn (thú)", "a large crimson and gold beast breakthrough pill with a beast-claw pattern, crackling energy, on a stone pedestal"],
  ["hoi_linh_don", "Hồi Linh Đơn", "a soft glowing light-blue beast healing pill wrapped in a green leaf"],
];
for (const [id, ten, m] of LD) add(`linh_don/${id}`, ten, 2, "GDD mục 6 (Luyện linh đơn); data/he_thong/json/linh_don.json", m);

// 9. Phù chú.
const PHU = [
  ["chong_set", "Phù chống sét", 1, "a yellow paper talisman with red cinnabar calligraphy-like seal patterns (no readable text), a small lightning rod motif, faint violet sparks", "GDD mục 7 (lôi kiếp)"],
  ["bao_ngoc", "Phù bảo ngọc", 1, "a yellow paper talisman with red cinnabar seal patterns (no readable text) wrapped around a small glowing blue gemstone", "GDD mục 12 (Ngọc và khảm)"],
  ["bao_ho", "Phù bảo hộ", 1, "a yellow paper talisman with red cinnabar seal patterns (no readable text) and a golden protective shield glyph glowing on it", "GDD mục 12 (Trang bị)"],
  ["tang_thanh", "Phù tăng thành", 1, "a yellow paper talisman decorated only with abstract red cinnabar swirling cloud and seal border patterns, no characters or letters, a rising golden arrow-like glow above it, small sparkles", "GDD mục 12 (Ngọc và khảm)"],
  ["ho_than", "Phù hộ thân", 2, "a yellow paper talisman with red cinnabar seal patterns (no readable text) folded into a triangle amulet on a red string, faint white aura", "GDD mục 3 (Hành trình)"],
  ["don_tho", "Phù độn thổ", 2, "a brown earth-colored paper talisman with ochre seal patterns (no readable text) half sinking into a swirl of soil and dust", "GDD mục 3 (Hành trình)"],
  ["ngu_thu", "Ngự Thú Phù", 2, "a yellow paper talisman with red cinnabar seal patterns (no readable text) and a glowing beast paw sigil, a small leather leash charm attached", "GDD mục 6 (Thú cưỡi)"],
];
for (const [id, ten, u, m, n] of PHU) add(`phu/${id}`, ten, u, n, m);

// 10. Trứng thú.
add("trung_thu/thuong", "Trứng thú", 1, "GDD mục 6 (Nguồn thú)", "a large pearly white spirit beast egg with faint silver cloud patterns on the shell, resting on a small nest of straw", "Một hình chung; hệ hiện bằng viền và chip hệ trên UI");
add("trung_thu/hiem", "Trứng thú hiếm (Yêu Thú Sào Huyệt)", 2, "GDD mục 6, 11", "a large dark spirit beast egg with glowing golden cracks and ancient runes on the shell, wisps of energy rising from it", "Trứng hiếm, khóa vào nhân vật");

// 11. Lô đỉnh và lò rèn theo nấc cấp (mẫu lô đỉnh: trung).
add("lo_dinh/so", "Lô đỉnh cấp 1–4", 2, "GDD mục 12 (lô đỉnh 10 cấp)", "a simple small bronze alchemy cauldron (ding) on three legs, plain design with a lid, a small fire beneath");
add("lo_dinh/trung", "Lô đỉnh cấp 5–8", 2, "GDD mục 12", "an ornate bronze alchemy cauldron (ding) inlaid with green jade, a coiled dragon on the lid, flames beneath", "Mẫu đã duyệt; lời mô tả ở đây là tả lại");
add("lo_dinh/cao", "Lô đỉnh cấp 9–10", 2, "GDD mục 12", "a legendary golden alchemy cauldron (ding) with nine dragons coiling around it, celestial flames in white and gold beneath, radiant aura");
add("lo_ren/so", "Lò rèn cấp 1–4", 2, "GDD mục 12 (Lò rèn)", "a small stone blacksmith forge with an anvil and a hammer resting on it, glowing coals");
add("lo_ren/trung", "Lò rèn cấp 5–8", 2, "GDD mục 12", "a large bronze xianxia forge furnace with a tiger-head chimney, glowing molten metal and an anvil");
add("lo_ren/cao", "Lò rèn cấp 9–10", 2, "GDD mục 12", "a divine forge furnace of black and gold metal with phoenix carvings, blue-white celestial fire, floating sparks");
add("manh/lo_dinh", "Mảnh lô đỉnh", 2, "GDD mục 11 (Đan Tiên Động Phủ)", "a broken bronze fragment of an ancient alchemy cauldron with jade inlay and engraved patterns, faint glow on the broken edge");
add("manh/lo_ren", "Mảnh lò rèn", 2, "GDD mục 11 (Luyện Khí Di Chỉ)", "a broken fragment of an ancient forge furnace, dark metal with ember-red glowing cracks");
add("manh/phap_bao_tran_giao", "Mảnh pháp bảo trấn giáo", 2, "GDD mục 11 (Thượng Cổ Chiến Trường)", "a shattered golden fragment of a sacred sect-guarding artifact, carved with ancient seal patterns, radiating soft light");

// 12. Vật đặc biệt.
add("dac_biet/kim_bai_mien_tu", "Kim Bài Miễn Tử", 2, "GDD mục 3 (Đồ sát, lao tù)", "a gold imperial pardon token plaque with a carved tiger head and cloud border, red silk tassel, no readable text");
add("dac_biet/chien_thuyen", "Chiến thuyền", 2, "GDD mục 10 (Hộ trận và công thành)", "a small flying war junk ship with red sails and a bronze ram prow, carved dragon figurehead, floating on clouds");
add("dac_biet/tien_ngoc", "Tiên ngọc", 2, "GDD mục 12, 13", "a single luminous celestial jade bead, rounded and polished, pale green with an inner golden glow and tiny sparkles");
add("dac_biet/phap_bao_tran_giao", "Pháp bảo trấn giáo", 2, "GDD mục 10 (NPC và pháp bảo trấn giáo)", "a sacred sect-guarding treasure, a small golden bell-shaped pagoda floating above a jade base, radiating protective golden light");
add("dac_biet/dan_phuong", "Đan phương", 2, "GDD mục 11 (Đan Tiên Động Phủ)", "a rolled bamboo slip pill recipe tied with a red cord, a small pill drawing on the visible slip, no readable text");
add("dac_biet/thien_tai_lenh", "Thiên Tài Lệnh", 3, "GDD mục 13 (Thiên Đạo Lệnh)", "an ornate jade command token plaque with golden trim and a cloud-and-sun carving, purple tassel, no readable text");

// 13. Bí kíp công pháp 12 hệ (công pháp đã ghép, khác tàn quyển rách).
for (const [id, ten, mau, kh, tt] of HE)
  add(`cong_phap/${id}`, `Công pháp hệ ${ten}`, 2, "GDD mục 9 (Ghép công pháp)",
    `a complete bound cultivation manual, thread-bound ancient book with a ${mau} silk cover and ${kh} emblem glowing ${tt} on the cover, slightly open`);
// 13b. Công pháp ghép (người dùng 2026-11-05: công pháp ghép phải có hình kết hợp). Luật ghép: chủ quyển + 1–2 phụ quyển
// (docs/KE_HOACH.md Sprint 2, mẫu ở data/he_thong/json/cong_phap_mau.json). Hệ của công pháp là tập hệ các quyển.
// Ghép 2 hệ: mỗi cặp hệ một hình riêng (66). Bộ 3 quyển (3 hệ, 220 tổ hợp): một hình theo chủ hệ (12), hai phụ hệ hiện bằng huy hiệu hệ trên UI.
const CAP_HE = [];
for (let i = 0; i < HE.length; i++) for (let j = i + 1; j < HE.length; j++) CAP_HE.push([HE[i], HE[j]]);
for (const [[ia, ta, ma, ka, sa], [ib, tb, mb, kb, sb]] of CAP_HE)
  add(`cong_phap/ghep/${ia}_${ib}`, `Công pháp ghép ${ta}–${tb}`, 2, "Ghép công pháp 2 hệ (docs/KE_HOACH.md Sprint 2; GDD mục 9)",
    `a complete bound cultivation manual whose silk cover is split diagonally into two halves, one ${ma} and one ${mb}, ${ka} and ${kb} emblems intertwined at the center glowing ${sa} and ${sb}, two silk tassels in both colors, slightly open`,
    "Dùng cho công pháp có đúng 2 hệ, bất kể hệ nào là chủ quyển");
for (const [id, ten, mau, kh, tt] of HE)
  add(`cong_phap/bo_ba/${id}`, `Bộ ba quyển chủ hệ ${ten}`, 2, "Ghép công pháp 3 quyển, cấp tông môn 100 (data/he_thong/json/cong_phap_mau.json)",
    `a bound set of three ancient cultivation manuals stacked and tied together with a carved jade clasp and a silk cord, the top volume covered in ${mau} silk with ${kh} emblem glowing ${tt}, the two lower volumes in plain pale cream silk, a soft mystical glow around the set`,
    "Công pháp 3 hệ: hình theo hệ chủ quyển; hai phụ hệ hiện bằng huy hiệu hệ (màu mau_he) đặt trên hình ở UI");

// 14. Vũ khí theo tài năng: hình khi cầm trên người (GDD mục 6), không phải hình trong túi.
const VK = [
  ["quyen_giap", "Quyền giáp (Tu thể)", "a pair of heavy bronze battle gauntlets with knuckle spikes"],
  ["phap_truong", "Pháp trượng (Tu pháp)", "a tall wooden magic staff topped with a glowing crystal orb held by carved branches"],
  ["tran_ban", "Trận bàn (Tu trận)", "a round bronze formation array disc engraved with trigram and rune circles, faint glowing lines"],
  ["ho_lo", "Hồ lô (Tu đan)", "a lacquered red calabash gourd bottle with a cork stopper and a cord, wisps of medicinal mist"],
  ["song_chuy_thu", "Song chủy thủ (Sát thủ)", "a pair of crossed sleek black daggers with curved blades and dark red wrapped handles"],
  ["bua_ren", "Búa rèn (Tu rèn)", "a heavy forging hammer with a bronze head engraved with fire patterns and a wooden handle"],
  ["liem_hai_thuoc", "Liềm hái thuốc (Tu dược)", "a small curved herb-gathering sickle with a jade handle and a sprig of spirit herb tied to it"],
  ["ban_tinh", "Bàn tính (Tu kim tiền)", "an ornate golden abacus with jade beads and a carved rosewood frame"],
];
for (const [id, ten, m] of VK) add(`vu_khi_tai_nang/${id}`, ten, 2, "GDD mục 6 (Vũ khí theo tài năng)", m, "Hình khi cầm trên người theo tài năng; người dùng chốt 2026-11-03: 60–70 kiểu vũ khí là hình trong túi, cầm lên hiện nhóm này");

// 15. Loại chiêu (10), chip loại chiêu trên màn. Thay 10 icon PixelLab cũ ở assets/pixellab/chieu/ (người dùng 2026-11-05: vẽ chiêu thức bằng Canva).
const CHIEU = [
  ["can_don", "Cận chiến đơn", "a single straight sword thrusting forward, a bright concentrated streak of white-gold sword qi bursting from its tip"],
  ["can_quet", "Cận chiến quét", "a broadsword sweeping through a wide crescent arc of glowing blade energy"],
  ["tam_xa", "Tầm xa", "a glowing arrow of spirit energy flying forward with a long luminous trail"],
  ["dien_rong", "Diện rộng", "an explosive burst of spirit energy expanding in glowing rings over a small patch of cracked ground"],
  ["ho_the", "Hộ thể", "a translucent golden protective barrier shaped like a bell dome, shimmering runes on its surface"],
  ["bua_chu", "Bùa chú", "a yellow paper talisman with red cinnabar seal patterns (no readable text) flying through the air, wreathed in crackling magic energy"],
  ["tran_phap", "Trận pháp", "a glowing formation array of concentric rings and trigram symbols hovering flat, light beams rising from its edges"],
  ["hoi_phuc", "Hồi phục", "a blooming jade-green lotus with rising healing sparkles and a soft green glow"],
  ["khong_che", "Khống chế", "glowing spirit chains coiling into a binding ring around a seal sigil"],
  ["than_phap", "Thân pháp", "a swift gust of wind with ghostly afterimage trails and a single floating feather, a strong sense of speed"],
];
for (const [id, ten, m] of CHIEU) add(`chieu/${id}`, ten, 1, "GDD mục 9 (10 loại chiêu); proto/src/theme/elements.ts SKILL_NAME", `a cultivation skill emblem: ${m}`, "Chip loại chiêu trên màn; thay assets/pixellab/chieu/<loại>.png");

// Mã vật phẩm (ma_vp) để theo dõi, theo yêu cầu người dùng 2026-11-03: NHÓM-LOẠI-SỐ, chữ in không dấu.
// Mã đã cấp không đổi và không dùng lại: lấy lại mã cũ từ file danh sách đang có, món mới nhận số kế tiếp trong nhóm-loại.
const LOAI_TB = { kiem: "KI", mu: "MU", ao: "AO", dai: "DA", bao_tay: "BT", giay: "GI", ngoc_boi: "NB" };
const HE_SO = Object.fromEntries(HE.map(([id], i) => [id, i + 1]));
const so3 = n => String(n).padStart(3, "0");
function tienTo(ma) {
  const [nhom, a, b] = ma.split("/");
  if (nhom === "trang_bi") return { tt: `TB-${LOAI_TB[a]}`, so: +b };
  if (nhom === "ngoc") return { tt: "NG-KH", so: HE_SO[a] };
  if (nhom === "tan_quyen") return { tt: "TQ-HE", so: HE_SO[a] };
  if (nhom === "cong_phap" && a === "ghep") { const [x, y] = b.split(/_(?=(?:kim|moc|thuy|hoa|tho|loi|phong|quang|am_lanh|cuc_duong|cuc_am|cuc_han)$)/); return { tt: "CP-GH", so: CAP_HE.findIndex(([p, q]) => p[0] === x && q[0] === y) + 1 }; }
  if (nhom === "cong_phap" && a === "bo_ba") return { tt: "CP-BO", so: HE_SO[b] };
  if (nhom === "cong_phap") return { tt: "CP-HE", so: HE_SO[a] };
  if (nhom === "linh_thach") return { tt: "LT-PH" };
  if (nhom === "quang") return { tt: "QU-BA" };
  if (nhom === "duoc") return { tt: ["linh_thao", "huyen_chi", "ngoc_sam", "than_lien"].includes(a) ? "DL-TH" : "DL-HI" };
  if (nhom === "dan") return { tt: a.startsWith("dan_duoc") ? "DA-DD" : a.startsWith("linh_dan") ? "DA-LD" : a.startsWith("than_dan") ? "DA-TD" : "DA-DB" };
  if (nhom === "linh_don") return { tt: "LD-TH" };
  if (nhom === "phu") return { tt: "PH-CH" };
  if (nhom === "trung_thu") return { tt: "TT-TH" };
  if (nhom === "lo_dinh") return { tt: "LO-LD" };
  if (nhom === "lo_ren") return { tt: "LO-LR" };
  if (nhom === "manh") return { tt: { lo_dinh: "MA-LD", lo_ren: "MA-LR", phap_bao_tran_giao: "MA-PB" }[a] };
  if (nhom === "dac_biet") return { tt: "DB-DB" };
  if (nhom === "vu_khi_tai_nang") return { tt: "VK-TN" };
  if (nhom === "chieu") return { tt: "CT-LO", so: CHIEU.findIndex(c => c[0] === a) + 1 };
  throw new Error("Chưa có quy tắc mã cho " + ma);
}
const cu = {};
try { for (const x of JSON.parse(fs.readFileSync(RA, "utf8")).icon) if (x.ma_vp) cu[x.ma] = x.ma_vp; } catch {}
const daDung = new Set(Object.values(cu));
for (const x of ds) {
  const { tt, so } = tienTo(x.ma);
  let ma_vp = cu[x.ma];
  if (!ma_vp && so) ma_vp = `${tt}-${so3(so)}`;
  if (!ma_vp) { let n = 1; while (daDung.has(`${tt}-${so3(n)}`)) n++; ma_vp = `${tt}-${so3(n)}`; }
  if (daDung.has(ma_vp) && cu[x.ma] !== ma_vp) throw new Error(`Trùng mã ${ma_vp} (${x.ma})`);
  daDung.add(ma_vp);
  x.ma_vp = ma_vp;
}
// 15. Món mới từ số liệu của phiên set đồ (2026-11-03/04): mã ma_vp lấy đúng từ số liệu; món có mã đã nằm trong danh sách thì bỏ qua.
const { monSoLieu } = require("./mon_so_lieu.cjs");
const daCoMa = new Set(ds.map(x => x.ma));
for (const m of monSoLieu(HE)) {
  if (ds.some(x => x.ma_vp === m.ma_vp)) continue;
  if (daDung.has(m.ma_vp) && cu[m.ma] !== m.ma_vp) throw new Error("Mã đã cấp cho món khác: " + m.ma_vp);
  if (daCoMa.has(m.ma)) throw new Error("Trùng đường dẫn " + m.ma);
  daDung.add(m.ma_vp); daCoMa.add(m.ma);
  // Một hình dùng chung nhiều mã (đồ phổ danh khí): các mã còn lại cũng coi như đã cấp.
  for (const c of m.ma_vp_chung || []) {
    if (c !== m.ma_vp && ds.some(x => x.ma_vp === c || (x.ma_vp_chung || []).includes(c))) throw new Error("Mã dùng chung trùng: " + c);
    daDung.add(c);
  }
  ds.push({ ...m, nhom: m.ma.split("/")[0] });
}

const thuTuKhoa = ["ma_vp", "ma_vp_chung", "ma", "nhom", "loai", "ten", "do_hiem", "khi_hinh", "uu_tien", "nguon", "mo_ta", "ghi_chu", "mau_da_duyet"];
for (let i = 0; i < ds.length; i++) ds[i] = Object.fromEntries(thuTuKhoa.filter(k => ds[i][k] !== undefined).map(k => [k, ds[i][k]]));

const out = {
  ghi_chu: [
    "Danh sách icon vật phẩm vẽ bằng Canva (phong cách tranh vẽ 3D, nền trong). Nhân vật, thú, đảo vẫn là pixel art PixelLab.",
    "Lời mô tả gửi Canva: 'Game inventory item icon: <mo_ta>. ' + duoi_loi_mo_ta.",
    "Trang bị (người dùng chốt 2026-11-03): 7 loại (kiếm, mũ, áo, đai, bao tay, giày, ngọc bội), mỗi loại 60 kiểu có tên riêng. Độ hiếm là màu nền ô trên UI, không vẽ vào hình: lục (đồ shop) < lam < tím < vàng < đỏ. Mỗi loại 24 lục, 16 lam, 12 tím, 5 vàng, 3 đỏ (đề xuất); vàng và đỏ rơi khi săn linh thú, thần thú. Thuộc tính chỉ hiện khi khảm ngọc, nên hình và tên không gắn hệ.",
    "Vũ khí (người dùng chốt 2026-11-03, data/he_thong/json/vu_khi.json): 60 kiểu chia 10 khí hình (khi_hinh). 34 kiểu giữ hình kiếm; 26 kiểu lam trở lên đổi sang đao, thương, côn, cung, phiến, bút, kỳ, cầm, tiêu với tên mới. File vẫn ở trang_bi/kiem/NN, mã vẫn TB-KI-0NN. Cầm trên người vẫn hiện nhóm vũ khí theo tài năng.",
    "Pháp bảo, pháp khí, Ý châu, ấn bộ, nguyên liệu và các đan, phù mới lấy từ data/he_thong/json (phiên set đồ); mã ma_vp đúng như số liệu. Độ hiếm pháp bảo, pháp khí là màu nền ô như trang bị.",
    "Luyện khí sau cấp tối đa (GDD tab Trang bị phần 13, phiên set đồ báo 2026-11-04): Khí Tinh, Linh Văn Thạch, Danh khí đồ phổ (một hình cho NL-DP-001…010, mã ở ma_vp_chung), Song Hệ Ngọc (một hình, màu hệ tô bằng UI), 12 Ngọc Phách, 10 danh khí TB-KI-061…070 ở trang_bi/kiem/61–70.",
    "Phẩm, cấp (1–10) và nấc cường hóa của các món khác hiện bằng viền và số trên UI, không vẽ riêng.",
    "uu_tien 1: món đang hiện trong prototype (túi, ô trang bị, Bảo Khố, Công pháp) và 10 kiểu đầu mỗi loại trang bị trải đủ 5 độ hiếm. 2: phần còn lại. 3: làm sau.",
    "File ảnh: assets/icon_ve/<ma>.webp, 512 px; nguồn gốc từng ảnh ở manifest.json cùng thư mục.",
    "ma_vp là mã theo dõi cố định (NHÓM-LOẠI-SỐ, ví dụ TB-KI-001). Không đổi, không dùng lại; món mới nhận số kế tiếp. Độ hiếm, phẩm, cấp, nấc cường hóa là thuộc tính của từng món trong túi, không nằm trong mã. Bảng nghĩa các tiền tố ở tien_to_ma.",
  ],
  duoi_loi_mo_ta: "Chinese xianxia fantasy, highly detailed painterly 3D render, soft studio lighting, single object centered, isolated on a plain white background, no text, no frame.",
  ty_le: "SQUARE_1_1",
  mau_he: Object.fromEntries(HE.map(([id, ten, mau]) => [id, { ten, mau }])),
  tien_to_ma: { TB: "Trang bị (KI kiếm, MU mũ, AO áo, DA đai, BT bao tay, GI giày, NB ngọc bội; số = số kiểu; KI 061–070 là danh khí)", NG: "Ngọc (KH ngọc khảm, số = thứ tự hệ 1–12; YC Ý châu; AN ấn bộ; SH song hệ ngọc; PH Ngọc Phách theo thứ tự hệ)", TQ: "Tàn quyển (HE; số = thứ tự hệ)", CP: "Công pháp (HE thuần hệ, số = thứ tự hệ; GH ghép 2 hệ, số = thứ tự cặp hệ; BO bộ 3 quyển, số = thứ tự chủ hệ)", LT: "Linh thạch (PH: phẩm)", QU: "Quặng (BA: bậc)", DL: "Dược liệu (TH: 4 bậc thường, HI: hiếm)", DA: "Đan (DD đan dược, LD linh đan, TD thần đan, DB đặc biệt)", LD: "Linh đơn cho thú (TH)", PH: "Phù chú (CH)", TT: "Trứng thú (TH)", LO: "Lô đỉnh (LD), lò rèn (LR)", MA: "Mảnh (LD lô đỉnh, LR lò rèn, PB pháp bảo trấn giáo)", DB: "Vật phẩm đặc biệt (DB)", VK: "Vũ khí theo tài năng, hình khi cầm (TN)", CT: "Chiêu thức (LO: loại chiêu, số theo thứ tự SKILL_NAME)", NL: "Nguyên liệu (LK luyện khí thạch, TB tu bổ sa, KM khai mạch đinh, GL nguyên liệu gia công, PB phôi pháp bảo, DB rèn lại đồ bí cảnh, KT khí tinh và linh văn thạch, DP danh khí đồ phổ)", PB: "Pháp bảo (TH thuẫn, LU luân, CH châu, TA tháp, HL hồ lô, KN kính, PN phiên, DI đỉnh, CU chuông, AN ấn; TG trấn giáo)", PK: "Pháp khí (CU cuốc, LB la bàn, TB trận bàn, QP quạt lửa, AT ngọc ẩn tức, CR chùy rèn, LI liềm, BA bàn tính)" },
  do_hiem: Object.entries(TEN_DO_HIEM).map(([id, ten], i) => ({ id, ten, bac: i + 1 })),
  so_luong: { tong: ds.length, uu_tien_1: ds.filter(x => x.uu_tien === 1).length, uu_tien_2: ds.filter(x => x.uu_tien === 2).length, uu_tien_3: ds.filter(x => x.uu_tien === 3).length },
  icon: ds,
};
fs.writeFileSync(RA, JSON.stringify(out, null, 2) + "\n");
console.log(out.so_luong);
