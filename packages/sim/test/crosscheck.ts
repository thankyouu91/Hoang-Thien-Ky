// So mã băm giữa hai máy: chạy lệnh này ở cả hai nơi, kết quả phải giống hệt.
import { simulate } from "../src/index.ts";
import { randomBattle } from "./fixtures.ts";
let acc = 0;
for (let s = 1; s <= 1000; s++) acc = (Math.imul(acc, 31) + simulate(randomBattle(s)).hash) >>> 0;
console.log("crosscheck", acc.toString(16));
