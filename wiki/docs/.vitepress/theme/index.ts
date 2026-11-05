// Theme wiki: theme mặc định của VitePress, phủ màu và chữ theo mẫu tranh giấy của dashboard game
// (proto/src/dashboard/tokens.css): nền kem, chữ có chân, khung đỏ son mảnh.
import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import "@fontsource-variable/lora/wght.css";
import "@fontsource-variable/lora/wght-italic.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/700.css";
import "./style.css";
import ThuNghiem from "./components/ThuNghiem.vue";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("ThuNghiem", ThuNghiem);
  },
} satisfies Theme;
