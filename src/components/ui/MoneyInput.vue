<script setup>
// اینپوت مبلغ: نمایش با جداکننده سه‌رقمی هنگام تایپ — مقدار داخلی لاتین می‌ماند
import { ref } from 'vue';
import { toFa } from '../../lib/utils.js';

const faDigitsToLatin = (s) =>
  String(s)
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);

const inputEl = ref(null);

const handle = (e) => {
  const el = e.target;
  const caretFromEnd = el.value.length - el.selectionStart;
  const digits = faDigitsToLatin(el.value).replace(/[^\d]/g, '');
  emit('update:modelValue', digits);
  // نگه‌داشتن مکان‌نما بعد از گروه‌بندی سه‌رقمی
  requestAnimationFrame(() => {
    if (!inputEl.value) return;
    const pos = Math.max(0, inputEl.value.value.length - caretFromEnd);
    inputEl.value.setSelectionRange(pos, pos);
  });
};
</script>

<template>
  <input
    ref="inputEl"
    type="text"
    inputmode="numeric"
    dir="ltr"
    :value="modelValue ? toFa(Number(modelValue).toLocaleString('en-US')) : ''"
    :placeholder="placeholder"
    :disabled="disabled"
    @input="handle"
  />
</template>
