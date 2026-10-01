<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

const now = ref(new Date());
let timer = null;
onMounted(() => { timer = setInterval(() => { now.value = new Date(); }, 1000); });
onBeforeUnmount(() => clearInterval(timer));
const p2 = (n) => String(n).padStart(2, '0');
</script>

<template>
  <span dir="ltr" class="tabular-nums">{{ p2(now.getHours()) }}:{{ p2(now.getMinutes()) }}:{{ p2(now.getSeconds()) }}</span>
</template>
