import assert from "node:assert/strict";
import { test } from "node:test";
import { dichDen } from "../src/www.ts";

test("www về tên gốc, choi về play, giữ đường dẫn và query", () => {
  assert.equal(dichDen(new URL("https://www.thienhoangky.fun/a/b?x=1")), "https://thienhoangky.fun/a/b?x=1");
  assert.equal(dichDen(new URL("https://choi.thienhoangky.fun/moi/beta-abc")), "https://play.thienhoangky.fun/moi/beta-abc");
  assert.equal(dichDen(new URL("https://la.thienhoangky.fun/")), "https://thienhoangky.fun/");
});
