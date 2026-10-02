<script setup>
/**
 * برنامه پخت روزانه — ماشین حالت فاز ۱
 * ثبت → pending (در انتظار تأیید سرآشپز) → رزرو (approve سرآشپز) → approved (تأیید مدیر در کارتابل)
 * - نیاز مواد با احتساب پرتی: recipeQty × planQty × (1 + wastePercent/100)
 * - کسری بر مبنای موجودی قابل استفاده (qty - reserved)
 */
import { ref, computed } from 'vue';
import {
  CalendarClock, Plus, Trash2, AlertTriangle, CheckCircle2, Pencil, XCircle,
  Clock3, CheckCheck, PackageX, PackagePlus,
} from 'lucide-vue-next';
import { toFa, nowTime, jalaliTodayString, jalaliOffsetString, faDatePretty, userDisplay, auditEntry } from '../lib/utils.js';
import { PLAN_STATUS_META, shortageOnAvailable } from '../lib/inventory.js';
import { useAppStore } from '../stores/app.js';
import NumberSpinner from '../components/ui/NumberSpinner.vue';
import Modal from '../components/ui/Modal.vue';
import SearchableSelect from '../components/SearchableSelect.vue';
import JalaliDatePicker from '../components/JalaliDatePicker.vue';

const props = defineProps({
  showToast: { type: Function, required: true },
  userName: { type: String, default: '—' },
  initialTab: { type: String, default: null },
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
const confirmDelete = ref(null);
const confirmRemoveDish = ref(null); // {plan, dishId, dishName}
const viewShortage = ref(null); // {plan, sh}
const confirmCancel = ref(null);

const auditUser = () => ({ fullName: props.userName, username: props.userName });

const recipeOf = (dId) => store.recipes.find((r) => r.dishId === dId) || null;
const statusMeta = (p) => PLAN_STATUS_META[p.status] || PLAN_STATUS_META.pending;

// ===== کسری لحظه‌ای بر مبنای موجودی قابل استفاده (با پرتی) =====
const shortageInfo = (planItems) => shortageOnAvailable(store, planItems);

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
    items.value = [...items.value, { dishId: dishId.value, dishName: dish.name, qty: n, decision: 'pending' }];
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
};

const submitPlan = () => {
  if (items.value.length === 0) return props.showToast('حداقل یک غذا به برنامه اضافه کنید', 'error');
  if (!planDate.value) return props.showToast('انتخاب تاریخ الزامی است', 'error');
  if (jalaliTodayString() > planDate.value) return props.showToast('برنامه برای گذشته قابل ثبت نیست', 'error');
  if (planDate.value > maxFuture) return props.showToast('برنامه حداکثر برای ۷ روز آینده امکان‌پذیر است', 'error');
  const sh = shortageInfo(items.value);
  const rec = {
    id: `plan_${Date.now().toString(36)}`,
    date: planDate.value,
    items: items.value.map((it) => ({ ...it, decision: 'pending', approvedQty: null, rejectReason: '', decisionNote: '' })),
    status: 'pending',
    createdBy: props.userName || '—',
    createdAt: `${jalaliTodayString()} ${nowTime()}`,
    reservedBy: null, reservedAt: null,
    approvedBy: null, approvedAt: null,
    rejectedBy: null, rejectedAt: null, rejectReason: '',
    cancelledBy: null, cancelledAt: null, cancelReason: '',
    reservationExpiresAt: null, reservationReleasedAt: null,
    stockDeducted: false,
    audit: [auditEntry(auditUser(), 'ثبت برنامه پخت — در انتظار تأیید سرآشپز')],
  };
  store.plans = [rec, ...store.plans];
  props.showToast(sh.hasShortage
    ? 'برنامه ثبت شد — کسری مواد موجود است؛ پس از تأیید سرآشپز رزرو انجام می‌شود'
    : 'برنامه ثبت شد و در انتظار تأیید سرآشپز است');
  resetForm();
};

const startEdit = (p) => {
  if (p.status !== 'pending') return props.showToast('فقط برنامه در انتظار تأیید قابل ویرایش است', 'error');
  editId.value = p.id;
  planDate.value = p.date;
  items.value = p.items.map((it) => ({ ...it }));
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const cancelEdit = () => resetForm();

// ذخیره ویرایش برنامه pending (اصلاح items در همان وضعیت)
const saveEdit = () => {
  if (items.value.length === 0) return props.showToast('حداقل یک غذا به برنامه اضافه کنید', 'error');
  store.plans = store.plans.map((x) => (x.id === editId.value
    ? {
        ...x, date: planDate.value,
        items: items.value.map((it) => ({ ...it, decision: it.decision || 'pending' })),
        audit: [...(x.audit || []), auditEntry(auditUser(), 'ویرایش برنامه (در انتظار تأیید)')],
      }
    : x));
  props.showToast('ویرایش برنامه ذخیره شد');
  resetForm();
};

// ===== حذف کل برنامه — اگر رزرو شده، رزرو آزاد می‌شود =====
const doDeletePlan = (p) => {
  const sold = invoiceSoldDishIdsFor(p.date);
  if (sold.size > 0) {
    confirmDelete.value = null;
    return props.showToast('برای تاریخ این برنامه فاکتور صادر شده؛ فقط حذف غذای مشخص مجاز است', 'error');
  }
  if (p.status === 'reserved') {
    // آزادسازی رزرو در کارتابل انجام می‌شود — اینجا فقط اطلاع
    confirmDelete.value = null;
    return props.showToast('برنامه رزرو شده است؛ ابتدا در کارتابل آن را رد کنید تا رزرو آزاد شود', 'error');
  }
  if (p.status === 'approved' && p.stockDeducted) {
    confirmDelete.value = null;
    return props.showToast('برنامه تأیید نهایی شده و مواد آن مصرف شده است؛ حذف مجاز نیست', 'error');
  }
  store.plans = store.plans.map((x) => (x.id === p.id
    ? { ...x, status: 'cancelled', cancelledBy: props.userName, cancelledAt: `${jalaliTodayString()} ${nowTime()}`, cancelReason: 'حذف توسط ثبت‌کننده', audit: [...(x.audit || []), auditEntry(auditUser(), 'لغو برنامه')] }
    : x));
  confirmDelete.value = null;
  props.showToast('برنامه لغو شد');
};

// ===== حذف یک غذای خاص (فقط در pending) =====
const doRemoveDish = ({ plan, dishId: dId }) => {
  if (plan.status !== 'pending') return props.showToast('فقط در وضعیت در انتظار تأیید قابل حذف است', 'error');
  const updatedItems = plan.items.filter((it) => it.dishId !== dId);
  if (updatedItems.length === 0) {
    store.plans = store.plans.map((x) => (x.id === plan.id
      ? { ...x, status: 'cancelled', cancelledBy: props.userName, cancelledAt: `${jalaliTodayString()} ${nowTime()}`, cancelReason: 'حذف آخرین غذا', audit: [...(x.audit || []), auditEntry(auditUser(), 'لغو برنامه — حذف آخرین غذا')] }
      : x));
    props.showToast('غذا حذف شد؛ برنامه خالی شد و لغو گردید');
  } else {
    store.plans = store.plans.map((x) => (x.id === plan.id ? { ...x, items: updatedItems, audit: [...(x.audit || []), auditEntry(auditUser(), `حذف غذا «${dId}» از برنامه`)] } : x));
    props.showToast('غذا از برنامه حذف شد');
  }
  confirmRemoveDish.value = null;
};

const canEdit = (p) => p.status === 'pending';
const canDeletePlan = (p) => p.status === 'pending' && invoiceSoldDishIdsFor(p.date).size === 0;

// لیست برنامه‌ها مرتب‌شده + کسری/فاکتور لحظه‌ای هر برنامه
const sortedPlansView = computed(() => [...store.plans]
  .filter((p) => p.status !== 'cancelled')
  .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0))
  .map((p) => ({
    p,
    sh: shortageInfo(p.items),
    sold: invoiceSoldDishIdsFor(p.date),
  })));

// پیش‌محاسبه کسری فرم جاری (زنده)
const formShortage = computed(() => (items.value.length > 0 ? shortageInfo(items.value) : null));

// موجودی قابل استفاده برای نمایش
const availOf = (ingId) => {
  const ing = store.ingredients.find((i) => i.id === ingId);
  return ing ? Math.max(0, (ing.qty || 0) - (ing.reserved || 0)) : 0;
};

const addShortageToPurchase = (plan) => {
  const sh = shortageInfo(plan.items);
  if (!sh.hasShortage) return;
  const t = jalaliTodayString();
  const needItems = sh.rows.filter((r) => !r.ok).map((r) => ({
    ingredientId: r.ingId,
    name: r.name,
    unit: r.unit,
    qty: r.shortage,
  }));
  if (needItems.length === 0) return props.showToast('کسری وجود ندارد', 'info');

  const existingOpen = store.purchaseRequests.find(
    (pr) => pr.date === t && pr.status === 'temp'
  );

  if (existingOpen) {
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
      return { ...pr, items: merged, date: t };
    });
    props.showToast(`${toFa(needItems.length)} قلم کسری به درخواست خریدِ بازِ امروز اضافه شد`);
  } else {
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
            ثبت برنامه → تأیید سرآشپز (رزرو مواد) → تأیید مدیر (مصرف از رزرو) — نیاز با احتساب پرتی
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
            {{ editId ? 'ویرایش برنامه (در انتظار تأیید)' : 'ثبت برنامه پخت جدید' }}
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
              {{ formShortage.hasShortage ? 'کسری مواد برای این برنامه:' : 'موجودی قابل استفاده برای این برنامه کافی است' }}
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
              @click="editId ? saveEdit() : submitPlan()"
            >
              <CheckCircle2 class="w-4 h-4" /> {{ editId ? 'ذخیره ویرایش' : 'ثبت برنامه' }}
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

      <!-- لیست برنامه‌ها -->
      <div class="lg:col-span-7 space-y-4">
        <div v-if="sortedPlansView.length === 0" class="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 text-xs font-bold">
          هنوز برنامه پختی ثبت نشده است
        </div>
        <div
          v-for="row in sortedPlansView"
          v-else
          :key="row.p.id"
          class="bg-white rounded-2xl border overflow-hidden"
          :class="row.p.status === 'approved' ? 'border-emerald-200' : row.p.status === 'reserved' ? 'border-sky-200' : row.sh.hasShortage ? 'border-rose-300' : 'border-slate-200'"
        >
          <!-- سربرگ برنامه -->
          <div
            class="p-4 border-b flex flex-wrap items-center justify-between gap-2"
            :class="row.p.status === 'approved' ? 'bg-emerald-50/50 border-emerald-100' : row.p.status === 'reserved' ? 'bg-sky-50/40 border-sky-100' : 'bg-amber-50/40 border-amber-100'"
          >
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-black text-slate-800">برنامه {{ faDatePretty(row.p.date) }}</span>
              <span v-if="row.p.date === today" class="text-[9px] font-black bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">امروز</span>
              <span v-if="row.p.date > today" class="text-[9px] font-black bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full">آینده</span>
              <!-- وضعیت جدید -->
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border" :class="statusMeta(row.p).cls">
                <CheckCircle2 v-if="row.p.status === 'approved'" class="w-3 h-3" />
                <Clock3 v-else class="w-3 h-3" />
                {{ statusMeta(row.p).label }}
              </span>
              <!-- کسری -->
              <template v-if="row.p.status === 'pending' && row.sh.hasShortage">
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
              <template v-if="row.p.status === 'pending'">
                <button title="ویرایش" class="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition" @click="startEdit(row.p)">
                  <Pencil class="w-4 h-4" />
                </button>
                <button
                  title="تأیید سرآشپز در کارتابل انجام می‌شود"
                  class="px-3.5 py-2 rounded-xl text-[11px] font-black flex items-center gap-1.5 transition bg-sky-100 text-sky-800 hover:bg-sky-200"
                  @click="store.navigate('cartable', 'cookplan')"
                >
                  <CheckCheck class="w-4 h-4" /> تأیید در کارتابل
                </button>
              </template>
              <button
                v-if="row.p.status === 'reserved'"
                title="تأیید نهایی مدیر در کارتابل انجام می‌شود"
                class="px-3.5 py-2 rounded-xl text-[11px] font-black flex items-center gap-1.5 transition bg-indigo-100 text-indigo-800 hover:bg-indigo-200"
                @click="store.navigate('cartable', 'cookplan')"
              >
                <CheckCheck class="w-4 h-4" /> تأیید مدیر در کارتابل
              </button>
              <button
                v-if="canDeletePlan(row.p)"
                title="لغو برنامه"
                class="p-2 rounded-xl transition text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                @click="confirmDelete = row.p"
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
                <th v-if="row.p.status === 'pending'" class="p-3 text-center w-24">حذف غذا</th>
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
                  <span v-if="it.decision === 'reject'" class="mr-1.5 text-[9px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full" :title="it.rejectReason">
                    رد شده{{ it.rejectReason ? ` — ${it.rejectReason}` : '' }}
                  </span>
                  <span v-else-if="it.decision === 'approve'" class="mr-1.5 text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">تایید</span>
                </td>
                <td class="p-3 text-center font-black text-teal-700">{{ toFa(it.qty) }}</td>
                <td class="p-3 text-center">
                  <button v-if="recipeOf(it.dishId)" class="text-[10px] font-bold text-sky-700 hover:underline" @click="viewShortage = { plan: row.p, sh: row.sh }">
                    {{ toFa(recipeOf(it.dishId).items.length) }} ماده
                  </button>
                  <template v-else>—</template>
                </td>
                <td v-if="row.p.status === 'pending'" class="p-3 text-center">
                  <button
                    title="حذف این غذا از برنامه"
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
            <span v-if="row.p.reservedAt">رزرو: {{ row.p.reservedBy }} — {{ toFa(row.p.reservedAt) }}</span>
            <span v-if="row.p.approvedAt">تأیید نهایی: {{ row.p.approvedBy }} — {{ toFa(row.p.approvedAt) }}</span>
            <span v-if="row.p.status === 'reserved' && row.p.reservationExpiresAt" class="font-bold text-sky-700">
              مهلت رزرو: {{ toFa(Math.max(0, Math.ceil((row.p.reservationExpiresAt - Date.now()) / 3600000))) }} ساعت باقی‌مانده
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== مودال تأیید لغو برنامه ===== -->
    <Modal v-if="confirmDelete" title="تأیید لغو برنامه" @close="confirmDelete = null">
      <div class="space-y-3 text-xs text-slate-700">
        <p class="font-bold leading-relaxed">
          برنامه «{{ faDatePretty(confirmDelete.date) }}» با {{ toFa(confirmDelete.items.length) }} غذا لغو شود؟
        </p>
        <div class="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-[11px] font-bold text-amber-900">
          برنامه لغو‌شده از لیست حذف نمی‌شود اما غیرفعال می‌گردد.
        </div>
      </div>
      <template #footer>
        <div class="flex gap-2">
          <button class="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition" @click="doDeletePlan(confirmDelete)">بله، لغو کن</button>
          <button class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition" @click="confirmDelete = null">انصراف</button>
        </div>
      </template>
    </Modal>

    <!-- ===== مودال تأیید حذف غذای خاص ===== -->
    <Modal v-if="confirmRemoveDish" title="تأیید حذف غذا از برنامه" @close="confirmRemoveDish = null">
      <p class="text-xs font-bold text-slate-700 leading-relaxed">
        غذای «{{ confirmRemoveDish.dishName }}» از برنامه {{ faDatePretty(confirmRemoveDish.plan.date) }} حذف شود؟
      </p>
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
              <th class="p-3 text-center">نیاز (با پرتی)</th>
              <th class="p-3 text-center">موجودی فیزیکی</th>
              <th class="p-3 text-center">رزرو شده</th>
              <th class="p-3 text-center">قابل استفاده</th>
              <th class="p-3 text-center">وضعیت</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="(r, i) in viewShortage.sh.rows" :key="r.ingId" :class="r.ok ? '' : 'bg-rose-50'">
              <td class="p-3 text-center text-slate-500">{{ toFa(i + 1) }}</td>
              <td class="p-3 font-black" :class="r.ok ? 'text-slate-800' : 'text-rose-900'">{{ r.name }}</td>
              <td class="p-3 text-center font-bold">{{ toFa(Math.round(r.need * 1000) / 1000) }} {{ r.unit }}</td>
              <td class="p-3 text-center">{{ toFa(Math.round(r.stock * 1000) / 1000) }}</td>
              <td class="p-3 text-center text-sky-700 font-bold">{{ toFa(Math.round(r.reserved * 1000) / 1000) }}</td>
              <td class="p-3 text-center font-bold text-emerald-700">{{ toFa(Math.round(r.available * 1000) / 1000) }}</td>
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
