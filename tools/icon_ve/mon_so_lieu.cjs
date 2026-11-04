// Món mới lấy từ số liệu của phiên set đồ (data/he_thong/json): phù, đan, nguyên liệu, pháp bảo, pháp khí, Ý châu, ấn bộ.
// Mã ma_vp lấy đúng từ số liệu. Lời mô tả hình tiếng Anh viết ở đây theo mẫu từng loại; tên lấy từ số liệu.
const path = require("path");
const J = f => require(path.resolve(__dirname, "../../data/he_thong/json", f + ".json"));
const { KHI_HINH } = require("./trang_bi_ten.cjs");

const HOAN_THIEN = {
  luc: "simple, practical and plainly crafted",
  lam: "well-crafted with refined engraved details",
  tim: "ornate, inlaid with gems, a faint mystical glow",
  vang: "magnificent and luxurious, gold accents, radiant golden aura",
  do: "legendary divine artifact, red and gold, blazing aura of power",
};

const khongDau = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
const slug = s => khongDau(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const so2 = ma_vp => ma_vp.slice(-2);

function monSoLieu(HE) {
  const he = Object.fromEntries(HE.map(([id, ten, mau, kh, tt]) => [id, { ten, mau, kh, tt }]));
  const ra = [];
  const add = (o) => ra.push({ uu_tien: 2, ...o });

  // Phù mới.
  const PHU = {
    "PH-CH-008": "a yellow paper talisman with red cinnabar seal patterns (no readable text), above it a small glowing gemstone lifting free from an empty ring-shaped socket drawn in light",
    "PH-CH-009": "a pale blue paper talisman with silver seal patterns (no readable text), a glowing wisp of light flowing in an arc out of it like a migrating soul",
    "PH-CH-010": "a yellow paper talisman with red cinnabar seal patterns (no readable text) wrapped around a small folded piece of armor, a faint protective bronze glow",
  };
  for (const p of J("vat_pham").phu) if (PHU[p.ma_vp])
    add({ ma_vp: p.ma_vp, ma: `phu/${slug(p.ten).replace(/_phu$/, "")}`, ten: p.ten, nguon: "data/he_thong/json/vat_pham.json (phu)", mo_ta: PHU[p.ma_vp] });

  // Đan: vật chứa theo nhóm như các đan đã có (đan dược: đĩa sứ; linh đan: hộp ngọc; thần đan: đài sen vàng).
  const D = {
    "DA-DD-005": "spring-green pills with tiny pink blossom petals around them",
    "DA-DD-006": "large deep crimson pills with a golden ring pattern",
    "DA-DD-007": "pale blue pills wrapped in condensing white mist",
    "DA-DD-008": "deep sapphire-blue pills with a faint glowing core",
    "DA-DD-009": "iron-grey metallic pills with a hard rocky texture",
    "DA-DD-010": "rosy pink pills with a soft warm glow",
    "DA-DD-011": "amber-gold pills each marked with a small eagle-eye pattern",
    "DA-DD-012": "dark blood-red pills with crackling red sparks",
    "DA-DD-013": "pale jade-teal pills with tiny wind swirls around them",
    "DA-DD-014": "clear white translucent pills with a cool calming glow",
    "DA-DD-015": "pale lavender pills each marked with a small calm spiral",
    "DA-DD-028": "golden pills each marked with a tiny glowing shield glyph",
    "DA-DD-029": "crimson pills with a faint heartbeat-like pulse of light",
    "DA-DD-030": "dark bronze pills with sharp cracked-armor patterns",
    "DA-DD-031": "violet-blue pills pierced by thin lines of light",
    "DA-DD-032": "dark maroon pills with swirling blood-red mist",
    "DA-DD-033": "light silver-teal pills floating slightly on a breeze",
    "DA-DD-034": "cool mint-green pills with frosty droplets",
    "DA-DD-035": "warm sunny orange pills radiating gentle heat",
    "DA-DD-036": "white pills each marked with a tiny golden exorcism seal",
    "DA-DD-037": "deep indigo pills each marked with a tiny silver bell",
    "DA-DD-038": "stone-grey pills with a golden diamond-hard sheen",
    "DA-DD-039": "fiery red-orange pills with flickering flame tips",
    "DA-DD-040": "black and red pills with wild crackling red energy",
    "DA-DD-041": "dark green pills with tortoise-shell hexagon patterns",
    "DA-DD-042": "luminous white-gold pills with a soft healing halo",
    "DA-DD-043": "dusky violet pills with a faint dissolving glow",
    "DA-DD-044": "light tan pills each marked with a tiny footprint",
    "DA-DD-045": "pale gold pills each marked with a tiny third-eye symbol",
    "DA-DD-046": "earthy ochre pills with small rock fragments beside them",
    "DA-DD-047": "leaf-green pills each marked with a tiny glowing eye, a sprig of herb beside them",
    "DA-DD-048": "ember-orange pills with tiny forge sparks",
    "DA-DD-049": "bone-white pills with faint pale yellow veins",
    "DA-DD-050": "swirling pink-purple pills with a hypnotic spiral pattern",
    "DA-LD-004": "bone-white with faint golden veins",
    "DA-LD-005": "vivid spring green with a sprouting leaf pattern",
    "DA-LD-006": "deep earthy brown with a solid golden core glow",
    "DA-LD-007": "teal with glowing pulse-line patterns",
    "DA-LD-008": "soft lilac with a tiny paw-print mark",
    "DA-LD-009": "pale white with a faint wisp of qi",
    "DA-LD-010": "light green with a foundation-stone pattern",
    "DA-LD-011": "golden with a tiny golden core inside",
    "DA-LD-012": "rose-pink with a tiny glowing nascent soul figure inside",
    "DA-LD-013": "deep blue with a starry spirit glow",
    "DA-LD-014": "translucent silver with void ripples",
    "DA-LD-015": "violet with two swirls of light merging into one",
    "DA-LD-016": "warm orange with two interlocking rings pattern",
    "DA-LD-017": "amber with a stream of light flowing out of it",
    "DA-LD-018": "deep indigo with a calm spiral of mist",
    "DA-LD-019": "clear pale blue with a still water ripple pattern",
    "DA-LD-020": "aqua with a tiny glowing spring fountain",
    "DA-LD-021": "pale gold with tiny motes of light gathering into it",
    "DA-LD-022": "bronze with a small guardian shield pattern",
    "DA-LD-023": "jade green with an opening lotus pattern",
    "DA-LD-024": "crimson with glowing meridian line patterns",
    "DA-LD-025": "ochre with a rooted tree pattern",
    "DA-LD-026": "silver-blue with a returning spiral of light",
    "DA-LD-027": "clear white with a bright steady inner light",
    "DA-LD-028": "sandy gold with a tiny paw mark and a swirl of qi",
    "DA-LD-029": "pale purple with tiny rune symbols floating around it",
    "DA-LD-030": "dark green inside a ring of clean white mist warding off poison fumes",
    "DA-LD-031": "warm red-orange with frost melting around it",
    "DA-LD-032": "icy blue with tiny wisps of cold vapor",
    "DA-LD-033": "deep violet with a grounded lightning bolt mark",
    "DA-LD-034": "pale teal with a stilled whirlwind mark",
    "DA-LD-035": "feather-white with a small floating feather beside it",
    "DA-LD-036": "half-transparent smoky grey, fading out of sight",
    "DA-LD-037": "musky amber with a tiny beast claw mark and a faint scent trail",
    "DA-LD-038": "light green with a curved returning swirl of light",
    "DA-LD-039": "bronze with a tiny cauldron mark",
    "DA-LD-040": "dark teal with a glowing trail of tiny footprints",
    "DA-TD-004": "jade green with a foundation pillar pattern, soft aura",
    "DA-TD-005": "molten gold with a golden core inside, bright aura",
    "DA-TD-006": "pearl white with a tiny glowing nascent soul figure inside",
    "DA-TD-007": "deep sapphire with swirling spirit light",
    "DA-TD-008": "violet with two lights merging into one",
    "DA-TD-009": "dark purple and gold wrapped in tiny lightning arcs, storm-cloud aura",
    "DA-TD-010": "pale blue with one golden ring pattern",
    "DA-TD-011": "deep teal with three golden ring patterns",
    "DA-TD-012": "emerald with five golden ring patterns",
    "DA-TD-013": "violet with seven golden ring patterns",
    "DA-TD-014": "pure gold with nine spiraling turns of light, blazing aura",
    "DA-TD-015": "smoky grey-black swirling with primordial chaos colors",
    "DA-TD-028": "iron grey with bone-white veins and tiny lightning sparks",
    "DA-TD-029": "electric violet with a small lightning bolt being drawn into it",
    "DA-TD-030": "emerald and gold with a reborn phoenix-feather pattern",
  };
  // Đan theo hệ: Tị X Đan (kháng hệ) và X Tâm Đan (đột phá chiêu hệ X), thứ tự hệ như HE.
  HE.forEach(([id], i) => {
    const h = he[id];
    D[`DA-DD-${String(16 + i).padStart(3, "0")}`] = `${h.mau} pills each marked with ${h.kh} symbol`;
    D[`DA-TD-${String(16 + i).padStart(3, "0")}`] = `${h.mau} with a glowing sigil of ${h.kh} at its heart`;
  });
  const VAT_CHUA = {
    dan_duoc: ["Đan dược", p => `three round ${p} on a small white porcelain dish`],
    linh_dan: ["Linh đan", p => `a single glowing spirit pill, ${p}, resting on silk inside an open carved green jade box`],
    than_dan: ["Thần đan", p => `a radiant divine pill, ${p}, floating above a golden lotus pedestal`],
  };
  for (const d of J("vat_pham").dan) {
    if (!D[d.ma_vp]) continue;
    const [loai, mau] = VAT_CHUA[d.nhom];
    add({ ma_vp: d.ma_vp, ma: `dan/${slug(d.ten)}`, ten: d.ten, loai, nguon: "data/he_thong/json/vat_pham.json (dan)", mo_ta: mau(D[d.ma_vp]) });
  }

  // Nguyên liệu mới (quặng QU-BA đã có).
  const NL = {
    "NL-LK-001": "a small rough grey enhancement refining stone, palm-sized and oval like a whetstone, with faint white veins",
    "NL-LK-002": "a smooth blue enhancement refining stone, oval like a whetstone, with glowing cyan veins",
    "NL-LK-003": "a polished violet enhancement refining stone, oval like a whetstone, with bright glowing violet veins and small sparks",
    "NL-LK-004": "a flawless golden enhancement refining stone, oval like a whetstone, with blazing golden veins and floating motes of light",
    "NL-TB-001": "a small open cloth pouch spilling fine glittering silver-grey repair sand",
    "NL-KM-001": "a slender bronze socket-opening spike nail engraved with runes, its tip glowing",
    "NL-GL-001": "a folded piece of thick spirit beast hide with striped fur, tied with a leather cord",
    "NL-GL-002": "a large pale spirit beast bone with faint glowing runes",
    "NL-GL-003": "a skein of shimmering white celestial silkworm thread with a silk cocoon beside it",
    "NL-GL-004": "a short log of spirit wood with glowing green grain and a sprouting leaf",
    "NL-GL-005": "a folded bolt of cloud-pattern brocade silk in pale blue and silver",
    "NL-PB-001": "an unformed magic treasure blank, a rough glowing metal core with swirling runes, floating",
    "NL-DB-001": "a chunk of dark meteoric iron with a star-speckled surface and glowing blue-white cracks",
  };
  for (const n of J("vat_pham").nguyen_lieu) if (NL[n.ma_vp])
    add({ ma_vp: n.ma_vp, ma: `nguyen_lieu/${slug(n.ten)}`, ten: n.ten, nguon: "data/he_thong/json/vat_pham.json (nguyen_lieu)", mo_ta: NL[n.ma_vp],
      ghi_chu: n.ma_vp === "NL-PB-001" ? "Một hình; độ hiếm của phôi hiện bằng màu nền ô" : undefined });

  // Pháp bảo: 10 loại × 5 độ hiếm, độ hiếm là màu nền ô như trang bị; mức hoàn thiện theo độ hiếm như trang bị.
  const PB = {
    thuan: ["a round xianxia magic shield treasure, floating", ["woven from rattan vines", "black mysterious iron with rivets", "shaped like a black tortoise shell with hexagon plates", "carved with a towering mountain relief", "carved with an ancient primordial giant relief"]],
    luan: ["a xianxia magic war wheel treasure, a bladed ring disc", ["carved wood with sharp edges", "iron with sawtooth edges", "spinning with wind and flames", "golden, engraved with heaven and earth trigrams", "twin interlocked rings, one golden sun and one silver moon"]],
    chau: ["a xianxia magic pearl treasure floating in the air", ["pale white with a protective glow", "teal with a still whirlwind inside", "purple-gold with a rich sheen", "deep sea blue with waves swirling inside", "swirling with primordial chaos colors"]],
    thap: ["a small xianxia magic pagoda treasure", ["carved from grey-green stone, three tiers", "bronze, five tiers, wrapped in demon-sealing talismans", "black iron, seven tiers, glowing seal runes", "exquisite golden filigree, many tiers, gem bells at each eave", "nine tiers reaching toward the sky, radiant crown of light"]],
    ho_lo: ["a xianxia magic calabash gourd treasure", ["red lacquered wine gourd with a cord", "white jade purifying gourd with a willow sprig", "dark green gourd drawing in wisps of spirit energy", "golden gourd engraved with trigrams, a swirling cosmos at its mouth", "huge black-gold gourd devouring a swirling vortex"]],
    kinh: ["a round xianxia magic mirror treasure standing upright", ["plain polished bronze", "casting a beam of demon-revealing golden light", "octagonal with a trigram border", "jade mirror with a snowy mountain relief", "taiji mirror, half black half white"]],
    phien_co: ["a tall narrow xianxia magic streamer banner hanging from a crossbar on a pole", ["plain blue cloth", "five vertical strips of five colors", "gathering swirling spirit energy around it", "dark purple with seven stars in a dipper shape", "dark crimson swirling with chaos clouds"]],
    dinh: ["a small floating xianxia magic cauldron treasure (ding)", ["green patina bronze", "three tall legs and cloud patterns", "jade green with nine small dragon heads around the rim", "ancient bronze with herb and grain reliefs", "massive square ding engraved with mountains and rivers"]],
    chuong: ["a floating xianxia magic bell treasure", ["small bronze hand bell", "clear jade-green bell with visible sound ripples", "silver bell with a calming light", "ancient massive bronze bell with primeval reliefs", "golden bell radiating rings of cosmic light"]],
    an: ["a xianxia magic seal treasure, a square seal with a carved knob", ["plain grey stone", "mountain-shaped knob, earthy ochre", "thunder god knob, crackling violet lightning", "massive heaven-overturning golden seal", "imperial jade seal with a dragon knob, celestial aura"]],
  };
  const pb = J("phap_bao");
  const tenLoai = Object.fromEntries(pb.loai.map(l => [l.id, l.ten]));
  const thuTu = {};
  for (const m of pb.mon) {
    const [goc, ct] = PB[m.loai];
    const i = thuTu[m.loai] = (thuTu[m.loai] ?? -1) + 1;
    add({ ma_vp: m.ma_vp, ma: `phap_bao/${m.loai}/${so2(m.ma_vp)}`, ten: m.ten, loai: tenLoai[m.loai], do_hiem: m.do_hiem,
      nguon: "data/he_thong/json/phap_bao.json (mon)", mo_ta: `${goc}: ${ct[i]}, ${HOAN_THIEN[m.do_hiem]}` });
  }
  const TG = {
    "PB-TG-001": "a large sect-guarding command plaque of gold and jade, carved with a sect gate and clouds, red tassel, no readable text, radiant protective aura",
    "PB-TG-002": "a sacred sect-guarding war banner on a golden pole embroidered with the azure dragon, white tiger, vermilion bird and black tortoise, radiant aura",
    "PB-TG-003": "a towering golden sect-guarding pagoda of many tiers reaching to the heavens, beams of light, radiant aura",
    "PB-TG-004": "a colossal ancient bronze and gold sect-guarding cauldron with primeval beast reliefs and sacred flames, radiant aura",
  };
  for (const t of pb.tran_giao)
    add({ ma_vp: t.ma_vp, ma: `phap_bao/tran_giao/${so2(t.ma_vp)}`, ten: t.ten, loai: "Trấn giáo", nguon: "data/he_thong/json/phap_bao.json (tran_giao)", mo_ta: TG[t.ma_vp],
      ghi_chu: "Hình riêng từng pháp bảo trấn giáo; dac_biet/phap_bao_tran_giao là hình chung cũ" });

  // Pháp khí: 8 loại × 3 độ hiếm (lục, lam, tím).
  const PK = {
    "Cuốc": ["a mining pickaxe tool", ["plain iron head and wooden handle", "black iron head with a blue sheen", "mountain-splitting divine pick with glowing runes"]],
    "La bàn": ["a round Chinese geomancy compass (luopan)", ["plain bronze with a needle", "a glowing needle pointing toward a tiny gem", "jade with starry rings and floating runes"]],
    "Trận bàn": ["a round formation array disc", ["wood with carved trigram lines", "jade with glowing rune circles", "star constellation patterns glowing silver"]],
    "Quạt lửa": ["a fire-fanning alchemy fan", ["a simple cattail-leaf fan", "red silk with flame embroidery and small flames at the tip", "wreathed in three-colored samadhi fire"]],
    "Ngọc ẩn tức": ["a small aura-concealing token", ["a smooth grey pebble with faint mist", "a dark jade token half fading into mist", "a nearly invisible translucent jade with shimmering edges"]],
    "Chùy rèn": ["a blacksmith forging hammer", ["plain iron head and wooden handle", "black iron head with a blue sheen", "hundred-times forged steel head with layered patterns and glowing seams"]],
    "Liềm": ["a curved herb-gathering sickle", ["plain iron blade and wooden handle", "jade-green handle with herb carvings", "white jade bone handle and a luminous blade"]],
    "Bàn tính": ["an abacus", ["plain wood frame and wooden beads", "rosewood frame with gold beads", "golden frame with beads like ancient coins, glowing"]],
  };
  const tt = {};
  for (const m of J("phap_khi").mon) {
    const [goc, ct] = PK[m.loai];
    const i = tt[m.loai] = (tt[m.loai] ?? -1) + 1;
    add({ ma_vp: m.ma_vp, ma: `phap_khi/${slug(m.loai)}/${so2(m.ma_vp)}`, ten: m.ten, loai: m.loai, do_hiem: m.do_hiem,
      nguon: "data/he_thong/json/phap_khi.json", mo_ta: `${goc}: ${ct[i]}, ${HOAN_THIEN[m.do_hiem]}` });
  }

  // Ý châu: quả cầu trơn trên đài sen bạc (khác ngọc khảm có giác cắt và tua), bóng khí hình bên trong.
  const YC = {
    kiem: ["a straight sword", "azure"], dao: ["a broadsword", "crimson"], cung: ["a strung bow", "emerald"], phien: ["an open folding fan", "pale teal"],
    con: ["a fighting staff", "bronze-orange"], but: ["a calligraphy brush", "ink-black and white"], ky: ["a war banner", "golden yellow"],
    cam: ["a guqin zither", "lavender"], tieu: ["a bamboo flute", "jade green"], thuong: ["a spear", "silver-white"],
  };
  const ng = J("ngoc");
  for (const y of ng.y_chau) {
    if (!KHI_HINH[y.khi_hinh]) throw new Error("Ý châu lạ khí hình " + y.khi_hinh);
    const [bong, mau] = YC[y.khi_hinh];
    add({ ma_vp: y.ma_vp, ma: `y_chau/${y.khi_hinh}`, ten: y.ten, khi_hinh: y.khi_hinh, nguon: "data/he_thong/json/ngoc.json (y_chau)",
      mo_ta: `a smooth luminous crystal spirit orb with the glowing silhouette of ${bong} floating inside, resting on a small silver lotus stand, ${mau} light` });
  }

  // Ấn bộ: con dấu vuông bằng ngọc, núm khắc theo bộ, màu theo hệ.
  const NUM = {
    tu_bao: "a pile of coins and gold ingots", bach_thao: "a cluster of herbs", ban_thach: "a boulder", liep_thu: "a hunting hawk",
    thiet_ky: "an armored warhorse", van_uyen: "a stack of books and a brush", ngoc_tuy: "a water droplet", linh_tuyen: "a bubbling spring",
    bang_phach: "an ice crystal", loi_tri: "a thunder drum", ngu_thu: "a crouching spirit beast", co_tong: "an ancient sect gate",
    dan_tien: "a small alchemy cauldron", thien_cong: "an anvil and hammer", huyet_anh: "a shadowy curved blade", do_kiep: "a lightning bolt over clouds",
    van_kiem: "a ring of many tiny swords", chu_thien: "a celestial sphere with orbits", pha_quan: "a war general's helmet", hon_don: "a swirling chaos vortex",
  };
  for (const a of ng.an_bo) {
    const h = a.he ? he[a.he] : { mau: "black and crimson", tt: "chaotic black-red" };
    if (!h || !NUM[a.bo]) throw new Error("Ấn bộ thiếu " + a.ma_vp);
    add({ ma_vp: a.ma_vp, ma: `an_bo/${a.bo}`, ten: a.ten, nguon: "data/he_thong/json/ngoc.json (an_bo)",
      mo_ta: `a small square spirit seal stamp carved from ${h.mau} jade, its knob carved as ${NUM[a.bo]}, ${h.tt} glow` });
  }
  return ra;
}

module.exports = { monSoLieu };
