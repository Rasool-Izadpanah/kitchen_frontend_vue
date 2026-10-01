<script setup>
// مودال عمومی برنامه
defineProps({
  title: { type: String, default: '' },
  icon: { type: [Object, Function], default: null },
  wide: { type: Boolean, default: false },
});
const emit = defineEmits(['close']);
</script>

<template>
  <div class="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto no-print">
    <div class="bg-white rounded-3xl shadow-2xl w-full max-h-[92vh] flex flex-col border border-slate-200" :class="wide ? 'max-w-5xl' : 'max-w-2xl'">
      <div class="flex items-center justify-between p-5 border-b border-slate-100">
        <h3 class="font-black text-slate-800 flex items-center gap-2 text-base">
          <component :is="icon" v-if="icon" class="w-5 h-5 text-emerald-600" />
          {{ title }}
        </h3>
        <button class="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition" @click="emit('close')">
          <X class="w-5 h-5" />
        </button>
      </div>
      <div class="p-5 overflow-y-auto flex-1">
        <slot />
      </div>
      <div v-if="$slots.footer" class="p-4 border-t border-slate-100 bg-slate-50 rounded-b-3xl">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>
