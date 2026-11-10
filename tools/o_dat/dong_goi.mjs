// Đóng gói các bộ ô đất Wang (PixelLab topdown tileset, 16 ô mỗi bộ) thành assets/pixellab/o_dat/:
//   <8 ký tự đầu của id>.png  tấm 4×4 ô của một bộ
//   bo.json                    danh sách loại đất và bảng tra ô theo 4 góc (định dạng: proto/src/scenes/mmo/oDat.ts)
// Chạy: node tools/o_dat/dong_goi.mjs
// Tải ảnh và metadata thẳng từ PixelLab theo id (không cần token, không tốn lượt). Thêm bộ mới: thêm id vào BO,
// thêm loại đất mới vào DAT (khóa = 4 ký tự đầu của base tile id mà script in ra khi gặp loại chưa có tên).
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../../assets/pixellab/o_dat/", import.meta.url));

/** Loại đất: 4 ký tự đầu của base tile id → [ký hiệu trong map, tên, cấm đi]. Loại đứng đầu là nền mặc định. */
const DAT = {
  "9b43": ["c", "Cỏ"],
  "54b5": ["d", "Đường đất"],
  "30a8": ["s", "Đất sỏi"],
  a39e: ["q", "Đường đá cuội"],
  d8d7: ["p", "Sân đá"],
  eaf1: ["n", "Nước", true],
  b667: ["b", "Cát"],
  "2ac6": ["h", "Cỏ hoa"],
  "0733": ["m", "Đồng hoa"],
  ef46: ["l", "Lúa mì"],
  ee61: ["t", "Đồi trà"],
  c6ed: ["r", "Ruộng nước"],
  "738d": ["x", "Tuyết"],
  d9c5: ["v", "Luống rau"],
  "1aaf": ["u", "Luống đất sẫm"],
  e44e: ["g", "Luống mới xới"],
};

/** Các bộ ô (id tileset PixelLab), cùng họ nền cỏ 9b43. */
const BO = [
  "3d608e2e-3802-4c87-9dbe-24ab6d49a2f9", "d24de682-08a5-4760-9586-7759900f244a", "db616a98-725c-41aa-9082-baf873df5c76",
  "e6ac3aa3-3d65-4b36-bbdb-466fe249720e", "920d8911-68da-4660-87b6-cf4fde256cbb", "886ca8a4-2252-4cce-96c6-4cfe15cb9527",
  "4be62411-64b9-46f7-a47c-42ba34af870c", "b9da19a9-9292-403a-a0fe-1493af530f74", "d69388d4-de5d-4923-80f2-96fc1c7bde13",
  "594c32c9-a35c-4220-b140-264afa2edd05", "5676bd36-df39-4d53-bf1d-90c712580313", "63368c21-edd1-4c88-af68-42bb10ceb3cd",
  "e06dfff3-7d17-487b-ad2b-ece7852a9d14", "ef27b33a-fe68-4f6d-b441-af0b6b629b87", "97ad5763-e2b2-48f9-a964-954198d7e861",
  "703fd7de-9ca7-4ee1-87ef-9af189e93d6d", "0d465866-748a-44dc-876a-59816aee56ba", "c48a9f4f-0d04-4cfc-bd93-84fae2ec4026",
  "d5390ee1-3714-4bbf-86cf-bfe361a7cea5",
];

const get = async (id, what) => {
  const r = await fetch(`https://api.pixellab.ai/mcp/tilesets/${id}/${what}`);
  if (!r.ok) throw new Error(`${id} ${what}: ${r.status}`);
  return r;
};

mkdirSync(OUT, { recursive: true });
const bo = [];
let co = 0;
for (const id of BO) {
  const meta = await (await get(id, "metadata")).json();
  const size = meta.tile_size.width;
  if (meta.tileset_data.tiles.length !== 16) throw new Error(`${id}: cần bộ 16 ô, có ${meta.tileset_data.tiles.length}`);
  if (co && co !== size) throw new Error(`${id}: ô ${size}px, khác các bộ trước (${co}px)`);
  co = size;
  const key = (side) => {
    const k = meta.base_tile_ids[side].slice(0, 4);
    if (!DAT[k]) throw new Error(`${id}: loại đất ${k} ("${meta[side + "_description"].slice(0, 50)}") chưa có tên trong DAT`);
    return DAT[k][0];
  };
  // Chỉ số = NW*8 + NE*4 + SW*2 + SE, góc là đất "trên" (upper) thì bit bật.
  const o = Array(16).fill(null);
  for (const t of meta.tileset_data.tiles) {
    const bit = (c) => (t.corners[c] === "upper" ? 1 : 0);
    o[bit("NW") * 8 + bit("NE") * 4 + bit("SW") * 2 + bit("SE")] = [t.bounding_box.x / size, t.bounding_box.y / size];
  }
  if (o.includes(null)) throw new Error(`${id}: thiếu ô cho một tổ hợp góc`);
  const f = id.slice(0, 8);
  writeFileSync(OUT + f + ".png", Buffer.from(await (await get(id, "image?inline=true")).arrayBuffer()));
  bo.push({ f, lo: key("lower"), up: key("upper"), o });
  console.log(f, key("lower"), "->", key("upper"));
}
const dat = Object.values(DAT).map(([k, ten, cam]) => ({ k, ten, ...(cam ? { cam: true } : {}) }));
writeFileSync(OUT + "bo.json", JSON.stringify({ co, dat, bo }) + "\n");
console.log(`xong: ${bo.length} bộ, ${dat.length} loại đất, ô ${co}px → ${OUT}`);
