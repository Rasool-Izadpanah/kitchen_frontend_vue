<script setup>
// پیام شناور بالای صفحه — top-center طبق سلیقه کاربر
import { AlertTriangle, CheckCircle2 } from 'lucide-vue-next';

defineProps({
  toast: { type: Object, default: null },
});
</script>

<template>
  <div
    v-if="toast"
    class="fixed top-5 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-white backdrop-blur-md no-print animate-bounce"
    :class="toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-600'"
  >
    <AlertTriangle v-if="toast.type === 'error'" class="w-5 h-5" />
    <CheckCircle2 v-else class="w-5 h-5" />
    <span class="font-medium text-sm">{{ toast.message }}</span>
  </div>
</template>
