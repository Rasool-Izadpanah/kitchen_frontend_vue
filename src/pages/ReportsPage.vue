<script setup>
/**
 * گزارش‌گیری — معادل ReportsPage.jsx
 * تب‌ها: صورتحساب مشتری، عملکرد آشپزخانه، گزارش خرید، قیمت تمام شده غذاها،
 * تخفیف‌های ارائه‌شده، لیست درخواست‌های خرید، گزارش برنامه‌های پخت
 * داده‌ها همه از useAppStore می‌آیند؛ قیمت فروش دستی مستقیم روی store.dishes ذخیره می‌شود.
 */
import { ref, computed } from 'vue';
import { BarChart3, Users, TrendingUp, Printer, ShoppingBag, Calculator, ShoppingCart, Eye, X } from 'lucide-vue-next';
import { toFa, formatMoney, faDate, jalaliToJdn, faDatePretty, jalaliTodayString } from '../lib/utils.js';
import { useAppStore } from '../stores/app.js';
import { inputCls } from '../components/ui/inputCls.js';
import EmptyRow from '../components/ui/EmptyRow.vue';
import FaNumberInput from '../components/ui/FaNumberInput.vue';
import MoneyInput from '../components/ui/MoneyInput.vue';
import SearchableSelect from '../components/SearchableSelect.vue';
import JalaliDatePicker from '../components/JalaliDatePicker.vue';
import PrintModal from '../components/PrintModal.vue';
import ExportButtons from '../components/ExportButtons.vue';

const props = defineProps({
  showToast: { type: Function, default: () => {} },
  userName: { type: String, default: '—' },
  initialTab: { type: String, default: null },
  showTabs: { type: Boolean, default: true },
});

const store = useAppStore();

const tab = ref(props.initialTab || 'customer'); // customer | performance | purchase | cost | discounts | purchaseRequests | cookplans
const custId = ref('');
const planDetail = ref(null);
const custFrom = ref('');
const custTo = ref('');
const perfFrom = ref('');
const perfTo = ref('');
const printTarget = ref(null); // 'customer' | 'performance' | 'purchase'
// گزارش خرید
const purSupplierId = ref('');
const purFrom = ref('');
const purTo = ref('');
// قیمت تمام شده
const profitPercent = ref('30');
const salePrices = ref({}); // { dishId: قیمت فروش دستی }

const inRange = (date, from, to) => {
  const jdn = jalaliToJdn(date);
  if (from && jdn < jalaliToJdn(from)) return false;
  if (to && jdn > jalaliToJdn(to)) return false;
  return true;
};

// ===== گزارش صورتحساب مشتری =====
const custInvoices = computed(() => {
  if (!custId.value) return [];
  return store.invoices
    .filter((inv) => inv.customer.id === custId.value && inRange(inv.date, custFrom.value, custTo.value))
    .sort((a, b) => (a.date > b.date ? 1 : -1));
});

const custTotals = computed(() => custInvoices.value.reduce((acc, inv) => ({
  portions: acc.portions + inv.items.reduce((s, it) => s + it.count, 0),
  subtotal: acc.subtotal + inv.subtotal,
  discount: acc.discount + (inv.discountAmount || 0),
  tax: acc.tax + (inv.taxAmount || 0),
  grand: acc.grand + inv.finalTotal,
  count: acc.count + 1,
}), { portions: 0, subtotal: 0, discount: 0, tax: 0, grand: 0, count: 0 }));

const cust = computed(() => store.customers.find((c) => c.id === custId.value) || null);

// ===== گزارش عملکرد آشپزخانه =====
const perfInvoices = computed(() =>
  store.invoices.filter((inv) => inRange(inv.date, perfFrom.value, perfTo.value)).sort((a, b) => (a.date > b.date ? 1 : -1))
);

const perfTotals = computed(() => perfInvoices.value.reduce((acc, inv) => ({
  portions: acc.portions + inv.items.reduce((s, it) => s + it.count, 0),
  subtotal: acc.subtotal + inv.subtotal,
  discount: acc.discount + (inv.discountAmount || 0),
  tax: acc.tax + (inv.taxAmount || 0),
  grand: acc.grand + inv.finalTotal,
  count: acc.count + 1,
}), { portions: 0, subtotal: 0, discount: 0, tax: 0, grand: 0, count: 0 }));

// ===== قیمت تمام شده غذاها =====
// سربار هر پرس = مجموع سربار ماهانه ÷ تعداد پرس‌های برنامه‌های قطعی ماه جاری
const overheadPerPortion = computed(() => {
  const totalOverhead = store.overheads.reduce((s, o) => s + (o.amount || 0), 0);
  const jn = jalaliTodayString().split('/');
  const monthPrefix = `${jn[0]}/${String(jn[1]).padStart(2, '0')}`;
  // پرس‌های قطعی در ماه جاری (از تاریخ یا createdAt)
  const monthlyPortions = store.invoices.reduce((s, inv) => {
    if (!inv.date.startsWith(monthPrefix)) return s;
    return s + inv.items.filter((it) => it.kind !== 'supply').reduce((a, it) => a + it.count, 0);
  }, 0);
  if (monthlyPortions === 0) return { perPortion: 0, portions: 0, total: totalOverhead };
  return { perPortion: Math.round(totalOverhead / monthlyPortions), portions: monthlyPortions, total: totalOverhead };
});

// تفکیک پخت بر اساس غذا (با محاسبه هزینه تمام‌شده و سود)
const dishStats = computed(() => {
  const map = {};
  perfInvoices.value.forEach((inv) => inv.items.filter((it) => it.kind !== 'supply').forEach((it) => {
    if (!map[it.dishId]) {
      const rec = store.recipes.find((r) => r.dishId === it.dishId);
      let matCost = 0;
      if (rec) rec.items.forEach((ri) => {
        const ing = store.ingredients.find((i) => i.id === ri.ingredientId);
        matCost += (ri.qty || 0) * (ing?.price || 0);
      });
      map[it.dishId] = { name: it.dishName, count: 0, amount: 0, unitCost: Math.round(matCost + overheadPerPortion.value.perPortion) };
    }
    map[it.dishId].count += it.count;
    map[it.dishId].amount += it.totalRow;
  }));
  return Object.values(map).sort((a, b) => b.count - a.count);
});

// جمع فوتر جدول عملکرد
const perfFooter = computed(() => {
  const totalSales = dishStats.value.reduce((s, d) => s + d.amount, 0);
  const totalCostAll = dishStats.value.reduce((s, d) => s + d.unitCost * d.count, 0);
  const totalProfit = totalSales - totalCostAll;
  return { totalSales, totalCostAll, totalProfit };
});

// ===== گزارش خرید (فروشنده + دوره زمانی) =====
const purchaseRows = computed(() => {
  if (!purSupplierId.value) return [];
  return store.moves
    .filter((m) => m.type === 'in' && m.supplierId === purSupplierId.value && inRange(m.date, purFrom.value, purTo.value))
    .sort((a, b) => (a.date > b.date ? 1 : -1));
});

const purchaseByItem = computed(() => {
  const map = {};
  purchaseRows.value.forEach((m) => {
    if (!map[m.ingredientId]) map[m.ingredientId] = { name: m.name, unit: m.unit, qty: 0, count: 0 };
    map[m.ingredientId].qty += m.qty;
    map[m.ingredientId].count += 1;
  });
  return Object.values(map).sort((a, b) => b.qty - a.qty);
});

const purSupplier = computed(() => store.customers.find((c) => c.id === purSupplierId.value) || null);

// هزینه مواد اولیه هر پرس + قیمت تمام شده
const costRows = computed(() => {
  return store.dishes.map((d) => {
    const rec = store.recipes.find((r) => r.dishId === d.id);
    let materialCost = 0;
    const details = [];
    if (rec) {
      rec.items.forEach((ri) => {
        const ing = store.ingredients.find((i) => i.id === ri.ingredientId);
        const price = ing?.price || 0;
        const cost = (ri.qty || 0) * price;
        materialCost += cost;
        details.push({ name: ri.name, qty: ri.qty, unit: ri.unit, price, cost });
      });
    }
    const withWaste = materialCost * (1 + 0); // پرتی قبلاً در قیمت خرید لحاظ شده
    const overhead = overheadPerPortion.value.perPortion;
    const totalCost = Math.round(withWaste + overhead);
    const suggestedPrice = Math.round((totalCost * (1 + (Number(profitPercent.value) || 0) / 100)) / 1000) * 1000;
    const manualPrice = salePrices.value[d.id];
    const currentPrice = manualPrice !== undefined && manualPrice !== '' ? Number(manualPrice) : (d.price || 0);
    return { dish: d, recipe: rec || null, materialCost: Math.round(materialCost), overhead, totalCost, suggestedPrice, currentPrice, details };
  });
});

const saveSalePrice = (dishId, value) => {
  // همیشه در state محلی ذخیره شود تا هنگام تایپ/پاک کردن، مقدار به عقب برنگردد
  salePrices.value = { ...salePrices.value, [dishId]: value };
};
const commitSalePrice = (dishId) => {
  const v = salePrices.value[dishId];
  const n = Number(v);
  if (n > 0) {
    // قیمت در جدول تعریف غذا ذخیره می‌شود (برای فاکتورها) — معادل setDishes در React
    store.dishes = store.dishes.map((d) => (d.id === dishId ? { ...d, price: n } : d));
  }
};

// ===== تب تخفیف‌های ارائه‌شده =====
const discCustFilter = ref('');
const discFrom = ref('');
const discTo = ref('');

// استخراج فاکتورهای دارای تخفیف
const discountRows = computed(() => {
  return store.invoices
    .filter((inv) => (inv.discountAmount || 0) > 0)
    .filter((inv) => (discCustFilter.value ? inv.customer.id === discCustFilter.value : true))
    .filter((inv) => {
      const jdn = jalaliToJdn(inv.date);
      if (discFrom.value && jdn < jalaliToJdn(discFrom.value)) return false;
      if (discTo.value && jdn > jalaliToJdn(discTo.value)) return false;
      return true;
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
});

const totalDiscount = computed(() => discountRows.value.reduce((s, inv) => s + (inv.discountAmount || 0), 0));

const byCustomer = computed(() => {
  const map = {};
  discountRows.value.forEach((inv) => {
    const key = inv.customer.id;
    if (!map[key]) map[key] = { name: `${inv.customer.firstName} ${inv.customer.lastName}`, count: 0, total: 0 };
    map[key].count += 1;
    map[key].total += inv.discountAmount || 0;
  });
  return Object.values(map).sort((a, b) => b.total - a.total);
});

// ===== تب لیست درخواست‌های خرید =====
const prStatusMeta = (status) => ({
  temp: { label: 'در انتظار تایید', cls: 'bg-amber-100 text-amber-700' },
  ordered: { label: 'سفارش‌شده — در انتظار تحویل', cls: 'bg-sky-100 text-sky-700' },
  completed: { label: 'تحویل داده شد', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'رد شد', cls: 'bg-rose-100 text-rose-700' },
  cancelled: { label: 'ابطال شد (تهیه نشد)', cls: 'bg-rose-100 text-rose-700' },
}[status] || { label: status, cls: 'bg-slate-100 text-slate-600' });

// ===== تب گزارش برنامه‌های پخت =====
const totalPlanPortions = computed(() => store.plans.reduce((s, p) => s + p.items.reduce((a, it) => a + it.qty, 0), 0));

const planStatusMeta = (status) => ({
  temp: { label: 'موقت', cls: 'bg-amber-100 text-amber-700' },
  final: { label: 'قطعی', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'رد شده', cls: 'bg-rose-100 text-rose-700' },
}[status] || { label: status, cls: 'bg-slate-100 text-slate-600' });

const planDishesSummary = (p) => p.items.map((it) => `${it.dishName} (${toFa(it.qty)})`).join(' + ');

// مودال جزئیات برنامه پخت
const detailStatusMeta = computed(() => (planDetail.value ? planStatusMeta(planDetail.value.status) : { label: '', cls: '' }));

// مواد لازم برنامه (برای برنامه رد شده محاسبه نمی‌شود)
const detailNeeds = computed(() => {
  const p = planDetail.value;
  const needs = {};
  if (p && p.status !== 'rejected') {
    p.items.forEach((it) => {
      const rec = store.recipes.find((r) => r.dishId === it.dishId);
      if (!rec) return;
      rec.items.forEach((ri) => {
        if (!needs[ri.ingredientId]) needs[ri.ingredientId] = { name: ri.name, unit: ri.unit, need: 0 };
        needs[ri.ingredientId].need += ri.qty * it.qty;
      });
    });
  }
  return needs;
});

const TABS = [
  { id: 'customer', label: 'صورتحساب مشتری', icon: Users },
  { id: 'performance', label: 'عملکرد آشپزخانه', icon: TrendingUp },
  { id: 'purchase', label: 'گزارش خرید', icon: ShoppingBag },
  { id: 'cost', label: 'قیمت تمام شده غذاها', icon: Calculator },
  { id: 'discounts', label: 'تخفیف‌های ارائه‌شده', icon: Calculator },
  { id: 'purchaseRequests', label: 'لیست درخواست‌های خرید', icon: ShoppingCart },
  { id: 'cookplans', label: 'گزارش برنامه‌های پخت', icon: Calculator },
];
</script>

<template>
  <div class="space-y-6">
    <!-- هدر -->
    <div class="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="p-3 bg-purple-50 text-purple-700 rounded-2xl">
          <BarChart3 class="w-6 h-6" />
        </div>
        <div>
          <h2 class="text-base font-black text-slate-900">گزارش‌گیری</h2>
          <p class="text-[11px] text-slate-500">صورتحساب مشتری و عملکرد آشپزخانه در دوره انتخابی — همه تاریخ‌ها هجری شمسی با تقویم بازشو</p>
        </div>
      </div>
    </div>

    <!-- تب‌ها — وقتی از ساید‌بار با زیربخش مشخص وارد شده، پنهان می‌شود -->
    <div v-if="showTabs" class="bg-white rounded-2xl border border-slate-200 p-2 flex gap-1.5 overflow-x-auto">
      <button
        v-for="t in TABS"
        :key="t.id"
        :class="tab === t.id ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'"
        class="px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition"
        @click="tab = t.id"
      >
        <component :is="t.icon" class="w-4 h-4" /> {{ t.label }}
      </button>
    </div>

    <!-- تب صورتحساب مشتری -->
    <div v-if="tab === 'customer'" class="space-y-4">
      <div class="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div class="sm:col-span-2">
            <label class="block text-xs font-bold text-slate-700 mb-1.5">انتخاب مشتری: <span class="text-rose-500">*</span></label>
            <SearchableSelect
              v-model="custId"
              placeholder="-- انتخاب مشتری --"
              search-placeholder="جستجوی نام یا شماره موبایل..."
              :options="store.customers.map((c) => ({
                value: c.id,
                label: `${c.firstName} ${c.lastName} — ${toFa(c.mobile)}`,
                searchText: `${c.firstName} ${c.lastName} ${c.mobile} ${c.address || ''}`,
              }))"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">از تاریخ:</label>
            <JalaliDatePicker v-model="custFrom" placeholder="ابتدای دوره" :max-date="custTo" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">تا تاریخ:</label>
            <JalaliDatePicker v-model="custTo" placeholder="انتهای دوره" :min-date="custFrom" />
          </div>
        </div>
        <div v-if="custInvoices.length > 0" class="flex flex-wrap gap-2 pt-1">
          <button class="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-purple-600/20" @click="printTarget = 'customer'">
            <Printer class="w-4 h-4" /> چاپ صورتحساب
          </button>
          <ExportButtons
            :filename="`صورتحساب-${cust?.lastName || 'مشتری'}`"
            :title="`صورتحساب ${cust ? cust.firstName + ' ' + cust.lastName : ''}`"
            :subtitle="`بازه: ${custFrom ? faDate(custFrom) : 'ابتدا'} تا ${custTo ? faDate(custTo) : 'امروز'}`"
            :headers="['ردیف', 'شماره فاکتور', 'تاریخ', 'ساعت', 'اقلام', 'پرس', 'مبلغ', 'تخفیف', 'مالیات', 'نهایی', 'ثبت‌کننده']"
            :rows="custInvoices.map((inv, i) => [
              i + 1,
              inv.id,
              inv.date,
              inv.time,
              inv.items.map((it) => `${it.dishName} (${it.count})`).join(' + '),
              inv.items.reduce((s, it) => s + it.count, 0),
              inv.subtotal,
              inv.discountAmount || 0,
              inv.isTaxable ? inv.taxAmount : 0,
              inv.finalTotal,
              inv.createdBy || '—',
            ])"
            :font-family="store.settings?.reportFont || 'Vazirmatn'"
          />
        </div>
      </div>

      <!-- جدول صورتحساب -->
      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div class="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <h3 class="text-sm font-black text-slate-800">
            صورتحساب {{ cust ? `${cust.firstName} ${cust.lastName}` : '(مشتری انتخاب نشده)' }}
          </h3>
          <span class="text-[11px] text-slate-500">
            بازه: {{ custFrom ? faDate(custFrom) : 'ابتدا' }} تا {{ custTo ? faDate(custTo) : 'امروز' }}
          </span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-right text-xs">
            <thead class="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
              <tr>
                <th class="p-3 w-12 text-center">ردیف</th>
                <th class="p-3">شماره فاکتور</th>
                <th class="p-3">تاریخ</th>
                <th class="p-3">ساعت</th>
                <th class="p-3">اقلام</th>
                <th class="p-3 text-center">پرس</th>
                <th class="p-3 text-left">مبلغ</th>
                <th class="p-3 text-left">تخفیف</th>
                <th class="p-3 text-left">مالیات</th>
                <th class="p-3 text-left">نهایی</th>
                <th class="p-3">ثبت‌کننده</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <EmptyRow v-if="custInvoices.length === 0" :col-span="11" :text="custId ? 'فاکتوری در این بازه یافت نشد' : 'ابتدا مشتری را انتخاب کنید'" />
              <tr v-for="(inv, idx) in custInvoices" v-else :key="inv.id" class="hover:bg-slate-50">
                <td class="p-3 text-center font-bold text-slate-500">{{ toFa(idx + 1) }}</td>
                <td class="p-3 font-black text-slate-800">{{ toFa(inv.id) }}</td>
                <td class="p-3 text-slate-600">{{ faDate(inv.date) }}</td>
                <td class="p-3 text-slate-500">{{ toFa(inv.time) }}</td>
                <td class="p-3 text-slate-600 max-w-[240px] truncate">{{ inv.items.map((it) => `${it.dishName} (${toFa(it.count)})`).join(' + ') }}</td>
                <td class="p-3 text-center font-bold text-emerald-800">{{ toFa(inv.items.reduce((s, it) => s + it.count, 0)) }}</td>
                <td class="p-3 text-left">{{ formatMoney(inv.subtotal) }}</td>
                <td class="p-3 text-left text-sky-700">{{ inv.discountAmount ? formatMoney(inv.discountAmount) : '—' }}</td>
                <td class="p-3 text-left text-amber-700">{{ inv.isTaxable ? formatMoney(inv.taxAmount) : 'معاف' }}</td>
                <td class="p-3 text-left font-black text-emerald-800">{{ formatMoney(inv.finalTotal) }}</td>
                <td class="p-3 text-slate-600">{{ inv.createdBy || '—' }}</td>
              </tr>
            </tbody>
            <tfoot v-if="custInvoices.length > 0" class="bg-purple-50 font-black text-xs border-t-2 border-purple-500">
              <tr>
                <td colspan="6" class="p-3">جمع کل ({{ toFa(custTotals.count) }} فاکتور):</td>
                <td class="p-3 text-center text-purple-900">{{ toFa(custTotals.portions) }}</td>
                <td class="p-3 text-left">{{ formatMoney(custTotals.subtotal) }}</td>
                <td class="p-3 text-left">{{ formatMoney(custTotals.discount) }}</td>
                <td class="p-3 text-left">{{ formatMoney(custTotals.tax) }}</td>
                <td class="p-3 text-left text-purple-900">{{ formatMoney(custTotals.grand) }} تومان</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>

    <!-- تب عملکرد آشپزخانه -->
    <div v-if="tab === 'performance'" class="space-y-4">
      <div class="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div class="sm:col-span-2">
            <label class="block text-xs font-bold text-slate-700 mb-1.5">دوره گزارش:</label>
            <div class="bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-black text-slate-700">
              {{ perfFrom ? faDatePretty(perfFrom) : 'ابتدای فعالیت' }} — {{ perfTo ? faDatePretty(perfTo) : 'امروز' }}
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">از تاریخ:</label>
            <JalaliDatePicker v-model="perfFrom" placeholder="ابتدای دوره" :max-date="perfTo" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">تا تاریخ:</label>
            <JalaliDatePicker v-model="perfTo" placeholder="انتهای دوره" :min-date="perfFrom" />
          </div>
        </div>
        <div v-if="perfInvoices.length > 0" class="flex flex-wrap gap-2">
          <button class="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-purple-600/20" @click="printTarget = 'performance'">
            <Printer class="w-4 h-4" /> چاپ گزارش عملکرد
          </button>
          <ExportButtons
            filename="گزارش-عملکرد-آشپزخانه"
            title="گزارش عملکرد آشپزخانه"
            :subtitle="`دوره: ${perfFrom ? faDate(perfFrom) : 'ابتدا'} تا ${perfTo ? faDate(perfTo) : 'امروز'}`"
            :headers="['ردیف', 'نام غذا', 'تعداد پرس', 'سهم از کل (٪)', 'جمع مبلغ (تومان)']"
            :rows="dishStats.map((d, i) => [
              i + 1,
              d.name,
              d.count,
              perfTotals.portions ? Math.round((d.count / perfTotals.portions) * 100) : 0,
              d.amount,
            ])"
            :font-family="store.settings?.reportFont || 'Vazirmatn'"
          />
        </div>
      </div>

      <!-- کارت‌های آماری -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div v-for="c in [
          { label: 'تعداد فاکتور', value: toFa(perfTotals.count), unit: 'فاکتور', color: 'text-slate-900' },
          { label: 'جمع پرس', value: toFa(perfTotals.portions), unit: 'پرس', color: 'text-emerald-800' },
          { label: 'جمع تخفیف', value: formatMoney(perfTotals.discount), unit: 'تومان', color: 'text-sky-700' },
          { label: 'درآمد نهایی', value: formatMoney(perfTotals.grand), unit: 'تومان', color: 'text-purple-800' },
        ]" :key="c.label" class="bg-white rounded-2xl border border-slate-200 p-4 space-y-1">
          <div class="text-[11px] text-slate-500 font-bold">{{ c.label }}</div>
          <div class="text-xl font-black flex items-baseline gap-1" :class="c.color">
            {{ c.value }} <span class="text-[10px] font-bold text-slate-400">{{ c.unit }}</span>
          </div>
        </div>
      </div>

      <!-- تفکیک غذاها با هزینه تمام‌شده و سود -->
      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div class="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <h3 class="text-sm font-black text-slate-800">تفکیک فروش، هزینه تمام‌شده و سود بر اساس غذا</h3>
          <span class="text-[10px] font-bold text-slate-500">سربار هر پرس: {{ formatMoney(overheadPerPortion.perPortion) }} تومان</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-right text-xs">
            <thead class="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
              <tr>
                <th class="p-3 w-12 text-center">ردیف</th>
                <th class="p-3">نام غذا</th>
                <th class="p-3 text-center">تعداد پرس</th>
                <th class="p-3 text-left">فروش (تومان)</th>
                <th class="p-3 text-left">هزینه تمام‌شده</th>
                <th class="p-3 text-left">قیمت فروش</th>
                <th class="p-3 text-left">سود</th>
                <th class="p-3 text-center">حاشیه سود</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <EmptyRow v-if="dishStats.length === 0" :col-span="8" text="داده‌ای در این بازه وجود ندارد" />
              <tr v-for="(d, idx) in dishStats" v-else :key="d.name" class="hover:bg-slate-50">
                <td class="p-3 text-center font-bold text-slate-500">{{ toFa(idx + 1) }}</td>
                <td class="p-3 font-black text-slate-800">{{ d.name }}</td>
                <td class="p-3 text-center font-bold text-emerald-800">{{ toFa(d.count) }}</td>
                <td class="p-3 text-left font-black">{{ formatMoney(d.amount) }}</td>
                <td class="p-3 text-left font-bold text-rose-700">{{ formatMoney(d.unitCost * d.count) }}</td>
                <td class="p-3 text-left font-bold text-slate-600">{{ d.count ? formatMoney(Math.round(d.amount / d.count)) : '—' }}</td>
                <td class="p-3 text-left font-black" :class="(d.amount - d.unitCost * d.count) >= 0 ? 'text-emerald-700' : 'text-rose-700'">{{ formatMoney(d.amount - d.unitCost * d.count) }}</td>
                <td class="p-3 text-center">
                  <span class="px-2 py-1 rounded-full text-[10px] font-black" :class="((d.amount ? Math.round(((d.amount - d.unitCost * d.count) / d.amount) * 100) : 0) >= 0) ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'">
                    {{ toFa(d.amount ? Math.round(((d.amount - d.unitCost * d.count) / d.amount) * 100) : 0) }}٪
                  </span>
                </td>
              </tr>
            </tbody>
            <tfoot v-if="dishStats.length > 0" class="bg-slate-50 font-black text-xs border-t-2 border-slate-400">
              <tr>
                <td colspan="3" class="p-3">جمع کل:</td>
                <td class="p-3 text-left">{{ formatMoney(perfFooter.totalSales) }}</td>
                <td class="p-3 text-left text-rose-700">{{ formatMoney(perfFooter.totalCostAll) }}</td>
                <td></td>
                <td class="p-3 text-left" :class="perfFooter.totalProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'">{{ formatMoney(perfFooter.totalProfit) }}</td>
                <td class="p-3 text-center">{{ perfFooter.totalSales ? toFa(Math.round((perfFooter.totalProfit / perfFooter.totalSales) * 100)) + '٪' : '—' }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>

    <!-- تب گزارش خرید -->
    <div v-if="tab === 'purchase'" class="space-y-4">
      <div class="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div class="sm:col-span-2">
            <label class="block text-xs font-bold text-slate-700 mb-1.5">انتخاب نام فروشنده: <span class="text-rose-500">*</span></label>
            <SearchableSelect
              v-model="purSupplierId"
              placeholder="-- انتخاب فروشنده --"
              search-placeholder="جستجوی نام یا موبایل فروشنده..."
              :options="store.customers.map((c) => ({
                value: c.id,
                label: `${c.firstName} ${c.lastName} — ${toFa(c.mobile || '-')}`,
                searchText: `${c.firstName} ${c.lastName} ${c.mobile || ''} فروشنده`,
              }))"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">از تاریخ:</label>
            <JalaliDatePicker v-model="purFrom" placeholder="ابتدای دوره" :max-date="purTo" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">تا تاریخ:</label>
            <JalaliDatePicker v-model="purTo" placeholder="انتهای دوره" :min-date="purFrom" />
          </div>
        </div>
        <div v-if="purchaseRows.length > 0" class="flex flex-wrap gap-2 pt-1">
          <button class="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-purple-600/20" @click="printTarget = 'purchase'">
            <Printer class="w-4 h-4" /> چاپ گزارش خرید
          </button>
          <ExportButtons
            :filename="`گزارش-خرید-${purSupplier?.lastName || 'فروشنده'}`"
            :title="`گزارش خرید از ${purSupplier ? purSupplier.firstName + ' ' + purSupplier.lastName : ''}`"
            :subtitle="`بازه: ${purFrom ? faDate(purFrom) : 'ابتدا'} تا ${purTo ? faDate(purTo) : 'امروز'}`"
            :headers="['ردیف', 'تاریخ', 'ساعت', 'ماده غذایی', 'مقدار', 'واحد', 'شرح', 'تحویل‌دهنده']"
            :rows="purchaseRows.map((m, i) => [i + 1, m.date, m.time, m.name, m.qty, m.unit, m.desc, m.person])"
            :font-family="store.settings?.reportFont || 'Vazirmatn'"
          />
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div class="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <h3 class="text-sm font-black text-slate-800">
            گزارش خرید از {{ purSupplier ? `${purSupplier.firstName} ${purSupplier.lastName}` : '(فروشنده انتخاب نشده)' }}
          </h3>
          <span class="text-[11px] text-slate-500">
            بازه: {{ purFrom ? faDate(purFrom) : 'ابتدا' }} تا {{ purTo ? faDate(purTo) : 'امروز' }}
          </span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-right text-xs">
            <thead class="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
              <tr>
                <th class="p-3 w-12 text-center">ردیف</th>
                <th class="p-3">تاریخ</th>
                <th class="p-3">ساعت</th>
                <th class="p-3">ماده غذایی</th>
                <th class="p-3 text-center">مقدار</th>
                <th class="p-3">شرح / فاکتور خرید</th>
                <th class="p-3">تحویل‌دهنده</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <EmptyRow v-if="!purSupplierId" :col-span="7" text="ابتدا نام فروشنده را انتخاب کنید" />
              <EmptyRow v-else-if="purchaseRows.length === 0" :col-span="7" text="خریدی از این فروشنده در این بازه ثبت نشده است" />
              <tr v-for="(m, idx) in purchaseRows" v-else :key="m.id" class="hover:bg-slate-50">
                <td class="p-3 text-center font-bold text-slate-500">{{ toFa(idx + 1) }}</td>
                <td class="p-3 text-slate-700">{{ faDate(m.date) }}</td>
                <td class="p-3 text-slate-500">{{ toFa(m.time) }}</td>
                <td class="p-3 font-black text-slate-800">{{ m.name }}</td>
                <td class="p-3 text-center font-black text-emerald-700">{{ toFa(m.qty) }} {{ m.unit }}</td>
                <td class="p-3 text-slate-600">{{ m.desc }}</td>
                <td class="p-3 text-slate-600">{{ m.person }}</td>
              </tr>
            </tbody>
            <tfoot v-if="purchaseRows.length > 0" class="bg-purple-50 font-black text-xs border-t-2 border-purple-500">
              <tr>
                <td colspan="3" class="p-3">جمع کل ({{ toFa(purchaseRows.length) }} فاکتور خرید):</td>
                <td class="p-3">{{ toFa(purchaseByItem.length) }} قلم ماده</td>
                <td class="p-3 text-center text-purple-900">—</td>
                <td colspan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- خلاصه جمع اقلام خریداری‌شده -->
      <div v-if="purchaseByItem.length > 0" class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div class="p-4 border-b border-slate-100">
          <h3 class="text-sm font-black text-slate-800">جمع خرید هر قلم در این دوره</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-right text-xs">
            <thead class="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
              <tr>
                <th class="p-3 w-12 text-center">ردیف</th>
                <th class="p-3">ماده غذایی</th>
                <th class="p-3 text-center">تعداد خرید</th>
                <th class="p-3 text-center">جمع مقدار</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(p, idx) in purchaseByItem" :key="p.name" class="hover:bg-slate-50">
                <td class="p-3 text-center font-bold text-slate-500">{{ toFa(idx + 1) }}</td>
                <td class="p-3 font-black text-slate-800">{{ p.name }}</td>
                <td class="p-3 text-center">{{ toFa(p.count) }}</td>
                <td class="p-3 text-center font-black text-emerald-700">{{ toFa(p.qty) }} {{ p.unit }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- تب قیمت تمام شده غذاها -->
    <div v-if="tab === 'cost'" class="space-y-4">
      <!-- فرم درصد سود و اطلاعات سربار -->
      <div class="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">درصد سود: <span class="text-rose-500">*</span></label>
            <div class="flex items-center gap-2">
              <FaNumberInput v-model="profitPercent" :class="`${inputCls} w-28 text-center font-black`" />
              <span class="text-sm font-black text-slate-700">٪</span>
            </div>
            <p class="text-[10px] text-slate-500 mt-1.5">
              قیمت فروش پیشنهادی = قیمت تمام شده × (۱ + درصد سود)
            </p>
          </div>
          <div class="bg-teal-50 border border-teal-200 rounded-2xl p-3.5 text-[11px] space-y-1">
            <div class="font-black text-teal-900">سربار ماهانه: {{ formatMoney(overheadPerPortion.total) }} تومان</div>
            <div class="text-teal-800">پرس‌های ماه جاری: {{ toFa(overheadPerPortion.portions) }} پرس</div>
            <div class="font-black text-teal-900">سربار هر پرس: {{ formatMoney(overheadPerPortion.perPortion) }} تومان</div>
          </div>
          <div class="bg-sky-50 border border-sky-200 rounded-2xl p-3.5 text-[11px] text-sky-900 font-bold leading-relaxed">
            قیمت فروش دستی هر غذا را در ستون «قیمت فروش» وارد کنید؛ مقدار واردشده در جدول تعریف غذا ذخیره می‌شود و در صدور فاکتور استفاده می‌گردد.
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <ExportButtons
            filename="قیمت-تمام-شده-غذاها"
            title="قیمت تمام شده غذاهای موجود"
            :subtitle="`درصد سود: ${profitPercent}٪ — سربار هر پرس: ${overheadPerPortion.perPortion} تومان`"
            :headers="['ردیف', 'نام غذا', 'هزینه مواد', 'سربار پرس', 'قیمت تمام شده', 'قیمت فروش پیشنهادی', 'قیمت فروش فعلی']"
            :rows="costRows.map((c, i) => [i + 1, c.dish.name, c.materialCost, c.overhead, c.totalCost, c.suggestedPrice, c.currentPrice])"
            :font-family="store.settings?.reportFont || 'Vazirmatn'"
          />
        </div>
      </div>

      <!-- جدول قیمت تمام شده -->
      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div class="p-4 border-b border-slate-100">
          <h3 class="text-sm font-black text-slate-800">قیمت تمام شده برای غذاهای موجود</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-right text-xs">
            <thead class="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
              <tr>
                <th class="p-3 w-12 text-center">ردیف</th>
                <th class="p-3">نام غذا</th>
                <th class="p-3 text-left">هزینه مواد اولیه</th>
                <th class="p-3 text-left">سربار</th>
                <th class="p-3 text-left">قیمت تمام شده</th>
                <th class="p-3 text-left">قیمت فروش پیشنهادی ({{ toFa(profitPercent || 0) }}٪)</th>
                <th class="p-3 text-center w-40">قیمت فروش (دستی)</th>
                <th class="p-3 text-center">رسپی</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <EmptyRow v-if="costRows.length === 0" :col-span="8" text="غذایی تعریف نشده است" />
              <tr v-for="(c, idx) in costRows" v-else :key="c.dish.id" class="hover:bg-slate-50">
                <td class="p-3 text-center font-bold text-slate-500">{{ toFa(idx + 1) }}</td>
                <td class="p-3 font-black text-slate-800">{{ c.dish.name }}</td>
                <td class="p-3 text-left font-bold">{{ formatMoney(c.materialCost) }}</td>
                <td class="p-3 text-left text-slate-600">{{ formatMoney(c.overhead) }}</td>
                <td class="p-3 text-left font-black text-rose-700">{{ formatMoney(c.totalCost) }}</td>
                <td class="p-3 text-left font-black text-emerald-700">{{ formatMoney(c.suggestedPrice) }}</td>
                <td class="p-3 text-center">
                  <MoneyInput
                    :model-value="salePrices[c.dish.id] !== undefined ? salePrices[c.dish.id] : String(c.currentPrice)"
                    class="w-32 mx-auto text-center py-1.5 border border-slate-200 rounded-lg bg-white font-black text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="قیمت"
                    @update:model-value="(v) => saveSalePrice(c.dish.id, v)"
                    @blur="commitSalePrice(c.dish.id)"
                  />
                </td>
                <td class="p-3 text-center">
                  <span v-if="c.recipe" class="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">{{ toFa(c.recipe.items.length) }} ماده</span>
                  <span v-else class="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">بدون رسپی</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- تب تخفیف‌های ارائه‌شده -->
    <div v-if="tab === 'discounts'" class="space-y-4">
      <!-- فیلترها -->
      <div class="bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1">مشتری:</label>
          <SearchableSelect
            v-model="discCustFilter"
            :options="[{ value: '', label: 'همه مشتریان' }, ...store.customers.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))]"
            placeholder="-- همه --"
          />
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1">از تاریخ:</label>
          <JalaliDatePicker v-model="discFrom" />
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1">تا تاریخ:</label>
          <JalaliDatePicker v-model="discTo" />
        </div>
        <div class="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
          <div class="text-[10px] font-bold text-amber-700">مجموع تخفیف دوره</div>
          <div class="text-lg font-black text-amber-900 tabular-nums">{{ formatMoney(totalDiscount) }}</div>
        </div>
      </div>

      <!-- خلاصه به تفکیک مشتری -->
      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div class="p-4 border-b border-slate-100"><h3 class="text-sm font-black text-slate-800">مجموع تخفیف به تفکیک مشتری</h3></div>
        <table class="w-full text-right text-xs">
          <thead class="bg-slate-50 font-black text-slate-700 border-b border-slate-200">
            <tr><th class="p-3">مشتری</th><th class="p-3 text-center">تعداد فاکتور</th><th class="p-3 text-left">مجموع تخفیف</th></tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="byCustomer.length === 0"><td colspan="3" class="p-6 text-center text-slate-400 font-bold">تخفیفی در این دوره ثبت نشده</td></tr>
            <tr v-for="c in byCustomer" v-else :key="c.name" class="hover:bg-slate-50">
              <td class="p-3 font-black text-slate-800">{{ c.name }}</td>
              <td class="p-3 text-center">{{ toFa(c.count) }}</td>
              <td class="p-3 text-left font-black text-rose-600 tabular-nums">{{ formatMoney(c.total) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ریز تخفیف‌ها -->
      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div class="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <h3 class="text-sm font-black text-slate-800">ریز تخفیف‌ها ({{ toFa(discountRows.length) }} فاکتور)</h3>
          <ExportButtons
            v-if="discountRows.length > 0"
            filename="تخفیف‌های-ارائه‌شده"
            title="گزارش تخفیف‌های ارائه‌شده"
            subtitle=""
            :headers="['شماره فاکتور', 'تاریخ', 'مشتری', 'درصد تخفیف', 'مبلغ تخفیف', 'مبلغ نهایی']"
            :rows="discountRows.map((inv) => [
              inv.id, inv.date,
              `${inv.customer.firstName} ${inv.customer.lastName}`,
              toFa(inv.discountPercent || 0) + '٪',
              inv.discountAmount || 0,
              inv.finalTotal,
            ])"
          />
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-right text-xs">
            <thead class="bg-slate-50 font-black text-slate-700 border-b border-slate-200">
              <tr>
                <th class="p-3">شماره فاکتور</th>
                <th class="p-3">تاریخ</th>
                <th class="p-3">مشتری</th>
                <th class="p-3 text-center">درصد</th>
                <th class="p-3 text-left">مبلغ تخفیف</th>
                <th class="p-3 text-left">مبلغ نهایی</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="discountRows.length === 0"><td colspan="6" class="p-6 text-center text-slate-400 font-bold">موردی یافت نشد</td></tr>
              <tr v-for="inv in discountRows" v-else :key="inv.id" class="hover:bg-slate-50">
                <td class="p-3 font-black text-slate-700" dir="ltr">{{ toFa(inv.id) }}</td>
                <td class="p-3 text-slate-600">{{ toFa(inv.date) }}</td>
                <td class="p-3 font-bold text-slate-800">{{ inv.customer.firstName }} {{ inv.customer.lastName }}</td>
                <td class="p-3 text-center">{{ toFa(inv.discountPercent || 0) }}٪</td>
                <td class="p-3 text-left font-black text-rose-600 tabular-nums">{{ formatMoney(inv.discountAmount) }}</td>
                <td class="p-3 text-left font-black tabular-nums">{{ formatMoney(inv.finalTotal) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- تب لیست درخواست‌های خرید -->
    <div v-if="tab === 'purchaseRequests'" class="space-y-4">
      <div class="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
        <div class="p-3 bg-amber-50 text-amber-700 rounded-2xl"><ShoppingCart class="w-6 h-6" /></div>
        <div class="flex-1">
          <h2 class="text-base font-black text-slate-900">لیست درخواست‌های خرید</h2>
          <p class="text-[11px] text-slate-500">مقادیر درخواست‌شده، تاییدشده و تحویل‌گرفته به همراه توضیحات انباردار</p>
        </div>
        <span class="text-[11px] font-black text-slate-500">{{ toFa(store.purchaseRequests.length) }} درخواست</span>
      </div>

      <div v-if="store.purchaseRequests.length === 0" class="bg-white border border-dashed border-slate-300 rounded-3xl p-12 text-center text-slate-400 text-xs font-bold">درخواست خریدی ثبت نشده است</div>
      <div v-else class="space-y-4">
        <div v-for="r in store.purchaseRequests" :key="r.id" class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div class="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2 text-[11px]">
            <span class="font-black text-slate-800">{{ toFa(r.id) }}</span>
            <span class="px-2 py-0.5 rounded-full font-black text-[9px]" :class="prStatusMeta(r.status).cls">{{ prStatusMeta(r.status).label }}</span>
            <span class="text-slate-500">تاریخ: {{ toFa(r.date) }}</span>
            <span class="text-slate-500">· درخواست‌دهنده: {{ r.requester }}</span>
            <span v-if="r.approvedByUser" class="text-slate-500">· تایید: {{ r.approvedByUser }}</span>
            <span v-if="r.completedBy" class="text-slate-500">· تحویل: {{ r.completedBy }}</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-right text-xs">
              <thead class="bg-slate-50 text-slate-600 font-black border-b border-slate-200">
                <tr>
                  <th class="p-2.5">#</th>
                  <th class="p-2.5">شرح کالا</th>
                  <th class="p-2.5 text-center">درخواست‌شده</th>
                  <th class="p-2.5 text-center">تاییدشده</th>
                  <th class="p-2.5 text-center">تحویل‌گرفته</th>
                  <th class="p-2.5">توضیحات انباردار</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="(it, i) in r.items" :key="i" class="hover:bg-slate-50">
                  <td class="p-2.5 text-slate-400">{{ toFa(i + 1) }}</td>
                  <td class="p-2.5 font-bold text-slate-700">{{ it.name }}</td>
                  <td class="p-2.5 text-center font-black">{{ toFa(it.qty) }} {{ it.unit }}</td>
                  <td class="p-2.5 text-center">
                    <span v-if="it.decision === 'reject'" class="text-rose-600 font-black">رد شد</span>
                    <span v-else class="text-emerald-700 font-black">{{ toFa(it.qty) }} {{ it.unit }}</span>
                  </td>
                  <td class="p-2.5 text-center font-black text-sky-700">
                    {{ it.receivedQty !== undefined ? `${toFa(it.receivedQty)} ${it.unit}` : '—' }}
                  </td>
                  <td class="p-2.5 text-slate-600">
                    {{ it.deliveryNote || '—' }}<span v-if="it.deliveredBy" class="text-[9px] text-slate-400"> ({{ it.deliveredBy }})</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- تب گزارش برنامه‌های پخت -->
    <div v-if="tab === 'cookplans'" class="space-y-4">
      <div class="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
        <div class="p-3 bg-teal-50 text-teal-700 rounded-2xl"><Calculator class="w-6 h-6" /></div>
        <div class="flex-1">
          <h2 class="text-base font-black text-slate-900">گزارش تفصیلی برنامه‌های پخت</h2>
          <p class="text-[11px] text-slate-500">غذاها، تعداد پرس، مواد لازم به تفکیک رسپی، وضعیت برنامه و تعیین تکلیف اقلام</p>
        </div>
        <div class="flex gap-2 text-[10px] font-black">
          <span class="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{{ toFa(store.plans.length) }} برنامه</span>
          <span class="px-2.5 py-1 rounded-full bg-teal-100 text-teal-700">{{ toFa(totalPlanPortions) }} پرس</span>
        </div>
      </div>

      <div v-if="store.plans.length === 0" class="bg-white border border-dashed border-slate-300 rounded-3xl p-12 text-center text-slate-400 text-xs font-bold">برنامه پختی ثبت نشده است</div>
      <div v-else>
        <!-- جدول خلاصه — هر برنامه یک ردیف -->
        <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-right text-xs">
              <thead class="bg-slate-50 text-slate-600 font-black border-b border-slate-200">
                <tr>
                  <th class="p-3">#</th>
                  <th class="p-3">تاریخ برنامه</th>
                  <th class="p-3 text-center">وضعیت</th>
                  <th class="p-3">غذاها</th>
                  <th class="p-3 text-center">تعداد پرس</th>
                  <th class="p-3">ثبت‌کننده</th>
                  <th class="p-3 text-center w-36">جزئیات</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="(p, idx) in store.plans" :key="p.id" class="hover:bg-slate-50">
                  <td class="p-3 text-slate-400">{{ toFa(idx + 1) }}</td>
                  <td class="p-3 font-black text-slate-800">
                    {{ faDate(p.date) }}<span v-if="p.date === jalaliTodayString()" class="mr-1 text-[9px] font-black bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">امروز</span>
                  </td>
                  <td class="p-3 text-center">
                    <span class="px-2 py-0.5 rounded-full font-black text-[9px]" :class="planStatusMeta(p.status).cls">{{ planStatusMeta(p.status).label }}</span>
                    <span v-if="p.stockDeducted" class="block text-[9px] text-emerald-600 font-bold mt-0.5">مواد کسر شد</span>
                  </td>
                  <td class="p-3 text-slate-600 max-w-[260px] truncate" :title="planDishesSummary(p)">{{ planDishesSummary(p) }}</td>
                  <td class="p-3 text-center font-black text-teal-700">{{ toFa(p.items.reduce((a, it) => a + it.qty, 0)) }}</td>
                  <td class="p-3 text-slate-500">{{ p.createdBy || '—' }}</td>
                  <td class="p-3 text-center">
                    <button
                      class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black inline-flex items-center gap-1 transition"
                      @click="planDetail = p"
                    >
                      <Eye class="w-3.5 h-3.5" /> مشاهده جزئیات
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- پنجره جزئیات برنامه پخت -->
    <div v-if="planDetail" class="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 overflow-y-auto" @click.self="planDetail = null">
      <div class="bg-white rounded-3xl shadow-2xl w-full max-w-3xl my-auto">
        <div class="p-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div class="flex items-center gap-2 flex-wrap">
            <h3 class="text-sm font-black text-slate-900">جزئیات برنامه پخت {{ faDate(planDetail.date) }}</h3>
            <span class="text-[9px] font-black px-2 py-0.5 rounded-full" :class="detailStatusMeta.cls">{{ detailStatusMeta.label }}</span>
            <span v-if="planDetail.stockDeducted" class="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">مواد کسر شد</span>
          </div>
          <button class="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition" @click="planDetail = null"><X class="w-5 h-5" /></button>
        </div>
        <div class="p-5 space-y-4">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div class="bg-slate-50 rounded-xl p-2.5"><div class="text-slate-400 font-bold">تعداد غذا</div><div class="font-black text-slate-800">{{ toFa(planDetail.items.length) }}</div></div>
            <div class="bg-slate-50 rounded-xl p-2.5"><div class="text-slate-400 font-bold">مجموع پرس</div><div class="font-black text-teal-700">{{ toFa(planDetail.items.reduce((a, it) => a + it.qty, 0)) }}</div></div>
            <div class="bg-slate-50 rounded-xl p-2.5"><div class="text-slate-400 font-bold">ثبت‌کننده</div><div class="font-black text-slate-800">{{ planDetail.createdBy || '—' }}</div></div>
            <div class="bg-slate-50 rounded-xl p-2.5"><div class="text-slate-400 font-bold">قطعی‌کننده</div><div class="font-black text-slate-800">{{ planDetail.finalizedBy || '—' }}</div></div>
          </div>

          <table class="w-full text-right text-xs">
            <thead class="bg-slate-50 text-slate-600 font-black border-b border-slate-200">
              <tr>
                <th class="p-2.5">#</th>
                <th class="p-2.5">غذا</th>
                <th class="p-2.5 text-center">تعداد پرس</th>
                <th class="p-2.5 text-center">وضعیت قلم</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(it, i) in planDetail.items" :key="i" class="hover:bg-slate-50">
                <td class="p-2.5 text-slate-400">{{ toFa(i + 1) }}</td>
                <td class="p-2.5 font-bold text-slate-700">{{ it.dishName }}</td>
                <td class="p-2.5 text-center font-black text-teal-700">{{ toFa(it.qty) }}</td>
                <td class="p-2.5 text-center">
                  <span class="text-[9px] font-black px-2 py-0.5 rounded-full" :class="
                    it.decision === 'approve' ? 'bg-emerald-100 text-emerald-700' :
                    it.decision === 'reject' ? 'bg-rose-100 text-rose-700' :
                    'bg-slate-100 text-slate-500'
                  ">
                    {{ it.decision === 'approve' ? 'تایید شده' : it.decision === 'reject' ? 'رد شده' : 'بلاتکلیف' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          <div class="border-t-2 border-dashed border-slate-200 pt-3">
            <div class="text-[11px] font-black text-teal-800 mb-2">جمع کل مواد لازم این برنامه{{ planDetail.status === 'rejected' ? ' (برنامه رد شده — محاسبه نشده)' : '' }}:</div>
            <div class="overflow-x-auto">
              <table class="w-full text-right text-xs">
                <thead class="bg-teal-50 text-teal-700 font-black border-b border-teal-200">
                  <tr>
                    <th class="p-2.5">#</th>
                    <th class="p-2.5">ماده غذایی</th>
                    <th class="p-2.5 text-left">مقدار لازم</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr v-if="Object.keys(detailNeeds).length === 0"><td colspan="3" class="p-4 text-center text-slate-400 font-bold">ماده‌ای محاسبه نشده (غذاهای این برنامه رسپی ندارند)</td></tr>
                  <tr v-for="(n, ingId, i) in detailNeeds" v-else :key="ingId" class="hover:bg-slate-50">
                    <td class="p-2.5 text-slate-400">{{ toFa(i + 1) }}</td>
                    <td class="p-2.5 font-bold text-slate-700">{{ n.name }}</td>
                    <td class="p-2.5 text-left font-black text-teal-700">{{ toFa(Math.round(n.need * 100) / 100) }} {{ n.unit }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="flex justify-end pt-2 border-t border-slate-100">
            <button class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition border border-slate-200" @click="planDetail = null">بستن</button>
          </div>
        </div>
      </div>
    </div>

    <!-- مودال‌های چاپ -->
    <PrintModal
      v-if="printTarget === 'customer'"
      :open="true"
      :title="`چاپ صورتحساب ${cust ? cust.firstName + ' ' + cust.lastName : ''}`"
      v-model:paper-size="store.paperSize"
      v-model:copies="store.copies"
      :font-family="store.settings.reportFont"
      @close="printTarget = null"
    >
      <div class="space-y-4">
        <div class="text-center border-b-2 border-slate-800 pb-3 space-y-1">
          <h3 class="font-black text-slate-900 text-sm">صورتحساب مشتری — آشپزخانه نسیم</h3>
          <p class="text-[11px] text-slate-600">وابسته به بنیاد خیریه سیدالشهدا (ع)</p>
          <p class="text-[11px] text-slate-700 font-bold">
            مشتری: {{ cust.firstName }} {{ cust.lastName }} — از {{ custFrom ? faDate(custFrom) : 'ابتدا' }} تا {{ custTo ? faDate(custTo) : 'امروز' }}
          </p>
        </div>
        <table class="w-full text-right text-[11px] border border-slate-300">
          <thead class="bg-slate-100 font-bold">
            <tr>
              <th class="p-2 border-l border-slate-200">#</th>
              <th class="p-2 border-l border-slate-200">شماره</th>
              <th class="p-2 border-l border-slate-200">تاریخ</th>
              <th class="p-2 border-l border-slate-200">اقلام</th>
              <th class="p-2 border-l border-slate-200 text-center">پرس</th>
              <th class="p-2 border-l border-slate-200 text-left">مبلغ</th>
              <th class="p-2 border-l border-slate-200 text-left">مالیات</th>
              <th class="p-2 text-left">نهایی</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="(inv, i) in custInvoices" :key="inv.id">
              <td class="p-2 border-l border-slate-100 text-center">{{ toFa(i + 1) }}</td>
              <td class="p-2 border-l border-slate-100">{{ toFa(inv.id) }}</td>
              <td class="p-2 border-l border-slate-100">{{ faDate(inv.date) }}</td>
              <td class="p-2 border-l border-slate-100">{{ inv.items.map((it) => `${it.dishName} (${toFa(it.count)})`).join(' + ') }}</td>
              <td class="p-2 border-l border-slate-100 text-center">{{ toFa(inv.items.reduce((s, it) => s + it.count, 0)) }}</td>
              <td class="p-2 border-l border-slate-100 text-left">{{ formatMoney(inv.subtotal) }}</td>
              <td class="p-2 border-l border-slate-100 text-left">{{ inv.isTaxable ? formatMoney(inv.taxAmount) : 'معاف' }}</td>
              <td class="p-2 text-left font-bold">{{ formatMoney(inv.finalTotal) }}</td>
            </tr>
          </tbody>
          <tfoot class="bg-slate-100 font-black">
            <tr>
              <td colspan="4" class="p-2">جمع کل:</td>
              <td class="p-2 text-center">{{ toFa(custTotals.portions) }}</td>
              <td class="p-2 text-left">{{ formatMoney(custTotals.subtotal) }}</td>
              <td class="p-2 text-left">{{ formatMoney(custTotals.tax) }}</td>
              <td class="p-2 text-left">{{ formatMoney(custTotals.grand) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </PrintModal>

    <PrintModal
      v-if="printTarget === 'performance'"
      :open="true"
      title="چاپ گزارش عملکرد آشپزخانه"
      v-model:paper-size="store.paperSize"
      v-model:copies="store.copies"
      :font-family="store.settings.reportFont"
      @close="printTarget = null"
    >
      <div class="space-y-4">
        <div class="text-center border-b-2 border-slate-800 pb-3 space-y-1">
          <h3 class="font-black text-slate-900 text-sm">گزارش عملکرد آشپزخانه نسیم</h3>
          <p class="text-[11px] text-slate-600">وابسته به بنیاد خیریه سیدالشهدا (ع)</p>
          <p class="text-[11px] text-slate-700 font-bold">
            دوره: {{ perfFrom ? faDate(perfFrom) : 'ابتدای فعالیت' }} تا {{ perfTo ? faDate(perfTo) : 'امروز' }}
          </p>
        </div>

        <div class="grid grid-cols-2 gap-3 text-[11px]">
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
            <div class="flex justify-between"><span>تعداد فاکتور:</span><strong>{{ toFa(perfTotals.count) }}</strong></div>
            <div class="flex justify-between"><span>جمع پرس:</span><strong>{{ toFa(perfTotals.portions) }}</strong></div>
          </div>
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
            <div class="flex justify-between"><span>جمع تخفیف:</span><strong>{{ formatMoney(perfTotals.discount) }}</strong></div>
            <div class="flex justify-between"><span>درآمد نهایی:</span><strong>{{ formatMoney(perfTotals.grand) }} تومان</strong></div>
          </div>
        </div>

        <table class="w-full text-right text-[11px] border border-slate-300">
          <thead class="bg-slate-100 font-bold">
            <tr>
              <th class="p-2 border-l border-slate-200">#</th>
              <th class="p-2 border-l border-slate-200">غذا</th>
              <th class="p-2 border-l border-slate-200 text-center">پرس</th>
              <th class="p-2 border-l border-slate-200 text-center">سهم</th>
              <th class="p-2 text-left">جمع مبلغ</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="(d, i) in dishStats" :key="d.name">
              <td class="p-2 border-l border-slate-100 text-center">{{ toFa(i + 1) }}</td>
              <td class="p-2 border-l border-slate-100">{{ d.name }}</td>
              <td class="p-2 border-l border-slate-100 text-center">{{ toFa(d.count) }}</td>
              <td class="p-2 border-l border-slate-100 text-center">{{ toFa(perfTotals.portions ? Math.round((d.count / perfTotals.portions) * 100) : 0) }}٪</td>
              <td class="p-2 text-left">{{ formatMoney(d.amount) }}</td>
            </tr>
          </tbody>
          <tfoot class="bg-slate-100 font-black">
            <tr>
              <td colspan="2" class="p-2">جمع:</td>
              <td class="p-2 text-center">{{ toFa(perfTotals.portions) }}</td>
              <td class="p-2"></td>
              <td class="p-2 text-left">{{ formatMoney(perfTotals.subtotal) }} تومان</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </PrintModal>

    <PrintModal
      v-if="printTarget === 'purchase' && purSupplier"
      :open="true"
      :title="`چاپ گزارش خرید از ${purSupplier.firstName} ${purSupplier.lastName}`"
      v-model:paper-size="store.paperSize"
      v-model:copies="store.copies"
      :font-family="store.settings.reportFont"
      @close="printTarget = null"
    >
      <div class="space-y-4">
        <div class="text-center border-b-2 border-slate-800 pb-3 space-y-1">
          <h3 class="font-black text-slate-900 text-sm">گزارش خرید — آشپزخانه نسیم</h3>
          <p class="text-[11px] text-slate-600">وابسته به بنیاد خیریه سیدالشهدا (ع)</p>
          <p class="text-[11px] text-slate-700 font-bold">
            فروشنده: {{ purSupplier.firstName }} {{ purSupplier.lastName }} — از {{ purFrom ? faDate(purFrom) : 'ابتدا' }} تا {{ purTo ? faDate(purTo) : 'امروز' }}
          </p>
        </div>
        <table class="w-full text-right text-[11px] border border-slate-300">
          <thead class="bg-slate-100 font-bold">
            <tr>
              <th class="p-2 border-l border-slate-200">#</th>
              <th class="p-2 border-l border-slate-200">تاریخ</th>
              <th class="p-2 border-l border-slate-200">ماده غذایی</th>
              <th class="p-2 border-l border-slate-200 text-center">مقدار</th>
              <th class="p-2">شرح</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="(m, i) in purchaseRows" :key="m.id">
              <td class="p-2 border-l border-slate-100 text-center">{{ toFa(i + 1) }}</td>
              <td class="p-2 border-l border-slate-100">{{ faDate(m.date) }}</td>
              <td class="p-2 border-l border-slate-100 font-bold">{{ m.name }}</td>
              <td class="p-2 border-l border-slate-100 text-center font-bold text-emerald-700">{{ toFa(m.qty) }} {{ m.unit }}</td>
              <td class="p-2">{{ m.desc }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="purchaseByItem.length > 0" class="pt-2 border-t border-dashed border-slate-300">
          <div class="font-black text-[11px] mb-2 text-slate-700">جمع خرید هر قلم:</div>
          <div class="grid grid-cols-2 gap-2 text-[11px]">
            <div v-for="p in purchaseByItem" :key="p.name" class="flex justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <span class="font-bold">{{ p.name }}</span>
              <span class="font-black text-emerald-700">{{ toFa(p.qty) }} {{ p.unit }}</span>
            </div>
          </div>
        </div>
      </div>
    </PrintModal>
  </div>
</template>
