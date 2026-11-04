// Atlas hạt 512 × 512 (8 × 8 ô 64 px) vẽ một lần bằng canvas 2D lúc nạp lớp hiệu ứng. Phần lớn ô là hình trắng/xám để
// shader tô theo màu hệ (nhân màu); lá bùa, ấn son giữ màu riêng (nơi gọi truyền màu trắng).
// Thứ tự ô theo CELL trong emit.ts; họa tiết 12 hệ theo ký hiệu GDD mục 15 như motifs.ts.
import { CELL, MOTIF_ORDER } from "./emit.ts";
import type { ElementId } from "../replay/types.ts";

const S = 64;
const PAPER = "#efe0b0";
const SEAL = "#b3261e";

type C2 = CanvasRenderingContext2D;

function cell(ctx: C2, i: number, draw: (c: C2) => void): void {
  ctx.save();
  ctx.translate((i % 8) * S + S / 2, Math.floor(i / 8) * S + S / 2);
  ctx.beginPath();
  ctx.rect(-S / 2, -S / 2, S, S);
  ctx.clip();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  draw(ctx);
  ctx.restore();
}

function radial(c: C2, r: number, stops: [number, string][]): CanvasGradient {
  const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
  for (const [k, col] of stops) g.addColorStop(k, col);
  return g;
}

/** Ngẫu nhiên cố định cho nét phù văn. */
function lcg(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

function motifShape(c: C2, el: ElementId): void {
  const W = "#ffffff";
  const G = "rgba(200, 200, 200, 1)";
  c.fillStyle = W;
  c.strokeStyle = W;
  const flame = (w: number, h: number) => {
    c.beginPath();
    c.moveTo(0, -h);
    c.bezierCurveTo(w * 0.7, -h * 0.35, w, h * 0.25, 0, h * 0.9);
    c.bezierCurveTo(-w, h * 0.25, -w * 0.7, -h * 0.35, 0, -h);
  };
  switch (el) {
    case "kim": {
      // vòng kim loại có ánh sáng
      c.lineWidth = 7;
      c.beginPath();
      c.arc(0, 0, 18, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = G;
      c.lineWidth = 3;
      c.beginPath();
      c.arc(0, 0, 18, Math.PI * 0.9, Math.PI * 1.6);
      c.stroke();
      break;
    }
    case "moc": {
      c.beginPath();
      c.moveTo(0, -24);
      c.quadraticCurveTo(20, -6, 0, 24);
      c.quadraticCurveTo(-20, -6, 0, -24);
      c.fill();
      c.strokeStyle = G;
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(0, -18);
      c.lineTo(0, 22);
      for (let k = -1; k <= 1; k++) {
        c.moveTo(0, k * 8);
        c.lineTo(8, k * 8 - 7);
        c.moveTo(0, k * 8 + 3);
        c.lineTo(-8, k * 8 - 4);
      }
      c.stroke();
      break;
    }
    case "thuy": {
      c.beginPath();
      c.moveTo(0, -24);
      c.bezierCurveTo(10, -8, 17, 2, 17, 10);
      c.arc(0, 10, 17, 0, Math.PI);
      c.bezierCurveTo(-17, 2, -10, -8, 0, -24);
      c.fill();
      c.fillStyle = G;
      c.beginPath();
      c.ellipse(-6, 10, 4, 7, -0.4, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case "hoa": {
      flame(17, 25);
      c.fill();
      c.fillStyle = G;
      c.translate(0, 8);
      flame(8, 13);
      c.fill();
      break;
    }
    case "tho": {
      c.save();
      c.rotate(0.2);
      c.fillRect(-16, -16, 32, 32);
      c.fillStyle = G;
      c.fillRect(-16, 4, 32, 12);
      c.strokeStyle = "rgba(150,150,150,1)";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-8, -16);
      c.lineTo(-2, -2);
      c.lineTo(10, 4);
      c.stroke();
      c.restore();
      break;
    }
    case "loi": {
      c.beginPath();
      c.moveTo(6, -27);
      c.lineTo(-12, 3);
      c.lineTo(0, 3);
      c.lineTo(-6, 27);
      c.lineTo(14, -6);
      c.lineTo(2, -6);
      c.closePath();
      c.fill();
      break;
    }
    case "phong": {
      c.lineWidth = 5;
      c.beginPath();
      for (let k = 0; k <= 40; k++) {
        const a = k * 0.32;
        const r = 2 + k * 0.55;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r * 0.85;
        if (k === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
      break;
    }
    case "cuc_duong": {
      c.fillStyle = radial(c, 14, [[0, W], [1, G]]);
      c.beginPath();
      c.arc(0, 0, 12, 0, Math.PI * 2);
      c.fill();
      c.lineWidth = 4;
      c.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        c.moveTo(Math.cos(a) * 17, Math.sin(a) * 17);
        c.lineTo(Math.cos(a) * 26, Math.sin(a) * 26);
      }
      c.stroke();
      break;
    }
    case "cuc_am": {
      c.beginPath();
      c.arc(0, 0, 22, 0, Math.PI * 2);
      c.arc(9, -6, 18, 0, Math.PI * 2, true);
      c.fill("evenodd");
      break;
    }
    case "cuc_han": {
      c.lineWidth = 4;
      c.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        const x = Math.cos(a);
        const y = Math.sin(a);
        c.moveTo(0, 0);
        c.lineTo(x * 25, y * 25);
        const bx = x * 14;
        const by = y * 14;
        for (const s of [-1, 1]) {
          const b = a + s * 0.7;
          c.moveTo(bx, by);
          c.lineTo(bx + Math.cos(b) * 8, by + Math.sin(b) * 8);
        }
      }
      c.stroke();
      break;
    }
    case "quang": {
      c.fillStyle = radial(c, 26, [[0, W], [0.35, "rgba(255,255,255,0.9)"], [1, "rgba(255,255,255,0)"]]);
      c.beginPath();
      for (let k = 0; k < 16; k++) {
        const a = (k * Math.PI) / 8;
        const r = k % 2 ? 9 : 27;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
      break;
    }
    case "am_lanh": {
      c.beginPath();
      c.moveTo(0, -26);
      c.bezierCurveTo(14, -14, 4, -6, 14, 4);
      c.bezierCurveTo(22, 18, 4, 26, -2, 24);
      c.bezierCurveTo(-18, 20, -16, 4, -6, -2);
      c.bezierCurveTo(-12, -10, -4, -18, 0, -26);
      c.fill();
      c.fillStyle = "rgba(140,140,140,1)";
      c.beginPath();
      c.arc(-4, 10, 3, 0, Math.PI * 2);
      c.arc(5, 10, 3, 0, Math.PI * 2);
      c.fill();
      break;
    }
  }
}

/** Vẽ atlas; trả canvas 512 × 512. */
export function drawAtlas(): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 8 * S;
  const ctx = cv.getContext("2d")!;
  const W = "#ffffff";
  const soft = (c: C2, r: number) => radial(c, r, [[0, "rgba(255,255,255,1)"], [0.4, "rgba(255,255,255,0.55)"], [1, "rgba(255,255,255,0)"]]);

  cell(ctx, CELL.spark, (c) => {
    c.scale(1, 0.2);
    c.fillStyle = soft(c, 31);
    c.beginPath();
    c.arc(0, 0, 31, 0, Math.PI * 2);
    c.fill();
    c.setTransform(1, 0, 0, 1, 0, 0);
  });
  cell(ctx, CELL.star, (c) => {
    c.fillStyle = soft(c, 14);
    c.beginPath();
    c.arc(0, 0, 14, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = W;
    c.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      const b = a + Math.PI / 4;
      c.lineTo(Math.cos(a) * 28, Math.sin(a) * 28);
      c.lineTo(Math.cos(b) * 5, Math.sin(b) * 5);
    }
    c.closePath();
    c.fill();
  });
  cell(ctx, CELL.ring, (c) => {
    c.strokeStyle = W;
    c.lineWidth = 5;
    c.beginPath();
    c.arc(0, 0, 24, 0, Math.PI * 2);
    c.stroke();
  });
  cell(ctx, CELL.dot, (c) => {
    c.fillStyle = radial(c, 14, [[0, W], [0.6, W], [1, "rgba(255,255,255,0)"]]);
    c.beginPath();
    c.arc(0, 0, 14, 0, Math.PI * 2);
    c.fill();
  });
  cell(ctx, CELL.talisman, (c) => {
    c.fillStyle = PAPER;
    c.fillRect(-13, -26, 26, 52);
    c.strokeStyle = "#c9b07a";
    c.lineWidth = 1.5;
    c.strokeRect(-13, -26, 26, 52);
    c.strokeStyle = SEAL;
    c.lineWidth = 2.6;
    c.beginPath();
    c.arc(0, -15, 5, 0, Math.PI * 2);
    c.moveTo(0, -9);
    c.lineTo(0, 20);
    c.moveTo(-7, -4);
    c.lineTo(7, -4);
    c.moveTo(-8, 4);
    c.lineTo(8, 4);
    c.moveTo(-6, 12);
    c.quadraticCurveTo(0, 8, 6, 14);
    c.stroke();
  });
  cell(ctx, CELL.seal, (c) => {
    c.fillStyle = SEAL;
    c.beginPath();
    c.roundRect(-25, -25, 50, 50, 5);
    c.fill();
    c.fillStyle = PAPER;
    c.font = "bold 34px 'Noto Serif', serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("封", 0, 2);
    c.strokeStyle = PAPER;
    c.lineWidth = 2;
    c.strokeRect(-21, -21, 42, 42);
  });
  cell(ctx, CELL.link, (c) => {
    c.strokeStyle = "rgba(170,170,170,1)";
    c.lineWidth = 8;
    c.beginPath();
    c.ellipse(0, 0, 22, 11, 0, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = W;
    c.lineWidth = 3.5;
    c.beginPath();
    c.ellipse(0, -1, 22, 10, 0, Math.PI * 1.05, Math.PI * 1.95);
    c.stroke();
  });
  cell(ctx, CELL.ice, (c) => {
    c.fillStyle = "rgba(225,235,240,0.95)";
    c.beginPath();
    c.moveTo(0, -29);
    c.lineTo(10, -16);
    c.lineTo(9, 22);
    c.lineTo(0, 29);
    c.lineTo(-9, 22);
    c.lineTo(-10, -16);
    c.closePath();
    c.fill();
    c.fillStyle = W;
    c.beginPath();
    c.moveTo(0, -29);
    c.lineTo(10, -16);
    c.lineTo(9, 22);
    c.lineTo(0, 29);
    c.closePath();
    c.fill();
    c.strokeStyle = "rgba(255,255,255,1)";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(-4, -18);
    c.lineTo(-4, 18);
    c.stroke();
  });
  cell(ctx, CELL.rock, (c) => {
    const r = lcg(7);
    c.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const rr = 17 + r() * 9;
      c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.85);
    }
    c.closePath();
    c.fillStyle = "rgba(205,205,205,1)";
    c.fill();
    c.save();
    c.clip();
    c.fillStyle = "rgba(150,150,150,1)";
    c.fillRect(-30, 6, 60, 30);
    c.fillStyle = W;
    c.fillRect(-30, -30, 60, 14);
    c.restore();
    c.strokeStyle = "rgba(110,110,110,1)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-6, -14);
    c.lineTo(0, 0);
    c.lineTo(11, 6);
    c.stroke();
  });
  cell(ctx, CELL.shard, (c) => {
    c.beginPath();
    c.moveTo(-26, 3);
    c.lineTo(22, -9);
    c.lineTo(10, 10);
    c.closePath();
    c.fillStyle = "rgba(210,210,210,1)";
    c.fill();
    c.beginPath();
    c.moveTo(-26, 3);
    c.lineTo(22, -9);
    c.lineTo(14, 0);
    c.closePath();
    c.fillStyle = W;
    c.fill();
  });
  cell(ctx, CELL.ghost, (c) => {
    const g = c.createLinearGradient(0, -28, 0, 30);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.75, "rgba(255,255,255,0.7)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, -20, 7.5, 0, Math.PI * 2);
    c.moveTo(-10, -10);
    c.quadraticCurveTo(0, -14, 10, -10);
    c.lineTo(14, 30);
    c.lineTo(-14, 30);
    c.closePath();
    c.fill();
  });
  cell(ctx, CELL.cross, (c) => {
    c.fillStyle = soft(c, 26);
    c.beginPath();
    c.arc(0, 0, 26, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = W;
    c.beginPath();
    c.roundRect(-18, -6, 36, 12, 5);
    c.roundRect(-6, -18, 12, 36, 5);
    c.fill();
  });
  cell(ctx, CELL.smoke, (c) => {
    const r = lcg(3);
    for (let k = 0; k < 6; k++) {
      const x = (r() - 0.5) * 22;
      const y = (r() - 0.5) * 18;
      const rr = 12 + r() * 10;
      c.fillStyle = radial(c, rr, [[0, "rgba(255,255,255,0.55)"], [1, "rgba(255,255,255,0)"]]);
      c.save();
      c.translate(x, y);
      c.beginPath();
      c.arc(0, 0, rr, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  });
  cell(ctx, CELL.streak, (c) => {
    const g = c.createLinearGradient(-30, 0, 30, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.7, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(0, 0, 30, 3.5, 0, 0, Math.PI * 2);
    c.fill();
  });
  for (const [i, ch] of [[CELL.glyphTuyet, "絕"], [CELL.glyphPhong, "陣"]] as const) {
    cell(ctx, i, (c) => {
      c.font = "bold 50px 'Noto Serif', serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.lineWidth = 6;
      c.strokeStyle = "rgba(60,60,60,1)";
      c.strokeText(ch, 0, 3);
      c.fillStyle = W;
      c.fillText(ch, 0, 3);
    });
  }
  for (let k = 0; k < 4; k++) {
    cell(ctx, CELL.rune0 + k, (c) => {
      const r = lcg(11 + k * 17);
      c.strokeStyle = W;
      c.lineWidth = 4;
      c.beginPath();
      for (let s = 0; s < 4; s++) {
        const x0 = (r() - 0.5) * 36;
        const y0 = (r() - 0.5) * 40;
        c.moveTo(x0, y0);
        if (r() < 0.5) c.lineTo(x0 + (r() - 0.5) * 34, y0 + (r() - 0.5) * 10);
        else c.quadraticCurveTo(x0 + (r() - 0.5) * 30, y0 + (r() - 0.5) * 30, x0 + (r() - 0.5) * 20, y0 + (r() - 0.5) * 34);
      }
      c.stroke();
      c.beginPath();
      c.arc((r() - 0.5) * 20, (r() - 0.5) * 20, 4, 0, Math.PI * 2);
      c.stroke();
    });
  }
  cell(ctx, CELL.vine, (c) => {
    c.strokeStyle = "rgba(210,210,210,1)";
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(-26, 20);
    c.bezierCurveTo(-10, 10, -18, -10, 0, -12);
    c.bezierCurveTo(14, -14, 10, 4, 22, -2);
    c.stroke();
    c.fillStyle = W;
    c.beginPath();
    c.ellipse(-12, 2, 7, 3.5, -1, 0, Math.PI * 2);
    c.ellipse(10, -12, 7, 3.5, 0.6, 0, Math.PI * 2);
    c.fill();
  });
  cell(ctx, CELL.feather, (c) => {
    c.strokeStyle = W;
    c.lineWidth = 3.5;
    c.beginPath();
    c.arc(0, 18, 30, -Math.PI * 0.85, -Math.PI * 0.15);
    c.stroke();
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 26, 26, -Math.PI * 0.8, -Math.PI * 0.3);
    c.stroke();
  });
  cell(ctx, CELL.sword, (c) => {
    // phi kiếm nằm ngang, mũi bên phải
    c.fillStyle = W;
    c.beginPath();
    c.moveTo(29, 0);
    c.lineTo(8, -3.5);
    c.lineTo(-12, -3.5);
    c.lineTo(-12, 3.5);
    c.lineTo(8, 3.5);
    c.closePath();
    c.fill();
    c.fillStyle = "rgba(170,170,170,1)";
    c.fillRect(-15, -9, 3, 18);
    c.fillRect(-27, -2, 12, 4);
    c.beginPath();
    c.arc(-28, 0, 3, 0, Math.PI * 2);
    c.fill();
  });
  cell(ctx, CELL.skull, (c) => {
    // đầu lâu: sọ trắng, hốc mắt và mũi tối (tô theo hệ thì thành lửa ma)
    c.fillStyle = W;
    c.beginPath();
    c.ellipse(0, -5, 20, 19, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.roundRect(-12, 6, 24, 15, 4);
    c.fill();
    c.fillStyle = "rgba(40,40,40,1)";
    c.beginPath();
    c.ellipse(-8, -3, 6, 7, 0.2, 0, Math.PI * 2);
    c.ellipse(8, -3, 6, 7, -0.2, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(0, 5);
    c.lineTo(-3, 10);
    c.lineTo(3, 10);
    c.closePath();
    c.fill();
    c.fillRect(-7, 15, 2, 6);
    c.fillRect(-1, 15, 2, 6);
    c.fillRect(5, 15, 2, 6);
  });
  cell(ctx, CELL.coin, (c) => {
    // đồng tiền lỗ vuông
    c.fillStyle = "#f2c230";
    c.beginPath();
    c.arc(0, 0, 22, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#a8781a";
    c.lineWidth = 3;
    c.stroke();
    c.fillStyle = "rgba(0,0,0,0)";
    c.globalCompositeOperation = "destination-out";
    c.fillRect(-6, -6, 12, 12);
    c.globalCompositeOperation = "source-over";
    c.strokeRect(-7, -7, 14, 14);
    c.fillStyle = "#fff2b0";
    c.beginPath();
    c.arc(-9, -11, 4, 0, Math.PI * 2);
    c.fill();
  });
  cell(ctx, CELL.drop, (c) => {
    c.fillStyle = W;
    c.beginPath();
    c.moveTo(0, -20);
    c.bezierCurveTo(9, -4, 13, 6, 0, 18);
    c.bezierCurveTo(-13, 6, -9, -4, 0, -20);
    c.fill();
  });
  MOTIF_ORDER.forEach((el, i) => cell(ctx, CELL.motif + i, (c) => motifShape(c, el)));
  return cv;
}
