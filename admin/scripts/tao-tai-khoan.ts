// Tạo tài khoản quản trị đầu tiên, hoặc đặt lại mật khẩu khi không còn Admin nào vào được.
// Script chỉ sinh file SQL (mật khẩu đã băm) trong admin/.tmp/ (không commit); chạy file đó lên D1 bằng wrangler.
//
//   node scripts/tao-tai-khoan.ts admin                       → vai admin, mật khẩu tạm ngẫu nhiên in ra màn hình
//   node scripts/tao-tai-khoan.ts vanhanh1 van_hanh           → vai vận hành
//   node scripts/tao-tai-khoan.ts admin admin --ghi <file>    → ghi mật khẩu tạm vào <file> thay vì in ra
//   npx wrangler d1 execute thienhoangky --remote --file .tmp/tai-khoan-admin.sql
//
// Tài khoản nhận mật khẩu tạm với phai_doi = 1: lần đăng nhập đầu phải đổi mật khẩu. Đã có tài khoản cùng tên thì
// mật khẩu bị đặt lại, tài khoản được mở khóa và mọi phiên của nó bị đăng xuất.

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bamMatKhau, matKhauNgauNhien } from "../worker/matKhau.ts";

process.chdir(fileURLToPath(new URL("..", import.meta.url)));

const [ten = "", vaiTro = "admin"] = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--ghi");
const iGhi = process.argv.indexOf("--ghi");
const ghiVao = iGhi > 0 ? process.argv[iGhi + 1] : null;

if (!/^[a-z0-9._-]{3,32}$/.test(ten)) {
  console.error("Tên đăng nhập 3–32 ký tự: chữ thường không dấu, số, dấu chấm, gạch dưới, gạch ngang.");
  process.exit(1);
}
if (vaiTro !== "admin" && vaiTro !== "van_hanh") {
  console.error("Vai trò là admin hoặc van_hanh.");
  process.exit(1);
}

const matKhau = matKhauNgauNhien(16);
const bam = await bamMatKhau(matKhau);
const now = Date.now();
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const sql = `-- Sinh bởi scripts/tao-tai-khoan.ts lúc ${new Date(now).toISOString()}. Không commit file này.
INSERT INTO qt_tai_khoan (ten, vai_tro, mat_khau, phai_doi, tao_boi, tao_luc)
VALUES (${q(ten)}, ${q(vaiTro)}, ${q(bam)}, 1, 'tao-tai-khoan', ${now})
ON CONFLICT(ten) DO UPDATE SET vai_tro = excluded.vai_tro, mat_khau = excluded.mat_khau, phai_doi = 1, khoa = 0,
  sai_lien_tiep = 0, tam_khoa_den = NULL, sua_boi = 'tao-tai-khoan', sua_luc = ${now};
DELETE FROM qt_phien WHERE ten = ${q(ten)};
`;

mkdirSync(".tmp", { recursive: true });
const file = `.tmp/tai-khoan-${ten}.sql`;
writeFileSync(file, sql);
if (ghiVao) {
  writeFileSync(
    ghiVao,
    `Admin Dashboard Thiên Hoang Ký — https://admin.thienhoangky.fun\nTên đăng nhập: ${ten}\nMật khẩu tạm: ${matKhau}\nLần đăng nhập đầu phải đổi mật khẩu (ít nhất 12 ký tự). Đổi xong thì xóa file này.\n`,
  );
  console.log(`Đã ghi mật khẩu tạm vào ${ghiVao}`);
} else {
  console.log(`Tên đăng nhập: ${ten}\nMật khẩu tạm: ${matKhau}`);
}
console.log(`SQL: admin/${file}\nChạy: npx.cmd wrangler d1 execute thienhoangky --remote --file ${file}`);
