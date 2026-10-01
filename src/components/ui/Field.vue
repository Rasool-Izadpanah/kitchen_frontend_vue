<script setup>
defineProps({ label: { type: String, default: '' } });
</script>

<template>
  <div>
    <label class="block text-xs font-bold text-slate-700 mb-1.5">{{ label }}</label>
    <slot />
  </div>
</template>
