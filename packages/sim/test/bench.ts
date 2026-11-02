// Đo thời gian chạy trận trong Node (GDD mục 16: so với runtime của Nakama ở sprint sau).
import { simulate } from "../src/index.ts";
import { randomBattle } from "./fixtures.ts";
const N = 5000;
const cases = [
  ["Đội ngẫu nhiên 1–10 người, 1–4 công pháp", 0, 0],
  ["10 đấu 10, mỗi người 4 công pháp", 10, 4],
] as const;
for (const [label, size, techniques] of cases) {
  const inputs = Array.from({ length: N }, (_, i) => randomBattle(i + 1, size, techniques));
  let ticks = 0, draws = 0;
  const t0 = performance.now();
  for (const inp of inputs) {
    const r = simulate(inp);
    ticks += r.ticks;
    if (r.winner === "draw") draws++;
  }
  const ms = performance.now() - t0;
  console.log(
    `${label}: ${N} trận, trung bình ${(ms / N).toFixed(3)} ms/trận, ${(ticks / N / 20).toFixed(1)} giây/trận, ` +
      `hòa ${((draws * 100) / N).toFixed(1)}%, ~${Math.round(N / (ms / 1000))} trận/giây trên 1 luồng`,
  );
}
