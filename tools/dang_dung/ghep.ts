// Ghép dòng manifest do lam.ts in ra vào một file manifest: dòng cùng `file` thì thay, dòng mới thì nối cuối.
// Chạy: node tools/dang_dung/ghep.ts <ra.json> <manifest vào> [manifest ra = manifest vào]
import { readFileSync, writeFileSync } from "node:fs";

const [entriesPath, inPath, outPath = inPath] = process.argv.slice(2);
if (!entriesPath || !inPath) throw new Error("node tools/dang_dung/ghep.ts <ra.json> <manifest vào> [manifest ra]");
const entries: { file: string }[] = JSON.parse(readFileSync(entriesPath, "utf8"));
const manifest = JSON.parse(readFileSync(inPath, "utf8")) as { assets: { file: string }[] };
let replaced = 0;
for (const e of entries) {
  const i = manifest.assets.findIndex((a) => a.file === e.file);
  if (i >= 0) {
    manifest.assets[i] = e;
    replaced++;
  } else manifest.assets.push(e);
}
writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`${entries.length} dòng: thay ${replaced}, thêm ${entries.length - replaced}`);
