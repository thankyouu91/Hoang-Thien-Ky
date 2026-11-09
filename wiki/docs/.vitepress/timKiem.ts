// Tách trang thành mục cho ô tìm kiếm (MiniSearch của VitePress, chạy lúc build, không gửi xuống trình duyệt).
// Giống cách tách mặc định của VitePress (mỗi tiêu đề một mục), thêm một việc: ở trang tra cứu, mỗi dòng bảng có neo
// <span class="neo" id="..."> (scripts/sinh.ts) thành một mục riêng mang tên món. Gõ "kiem thanh cuong" thì ra đúng
// dòng Kiếm Thanh Cương thay vì cả bảng 60 vũ khí.

export interface MucTim {
  anchor: string;
  titles: string[];
  text: string;
}

const TIEU_DE = /<h(\d*).*?>(.*?<a.*? href="#.*?".*?>.*?<\/a>)<\/h\1>/gi;
const NOI_DUNG_TIEU_DE = /(.*?)<a.*? href="#(.*?)".*?>.*?<\/a>/i;

const boThe = (s: string): string => s.replace(/<[^>]*>/g, "");
const gon = (s: string): string =>
  boThe(s)
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

function* dongCoNeo(noiDung: string, titles: string[]): Generator<MucTim> {
  for (const m of noiDung.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const neo = /<span class="neo" id="([^"]+)"/.exec(m[1]);
    if (!neo) continue;
    const o = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((x) => x[1]);
    // Tên món: chữ đậm đầu tiên trong dòng, không có thì ô thứ hai (ô đầu thường là hình).
    const ten = gon(/<strong>([\s\S]*?)<\/strong>/.exec(m[1])?.[1] ?? o[1] ?? o[0] ?? "");
    if (!ten) continue;
    yield { anchor: neo[1], titles: [...titles, ten], text: o.map(gon).filter(Boolean).join(" · ") };
  }
}

export function* tachMuc(file: string, html: string): Generator<MucTim> {
  const traCuu = /[\\/]tra-cuu[\\/]/.test(file);
  const phan = html.split(TIEU_DE);
  phan.shift();
  let cha: string[] = [];
  for (let i = 0; i < phan.length; i += 3) {
    const cap = parseInt(phan[i]) - 1;
    const kq = NOI_DUNG_TIEU_DE.exec(phan[i + 1]);
    const tieuDe = boThe(kq?.[1] ?? "").trim();
    const neo = kq?.[2] ?? "";
    const noiDung = phan[i + 2];
    if (!tieuDe || !noiDung) continue;
    let titles = cha.slice(0, cap);
    titles[cap] = tieuDe;
    titles = titles.filter(Boolean);
    yield { anchor: neo, titles, text: boThe(noiDung) };
    if (traCuu) yield* dongCoNeo(noiDung, titles);
    if (cap === 0) cha = [tieuDe];
    else cha[cap] = tieuDe;
  }
}
