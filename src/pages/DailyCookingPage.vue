<script setup>
/**
 * برنامه پخت روزانه — معادل DailyCookingPage.jsx
 * - ثبت غذاهای روز + تعداد پخت (کاربر عادی/ادمین)
 * - محاسبه خودکار مواد مصرفی بر اساس رسپی و نمایش کسری با رنگ متمایز
 * - درخواست موقت می‌ماند تا کسری جبران شود؛ سپس قطعی و کسر از انبار (اختیاری/دستی)
 * - برنامه‌گذشته برای روزهای آینده تا ۷ روز؛ کنترل موجودی در هر بازشدن
 * - ویرایش/حذف تا قبل از صدور فاکتور آن تاریخ؛ پس از فاکتور فقط حذف غذای خاص (با تأیید)
 */
import { ref, computed } from 'vue';
import {
  CalendarClock, Plus, Trash2, AlertTriangle, CheckCircle2, Pencil, XCircle,
  Clock3, CheckCheck, PackageX, PackagePlus,
} from 'lucide-vue-next';
import { toFa, nowTime, jalaliTodayString, jalaliOffsetString, faDatePretty, userDisplay, auditEntry } from '../lib/utils.js';
import { useAppStore } from '../stores/app.js';
import NumberSpinner from '../components/ui/NumberSpinner.vue';
import Modal from '../components/ui/Modal.vue';
import SearchableSelect from '../components/SearchableSelect.vue';
import JalaliDatePicker from '../components/JalaliDatePicker.vue';

const props = defineProps({
  showToast: { type: Function, required: true },
  userName: { type: String, default: '—' },
  initialTab: { type: String, default: null }, // 'register' | 'drafts' | null (هر دو)
  showTabs: { type: Boolean, default: false },
});

const store = useAppStore();

const today = jalaliTodayString();
const maxFuture = jalaliOffsetString(7);

const planDate = ref(today);
const editId = ref(null);
const dishId = ref('');
const qty = ref('1');
const items = ref([]);
const deductStock = ref(true);
const confirmFinalize = ref(null);
const confirmDelete = ref(null);
const confirmRemoveDish = ref(null); // {plan, dishId, dishName}
const viewShortage = ref(null); // {plan, sh}

const recipeOf = (dId) => store.recipes.find((r) => r.dishId === dId) || null;

// ===== محاسبه مواد موردنیاز =====
const calcNeeds = (planItems) => {
  const map = {};
  planItems.forEach((it) => {
    const rec = recipeOf(it.dishId);
    if (!rec) return;
    rec.items.forEach((ri) => {
      if (!map[ri.ingredientId]) map[ri.ingredientId] = { name: ri.name, unit: ri.unit, need: 0 };
      map[ri.ingredientId].need += ri.qty * it.qty;
    });
  });
  return map;
};

// ===== کنترل موجودی لحظه‌ای (با هر بار بازشدن محاسبه می‌شود) =====
const shortageInfo = (planItems) => {
  const needs = calcNeeds(planItems);
  const rows = Object.entries(needs).map(([ingId, n]) => {
    const ing = store.ingredients.find((i) => i.id === ingId);
    const stock = ing ? ing.qty : 0;
    const shortage = Math.max(0, n.need - stock);
    return { ingId, name: n.name, unit: n.unit, need: n.need, stock, shortage, ok: shortage <= 0 };
  });
  return {
    rows: rows.sort((a, b) => (a.ok === b.ok ? b.need - a.need : a.ok ? 1 : -1)),
    hasShortage: rows.some((r) => !r.ok),
  };
};

// غذاهایی که در فاکتورهای یک تاریخ فروخته شده‌اند
const invoiceSoldDishIdsFor = (date) => {
  const s = new Set();
  store.invoices.filter((inv) => inv.date === date).forEach((inv) => inv.items.forEach((it) => s.add(it.dishId)));
  return s;
};

const addToPlan = () => {
  if (!dishId.value) return props.showToast('انتخاب غذا الزامی است', 'error');
  const n = Number(qty.value);
  if (!n || n <= 0) return props.showToast('تعداد پخت باید بیشتر از صفر باشد', 'error');
  const dish = store.dishes.find((d) => d.id === dishId.value);
  const ex = items.value.findIndex((it) => it.dishId === dishId.value);
  if (ex > -1) {
    const upd = [...items.value];
    upd[ex] = { ...upd[ex], qty: upd[ex].qty + n };
    items.value = upd;
    props.showToast('تعداد پخت این غذا افزایش یافت');
  } else {
    items.value = [...items.value, { dishId: dishId.value, dishName: dish.name, qty: n }];
  }
  dishId.value = '';
  qty.value = '1';
};

const removeFormItem = (idx) => {
  items.value = items.value.filter((_, i) => i !== idx);
};

const resetForm = () => {
  editId.value = null;
  planDate.value = today;
  items.value = [];
  deductStock.value = true;
};

const submitPlan = () => {
  if (items.value.length === 0) return props.showToast('حداقل یک غذا به برنامه اضافه کنید', 'error');
  if (!planDate.value) return props.showToast('انتخاب تاریخ الزامی است', 'error');
  // محدودیت ۷ روز آینده
  if (jalaliTodayString() > planDate.value) return props.showToast('برنامه برای گذشته قابل ثبت نیست', 'error');
  if (planDate.value > maxFuture) return props.showToast('برنامه حداکثر برای ۷ روز آینده امکان‌پذیر است', 'error');
  const sh = shortageInfo(items.value);
  const rec = {
    id: `plan_${Date.now().toString(36)}`,
    date: planDate.value,
    items: [...items.value],
    status: 'temp',
    deductStock: deductStock.value,
    createdAt: `${jalaliTodayString()} ${nowTime()}`,
    createdBy: props.userName || '—',
    finalizedAt: null,
    finalizedBy: null,
    stockDeducted: false,
    audit: [auditEntry({ firstName: props.userName?.split(' ')[0], lastName: props.userName?.split(' ').slice(1).join(' '), fullName: props.userName }, 'ثبت برنامه پخت (موقت)')],
  };
  store.plans = [rec, ...store.plans];
  props.showToast(sh.hasShortage
    ? 'برنامه موقت ثبت شد — کسری مواد موجود است؛ پس از جبران، قطعی کنید'
    : 'برنامه موقت ثبت شد — برای کسر از انبار، قطعی کنید');
  resetForm();
};

const startEdit = (p) => {
  if (p.status !== 'temp') return props.showToast('برنامه قطعی‌شده قابل ویرایش نیست', 'error');
  editId.value = p.id;
  planDate.value = p.date;
  items.value = p.items.map((it) => ({ ...it }));
  deductStock.value = p.deductStock !== false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const cancelEdit = () => resetForm();

// ===== قطعی برنامه =====
const doFinalize = (p) => {
  const sh = shortageInfo(p.items);
  if (sh.hasShortage) {
    confirmFinalize.value = null;
    return props.showToast('هنوز کسری مواد وجود دارد؛ ابتدا موجودی را از بخش ورود کالا جبران کنید', 'error');
  }
  let deducted = false;
  if (p.deductStock && !p.stockDeducted) {
    const needs = calcNeeds(p.items);
    store.ingredients = store.ingredients.map((i) => (needs[i.id] ? { ...i, qty: Math.max(0, i.qty - needs[i.id].need) } : i));
    deducted = true;
  }
  store.plans = store.plans.map((x) => (x.id === p.id
    ? { ...x, status: 'final', finalizedAt: `${jalaliTodayString()} ${nowTime()}`, finalizedBy: props.userName || '—', stockDeducted: deducted, audit: [...(x.audit || []), auditEntry({ firstName: props.userName?.split(' ')[0], lastName: props.userName?.split(' ').slice(1).join(' '), fullName: props.userName }, 'قطعی‌سازی برنامه')] }
    : x));
  confirmFinalize.value = null;
  props.showToast(p.deductStock
    ? 'برنامه قطعی شد و مواد از انبار کسر شد'
    : 'برنامه قطعی شد (بدون کسر از انبار — کسر دستی از بخش خروج کالا)');
};

// ===== حذف کل برنامه =====
const doDeletePlan = (p) => {
  const sold = invoiceSoldDishIdsFor(p.date);
  if (sold.size > 0) {
    confirmDelete.value = null;
    return props.showToast('برای تاریخ این برنامه فاکتور صادر شده؛ فقط حذف غذای مشخص مجاز است', 'error');
  }
  if (p.status === 'final' && p.stockDeducted) {
    const needs = calcNeeds(p.items);
    store.ingredients = store.ingredients.map((i) => (needs[i.id] ? { ...i, qty: i.qty + needs[i.id].need } : i));
  }
  store.plans = store.plans.filter((x) => x.id !== p.id);
  confirmDelete.value = null;
  props.showToast('برنامه حذف شد');
};

// ===== حذف یک غذای خاص از برنامه =====
const doRemoveDish = ({ plan, dishId: dId }) => {
  const updatedItems = plan.items.filter((it) => it.dishId !== dId);
  if (plan.status === 'final' && plan.stockDeducted) {
    const before = calcNeeds(plan.items);
    const after = calcNeeds(updatedItems);
    store.ingredients = store.ingredients.map((i) => {
      const d = (before[i.id]?.need || 0) - (after[i.id]?.need || 0);
      return d ? { ...i, qty: i.qty + d } : i;
    });
  }
  if (updatedItems.length === 0) {
    store.plans = store.plans.filter((x) => x.id !== plan.id);
    props.showToast('غذا حذف شد؛ برنامه خالی شد و حذف گردید');
  } else {
    store.plans = store.plans.map((x) => (x.id === plan.id ? { ...x, items: updatedItems } : x));
    props.showToast('غذا از برنامه حذف شد');
  }
  confirmRemoveDish.value = null;
};

const canEdit = (p) => p.status === 'temp';
const canDeletePlan = (p) => invoiceSoldDishIdsFor(p.date).size === 0;

// لیست برنامه‌ها مرتب‌شده + کسری/فاکتور لحظه‌ای هر برنامه (واکنش‌گرا به موجودی انبار)
const sortedPlansView = computed(() => [...store.plans]
  .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0))
  .map((p) => ({
    p,
    sh: shortageInfo(p.items),
    sold: invoiceSoldDishIdsFor(p.date),
  })));

// پیش‌محاسبه کسری فرم جاری (زنده)
const formShortage = computed(() => (items.value.length > 0 ? shortageInfo(items.value) : null));

// کسری لحظه‌ای برنامه‌ی در حال قطعی (زنده — مثل IIFE در نسخه React)
const finalizeShortage = computed(() => (confirmFinalize.value ? shortageInfo(confirmFinalize.value.items) : null));

const addShortageToPurchase = (plan) => {
  const sh = shortageInfo(plan.items);
  if (!sh.hasShortage) return;
  const t = jalaliTodayString();
  const needItems = sh.rows.filter((r) => !r.ok).map((r) => ({
    ingredientId: r.ingId,
    name: r.name,
    unit: r.unit,
    qty: Number((r.need - r.stock).toFixed(3)),
  }));
  if (needItems.length === 0) return props.showToast('کسری وجود ندارد', 'info');

  // check for existing open purchase request for today
  const existingOpen = store.purchaseRequests.find(
    (pr) => pr.date === t && pr.status === 'temp'
  );

  if (existingOpen) {
    // append to existing
    store.purchaseRequests = store.purchaseRequests.map((pr) => {
      if (pr.id !== existingOpen.id) return pr;
      const merged = [...pr.items];
      needItems.forEach((ni) => {
        const exIdx = merged.findIndex((m) => m.ingredientId === ni.ingredientId);
        if (exIdx > -1) {
          merged[exIdx].qty = Number((merged[exIdx].qty + ni.qty).toFixed(3));
        } else {
          merged.push({ ...ni });
        }
      });
      return { ...pr, items: merged, date: t }; // update date to today
    });
    props.showToast(`${toFa(needItems.length)} قلم کسری به درخواست خریدِ بازِ امروز اضافه شد`);
  } else {
    // create new purchase request
    const newReq = {
      id: `PR-${Date.now().toString(36)}`,
      date: t,
      time: toFa(nowTime()),
      requester: props.userName || '—',
      items: needItems,
      status: 'temp',
    };
    store.purchaseRequests = [newReq, ...store.purchaseRequests];
    props.showToast(`درخواست خرید جدید برای ${toFa(needItems.length)} قلم کسری ایجاد شد`);
  }
  // also send notification to purchasers
  const purchasers = store.users.filter((u) => u.roles?.includes('manager') || u.roles?.includes('admin') || u.role === 'manager');
  purchasers.forEach((u) => {
    store.messages.push({
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      to: userDisplay(u),
      kind: 'info',
      text: `کسری مواد برنامه پخت ${plan.date} به درخواست خرید امروز اضافه شد (${toFa(needItems.length)} قلم).`,
      read: false, date: t, time: toFa(nowTime()),
    });
  });
};
</script>

<template>
  <div class="space-y-6">
    <!-- هدر -->
    <div class="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="p-3 bg-teal-50 text-teal-700 rounded-2xl">
          <CalendarClock class="w-6 h-6" />
        </div>
        <div>
          <h2 class="text-base font-black text-slate-900">برنامه پخت روزانه</h2>
          <p class="text-[11px] text-slate-500">
            ثبت غذاهای روز و تعداد پخت، محاسبه مواد از رسپی، کنترل کسری و قطعی‌سازی — امکان ثبت برای ۷ روز آینده
          </p>
        </div>
      </div>
      <span class="text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
        امروز: {{ faDatePretty(today) }}
      </span>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- فرم ثبت برنامه -->
      <div v-if="initialTab !== 'drafts'" class="lg:col-span-5 space-y-4">
        <div class="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h3 class="text-sm font-black text-slate-800 flex items-center gap-2">
            <Pencil v-if="editId" class="w-4 h-4 text-amber-600" />
            <Plus v-else class="w-4 h-4 text-teal-600" />
            {{ editId ? 'ویرایش برنامه موقت' : 'ثبت برنامه پخت جدید' }}
          </h3>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">تاریخ برنامه (حداکثر ۷ روز آینده):</label>
            <JalaliDatePicker v-model="planDate" :min-date="today" :max-date="maxFuture" />
          </div>

          <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div class="sm:col-span-7">
                <label class="block text-[11px] font-bold text-slate-600 mb-1">غذا:</label>
                <SearchableSelect
                  v-model="dishId"
                  placeholder="-- انتخاب غذا --"
                  search-placeholder="جستجوی نام غذا..."
                  :options="store.dishes.map((d) => ({
                    value: d.id,
                    label: recipeOf(d.id) ? d.name : `${d.name} (بدون رسپی!)`,
                    searchText: d.name,
                  }))"
                />
              </div>
              <div class="sm:col-span-5">
                <label class="block text-[11px] font-bold text-slate-600 mb-1">تعداد پخت (پرس):</label>
                <NumberSpinner v-model="qty" :min="1" :step="1" />
              </div>
            </div>
            <button
              type="button"
              class="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5"
              @click="addToPlan"
            >
              <Plus class="w-4 h-4" /> افزودن به برنامه
            </button>
          </div>

          <!-- اقلام برنامه جاری -->
          <div v-if="items.length > 0" class="border border-slate-200 rounded-2xl overflow-hidden">
            <table class="w-full text-right text-xs">
              <thead class="bg-slate-50 font-black text-slate-700 border-b border-slate-200">
                <tr>
                  <th class="p-2.5 w-10 text-center">#</th>
                  <th class="p-2.5">غذا</th>
                  <th class="p-2.5 text-center w-24">پرس</th>
                  <th class="p-2.5 text-center w-12">حذف</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="(it, idx) in items" :key="it.dishId" class="hover:bg-slate-50">
                  <td class="p-2.5 text-center text-slate-500">{{ toFa(idx + 1) }}</td>
                  <td class="p-2.5 font-black text-slate-800">
                    {{ it.dishName }}
                    <span v-if="!recipeOf(it.dishId)" class="mr-1.5 text-[9px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">بدون رسپی</span>
                  </td>
                  <td class="p-2.5 text-center font-black text-teal-700">{{ toFa(it.qty) }}</td>
                  <td class="p-2.5 text-center">
                    <button class="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded-lg transition" @click="removeFormItem(idx)">
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- پیش‌محاسبه کسری فرم جاری -->
          <div
            v-if="formShortage"
            class="rounded-2xl p-4 border space-y-2"
            :class="formShortage.hasShortage ? 'bg-rose-50 border-rose-300' : 'bg-emerald-50 border-emerald-200'"
          >
            <div class="text-xs font-black flex items-center gap-1.5" :class="formShortage.hasShortage ? 'text-rose-800' : 'text-emerald-800'">
              <AlertTriangle v-if="formShortage.hasShortage" class="w-4 h-4" />
              <CheckCircle2 v-else class="w-4 h-4" />
              {{ formShortage.hasShortage ? 'کسری مواد برای این برنامه:' : 'موجودی انبار برای این برنامه کافی است' }}
              <button
                v-if="formShortage.hasShortage"
                class="mr-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-black bg-teal-600 text-white hover:bg-teal-700 transition shadow-sm"
                title="مواد کسری را به درخواست خرید بازِ امروز اضافه می‌کند؛ اگر درخواست بازی نباشد، درخواست جدید ساخته می‌شود"
                @click="addShortageToPurchase({ items, date: planDate })"
              >
                <PackagePlus class="w-3.5 h-3.5" /> افزودن کسری به درخواست خرید
              </button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] max-h-40 overflow-y-auto">
              <div
                v-for="r in formShortage.rows"
                :key="r.ingId"
                class="flex justify-between rounded-xl px-3 py-1.5 border"
                :class="r.ok ? 'bg-white border-emerald-100 text-slate-700' : 'bg-rose-100 border-rose-300 text-rose-900 font-black'"
              >
                <span>{{ r.name }}</span>
                <span>
                  {{ toFa(Math.round(r.need * 1000) / 1000) }} {{ r.unit }}
                  <span v-if="!r.ok" class="text-rose-700"> (کسری: {{ toFa(Math.round(r.shortage * 1000) / 1000) }})</span>
                </span>
              </div>
            </div>
          </div>

          <div class="flex gap-2">
            <button
              class="flex-1 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-black transition shadow-md shadow-teal-600/20 flex items-center justify-center gap-2"
              @click="submitPlan"
            >
              <CheckCircle2 class="w-4 h-4" /> {{ editId ? 'ذخیره ویرایش (موقت)' : 'ثبت برنامه (موقت)' }}
            </button>
            <button
              v-if="editId || items.length > 0"
              class="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              @click="cancelEdit"
            >
              <XCircle class="w-4 h-4" /> انصراف
            </button>
          </div>
        </div>
      </div>

      <!-- لیست برنامه‌ها — در همه حالت‌ها نمایش داده می‌شود تا وضعیت موقت/کسری/قطعی قابل مشاهده باشد -->
      <div class="lg:col-span-7 space-y-4">
        <div v-if="sortedPlansView.length === 0" class="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 text-xs font-bold">
          هنوز برنامه پختی ثبت نشده است
        </div>
        <div
          v-for="row in sortedPlansView"
          v-else
          :key="row.p.id"
          class="bg-white rounded-2xl border overflow-hidden"
          :class="row.p.status === 'final' ? 'border-emerald-200' : row.sh.hasShortage ? 'border-rose-300' : 'border-slate-200'"
        >
          <!-- سربرگ برنامه -->
          <div
            class="p-4 border-b flex flex-wrap items-center justify-between gap-2"
            :class="row.p.status === 'final' ? 'bg-emerald-50/50 border-emerald-100' : row.sh.hasShortage ? 'bg-rose-50/40 border-rose-100' : 'bg-amber-50/40 border-amber-100'"
          >
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-black text-slate-800">برنامه {{ faDatePretty(row.p.date) }}</span>
              <span v-if="row.p.date === today" class="text-[9px] font-black bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">امروز</span>
              <span v-if="row.p.date > today" class="text-[9px] font-black bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full">آینده</span>
              <!-- وضعیت -->
              <span v-if="row.p.status === 'final'" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 class="w-3 h-3" /> قطعی{{ row.p.stockDeducted ? ' · کسر شده' : ' · بدون کسر' }}
              </span>
              <span v-else class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                <Clock3 class="w-3 h-3" /> موقت
              </span>
              <!-- کسری: مشاهده + ارسال به درخواست خرید -->
              <template v-if="row.p.status === 'temp' && row.sh.hasShortage">
                <button
                  class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 hover:bg-rose-200 transition"
                  title="مشاهده جزئیات کسری"
                  @click="viewShortage = { plan: row.p, sh: row.sh }"
                >
                  <PackageX class="w-3 h-3" /> کسری: {{ toFa(row.sh.rows.filter((r) => !r.ok).length) }} قلم
                </button>
                <button
                  class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 border border-teal-300 hover:bg-teal-200 transition ml-1"
                  title="افزودن مواد کسری به درخواست خرید امروز"
                  @click="addShortageToPurchase(row.p)"
                >
                  <PackagePlus class="w-3 h-3" /> به درخواست خرید
                </button>
              </template>
            </div>
            <div class="flex items-center gap-1.5">
              <template v-if="row.p.status === 'temp'">
                <button title="ویرایش" class="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition" @click="startEdit(row.p)">
                  <Pencil class="w-4 h-4" />
                </button>
                <button
                  :disabled="row.sh.hasShortage"
                  :title="row.sh.hasShortage ? 'کسری مواد موجود است — قطعی امکان‌پذیر نیست' : 'قطعی کردن برنامه'"
                  class="px-3.5 py-2 rounded-xl text-[11px] font-black flex items-center gap-1.5 transition"
                  :class="row.sh.hasShortage ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'"
                  @click="row.sh.hasShortage
                    ? showToast('به دلیل کسری مواد، برنامه فقط در حالت موقت می‌ماند؛ ابتدا کسری را جبران کنید', 'error')
                    : (confirmFinalize = row.p)"
                >
                  <CheckCheck class="w-4 h-4" /> قطعی کردن{{ row.sh.hasShortage ? ' (کسری)' : '' }}
                </button>
              </template>
              <button
                :title="canDeletePlan(row.p) ? 'حذف برنامه' : 'حذف کل مجاز نیست'"
                class="p-2 rounded-xl transition"
                :class="canDeletePlan(row.p) ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50' : 'text-slate-300 cursor-not-allowed'"
                @click="canDeletePlan(row.p) ? (confirmDelete = row.p) : showToast('برای این تاریخ فاکتور صادر شده؛ فقط حذف غذای مشخص مجاز است', 'error')"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- جدول غذاهای برنامه -->
          <table class="w-full text-right text-xs">
            <thead class="bg-slate-50 font-black text-slate-700 border-b border-slate-200">
              <tr>
                <th class="p-3 w-10 text-center">#</th>
                <th class="p-3">غذا</th>
                <th class="p-3 text-center w-20">پرس</th>
                <th class="p-3 text-center">رسپی</th>
                <th class="p-3 text-center w-24">حذف غذا</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="it in row.p.items" :key="it.dishId" class="hover:bg-slate-50">
                <td class="p-3 text-center font-bold text-slate-500">—</td>
                <td class="p-3 font-black text-slate-800">
                  {{ it.dishName }}
                  <span
                    v-if="row.sold.has(it.dishId)"
                    class="mr-1.5 text-[9px] font-black bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full"
                    title="برای این غذا فاکتور صادر شده است"
                  >
                    فاکتور شده
                  </span>
                  <span v-if="!recipeOf(it.dishId)" class="mr-1.5 text-[9px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">بدون رسپی</span>
                </td>
                <td class="p-3 text-center font-black text-teal-700">{{ toFa(it.qty) }}</td>
                <td class="p-3 text-center">
                  <button v-if="recipeOf(it.dishId)" class="text-[10px] font-bold text-sky-700 hover:underline" @click="viewShortage = { plan: row.p, sh: row.sh }">
                    {{ toFa(recipeOf(it.dishId).items.length) }} ماده
                  </button>
                  <template v-else>—</template>
                </td>
                <td class="p-3 text-center">
                  <button
                    :title="row.sold.has(it.dishId) ? 'حذف این غذا (فاکتور خورده — با تأیید)' : 'حذف این غذا از برنامه'"
                    class="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                    @click="confirmRemoveDish = { plan: row.p, dishId: it.dishId, dishName: it.dishName }"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- پانوشت -->
          <div class="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
            <span>ثبت: {{ row.p.createdBy }} — {{ toFa(row.p.createdAt) }}</span>
            <span v-if="row.p.finalizedAt">قطعی: {{ row.p.finalizedBy }} — {{ toFa(row.p.finalizedAt) }}</span>
            <span v-if="row.p.status === 'final' && !row.p.stockDeducted" class="font-black text-amber-700">کسر مواد به‌صورت دستی از خروج کالا انجام شود</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== مودال تأیید قطعی ===== -->
    <Modal
      v-if="confirmFinalize && finalizeShortage"
      :title="`قطعی کردن برنامه ${faDatePretty(confirmFinalize.date)}`"
      @close="confirmFinalize = null"
    >
      <div class="space-y-3 text-xs text-slate-700">
        <p class="font-bold leading-relaxed">
          با قطعی کردن، برنامه به وضعیت قطعی می‌رود
          {{ confirmFinalize.deductStock ? ' و مواد غذایی از انبار کسر می‌شود.' : ' اما از انبار کسری نمی‌شود (کسر دستی).' }}
        </p>
        <div class="rounded-2xl p-3 border" :class="finalizeShortage.hasShortage ? 'bg-rose-50 border-rose-300' : 'bg-emerald-50 border-emerald-200'">
          <div class="font-black mb-2 flex items-center gap-1.5" :class="finalizeShortage.hasShortage ? 'text-rose-800' : 'text-emerald-800'">
            <AlertTriangle v-if="finalizeShortage.hasShortage" class="w-4 h-4" />
            <CheckCircle2 v-else class="w-4 h-4" />
            {{ finalizeShortage.hasShortage ? 'کسری مواد — ابتدا جبران کنید:' : 'موجودی برای تمام مواد کافی است' }}
          </div>
          <div class="space-y-1.5 max-h-48 overflow-y-auto">
            <div
              v-for="r in finalizeShortage.rows"
              :key="r.ingId"
              class="flex justify-between rounded-xl px-3 py-1.5 border text-[11px]"
              :class="r.ok ? 'bg-white border-emerald-100' : 'bg-rose-100 border-rose-300 font-black text-rose-900'"
            >
              <span>{{ r.name }}</span>
              <span>
                نیاز: {{ toFa(Math.round(r.need * 1000) / 1000) }} {{ r.unit }} · موجودی: {{ toFa(Math.round(r.stock * 1000) / 1000) }}
                <template v-if="!r.ok"> · کسری: {{ toFa(Math.round(r.shortage * 1000) / 1000) }}</template>
              </span>
            </div>
          </div>
        </div>
        <div v-if="confirmFinalize.deductStock && !confirmFinalize.stockDeducted" class="bg-sky-50 border border-sky-200 rounded-2xl p-3 text-[11px] font-bold text-sky-900">
          با تأیید این پنجره، مواد به همان اندازه از موجودی انبار کسر می‌شود.
        </div>
      </div>
      <template #footer>
        <div class="flex gap-2">
          <button
            :disabled="finalizeShortage.hasShortage"
            class="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl text-xs font-black transition"
            @click="doFinalize(confirmFinalize)"
          >
            {{ finalizeShortage.hasShortage ? 'قطعی ممکن نیست — کسری وجود دارد' : 'بله، قطعی کن' }}
          </button>
          <button class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition" @click="confirmFinalize = null">انصراف</button>
        </div>
      </template>
    </Modal>

    <!-- ===== مودال تأیید حذف کل برنامه ===== -->
    <Modal v-if="confirmDelete" title="تأیید حذف برنامه" @close="confirmDelete = null">
      <div class="space-y-3 text-xs text-slate-700">
        <p class="font-bold leading-relaxed">
          برنامه «{{ faDatePretty(confirmDelete.date) }}» با {{ toFa(confirmDelete.items.length) }} غذا حذف شود؟
        </p>
        <div v-if="confirmDelete.status === 'final' && confirmDelete.stockDeducted" class="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-[11px] font-bold text-amber-900">
          این برنامه قطعی شده و مواد آن از انبار کسر شده است؛ با حذف، مواد به انبار برمی‌گردد.
        </div>
      </div>
      <template #footer>
        <div class="flex gap-2">
          <button class="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition" @click="doDeletePlan(confirmDelete)">بله، حذف کن</button>
          <button class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition" @click="confirmDelete = null">انصراف</button>
        </div>
      </template>
    </Modal>

    <!-- ===== مودال تأیید حذف غذای خاص ===== -->
    <Modal v-if="confirmRemoveDish" title="تأیید حذف غذا از برنامه" @close="confirmRemoveDish = null">
      <p class="text-xs font-bold text-slate-700 leading-relaxed">
        غذای «{{ confirmRemoveDish.dishName }}» از برنامه {{ faDatePretty(confirmRemoveDish.plan.date) }} حذف شود؟
      </p>
      <div v-if="confirmRemoveDish.plan.status === 'final' && confirmRemoveDish.plan.stockDeducted" class="mt-3 bg-amber-50 border border-amber-200 rounded-2xl p-3 text-[11px] font-bold text-amber-900">
        مواد این غذا به انبار برگردانده می‌شود.
      </div>
      <template #footer>
        <div class="flex gap-2">
          <button class="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition" @click="doRemoveDish(confirmRemoveDish)">بله، حذف کن</button>
          <button class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition" @click="confirmRemoveDish = null">انصراف</button>
        </div>
      </template>
    </Modal>

    <!-- ===== مودال مشاهده کسری/مواد ===== -->
    <Modal v-if="viewShortage" wide :title="`مواد مصرفی برنامه ${faDatePretty(viewShortage.plan.date)}`" @close="viewShortage = null">
      <div class="overflow-x-auto">
        <table class="w-full text-right text-xs">
          <thead class="bg-slate-50 font-black text-slate-700 border-b border-slate-200">
            <tr>
              <th class="p-3">#</th>
              <th class="p-3">ماده غذایی</th>
              <th class="p-3 text-center">نیاز برنامه</th>
              <th class="p-3 text-center">موجودی انبار</th>
              <th class="p-3 text-center">وضعیت</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="(r, i) in viewShortage.sh.rows" :key="r.ingId" :class="r.ok ? '' : 'bg-rose-50'">
              <td class="p-3 text-center text-slate-500">{{ toFa(i + 1) }}</td>
              <td class="p-3 font-black" :class="r.ok ? 'text-slate-800' : 'text-rose-900'">{{ r.name }}</td>
              <td class="p-3 text-center font-bold">{{ toFa(Math.round(r.need * 1000) / 1000) }} {{ r.unit }}</td>
              <td class="p-3 text-center">{{ toFa(Math.round(r.stock * 1000) / 1000) }}</td>
              <td class="p-3 text-center">
                <span v-if="r.ok" class="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">کافی</span>
                <span v-else class="text-[10px] font-black bg-rose-100 text-rose-800 px-2.5 py-1 rounded-full">کسری: {{ toFa(Math.round(r.shortage * 1000) / 1000) }} {{ r.unit }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <template #footer>
        <button class="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition" @click="viewShortage = null">بستن</button>
      </template>
    </Modal>
  </div>
</template>
