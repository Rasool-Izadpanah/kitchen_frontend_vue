<script setup>
/**
 * انتخابگر تاریخ هجری شمسی با تقویم بازشو
 * modelValue: رشته 'YYYY/MM/DD' (ارقام لاتین)
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { Calendar, ChevronRight, ChevronLeft, X } from 'lucide-vue-next';
import {
  toFa, JALALI_MONTHS, WEEKDAYS,
  todayJalali, jalaaliMonthLength, jalaliWeekdayCol,
  jalaliToJdn, js,
} from '../lib/utils.js';

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'انتخاب تاریخ' },
  minDate: { type: String, default: '' },
  maxDate: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue']);

const t = todayJalali();
const open = ref(false);
const view = ref(null); // {jy, jm}
const boxRef = ref(null);

const parsed = computed(() => {
  if (!props.modelValue) return null;
  const [y, m, d] = String(props.modelValue).split('/').map(Number);
  if (!y || !m || !d) return null;
  return { jy: y, jm: m, jd: d };
});

watch(open, (v) => {
  if (v) {
    const base = parsed.value || t;
    view.value = { jy: base.jy, jm: base.jm };
  }
});

const onDoc = (e) => {
  if (boxRef.value && !boxRef.value.contains(e.target)) open.value = false;
};
onMounted(() => document.addEventListener('mousedown', onDoc));
onBeforeUnmount(() => document.removeEventListener('mousedown', onDoc));

const minJdn = computed(() => (props.minDate ? jalaliToJdn(props.minDate) : -Infinity));
const maxJdn = computed(() => (props.maxDate ? jalaliToJdn(props.maxDate) : Infinity));

const selectDay = (jy, jm, jd) => {
  emit('update:modelValue', js(jy, jm, jd));
  open.value = false;
};

const shiftMonth = (delta) => {
  let { jy, jm } = view.value;
  jm += delta;
  if (jm > 12) { jm = 1; jy += 1; }
  if (jm < 1) { jm = 12; jy -= 1; }
  view.value = { jy, jm };
};

const grid = computed(() => {
  if (!view.value) return [];
  const len = jalaaliMonthLength(view.value.jy, view.value.jm);
  const firstCol = jalaliWeekdayCol(view.value.jy, view.value.jm, 1);
  const cells = [];
  for (let i = 0; i < firstCol; i++) cells.push(null);
  for (let d = 1; d <= len; d++) cells.push(d);
  return cells;
});

const todayStr = js(t.jy, t.jm, t.jd);
const years = Array.from({ length: 41 }, (_, i) => t.jy - 10 + i);
</script>

<template>
  <div ref="boxRef" class="relative">
    <button
      type="button"
      class="w-full flex items-center justify-between gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm hover:bg-white transition focus:ring-2 focus:ring-emerald-500 focus:outline-none"
      @click="open = !open"
    >
      <span :class="modelValue ? 'font-bold text-slate-800' : 'text-slate-500'">
        {{ modelValue ? toFa(modelValue) : placeholder }}
      </span>
      <span class="flex items-center gap-1">
        <span
          v-if="modelValue"
          role="button"
          tabindex="0"
          class="text-slate-400 hover:text-rose-500"
          @click.stop="emit('update:modelValue', '')"
        >
          <X class="w-3.5 h-3.5" />
        </span>
        <Calendar class="w-4 h-4 text-emerald-600" />
      </span>
    </button>

    <div v-if="open && view" class="absolute z-50 mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl p-3 w-[272px]">
      <div class="flex items-center justify-between mb-2">
        <button type="button" class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600" @click="shiftMonth(1)">
          <ChevronRight class="w-4 h-4" />
        </button>
        <div class="flex items-center gap-2 text-sm font-black text-slate-800">
          <select
            v-model.number="view.jm"
            class="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none"
          >
            <option v-for="(m, i) in JALALI_MONTHS" :key="m" :value="i + 1">{{ m }}</option>
          </select>
          <select
            v-model.number="view.jy"
            class="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none"
          >
            <option v-for="y in years" :key="y" :value="y">{{ toFa(y) }}</option>
          </select>
        </div>
        <button type="button" class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600" @click="shiftMonth(-1)">
          <ChevronLeft class="w-4 h-4" />
        </button>
      </div>

      <div class="grid grid-cols-7 gap-1 mb-1">
        <div
          v-for="(w, i) in WEEKDAYS"
          :key="i"
          class="text-center text-[10px] font-bold"
          :class="i === 6 ? 'text-rose-500' : 'text-slate-500'"
        >{{ w }}</div>
      </div>

      <div class="grid grid-cols-7 gap-1">
        <template v-for="(day, idx) in grid" :key="idx">
          <div v-if="day === null" />
          <button
            v-else
            type="button"
            class="h-8 rounded-lg text-xs font-bold transition"
            :class="[
              jalaliToJdn(js(view.jy, view.jm, day)) < minJdn || jalaliToJdn(js(view.jy, view.jm, day)) > maxJdn
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-slate-700 hover:bg-emerald-50',
              modelValue === js(view.jy, view.jm, day) ? 'bg-emerald-600 text-white hover:bg-emerald-600' : '',
              todayStr === js(view.jy, view.jm, day) && modelValue !== js(view.jy, view.jm, day) ? 'ring-1 ring-emerald-400 text-emerald-700' : '',
            ]"
            :disabled="jalaliToJdn(js(view.jy, view.jm, day)) < minJdn || jalaliToJdn(js(view.jy, view.jm, day)) > maxJdn"
            @click="selectDay(view.jy, view.jm, day)"
          >
            {{ toFa(day) }}
          </button>
        </template>
      </div>

      <div class="flex items-center justify-between pt-2 mt-1 border-t border-slate-100">
        <button
          type="button"
          class="text-[11px] font-bold text-emerald-700 hover:underline px-2 py-1"
          @click="selectDay(t.jy, t.jm, t.jd)"
        >
          امروز
        </button>
        <span class="text-[10px] text-slate-400">تقویم هجری شمسی</span>
      </div>
    </div>
  </div>
</template>
