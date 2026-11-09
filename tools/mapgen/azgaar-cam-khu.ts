// Chạy trong trang Azgaar, không chạy bằng Node: tô biome cho lòng giữa (Linh Hải Cấm Khu) theo <vị diện>_cam_khu_biome.json
// của cam_khu.ts --biome, vẽ lại biểu tượng địa hình riêng các ô đó (Relief.regenerate giữ nguyên mọi biểu tượng khác), rồi
// gửi .map thẳng vào data/maps qua máy nhận file nhan-file.ts. Không chạy lại bước sinh nào khác của Azgaar, nên
// sông, thị trấn, đường và 12 vùng giữ nguyên.
//
// heightmap.ts chép file này (đã bỏ kiểu) thành public/htk/cam_khu.js, cùng việc tô biome. Mở bản đồ đã lưu rồi:
//   const { Load } = await import("/services/io/load.ts"); Load.uploadMap(await (await fetch("/ktlp/ha_azgaar.map")).blob())
//   const k = await import("/ktlp/cam_khu.js"); await k.apply("ha"); await k.send("ha", "<địa chỉ nhan-file.ts in ra>")

type Pack = { cells: { biome: Uint8Array | number[] }; relief: unknown[] };

export async function apply(plane: string): Promise<{ cells: number; relief: [number, number] }> {
  const job = (await (await fetch(`/ktlp/${plane}_cam_khu_biome.json`)).json()) as { cells: [number, number][] };
  const pack = (window as unknown as { pack: Pack }).pack;
  const zone = new Set<number>();
  const biomeBefore = new Map<number, number>();
  for (const [cell, biome] of job.cells) biomeBefore.set(cell, pack.cells.biome[cell]), (pack.cells.biome[cell] = biome), zone.add(cell);
  const { Relief } = await import(/* @vite-ignore */ "/model/physical/relief-generator.ts");
  const { Layers } = await import(/* @vite-ignore */ "/renderers/layers.ts");
  // .map cũ không lưu biểu tượng địa hình (Azgaar sinh ngẫu nhiên lúc vẽ nếu pack.relief rỗng): sinh đủ cả bản đồ trước, rồi
  // mới vẽ lại riêng lòng giữa; .map lưu sau đó giữ luôn biểu tượng nên lần vẽ sau ra cùng một hình
  if (!pack.relief.length) {
    for (const [cell] of job.cells) pack.cells.biome[cell] = biomeBefore.get(cell)!;
    Relief.generate();
    for (const [cell, biome] of job.cells) pack.cells.biome[cell] = biome;
  }
  const before = pack.relief.length;
  Relief.regenerate((cell: number) => zone.has(cell));
  Layers.draw("biomes");
  Layers.draw("relief");
  return { cells: zone.size, relief: [before, pack.relief.length] };
}

/** Chỉ gửi .map. Không xuất lại Full JSON: Azgaar sửa độ cao khi nạp .map, bộ đệm dựng từ bản đó sẽ xê dịch điểm 12 vùng
 * (xem loadPlaneMap); biome lòng giữa đã có trong <vị diện>_cam_khu_biome.json */
export async function send(plane: string, sink: string): Promise<number> {
  const { Save } = await import(/* @vite-ignore */ "/services/io/save.ts");
  const body = new Blob([Save.prepareMapData()], { type: "text/plain" });
  const reply = await fetch(`${sink}${plane}_azgaar.map`, { method: "PUT", body });
  if (!reply.ok) throw new Error(`Máy nhận file từ chối ${plane}_azgaar.map: ${reply.status}`);
  return Math.round(body.size / 1024);
}
