<script setup>
defineProps({
  colSpan: { type: Number, required: true },
  text: { type: String, default: '' },
});
</script>

<template>
  <tr>
    <td :colspan="colSpan" class="p-8 text-center text-slate-400 text-xs">{{ text }}</td>
  </tr>
</template>
