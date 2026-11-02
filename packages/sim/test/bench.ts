// Đo thời gian chạy trận trong Node (GDD mục 16: so với runtime của Nakama ở sprint sau).
import { simulate } from "../src/index.ts";
import { randomBattle } from "./fixtures.ts";
const N = 5000;
const inputs = Array.from({ length: N }, (_, i) => randomBattle(i + 1));
let ticks = 0;
const t0 = performance.now();
for (const inp of inputs) ticks += simulate(inp).ticks;
const ms = performance.now() - t0;
console.log(`${N} trận, trung bình ${(ms / N).toFixed(3)} ms/trận, ${(ticks / N).toFixed(0)} tick/trận, ~${Math.round(N / (ms / 1000))} trận/giây trên 1 luồng`);
