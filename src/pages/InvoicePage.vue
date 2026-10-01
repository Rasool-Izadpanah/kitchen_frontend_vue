<script setup>
// TODO: پورت از نسخه React — این نسخه موقت است
const props = defineProps({
  showToast: { type: Function, default: () => {} },
  userName: { type: String, default: '—' },
});
</script>

<template>
  <div class="bg-amber-50 border border-amber-200 rounded-3xl p-10 text-center">
    <h3 class="font-black text-amber-900 text-sm">این بخش در حال پورت‌سازی است</h3>
    <p class="text-xs text-amber-800 font-bold mt-2">به‌زودی در نسخه Vue فعال می‌شود</p>
  </div>
</template>
