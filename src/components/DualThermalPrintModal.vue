<script setup>
/**
 * مودال چاپ دو پرینتر حرارتی:
 * - چاپگر ۱: سفارش‌گیرنده (رسید مشتری)
 * - چاپگر ۲: آشپزخانه (سفارش پخت)
 * حالت «چاپ همزمان»: هر دو نسخه در یک برگه (با صفحه‌شکن) چاپ می‌شوند.
 * حالت «چاپ جداگانه»: هر نسخه به‌تنهایی و با انتخاب جداگانه پرینتر مقصد.
 */
import { ref, computed, watch } from 'vue';
import { Printer, X } from 'lucide-vue-next';

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  printer1Name: { type: String, default: 'چاپگر ۱ — سفارش‌گیرنده (رسید مشتری)' },
  printer2Name: { type: String, default: 'چاپگر ۲ — آشپزخانه' },
  fontFamily: { type: String, default: 'Vazirmatn' },
});

const emit = defineEmits(['close']);

const mode = ref('both'); // both | customer | kitchen
const dest1 = ref('system');
const dest2 = ref('system');

watch(() => props.open, (v) => { if (v) mode.value = 'both'; });

const printers = [{ id: 'system', name: 'انتخاب در پنجره چاپ سیستم‌عامل' }];

const targets = computed(() => (mode.value === 'both' ? ['customer', 'kitchen'] : [mode.value]));
const label = computed(() => ({ customer: props.printer1Name, kitchen: props.printer2Name }));

const printNow = () => setTimeout(() => window.print(), 120);
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto no-print">


    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[94vh] flex flex-col border border-slate-200 my-auto">
      <!-- هدر مودال -->
      <div class="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 no-print">
        <h3 class="font-black text-slate-800 flex items-center gap-2 text-sm sm:text-base">
          <Printer class="w-5 h-5 text-emerald-600" />
          {{ title }}
        </h3>
        <button class="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition" @click="emit('close')">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- انتخاب حالت چاپ -->
      <div class="p-4 sm:p-5 bg-slate-50 border-b border-slate-100 space-y-4 no-print">
        <div>
          <div class="text-[11px] font-black text-slate-700 mb-2">حالت ارسال به چاپگرهای حرارتی:</div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              v-for="m in [
                { id: 'both', label: 'چاپ همزمان', hint: 'هر دو نسخه پشت سر هم' },
                { id: 'customer', label: 'فقط چاپگر ۱', hint: 'رسید مشتری' },
                { id: 'kitchen', label: 'فقط چاپگر ۲', hint: 'سفارش آشپزخانه' },
              ]"
              :key="m.id"
              type="button"
              class="px-3 py-2.5 rounded-xl border text-right transition"
              :class="mode === m.id ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/30' : 'border-slate-200 bg-white hover:bg-slate-50'"
              @click="mode = m.id"
            >
              <div class="text-xs font-black text-slate-800">{{ m.label }}</div>
              <div class="text-[10px] text-slate-500">{{ m.hint }}</div>
            </button>
          </div>
        </div>

        <!-- مقصد هر چاپگر -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            class="rounded-xl border p-3 space-y-2"
            :class="mode !== 'kitchen' ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50 opacity-60'"
          >
            <div class="text-[11px] font-black text-slate-700 flex items-center gap-1.5">
              <span class="w-5 h-5 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] flex items-center justify-center">۱</span>
              {{ printer1Name }}
            </div>
            <select
              v-model="dest1"
              :disabled="mode === 'kitchen'"
              class="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option v-for="p in printers" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div
            class="rounded-xl border p-3 space-y-2"
            :class="mode !== 'customer' ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200 bg-slate-50 opacity-60'"
          >
            <div class="text-[11px] font-black text-slate-700 flex items-center gap-1.5">
              <span class="w-5 h-5 rounded-lg bg-blue-100 text-blue-700 text-[10px] flex items-center justify-center">۲</span>
              {{ printer2Name }}
            </div>
            <select
              v-model="dest2"
              :disabled="mode === 'customer'"
              class="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option v-for="p in printers" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <template v-if="mode === 'both'">
            <button
              class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-md shadow-emerald-600/25"
              @click="printNow"
            >
              <Printer class="w-4 h-4" />
              چاپ همزمان (۲ نسخه)
            </button>
          </template>
          <template v-else>
            <button
              v-for="t in targets"
              :key="t"
              class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-md shadow-emerald-600/25"
              @click="printNow"
            >
              <Printer class="w-4 h-4" />
              {{ `چاپ ${label[t]}` }}
            </button>
          </template>
        </div>
        <p class="text-[10px] text-slate-500 leading-relaxed">
          در حالت «چاپ همزمان» هر دو نسخه در یک برگه (پشت سر هم با صفحه‌شکن) به چاپگر انتخابی ارسال می‌شوند.
          در حالت جداگانه می‌توانید مقصد هر نسخه را مستقلاً انتخاب کنید — پرینتر نهایی در پنجره چاپ سیستم‌عامل نیز قابل تأیید است.
        </p>
      </div>

      <!-- پیش‌نمایش -->
      <div class="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-100">
        <div class="flex flex-col items-center gap-5">
          <div v-for="t in targets" :key="t" :class="targets.length > 1 ? 'dual-print-wrap' : ''">
            <div class="text-[10px] text-slate-500 font-bold mb-1 text-center no-print">
              — نسخه {{ t === 'customer' ? printer1Name : printer2Name }} —
            </div>
            <div
              class="dual-print-area bg-white text-slate-900 shadow-md border border-slate-300 mx-auto w-[302px] p-3.5 text-[11px] rounded-none"
              :style="{ fontFamily: `'${fontFamily}', 'Vazirmatn', ui-sans-serif, sans-serif` }"
            >
              <slot :target="t" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
