<script setup>
/**
 * مودال تنظیمات چاپ: انتخاب قالب کاغذ (A4 / A5 / حرارتی ۸۰mm)، تعداد نسخه و پرینتر
 * سپس window.print() با رندر N نسخه از محتوا
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { Printer, X } from 'lucide-vue-next';
import { toFa } from '../lib/utils.js';

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  paperSize: { type: String, default: 'A4' },
  copies: { type: Number, default: 1 },
  fontFamily: { type: String, default: 'Vazirmatn' },
});
const emit = defineEmits(['close', 'update:paperSize', 'update:copies']);

const sizes = [
  { id: 'A4', label: 'A4 (استاندارد)' },
  { id: 'A5', label: 'A5 (نیم‌برگ)' },
  { id: 'thermal80', label: 'حرارتی ۸۰ میلی‌متری' },
];

// مرورگرها API عمومی برای فهرست پرینترهای نصب‌شده ندارند؛
// انتخاب نهایی پرینتر در پنجره چاپ سیستم‌عامل انجام می‌شود.
const printers = [{ id: 'system', name: 'پرینتر پیش‌فرض سیستم (انتخاب در پنجره چاپ)' }];
const printer = ref('system');

const doPrint = () => setTimeout(() => window.print(), 120);

// ===== اندازه کاغذ چاپ (@page) داینامیک — معادل style تگ App.jsx =====
let pageStyleEl = null;
const applyPageRule = (size) => {
  if (!pageStyleEl) {
    pageStyleEl = document.createElement('style');
    document.head.appendChild(pageStyleEl);
  }
  const at = size === 'thermal80' ? '80mm auto' : size === 'A5' ? 'A5 portrait' : 'A4 portrait';
  const margin = size === 'thermal80' ? '3mm' : '8mm';
  const width = size === 'thermal80' ? '74mm' : '100%';
  const padding = size === 'thermal80' ? '0' : '6mm';
  pageStyleEl.textContent = `@media print { @page { size: ${at}; margin: ${margin}; } #print-area { width: ${width} !important; padding: ${padding} !important; } }`;
};
watch(() => props.paperSize, applyPageRule, { immediate: true });
onBeforeUnmount(() => { if (pageStyleEl) { pageStyleEl.remove(); pageStyleEl = null; } });
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto no-print">
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[94vh] flex flex-col border border-slate-200 my-auto">
      <!-- هدر مودال -->
      <div class="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 no-print">
        <h3 class="font-black text-slate-800 flex items-center gap-2 text-sm sm:text-base">
          <Printer class="w-5 h-5 text-emerald-600" />
          {{ title }}
        </h3>
        <div class="flex items-center gap-2">
          <button
            class="px-4 sm:px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-md shadow-emerald-600/25"
            @click="doPrint"
          >
            <Printer class="w-4 h-4" />
            چاپ ({{ toFa(copies) }} نسخه)
          </button>
          <button class="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition" @click="emit('close')">
            <X class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- تنظیمات چاپ -->
      <div class="p-4 sm:p-5 bg-slate-50 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 no-print">
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1.5">قالب کاغذ:</label>
          <select
            :value="paperSize"
            class="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            @change="emit('update:paperSize', $event.target.value)"
          >
            <option v-for="s in sizes" :key="s.id" :value="s.id">{{ s.label }}</option>
          </select>
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1.5">تعداد نسخه چاپ:</label>
          <input
            type="number" min="1" max="10"
            :value="copies"
            class="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-center focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            @change="emit('update:copies', Math.min(10, Math.max(1, +$event.target.value || 1)))"
          />
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1.5">چاپگر:</label>
          <select v-model="printer" class="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none">
            <option v-for="p in printers" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
      </div>

      <!-- پیش‌نمایش — تعداد نسخه تکرار می‌شود و بین نسخه‌ها صفحه‌شکن هست -->
      <div class="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-100">
        <div class="flex flex-col items-center gap-4">
          <div v-for="ci in copies" :key="ci" :class="copies > 1 ? 'print-copy-wrap' : ''">
            <div v-if="copies > 1" class="text-[10px] text-slate-400 font-bold mb-1 text-center no-print">
              — نسخه {{ toFa(ci) }} از {{ toFa(copies) }} —
            </div>
            <div
              id="print-area"
              :style="{ fontFamily: `'${fontFamily}', 'Vazirmatn', ui-sans-serif, sans-serif` }"
              class="bg-white text-slate-900 shadow-md border border-slate-300 mx-auto"
              :class="paperSize === 'thermal80'
                ? 'w-[302px] p-3.5 text-[11px] rounded-none'
                : paperSize === 'A5'
                ? 'w-full max-w-[560px] p-5 text-xs rounded-lg'
                : 'w-full max-w-[780px] p-7 text-xs rounded-lg'"
            >
              <slot />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
