<script setup>
// اینپوت‌های عددی با نمایش ارقام فارسی — مقدار ذخیره‌شده لاتین می‌ماند
// تا محاسبات و ذخیره‌سازی بدون تغییر کار کند.
import { ref } from 'vue';
import { toFa } from '../../lib/utils.js';

// تبدیل ارقام فارسی/عربی تایپ‌شده به لاتین برای ذخیره‌سازی
const faDigitsToLatin = (s) =>
  String(s)
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  step: { type: [Number, String], default: null },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);

const handle = (e) => {
  let s = faDigitsToLatin(e.target.value).replace(/[^\d.]/g, '');
  if (props.step === 'any' || !props.step) {
    // اعشار مجاز
    const parts = s.split('.');
    if (parts.length > 2) s = `${parts[0]}.${parts.slice(1).join('')}`;
  } else {
    s = s.replace(/\./g, '');
  }
  emit('update:modelValue', s);
};
</script>

<template>
  <input
    type="text"
    inputmode="decimal"
    dir="ltr"
    :value="toFa(modelValue)"
    :placeholder="placeholder"
    :disabled="disabled"
    @input="handle"
  />
</template>
