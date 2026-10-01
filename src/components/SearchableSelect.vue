<script setup>
/**
 * منوی بازشوی جستجودار:
 * - فیلد جستجوی لحظه‌ای که در تمام ستون‌های نمایشی آیتم جستجو می‌کند
 * - باز/بسته با کلیک؛ بسته با کلیک بیرون یا Escape
 * - آیتم‌ها: { value, label, searchText } — searchText برای جستجو در همه ستون‌ها (اختیاری)
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { Search, ChevronDown, Check, X } from 'lucide-vue-next';
import { toFa } from '../lib/utils.js';

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] }, // [{ value, label, searchText? }]
  placeholder: { type: String, default: '-- انتخاب کنید --' },
  emptyText: { type: String, default: 'موردی یافت نشد' },
  searchPlaceholder: { type: String, default: 'جستجو...' },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);

const open = ref(false);
const query = ref('');
const wrapRef = ref(null);
const inputRef = ref(null);

const onDoc = (e) => {
  if (wrapRef.value && !wrapRef.value.contains(e.target)) {
    open.value = false;
    query.value = '';
  }
};
const onKey = (e) => {
  if (e.key === 'Escape') { open.value = false; query.value = ''; }
};
onMounted(() => {
  document.addEventListener('mousedown', onDoc);
  document.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDoc);
  document.removeEventListener('keydown', onKey);
});

watch(open, (v) => {
  if (v && inputRef.value) inputRef.value.focus();
});

const selected = computed(() => props.options.find((o) => o.value === props.modelValue) || null);

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.options;
  return props.options.filter((o) => {
    const hay = `${o.label} ${o.searchText || ''}`.toLowerCase();
    return hay.includes(q);
  });
});

const pick = (v) => {
  emit('update:modelValue', v);
  open.value = false;
  query.value = '';
};

const clear = (e) => {
  e.stopPropagation();
  emit('update:modelValue', '');
  query.value = '';
};

const resultText = computed(() => `${toFa(filtered.value.length)} نتیجه`);
</script>

<template>
  <div ref="wrapRef" class="relative">
    <!-- دکمه نمایش مقدار انتخابی -->
    <button
      type="button"
      :disabled="disabled"
      class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-right flex items-center justify-between gap-2 transition focus:ring-2 focus:ring-emerald-500 focus:outline-none"
      :class="disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white focus:bg-white cursor-pointer'"
      @click="open = !open"
    >
      <span class="truncate" :class="selected ? 'font-bold text-slate-800' : 'text-slate-400'">
        {{ selected ? selected.label : placeholder }}
      </span>
      <span class="flex items-center gap-1 shrink-0">
        <span
          v-if="selected && !disabled"
          role="button"
          tabindex="-1"
          title="پاک کردن انتخاب"
          class="p-0.5 text-slate-400 hover:text-rose-600 rounded transition"
          @click="clear"
        >
          <X class="w-3.5 h-3.5" />
        </span>
        <ChevronDown class="w-4 h-4 text-slate-500 transition-transform" :class="open ? 'rotate-180' : ''" />
      </span>
    </button>

    <!-- پنل بازشو با فیلد جستجو -->
    <div v-if="open" class="absolute z-50 mt-1.5 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden min-w-[240px]">
      <div class="p-2 border-b border-slate-100 sticky top-0 bg-white">
        <div class="relative">
          <Search class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            :placeholder="searchPlaceholder"
            class="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pr-9 pl-3 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 focus:outline-none"
          />
        </div>
        <div v-if="query" class="text-[10px] text-slate-400 mt-1.5 px-1 font-bold">{{ resultText }}</div>
      </div>
      <div class="max-h-60 overflow-y-auto py-1">
        <div v-if="filtered.length === 0" class="px-4 py-6 text-center text-[11px] text-slate-400 font-bold">{{ emptyText }}</div>
        <button
          v-for="o in filtered"
          :key="String(o.value)"
          type="button"
          class="w-full text-right px-3.5 py-2.5 text-xs flex items-start justify-between gap-2 transition"
          :class="o.value === modelValue ? 'bg-emerald-50 text-emerald-900 font-black' : 'text-slate-700 hover:bg-slate-50 font-medium'"
          @click="pick(o.value)"
        >
          <span class="leading-relaxed">{{ o.label }}</span>
          <Check v-if="o.value === modelValue" class="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        </button>
      </div>
    </div>
  </div>
</template>
