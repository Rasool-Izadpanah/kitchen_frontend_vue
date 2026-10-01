<script setup>
/**
 * یک بخش از سایدبار: دکمه باز/بسته (آکاردئون — فقط یک بخش باز) و زیربخش‌ها با گروه‌بندی
 * حالت باز بودن در والد (App.vue از طریق ref) مدیریت می‌شود.
 */
import { computed } from 'vue';
import { ChevronDown } from 'lucide-vue-next';

const props = defineProps({
  section: { type: Object, required: true }, // {id, label, icon, children}
  page: { type: String, required: true },
  activeKey: { type: String, default: null },
  expanded: { type: Boolean, default: false },
});
const emit = defineEmits(['toggle', 'navigate']);

const hasActive = computed(() => props.section.children.some((c) => c.page === props.page));

// گروه‌بندی زیربخش‌ها (در صورت تعریف group) — سرگروه به‌صورت عنوان نمایش داده می‌شود
const groups = computed(() => {
  const out = [];
  props.section.children.forEach((c) => {
    const g = c.group || '';
    let bucket = out.find((x) => x.name === g);
    if (!bucket) { bucket = { name: g, items: [] }; out.push(bucket); }
    bucket.items.push(c);
  });
  return out;
});
</script>

<template>
  <div>
    <button
      class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-black transition"
      :class="hasActive ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-50'"
      @click="emit('toggle', section.id)"
    >
      <span class="flex items-center gap-2.5">
        <component :is="section.icon" class="w-4.5 h-4.5" :class="hasActive ? 'text-emerald-600' : 'text-slate-400'" />
        {{ section.label }}
      </span>
      <ChevronDown class="w-3.5 h-3.5 text-slate-400 transition-transform" :class="expanded ? 'rotate-180' : ''" />
    </button>

    <!-- زیربخش‌ها — فقط بخش باز نمایش داده می‌شود -->
    <div v-if="expanded" class="mt-1 mr-4 pr-3 border-r-2 border-slate-100 space-y-0.5 py-1">
      <div v-for="g in groups" :key="g.name || 'main'" class="space-y-0.5">
        <div v-if="g.name" class="px-3 pt-2 pb-1 text-[9px] font-black text-slate-400 tracking-wide">{{ g.name }}</div>
        <button
          v-for="c in g.items"
          :key="c.id"
          class="w-full text-right px-3 py-2 rounded-lg text-[11px] font-bold transition"
          :class="activeKey ? (activeKey === c.id ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700') : (page === c.page ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700')"
          @click="emit('navigate', c.page, c.tab)"
        >
          {{ c.label }}
        </button>
      </div>
    </div>
  </div>
</template>
