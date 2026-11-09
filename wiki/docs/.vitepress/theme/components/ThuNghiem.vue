<script setup lang="ts">
// Nhãn cho số còn đang thử trong bản chơi thử (GDD ghi "đề xuất"): hiện số hiện hành, báo người chơi số có thể đổi.
// Lớp ignore-header: mục lục "Trong trang này" của VitePress bỏ nhãn khỏi tên tiêu đề.
defineProps<{ text?: string }>();
</script>

<template>
  <span class="thu-nghiem ignore-header" title="Số này đang được thử trong bản chơi thử và có thể đổi ở bản sau.">{{ text ?? "đang thử nghiệm, có thể đổi" }}</span>
</template>
