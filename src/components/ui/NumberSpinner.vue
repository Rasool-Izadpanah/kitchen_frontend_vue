<script setup>
// اینپوت عددی با نمایش ارقام فارسی + دکمه‌های افزایش/کاهش
// هم تایپ با کیبورد و هم کلیک روی +/− کار می‌کند.
import FaNumberInput from './FaNumberInput.vue';

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  min: { type: Number, default: 0 },
  max: { type: Number, default: Infinity },
  step: { type: Number, default: 1 },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);

const clamp = (n) => Math.min(props.max, Math.max(props.min, n));
const inc = () => emit('update:modelValue', String(clamp((Number(props.modelValue) || 0) + props.step)));
const dec = () => emit('update:modelValue', String(clamp((Number(props.modelValue) || 0) - props.step)));
</script>

<template>
  <div class="relative flex items-stretch" :class="disabled ? 'opacity-60 pointer-events-none' : ''">
    <button
      type="button"
      tabindex="-1"
      class="px-2.5 bg-slate-100 hover:bg-emerald-100 text-slate-600 rounded-r-xl border border-slate-300 border-l-0 text-sm font-black transition shrink-0"
      aria-label="افزایش"
      @click="inc"
    >+</button>
    <div class="flex-1">
      <FaNumberInput
        :model-value="String(modelValue)"
        :disabled="disabled"
        class="w-full text-center font-black border-y border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"
        @update:model-value="(v) => emit('update:modelValue', v)"
      />
    </div>
    <button
      type="button"
      tabindex="-1"
      class="px-2.5 bg-slate-100 hover:bg-rose-100 text-slate-600 rounded-l-xl border border-slate-300 border-r-0 text-base font-black transition shrink-0"
      aria-label="کاهش"
      @click="dec"
    >−</button>
  </div>
</template>
