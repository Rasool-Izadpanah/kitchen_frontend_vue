<script setup>
/**
 * داشبورد — معادل Dashboard.jsx
 * سه کاشی: گزارش فروش روز | هشدار کمبود انبار | پخت و فروش امروز
 */
import { computed } from 'vue';
import {
  TrendingUp, AlertTriangle, Utensils, BadgeDollarSign, FileText, Clock,
  ShoppingCart, ChefHat, ChevronLeft, CookingPot, Boxes,
} from 'lucide-vue-next';
import { toFa, formatMoney, faDatePretty, jalaliTodayString } from '../lib/utils.js';
import { useAppStore } from '../stores/app.js';

const store = useAppStore();
const today = jalaliTodayString();

/* ===== کاشی سمت راست: گزارش فروش روز جاری (فقط غذا — بدون اقلام جانبی) ===== */
const todayInvoices = computed(() => store.invoices.filter((inv) => inv.date === today));
const isDish = (it) => it.kind !== 'supply';
const todayPortions = computed(() =>
  todayInvoices.value.reduce((s, inv) => s + inv.items.filter(isDish).reduce((a, it) => a + it.count, 0), 0)
);
const todayTotal = computed(() => todayInvoices.value.reduce((s, inv) => s + inv.finalTotal, 0));
const lastTime = computed(() => todayInvoices.value.map((i) => i.time).sort().pop());

// تفکیک فروش امروز فقط به تفکیک غذا
const dishRows = computed(() => {
  const dishMap = {};
  todayInvoices.value.forEach((inv) => inv.items.filter(isDish).forEach((it) => {
    if (!dishMap[it.dishName]) dishMap[it.dishName] = { name: it.dishName, count: 0, total: 0 };
    dishMap[it.dishName].count += it.count;
    dishMap[it.dishName].total += it.totalRow;
  }));
  return Object.values(dishMap).sort((a, b) => b.count - a.count).slice(0, 4);
});
const maxDish = computed(() => (dishRows.value.length ? dishRows.value[0].count : 1));

/* ===== کاشی وسط: اقلام انبار در وضعیت کمبود ===== */
const lowItems = computed(() =>
  store.ingredients
    .filter((ing) => ing.qty <= ing.minThreshold)
    .sort((a, b) => a.qty / (a.minThreshold || 1) - b.qty / (b.minThreshold || 1))
);
const criticalCount = computed(() =>
  lowItems.value.filter((i) => (i.minThreshold ? i.qty / i.minThreshold : 1) <= 0.5).length
);

/* ===== کاشی سمت چپ: برنامه پخت روزانه vs فروش ===== */
const todayPlans = computed(() => store.plans.filter((p) => p.date === today));
const finalPlans = computed(() => todayPlans.value.filter((p) => p.status === 'final'));

const cookedByDish = computed(() => {
  const m = {};
  (finalPlans.value.length ? finalPlans.value : todayPlans.value).forEach((p) => {
    p.items.forEach((it) => {
      if (!m[it.dishName]) m[it.dishName] = 0;
      m[it.dishName] += it.qty;
    });
  });
  return m;
});
const cookedTotal = computed(() => Object.values(cookedByDish.value).reduce((a, b) => a + b, 0));

const soldByDish = computed(() => {
  const m = {};
  todayInvoices.value.forEach((inv) => inv.items.filter((it) => it.kind !== 'supply').forEach((it) => {
    if (!m[it.dishName]) m[it.dishName] = 0;
    m[it.dishName] += it.count;
  }));
  return m;
});
const soldTotal = computed(() => Object.values(soldByDish.value).reduce((a, b) => a + b, 0));
const remainingTotal = computed(() => Math.max(0, cookedTotal.value - soldTotal.value));
const planIsFinal = computed(() => finalPlans.value.length > 0);

const cookRows = computed(() => {
  const allDishNames = Array.from(new Set([...Object.keys(cookedByDish.value), ...Object.keys(soldByDish.value)]));
  return allDishNames.map((n) => ({
    name: n,
    cooked: cookedByDish.value[n] || 0,
    sold: soldByDish.value[n] || 0,
    remaining: Math.max(0, (cookedByDish.value[n] || 0) - (soldByDish.value[n] || 0)),
  })).sort((a, b) => b.cooked - a.cooked);
});
</script>

<template>
  <div class="space-y-6">
    <!-- ===== نوار عنوان داشبورد ===== -->
    <div class="bg-gradient-to-l from-emerald-900 via-emerald-700 to-teal-600 rounded-3xl p-5 sm:p-7 text-white relative shadow-lg overflow-hidden">
      <div class="absolute -left-12 -bottom-16 w-60 h-60 rounded-full bg-white/5" />
      <div class="absolute left-28 -top-24 w-44 h-44 rounded-full bg-white/5" />
      <div class="relative space-y-5">
        <div class="flex flex-wrap items-center gap-2"></div>

        <!-- عنوان کامل سامانه -->
        <div class="flex items-center gap-3.5">
          <div class="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
            <ChefHat class="w-7 h-7" />
          </div>
          <div class="min-w-0">
            <h2 class="text-base sm:text-xl font-black leading-snug">مدیریت آشپزخانه نسیم</h2>
            <p class="text-emerald-100/85 text-[11px] sm:text-xs font-medium">( وابسته به بنیاد خیریه سیدالشهدا (ع) )</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== سه کاشی میانی — در چیدمان RTL اولین کاشی سمت راست است ===== -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
      <!-- کاشی سمت راست: گزارش فروش روز جاری -->
      <div class="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600">
              <TrendingUp class="w-5 h-5" />
            </div>
            <div>
              <h3 class="text-sm font-black text-slate-800">گزارش فروش</h3>
              <p class="text-[10px] text-slate-500 font-medium">{{ faDatePretty(today) }}</p>
            </div>
          </div>
          <span class="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 inline-flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> لحظه‌ای
          </span>
        </div>

        <!-- دو شاخص اصلی -->
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-2xl bg-slate-50 border border-slate-100 p-3.5 space-y-1.5">
            <div class="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
              <Utensils class="w-3.5 h-3.5" /> پرس غذای فاکتورشده
            </div>
            <div class="text-2xl font-black text-slate-900 tabular-nums">
              {{ toFa(todayPortions) }}
              <span class="text-[10px] font-bold text-slate-400 mr-1">پرس</span>
            </div>
          </div>
          <div class="rounded-2xl bg-emerald-50 border border-emerald-100 p-3.5 space-y-1.5">
            <div class="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700">
              <BadgeDollarSign class="w-3.5 h-3.5" /> جمع کل فاکتورها
            </div>
            <div class="text-lg font-black text-emerald-800 tabular-nums leading-7">
              {{ formatMoney(todayTotal) }}
              <span class="text-[10px] font-bold text-emerald-600 mr-1">تومان</span>
            </div>
          </div>
        </div>

        <!-- تفکیک فروش امروز به تفکیک غذا -->
        <div v-if="dishRows.length > 0" class="space-y-2.5 pt-1">
          <div class="text-[10px] font-black text-slate-500 flex items-center justify-between">
            <span>پرفروش‌ترین غذاهای امروز</span>
            <span class="text-slate-400">پرس</span>
          </div>
          <div v-for="d in dishRows" :key="d.name" class="space-y-1">
            <div class="flex items-center justify-between text-[11px]">
              <span class="font-bold text-slate-700 truncate max-w-[150px]">{{ d.name }}</span>
              <span class="font-black text-slate-800 tabular-nums">{{ toFa(d.count) }}</span>
            </div>
            <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full bg-gradient-to-l from-emerald-600 to-teal-400 transition-all"
                :style="{ width: `${Math.max(6, (d.count / maxDish) * 100)}%` }"
              />
            </div>
          </div>
        </div>
        <div v-else class="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-[11px] text-slate-400 font-bold">
          امروز هنوز فاکتوری صادر نشده است
        </div>

        <!-- پانوشت کاشی -->
        <div class="mt-auto pt-3 border-t border-dashed border-slate-200 flex items-center justify-between text-[11px]">
          <span class="flex items-center gap-1 text-slate-500 font-medium">
            <FileText class="w-3.5 h-3.5" /> {{ toFa(todayInvoices.length) }} فاکتور
            <span v-if="lastTime" class="flex items-center gap-1 mr-1.5"><Clock class="w-3 h-3" /> آخرین ثبت {{ lastTime }}</span>
          </span>
          <button
            class="text-emerald-700 font-black hover:underline inline-flex items-center gap-0.5"
            :style="{ display: store.can('create_invoice') ? undefined : 'none' }"
            @click="store.navigate('invoice')"
          >
            صدور فاکتور <ChevronLeft class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <!-- کاشی وسط: اقلام انبار در وضعیت کمبود (قرمز) -->
      <div class="bg-white rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col gap-4 border" :class="lowItems.length ? 'border-rose-200' : 'border-slate-200'">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="p-2.5 rounded-2xl" :class="lowItems.length ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'">
              <AlertTriangle class="w-5 h-5" />
            </div>
            <div>
              <h3 class="text-sm font-black text-slate-800">هشدار کمبود موجودی انبار</h3>
              <p class="text-[10px] text-slate-500 font-medium">اقلام زیر آستانه هشدار</p>
            </div>
          </div>
          <span
            v-if="lowItems.length > 0"
            class="text-[10px] font-black px-2.5 py-1 rounded-full border"
            :class="criticalCount ? 'bg-rose-600 text-white border-rose-600' : 'bg-amber-50 text-amber-700 border-amber-200'"
          >
            {{ toFa(lowItems.length) }} قلم کمبود{{ criticalCount ? ` · ${toFa(criticalCount)} بحرانی` : '' }}
          </span>
        </div>

        <div v-if="lowItems.length === 0" class="flex-1 flex flex-col items-center justify-center py-10 gap-2">
          <div class="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 text-xl font-black">✓</div>
          <div class="text-emerald-700 font-black text-sm">تمام اقلام در وضعیت مطلوب‌اند</div>
          <p class="text-[11px] text-slate-500">هیچ قلمی زیر آستانه هشدار موجودی نیست</p>
        </div>
        <div v-else class="space-y-2 max-h-80 overflow-y-auto pl-1 flex-1">
          <div
            v-for="ing in lowItems"
            :key="ing.id"
            class="rounded-2xl p-3 border"
            :class="(ing.minThreshold ? ing.qty / ing.minThreshold : 1) <= 0.5 ? 'bg-rose-50 border-rose-300' : 'bg-amber-50 border-amber-200'"
          >
            <div class="flex items-center justify-between text-xs mb-1.5">
              <span class="font-black" :class="(ing.minThreshold ? ing.qty / ing.minThreshold : 1) <= 0.5 ? 'text-rose-900' : 'text-amber-900'">{{ ing.name }}</span>
              <span class="font-black tabular-nums" :class="(ing.minThreshold ? ing.qty / ing.minThreshold : 1) <= 0.5 ? 'text-rose-700' : 'text-amber-700'">
                {{ toFa(ing.qty) }} / {{ toFa(ing.minThreshold) }} {{ ing.unit }}
              </span>
            </div>
            <div class="h-1.5 bg-white rounded-full overflow-hidden border border-black/5">
              <div
                class="h-full rounded-full"
                :class="(ing.minThreshold ? ing.qty / ing.minThreshold : 1) <= 0.5 ? 'bg-rose-500' : 'bg-amber-500'"
                :style="{ width: `${Math.min(100, Math.max(4, (ing.minThreshold ? ing.qty / ing.minThreshold : 1) * 100))}%` }"
              />
            </div>
            <div class="flex justify-between mt-1 text-[10px]">
              <span :class="(ing.minThreshold ? ing.qty / ing.minThreshold : 1) <= 0.5 ? 'text-rose-600 font-black' : 'text-amber-600 font-bold'">
                {{ (ing.minThreshold ? ing.qty / ing.minThreshold : 1) <= 0.5 ? '● قرمز — بحرانی' : '● زرد — رو به اتمام' }}
              </span>
              <span class="text-slate-500 font-medium">{{ ing.storage }}</span>
            </div>
          </div>
        </div>

        <button
          v-if="store.can('view_warehouse')"
          class="mt-auto pt-3 border-t border-dashed border-slate-200 text-[11px] font-black text-slate-600 hover:text-emerald-700 transition flex items-center justify-center gap-1"
          @click="store.navigate('warehouse', 'balance')"
        >
          مشاهده موجودی کامل انبار و کاردکس <ChevronLeft class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- کاشی سمت چپ: پخت روزانه در برابر فروش -->
      <div class="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="p-2.5 rounded-2xl bg-teal-50 text-teal-600">
              <CookingPot class="w-5 h-5" />
            </div>
            <div>
              <h3 class="text-sm font-black text-slate-800">پخت و فروش امروز</h3>
              <p class="text-[10px] text-slate-500 font-medium">
                {{ planIsFinal ? 'بر اساس برنامه قطعی' : todayPlans.length ? 'بر اساس برنامه موقت' : 'برنامه‌ای ثبت نشده' }}
              </p>
            </div>
          </div>
          <span v-if="!planIsFinal && todayPlans.length > 0" class="text-[9px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">موقت</span>
        </div>

        <!-- سه شاخص اصلی: پخت / فروش / باقیمانده -->
        <div class="grid grid-cols-3 gap-2">
          <div class="rounded-2xl bg-teal-50 border border-teal-100 p-3 space-y-1 text-center">
            <CookingPot class="w-4 h-4 text-teal-600 mx-auto" />
            <div class="text-[9px] font-bold text-teal-700">پخته‌شده</div>
            <div class="text-lg font-black text-teal-800 tabular-nums">{{ toFa(cookedTotal) }}</div>
            <div class="text-[9px] font-bold text-teal-600">پرس</div>
          </div>
          <div class="rounded-2xl bg-emerald-50 border border-emerald-100 p-3 space-y-1 text-center">
            <ShoppingCart class="w-4 h-4 text-emerald-600 mx-auto" />
            <div class="text-[9px] font-bold text-emerald-700">فروخته‌شده</div>
            <div class="text-lg font-black text-emerald-800 tabular-nums">{{ toFa(soldTotal) }}</div>
            <div class="text-[9px] font-bold text-emerald-600">پرس</div>
          </div>
          <div class="rounded-2xl bg-sky-50 border border-sky-100 p-3 space-y-1 text-center">
            <Boxes class="w-4 h-4 text-sky-600 mx-auto" />
            <div class="text-[9px] font-bold text-sky-700">باقیمانده</div>
            <div class="text-lg font-black text-sky-800 tabular-nums">{{ toFa(remainingTotal) }}</div>
            <div class="text-[9px] font-bold text-sky-600">پرس</div>
          </div>
        </div>

        <!-- جدول تفکیک هر غذا -->
        <div v-if="cookRows.length > 0" class="border border-slate-200 rounded-2xl overflow-hidden">
          <table class="w-full text-right text-[11px]">
            <thead class="bg-slate-50 font-black text-slate-600 border-b border-slate-200">
              <tr>
                <th class="p-2">غذا</th>
                <th class="p-2 text-center">پخت</th>
                <th class="p-2 text-center">فروش</th>
                <th class="p-2 text-center">مانده</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="r in cookRows" :key="r.name" class="hover:bg-slate-50">
                <td class="p-2 font-bold text-slate-700 truncate max-w-[110px]">{{ r.name }}</td>
                <td class="p-2 text-center font-black text-teal-700">{{ toFa(r.cooked) }}</td>
                <td class="p-2 text-center font-black text-emerald-700">{{ toFa(r.sold) }}</td>
                <td class="p-2 text-center font-black" :class="r.remaining > 0 ? 'text-sky-700' : 'text-slate-400'">{{ toFa(r.remaining) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-[11px] text-slate-400 font-bold flex-1 flex flex-col items-center justify-center gap-1">
          برای امروز برنامه پختی ثبت نشده است
        </div>

        <div class="mt-auto pt-3 border-t border-dashed border-slate-200 flex items-center justify-between text-[11px]">
          <span class="text-slate-500 font-medium">{{ toFa(cookRows.length) }} غذا در برنامه امروز</span>
          <button
            class="text-teal-700 font-black hover:underline inline-flex items-center gap-0.5"
            :style="{ display: store.can('dailycook') ? undefined : 'none' }"
            @click="store.navigate('dailycook')"
          >
            برنامه پخت <ChevronLeft class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
