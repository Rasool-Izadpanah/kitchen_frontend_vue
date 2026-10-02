<script setup>
/**
 * سند چاپی فاکتور — داخل PrintModal / DualThermalPrintModal رندر می‌شود.
 * target: 'customer' (رسید مشتری) | 'kitchen' (سفارش آشپزخانه) | '' (سند کامل A4/A5)
 */
import { toFa, formatMoney } from '../lib/utils.js';

const props = defineProps({
  invoice: { type: Object, required: true },
  settings: { type: Object, default: () => ({}) },
  paperSize: { type: String, default: 'A4' },
  target: { type: String, default: '' },
});
const inv = props.invoice;
const thermal = props.paperSize === 'thermal80';
const kitchenName = props.settings?.kitchenName || 'آشپزخانه نسیم';
const charityName = props.settings?.charityName || 'وابسته به بنیاد خیریه سیدالشهدا (ع)';
const totalPortions = inv.items.reduce((s, it) => s + it.count, 0);
</script>

<template>
  <!-- نسخه حرارتی -->
  <template v-if="thermal">
    <!-- نسخه آشپزخانه: فقط اقلام و تعداد — بدون مبالغ -->
    <div v-if="target === 'kitchen'" class="space-y-2.5 leading-tight">
      <div class="text-center pb-2 border-b border-dashed border-slate-400 space-y-1">
        <div class="font-black text-[13px] text-slate-900">سفارش آشپزخانه</div>
        <div class="text-[10px] text-slate-600">{{ kitchenName }}</div>
      </div>
      <div class="space-y-1 text-[10px] py-1 border-b border-dashed border-slate-300">
        <div class="flex justify-between"><span>شماره فاکتور:</span><strong>{{ toFa(inv.id) }}</strong></div>
        <div class="flex justify-between"><span>تاریخ:</span><span>{{ toFa(inv.date) }}</span></div>
        <div class="flex justify-between"><span>ساعت:</span><span>{{ toFa(inv.time) }}</span></div>
        <div class="flex justify-between"><span>مشتری:</span><strong>{{ inv.customer?.firstName }} {{ inv.customer?.lastName }}</strong></div>
      </div>
      <div class="space-y-1.5 py-1">
        <div class="font-bold text-[10px] border-b border-slate-300 pb-1 mb-1 flex justify-between">
          <span>شرح</span><span>تعداد (پرس)</span>
        </div>
        <div class="divide-y divide-dashed divide-slate-200">
          <div v-for="(it, i) in inv.items" :key="i" class="py-1.5 flex justify-between items-center">
            <span class="font-bold text-slate-900 text-[12px]">{{ it.dishName }}</span>
            <span class="font-black text-[13px]">{{ toFa(it.count) }}</span>
          </div>
        </div>
      </div>
      <div class="border-t-2 border-dashed border-slate-500 pt-2 text-[11px] font-black flex justify-between">
        <span>جمع کل پرس:</span><span>{{ toFa(totalPortions) }}</span>
      </div>
      <div v-if="inv.notes" class="text-[10px] pt-2 border-t border-dashed border-slate-300">
        <strong>توضیحات:</strong> {{ inv.notes }}
      </div>
    </div>

    <!-- نسخه مشتری حرارتی -->
    <div v-else class="space-y-2.5 leading-tight">
      <div class="text-center pb-2 border-b border-dashed border-slate-400 space-y-1">
        <div class="font-black text-[13px] text-slate-900">{{ kitchenName }}</div>
        <div class="text-[10px] text-slate-600">{{ charityName }}</div>
      </div>
      <div class="space-y-1 text-[10px] py-1 border-b border-dashed border-slate-300">
        <div class="flex justify-between"><span>شماره فاکتور:</span><strong>{{ toFa(inv.id) }}</strong></div>
        <div class="flex justify-between"><span>تاریخ:</span><span>{{ toFa(inv.date) }}</span></div>
        <div class="flex justify-between"><span>ساعت:</span><span>{{ toFa(inv.time) }}</span></div>
        <div class="flex justify-between"><span>مشتری:</span><strong class="truncate max-w-[160px]">{{ inv.customer?.firstName }} {{ inv.customer?.lastName }}</strong></div>
        <div v-if="inv.receiver" class="flex justify-between"><span>تحویل‌گیرنده:</span><span>{{ inv.receiver }}</span></div>
      </div>
      <div class="space-y-1 py-1">
        <div class="font-bold text-[10px] border-b border-slate-300 pb-1 mb-1 flex justify-between">
          <span>شرح</span><span>تعداد × فی</span>
        </div>
        <div class="divide-y divide-dashed divide-slate-200">
          <div v-for="(it, i) in inv.items" :key="i" class="py-1">
            <div class="font-bold text-slate-900 text-[11px]">{{ it.dishName }}</div>
            <div class="flex justify-between text-[10px] text-slate-600">
              <span>{{ toFa(it.count) }} × {{ formatMoney(it.unitPrice) }}</span>
              <span class="font-bold text-slate-900">{{ formatMoney(it.totalRow) }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="border-t-2 border-dashed border-slate-500 pt-2 space-y-1 text-[10px]">
        <div class="flex justify-between"><span>جمع اقلام:</span><span>{{ formatMoney(inv.subtotal) }} ت</span></div>
        <div v-if="inv.discountAmount > 0" class="flex justify-between"><span>تخفیف ({{ toFa(inv.discountPercent) }}٪):</span><span>{{ formatMoney(inv.discountAmount) }} ت</span></div>
        <div class="flex justify-between"><span>مالیات:</span><span>{{ inv.isTaxable ? `${formatMoney(inv.taxAmount)} ت` : 'معاف' }}</span></div>
        <div class="flex justify-between font-black text-[11px] pt-1 border-t border-slate-800">
          <span>جمع کل:</span><span>{{ formatMoney(inv.finalTotal) }} تومان</span>
        </div>
      </div>
      <div v-if="inv.receiver" class="pt-3 border-t border-dashed border-slate-400">
        <div class="text-[10px] text-slate-600 mb-5">امضای تحویل‌گیرنده: {{ inv.receiver }}</div>
        <div class="border-t border-dotted border-slate-400 w-40" />
      </div>
      <div class="text-center pt-2 text-[9px] text-slate-500 border-t border-dashed border-slate-400">
        با سپاس از همراهی شما در امر خیر
      </div>
    </div>
  </template>

  <!-- قالب A4 / A5 -->
  <div v-else class="space-y-5">
    <div class="flex flex-col sm:flex-row justify-between items-center border-b-2 border-slate-800 pb-4 gap-3">
      <div class="text-right space-y-1">
        <h3 class="font-black text-slate-900 text-base sm:text-lg">{{ kitchenName }}</h3>
        <p class="text-slate-600 text-[11px]">{{ charityName }}</p>
      </div>
      <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1 min-w-[185px]">
        <div class="flex justify-between"><span class="text-slate-600">شماره فاکتور:</span><strong>{{ toFa(inv.id) }}</strong></div>
        <div class="flex justify-between"><span class="text-slate-600">تاریخ:</span><strong>{{ toFa(inv.date) }}</strong></div>
        <div class="flex justify-between"><span class="text-slate-600">ساعت:</span><strong>{{ toFa(inv.time) }}</strong></div>
      </div>
    </div>

    <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      <div><span class="text-slate-600">مشتری: </span><strong class="text-slate-900">{{ inv.customer?.firstName }} {{ inv.customer?.lastName }}</strong></div>
      <div><span class="text-slate-600">تلفن: </span><strong>{{ toFa(inv.customer?.mobile || '-') }}</strong></div>
      <div class="sm:col-span-2"><span class="text-slate-600">نشانی: </span><span>{{ inv.customer?.address || '—' }}</span></div>
    </div>

    <table class="w-full text-right text-xs border border-slate-300 overflow-hidden">
      <thead class="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
        <tr>
          <th class="p-2.5 text-center w-12 border-l border-slate-300">ردیف</th>
          <th class="p-2.5 border-l border-slate-300">شرح غذا</th>
          <th class="p-2.5 text-center border-l border-slate-300 w-28">تعداد پرس</th>
          <th class="p-2.5 text-left border-l border-slate-300">فی (تومان)</th>
          <th class="p-2.5 text-left">مبلغ کل (تومان)</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-200">
        <tr v-for="(it, i) in inv.items" :key="i">
          <td class="p-2.5 text-center border-l border-slate-200 font-bold text-slate-600">{{ toFa(i + 1) }}</td>
          <td class="p-2.5 font-bold border-l border-slate-200">{{ it.dishName }}</td>
          <td class="p-2.5 text-center font-black border-l border-slate-200 text-emerald-800">{{ toFa(it.count) }}</td>
          <td class="p-2.5 text-left border-l border-slate-200">{{ formatMoney(it.unitPrice) }}</td>
          <td class="p-2.5 text-left font-black">{{ formatMoney(it.totalRow) }}</td>
        </tr>
      </tbody>
    </table>

    <div class="flex flex-col sm:flex-row justify-between items-start gap-4">
      <div class="text-xs text-slate-600 space-y-1 max-w-sm">
        <p v-if="inv.notes"><strong>توضیحات:</strong> {{ inv.notes }}</p>
      </div>
      <div class="w-full sm:w-72 space-y-2 text-xs">
        <div class="flex justify-between text-slate-700"><span>جمع اقلام:</span><span class="font-bold">{{ formatMoney(inv.subtotal) }} تومان</span></div>
        <div v-if="inv.discountAmount > 0" class="flex justify-between text-slate-700"><span>تخفیف ({{ toFa(inv.discountPercent) }}٪):</span><span class="font-bold text-sky-700">{{ formatMoney(inv.discountAmount) }} تومان</span></div>
        <div class="flex justify-between text-slate-700">
          <span>مالیات ({{ inv.isTaxable ? `${toFa(inv.taxRate)}٪` : 'معاف' }}):</span>
          <span class="font-bold">{{ inv.isTaxable ? `${formatMoney(inv.taxAmount)} تومان` : '۰ تومان' }}</span>
        </div>
        <div class="flex justify-between text-slate-900 font-black border-t-2 border-slate-800 pt-2 text-sm">
          <span>مبلغ نهایی:</span><span class="text-emerald-800">{{ formatMoney(inv.finalTotal) }} تومان</span>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-xs text-center">
      <div>
        <span class="block text-slate-600 mb-8">مهر و امضای آشپزخانه:</span>
        <div class="border-t border-dotted border-slate-400 mx-auto w-36" />
      </div>
      <div>
        <span class="block text-slate-600 mb-8">امضای تحویل‌گیرنده {{ inv.receiver ? `(${inv.receiver})` : '' }}:</span>
        <div class="border-t border-dotted border-slate-400 mx-auto w-36" />
      </div>
    </div>
  </div>
</template>
