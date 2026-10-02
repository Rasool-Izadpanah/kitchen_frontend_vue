<script setup>
/**
 * صدور فاکتور فروش — معادل InvoicePage.jsx
 * فرم چندمرحله‌ای (مشتری/تحویل‌گیرنده/غذا+قلم جانبی) + خلاصه زنده + لیست فاکتورها + چاپ حرارتی دوگانه
 * دسترسی: صدور با create_invoice | ویرایش/حذف فقط ادمین
 */
import { ref, computed } from 'vue';
import {
  ShoppingCart, Plus, Trash2, Printer, BarChart3, Pencil, Save, XCircle, Lock, AlertTriangle,
} from 'lucide-vue-next';
import { toFa, formatMoney, nowTime, jalaliTodayString, faDate, auditEntry, userDisplay } from '../lib/utils.js';
import { useAppStore } from '../stores/app.js';
import SearchableSelect from '../components/SearchableSelect.vue';
import DualThermalPrintModal from '../components/DualThermalPrintModal.vue';
import InvoiceDocument from '../components/InvoiceDocument.vue';
import EmptyRow from '../components/ui/EmptyRow.vue';
import FaNumberInput from '../components/ui/FaNumberInput.vue';
import NumberSpinner from '../components/ui/NumberSpinner.vue';
import { inputCls } from '../components/ui/inputCls.js';

const props = defineProps({
  showToast: { type: Function, required: true },
  userName: { type: String, default: '—' },
  initialTab: { type: String, default: null }, // 'list' | null
  listOnly: { type: Boolean, default: false },
});

const store = useAppStore();
const toast = (m, t) => props.showToast(m, t);

const customerId = ref('');
const receiver = ref('');
const dishId = ref('');
const portions = ref('1');
const supplyId = ref('');
const supplyQty = ref('1');
const items = ref([]);
const notes = ref('');
const printInv = ref(null);
const editId = ref(null);
const confirmDel = ref(null);

const customer = computed(() => store.customers.find((c) => c.id === customerId.value) || null);
const dish = computed(() => store.dishes.find((d) => d.id === dishId.value) || null);

const subtotal = computed(() => items.value.reduce((s, it) => s + it.totalRow, 0));
const discountPercent = computed(() => (customer.value ? Number(customer.value.discountPercent || 0) : 0));
const discountAmount = computed(() => Math.round((subtotal.value * discountPercent.value) / 100));
const afterDiscount = computed(() => subtotal.value - discountAmount.value);
const isTaxable = computed(() => (customer.value ? Boolean(customer.value.isTaxable) : false));
const taxRate = computed(() => Number(store.settings?.taxRate) || 0);
const taxAmount = computed(() => (isTaxable.value ? Math.round((afterDiscount.value * taxRate.value) / 100) : 0));
const grandTotal = computed(() => afterDiscount.value + taxAmount.value);
const totalPortions = computed(() => items.value.reduce((s, it) => s + it.count, 0));
const currency = computed(() => store.settings?.currency || 'تومان');

const addToOrder = () => {
  if (!dish.value) return toast('لطفاً یک غذا انتخاب کنید', 'error');
  const n = Number(portions.value);
  if (!n || n <= 0) return toast('تعداد پرس باید بیشتر از صفر باشد', 'error');
  const ex = items.value.findIndex((it) => it.dishId === dish.value.id);
  if (ex > -1) {
    const upd = [...items.value];
    upd[ex] = { ...upd[ex], count: upd[ex].count + n, totalRow: (upd[ex].count + n) * upd[ex].unitPrice };
    items.value = upd;
    toast('تعداد پرس همان غذا افزایش یافت');
  } else {
    items.value = [...items.value, { dishId: dish.value.id, dishName: dish.value.name, count: n, unitPrice: dish.value.price, totalRow: n * dish.value.price }];
    toast('غذا به سفارش افزوده شد');
  }
  dishId.value = '';
  portions.value = '1';
};

const addSupply = () => {
  const sup = store.supplies.find((s) => s.id === supplyId.value);
  if (!sup) return toast('یک قلم جانبی انتخاب کنید', 'error');
  const n = Number(supplyQty.value);
  if (!n || n <= 0) return toast('تعداد قلم جانبی باید بیشتر از صفر باشد', 'error');
  const ex = items.value.findIndex((it) => it.kind === 'supply' && it.dishId === sup.id);
  if (ex > -1) {
    const upd = [...items.value];
    upd[ex] = { ...upd[ex], count: upd[ex].count + n, totalRow: (upd[ex].count + n) * upd[ex].unitPrice };
    items.value = upd;
    toast('تعداد این قلم جانبی افزایش یافت');
  } else {
    items.value = [...items.value, { dishId: sup.id, dishName: sup.name, kind: 'supply', count: n, unitPrice: sup.price, totalRow: n * sup.price }];
    toast('قلم جانبی به سفارش افزوده شد');
  }
  supplyId.value = '';
  supplyQty.value = '1';
};

const updateCount = (idx, val) => {
  const n = parseInt(val, 10);
  if (Number.isNaN(n) || n <= 0) return;
  const upd = [...items.value];
  upd[idx] = { ...upd[idx], count: n, totalRow: n * upd[idx].unitPrice };
  items.value = upd;
};

const removeRow = (idx) => { items.value = items.value.filter((_, i) => i !== idx); };

// ===== دسترسی‌ها: صدور فاکتور فقط کاربر معمولی | ویرایش/حذف فقط ادمین =====
const isAdmin = computed(() => store.currentUser?.roles?.includes('admin') || store.currentUser?.role === 'admin');
const today = jalaliTodayString();
const canIssue = computed(() => !isAdmin.value);
const canModify = () => isAdmin.value;

const resetForm = () => {
  editId.value = null;
  customerId.value = '';
  receiver.value = '';
  items.value = [];
  notes.value = '';
};

const startEdit = (inv) => {
  if (!canModify(inv)) return toast('ویرایش فاکتور فقط برای کاربر ادمین مجاز است', 'error');
  editId.value = inv.id;
  customerId.value = inv.customer?.id || '';
  receiver.value = inv.receiver || '';
  items.value = inv.items.map((it) => ({ ...it }));
  notes.value = inv.notes || '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const cancelEdit = resetForm;

const saveEdit = () => {
  if (!customer.value) return toast('انتخاب مشتری الزامی است', 'error');
  if (items.value.length === 0) return toast('حداقل یک ردیف سفارش لازم است', 'error');
  store.invoices = store.invoices.map((inv) => (inv.id === editId.value
    ? {
        ...inv,
        customer: customer.value,
        items: [...items.value],
        subtotal: subtotal.value,
        discountPercent: discountPercent.value,
        discountAmount: discountAmount.value,
        taxRate: taxRate.value,
        taxAmount: taxAmount.value,
        isTaxable: isTaxable.value,
        finalTotal: grandTotal.value,
        receiver: receiver.value.trim(),
        notes: notes.value.trim(),
        editedAt: `${jalaliTodayString()} ${toFa(nowTime())}`,
        editedBy: userDisplay(store.currentUser),
        audit: [...(inv.audit || [{ by: inv.createdBy || '—', at: `${inv.date} ${inv.time}`, action: 'ثبت فاکتور' }]), auditEntry(store.currentUser, 'ویرایش فاکتور')],
      }
    : inv));
  toast(`فاکتور ${toFa(editId.value)} به‌روزرسانی شد`);
  resetForm();
};

const deleteInvoice = (inv) => {
  if (!canModify(inv)) return toast('حذف فاکتور فقط برای کاربر ادمین مجاز است', 'error');
  store.invoices = store.invoices.filter((x) => x.id !== inv.id);
  confirmDel.value = null;
  if (editId.value === inv.id) resetForm();
  toast(`فاکتور ${toFa(inv.id)} ابطال شد (اظهارکننده: ${userDisplay(store.currentUser)})`);
};

const finalize = () => {
  if (!customer.value) return toast('انتخاب مشتری الزامی است', 'error');
  if (items.value.length === 0) return toast('حداقل یک ردیف سفارش لازم است', 'error');
  let nextNum = 1001;
  store.invoices.forEach((inv) => {
    const m = String(inv.id).match(/(\d+)$/);
    if (m) nextNum = Math.max(nextNum, Number(m[1]) + 1);
  });
  const inv = {
    id: `INV-${nextNum}`,
    date: jalaliTodayString(),
    time: toFa(nowTime()),
    createdBy: userDisplay(store.currentUser),
    createdById: store.currentUser?.id || '',
    audit: [auditEntry(store.currentUser, 'ثبت فاکتور')],
    customer: customer.value,
    items: [...items.value],
    subtotal: subtotal.value,
    discountPercent: discountPercent.value,
    discountAmount: discountAmount.value,
    taxRate: taxRate.value,
    taxAmount: taxAmount.value,
    isTaxable: isTaxable.value,
    finalTotal: grandTotal.value,
    receiver: receiver.value.trim(),
    notes: notes.value.trim(),
  };
  store.invoices = [inv, ...store.invoices];
  toast(`فاکتور ${toFa(inv.id)} صادر و ثبت شد`);
  printInv.value = inv;
  resetForm();
};

const rows = computed(() => [...store.invoices].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)));
</script>

<template>
  <div class="space-y-6">
    <!-- نوار عملیات -->
    <div class="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div class="flex items-center gap-3">
        <div class="p-3 bg-emerald-50 text-emerald-700 rounded-2xl">
          <ShoppingCart class="w-6 h-6" />
        </div>
        <div>
          <h2 class="text-base font-black text-slate-900">صدور فاکتور فروش</h2>
          <p class="text-[11px] text-slate-500">ثبت فاکتور چندغذایی با تخفیف و مالیات — تاریخ و ساعت ثبت خودکار درج می‌شود</p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-if="canIssue"
          @click="editId ? saveEdit() : finalize()"
          class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-emerald-600/20"
        >
          <Plus class="w-4 h-4" /> {{ editId ? 'ذخیره ویرایش' : 'ثبت فاکتور جدید' }}
        </button>
        <span
          v-else
          class="px-4 py-2.5 bg-slate-100 text-slate-400 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-200 cursor-not-allowed"
          title="صدور فاکتور فقط برای کاربر معمولی مجاز است"
        >
          <Lock class="w-4 h-4" /> صدور فاکتور (اختصاصی کاربر معمولی)
        </span>
        <button
          @click="rows.length ? (printInv = rows[0]) : toast('فاکتوری برای چاپ وجود ندارد', 'error')"
          class="px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border border-blue-100"
        >
          <Printer class="w-4 h-4" /> چاپ فاکتور
        </button>
        <button
          @click="store.navigate('reports')"
          class="px-4 py-2.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border border-purple-100"
        >
          <BarChart3 class="w-4 h-4" /> گزارش‌گیری
        </button>
      </div>
    </div>

    <template v-if="!listOnly">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- فرم سفارش -->
        <div class="lg:col-span-8 space-y-6">
          <!-- نوار ویرایش -->
          <div v-if="editId" class="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
            <div class="flex items-center gap-3">
              <div class="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                <Pencil class="w-5 h-5" />
              </div>
              <div>
                <p class="text-sm font-black text-amber-900">حالت ویرایش فاکتور {{ toFa(editId) }}</p>
                <p class="text-[11px] text-amber-700">تغییرات را در فرم زیر اعمال کنید، سپس «ذخیره ویرایش» را بزنید</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button @click="saveEdit" class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm">
                <Save class="w-4 h-4" /> ذخیره ویرایش
              </button>
              <button @click="cancelEdit" class="px-4 py-2 bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 rounded-xl text-xs font-bold flex items-center gap-1.5 transition">
                <XCircle class="w-4 h-4" /> انصراف
              </button>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5">
            <!-- ۱. مشتری -->
            <div class="space-y-3">
              <label class="block text-sm font-black text-slate-800 flex items-center gap-2">
                <span class="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 text-xs flex items-center justify-center">۱</span>
                انتخاب مشتری:
              </label>
              <div class="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div class="sm:col-span-8">
                  <SearchableSelect
                    v-model="customerId"
                    placeholder="-- مشتری را از لیست انتخاب کنید --"
                    search-placeholder="جستجوی نام، موبایل، وضعیت مالیات..."
                    :options="store.customers.map((c) => ({
                      value: c.id,
                      label: `${c.firstName} ${c.lastName} — ${toFa(c.mobile)} ${c.isTaxable ? '(مشمول مالیات)' : '(معاف)'}${c.discountPercent ? ` (تخفیف ${toFa(c.discountPercent)}٪)` : ''}`,
                      searchText: `${c.firstName} ${c.lastName} ${c.mobile} ${c.address || ''} ${c.isTaxable ? 'مشمول مالیات' : 'معاف'} تخفیف ${c.discountPercent}`,
                    }))"
                  />
                </div>
                <button
                  type="button"
                  @click="store.navigate('settings', 'customers')"
                  class="sm:col-span-4 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border border-slate-200"
                >
                  <Plus class="w-4 h-4" /> مشتری جدید (تنظیمات)
                </button>
              </div>

              <div v-if="customer" class="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 text-[11px] grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><span class="text-slate-500 block">نام:</span><span class="font-black text-slate-800">{{ customer.firstName }} {{ customer.lastName }}</span></div>
                <div><span class="text-slate-500 block">تلفن:</span><span class="font-bold">{{ toFa(customer.mobile || '-') }}</span></div>
                <div><span class="text-slate-500 block">مالیات:</span><span class="font-black" :class="customer.isTaxable ? 'text-amber-700' : 'text-emerald-700'">{{ customer.isTaxable ? `مشمول (${toFa(taxRate)}٪)` : 'معاف' }}</span></div>
                <div><span class="text-slate-500 block">تخفیف:</span><span class="font-black text-sky-700">{{ toFa(discountPercent) }}٪</span></div>
              </div>
            </div>

            <!-- ۲. تحویل‌گیرنده -->
            <div class="space-y-3">
              <label class="block text-sm font-black text-slate-800 flex items-center gap-2">
                <span class="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 text-xs flex items-center justify-center">۲</span>
                تحویل‌گیرنده (اختیاری — در انتهای فاکتور برای امضا درج می‌شود):
              </label>
              <div class="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <input
                  v-model="receiver"
                  list="receivers-list"
                  placeholder="نام تحویل‌گیرنده را وارد یا از لیست انتخاب کنید..."
                  :class="`${inputCls} sm:col-span-8`"
                />
                <datalist id="receivers-list">
                  <option v-for="c in store.customers" :key="c.id" :value="`${c.firstName} ${c.lastName}`" />
                </datalist>
                <div class="sm:col-span-4 text-[11px] text-slate-500 flex items-center leading-relaxed">
                  {{ receiver.trim() ? `امضای «${receiver.trim()}» در انتهای فاکتور درج می‌شود` : 'در صورت خالی بودن، جای امضا خالی می‌ماند' }}
                </div>
              </div>
            </div>

            <!-- ۳. انتخاب غذا -->
            <div class="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-4">
              <label class="block text-sm font-black text-slate-800 flex items-center gap-2">
                <span class="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 text-xs flex items-center justify-center">۳</span>
                انتخاب غذا و تعداد پرس:
              </label>
              <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div class="sm:col-span-5">
                  <label class="block text-xs font-bold text-slate-600 mb-1.5">عنوان غذا:</label>
                  <SearchableSelect
                    v-model="dishId"
                    placeholder="-- انتخاب غذا --"
                    search-placeholder="جستجوی نام غذا یا قیمت..."
                    :options="store.dishes.map((d) => ({
                      value: d.id,
                      label: `${d.name} — ${formatMoney(d.price)} تومان`,
                      searchText: `${d.name} ${d.price} تومان پرس`,
                    }))"
                  />
                </div>
                <div class="sm:col-span-3">
                  <label class="block text-xs font-bold text-slate-600 mb-1.5">تعداد پرس:</label>
                  <NumberSpinner v-model="portions" :min="1" :step="1" />
                </div>
                <div class="sm:col-span-4">
                  <button type="button" @click="addToOrder" class="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition flex items-center justify-center gap-2">
                    <Plus class="w-4 h-4" /> افزودن به جدول
                  </button>
                </div>
              </div>
            </div>

            <!-- اقلام جانبی -->
            <div v-if="store.supplies.length > 0" class="bg-sky-50/70 border border-sky-200 rounded-2xl p-4 space-y-4">
              <label class="block text-sm font-black text-slate-800 flex items-center gap-2">
                <span class="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 text-xs flex items-center justify-center">+</span>
                اقلام جانبی (ظرف، قاشق و چنگال و ...):
              </label>
              <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div class="sm:col-span-5">
                  <label class="block text-xs font-bold text-slate-600 mb-1.5">عنوان قلم:</label>
                  <SearchableSelect
                    v-model="supplyId"
                    placeholder="-- انتخاب قلم جانبی --"
                    search-placeholder="جستجوی نام قلم یا قیمت..."
                    :options="store.supplies.map((s) => ({
                      value: s.id,
                      label: `${s.name} — ${formatMoney(s.price)} تومان`,
                      searchText: `${s.name} ${s.price} تومان`,
                    }))"
                  />
                </div>
                <div class="sm:col-span-3">
                  <label class="block text-xs font-bold text-slate-600 mb-1.5">تعداد:</label>
                  <NumberSpinner v-model="supplyQty" :min="1" :step="1" />
                </div>
                <div class="sm:col-span-4">
                  <button type="button" @click="addSupply" class="w-full bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition flex items-center justify-center gap-2">
                    <Plus class="w-4 h-4" /> افزودن به جدول
                  </button>
                </div>
              </div>
            </div>

            <!-- ۴. جدول اقلام -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <label class="text-sm font-black text-slate-800 flex items-center gap-2">
                  <span class="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 text-xs flex items-center justify-center">۴</span>
                  اقلام سفارش جاری:
                </label>
                <button v-if="items.length > 0" @click="items = []" class="text-xs text-rose-600 hover:underline flex items-center gap-1 font-bold">
                  <Trash2 class="w-3.5 h-3.5" /> پاک کردن همه
                </button>
              </div>

              <div class="overflow-x-auto border border-slate-200 rounded-2xl">
                <table class="w-full text-right text-xs">
                  <thead class="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                    <tr>
                      <th class="p-3 w-12 text-center">ردیف</th>
                      <th class="p-3">نام غذا</th>
                      <th class="p-3 text-center w-36">تعداد پرس</th>
                      <th class="p-3 text-left">قیمت هر پرس</th>
                      <th class="p-3 text-left">مبلغ کل ردیف</th>
                      <th class="p-3 text-center w-20">حذف</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <EmptyRow v-if="items.length === 0" :col-span="6" text="هنوز غذایی به سفارش افزوده نشده است" />
                    <template v-else>
                      <tr v-for="(it, idx) in items" :key="it.dishId" class="hover:bg-slate-50">
                        <td class="p-3 text-center font-bold text-slate-500">{{ toFa(idx + 1) }}</td>
                        <td class="p-3 font-black text-slate-800">
                          <span v-if="it.kind === 'supply'" class="inline-flex items-center gap-2">
                            {{ it.dishName }}
                            <span class="text-[9px] font-black bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">قلم جانبی</span>
                          </span>
                          <template v-else>{{ it.dishName }}</template>
                        </td>
                        <td class="p-3 text-center">
                          <FaNumberInput
                            :model-value="String(it.count)"
                            class="w-20 text-center py-1.5 border border-slate-200 rounded-lg bg-white font-black text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            @update:model-value="updateCount(idx, $event)"
                          />
                        </td>
                        <td class="p-3 text-left font-medium text-slate-700">{{ formatMoney(it.unitPrice) }}</td>
                        <td class="p-3 text-left font-black text-emerald-700">{{ formatMoney(it.totalRow) }}</td>
                        <td class="p-3 text-center">
                          <button @click="removeRow(idx)" class="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 rounded-lg transition">
                            <Trash2 class="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>

              <input v-model="notes" type="text" placeholder="توضیحات فاکتور (اختیاری)..." :class="inputCls" />
            </div>
          </div>
        </div>

        <!-- ستون کنار: خلاصه فاکتور -->
        <div class="lg:col-span-4">
          <div class="bg-white rounded-2xl border border-slate-200 p-6 lg:sticky lg:top-28 space-y-4">
            <h3 class="font-black text-slate-800 border-b border-slate-100 pb-3 flex items-center justify-between text-sm">
              <span>خلاصه فاکتور</span>
              <span class="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">{{ toFa(totalPortions) }} پرس</span>
            </h3>

            <div class="space-y-2.5 text-xs">
              <div class="flex justify-between text-slate-600">
                <span>مشتری:</span>
                <span class="font-black text-slate-800">{{ customer ? `${customer.firstName} ${customer.lastName}` : '—' }}</span>
              </div>
              <div class="flex justify-between text-slate-600">
                <span>تاریخ و ساعت:</span>
                <span class="font-bold text-slate-800">{{ faDate(jalaliTodayString()) }} — {{ toFa(nowTime()) }}</span>
              </div>
              <div class="flex justify-between text-slate-600 pt-2 border-t border-dashed border-slate-200">
                <span>جمع اقلام:</span>
                <span class="font-bold">{{ formatMoney(subtotal) }} {{ currency }}</span>
              </div>
              <div class="flex justify-between text-slate-600">
                <span>تخفیف ({{ toFa(discountPercent) }}٪):</span>
                <span class="font-bold" :class="discountAmount ? 'text-sky-700' : 'text-slate-500'">{{ discountAmount ? `${formatMoney(discountAmount)} ${currency}` : '—' }}</span>
              </div>
              <div class="flex justify-between text-slate-600">
                <span>مالیات ({{ toFa(taxRate) }}٪):</span>
                <span class="font-bold" :class="isTaxable ? 'text-amber-700' : 'text-emerald-600'">{{ isTaxable ? `${formatMoney(taxAmount)} ${currency}` : 'معاف (۰)' }}</span>
              </div>
              <div class="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 flex justify-between items-center mt-2">
                <div>
                  <span class="text-[11px] font-black text-emerald-800 block">مبلغ نهایی قابل پرداخت</span>
                  <span class="text-[10px] text-emerald-600">{{ toFa(items.length) }} ردیف سفارش</span>
                </div>
                <span class="text-lg font-black text-emerald-900">{{ formatMoney(grandTotal) }}<span class="text-[10px] font-bold mr-1">{{ currency }}</span></span>
              </div>
            </div>

            <button
              @click="editId ? saveEdit() : finalize()"
              :disabled="items.length === 0 || !customer || !canIssue"
              class="w-full text-white font-black py-3 rounded-xl text-sm transition shadow-md flex items-center justify-center gap-2"
              :class="editId ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20' : 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:pointer-events-none shadow-emerald-600/20'"
            >
              <Save v-if="editId" class="w-4 h-4" />
              <Printer v-else class="w-4 h-4" />
              {{ editId ? 'ذخیره ویرایش فاکتور' : 'ثبت و پیش‌نمایش چاپ' }}
            </button>
            <p v-if="!canIssue" class="text-[10px] text-center text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2 font-bold">
              صدور فاکتور جدید فقط برای کاربر معمولی فعال است — ادمین به ویرایش و حذف فاکتورها دسترسی دارد
            </p>
          </div>
        </div>
      </div>
    </template>

    <!-- لیست فاکتورهای ثبت‌شده -->
    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div class="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <h3 class="text-sm font-black text-slate-800">فاکتورهای صادرشده ({{ toFa(store.invoices.length) }})</h3>
        <span class="text-[11px] text-slate-500">برای چاپ روی دکمه چاپ هر ردیف بزنید</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-right text-xs">
          <thead class="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
            <tr>
              <th class="p-3">شماره</th>
              <th class="p-3">تاریخ</th>
              <th class="p-3">ساعت</th>
              <th class="p-3">مشتری</th>
              <th class="p-3">اقلام</th>
              <th class="p-3 text-center">پرس</th>
              <th class="p-3 text-left">مبلغ نهایی</th>
              <th class="p-3 text-center">چاپ</th>
              <th class="p-3 text-center">عملیات</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <EmptyRow v-if="rows.length === 0" :col-span="9" text="هنوز فاکتوری ثبت نشده است" />
            <template v-else>
              <tr v-for="inv in rows" :key="inv.id" class="hover:bg-slate-50" :class="inv.id === editId ? 'bg-amber-50/60' : ''">
                <td class="p-3 font-black text-slate-800">{{ toFa(inv.id) }}</td>
                <td class="p-3 text-slate-600">{{ faDate(inv.date) }}</td>
                <td class="p-3 text-slate-600">{{ toFa(inv.time) }}</td>
                <td class="p-3 font-bold text-slate-800">{{ inv.customer?.firstName }} {{ inv.customer?.lastName }}</td>
                <td class="p-3 text-slate-600 max-w-[220px] truncate">{{ inv.items.map((it) => `${it.dishName} (${toFa(it.count)})`).join(' + ') }}</td>
                <td class="p-3 text-center font-bold text-emerald-800">{{ toFa(inv.items.reduce((s, it) => s + it.count, 0)) }}</td>
                <td class="p-3 text-left font-black text-emerald-800">{{ formatMoney(inv.finalTotal) }}</td>
                <td class="p-3 text-center">
                  <button @click="printInv = inv" class="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-bold transition flex items-center gap-1 mx-auto">
                    <Printer class="w-3.5 h-3.5" /> چاپ
                  </button>
                </td>
                <td class="p-3 text-center">
                  <div class="flex items-center justify-center gap-1">
                    <template v-if="canModify(inv)">
                      <button
                        @click="startEdit(inv)"
                        :title="inv.date === today ? 'ویرایش فاکتور روز جاری' : 'ویرایش (ادمین)'"
                        class="p-1.5 rounded-lg transition"
                        :class="inv.id === editId ? 'bg-amber-100 text-amber-700' : 'text-slate-500 hover:text-emerald-700 hover:bg-emerald-50'"
                      >
                        <Pencil class="w-4 h-4" />
                      </button>
                      <button @click="confirmDel = inv" title="حذف (ادمین)" class="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition">
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </template>
                    <span v-else title="کاربر معمولی فقط به فاکتورهای روز جاری دسترسی دارد" class="inline-flex items-center gap-1 text-[10px] text-slate-300 font-bold">
                      <Lock class="w-3.5 h-3.5" /> بدون دسترسی
                    </span>
                    <span v-if="inv.editedAt" :title="`آخرین ویرایش: ${inv.editedAt} — ${inv.editedBy || ''}`" class="text-[9px] text-amber-600 font-bold mr-1">ویرایش‌شده</span>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- مودال تأیید حذف -->
    <div v-if="confirmDel" class="fixed inset-0 z-[96] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 no-print">
      <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-rose-100">
        <div class="flex items-center gap-3 mb-4">
          <div class="p-3 bg-rose-100 text-rose-600 rounded-2xl">
            <AlertTriangle class="w-6 h-6" />
          </div>
          <div>
            <h3 class="font-black text-slate-900 text-sm">حذف فاکتور {{ toFa(confirmDel.id) }}</h3>
            <p class="text-[11px] text-slate-500">
              {{ confirmDel.customer?.firstName }} {{ confirmDel.customer?.lastName }} — {{ faDate(confirmDel.date) }} — {{ formatMoney(confirmDel.finalTotal) }} {{ currency }}
            </p>
          </div>
        </div>
        <p class="text-xs text-slate-600 leading-relaxed mb-5">
          این عملیات بازگشت‌پذیر نیست و فاکتور برای همیشه از فهرست حذف می‌شود. آیا مطمئن هستید؟
        </p>
        <div class="flex items-center gap-2">
          <button @click="deleteInvoice(confirmDel)" class="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition">
            بله، حذف کن
          </button>
          <button @click="confirmDel = null" class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition">
            انصراف
          </button>
        </div>
      </div>
    </div>

    <!-- مودال چاپ فاکتور — حرارتی دوگانه (مشتری + آشپزخانه) -->
    <DualThermalPrintModal
      :open="!!printInv"
      :title="`چاپ فاکتور ${printInv ? toFa(printInv.id) : ''}`"
      :font-family="store.settings?.reportFont || 'Vazirmatn'"
      @close="printInv = null"
    >
      <template #default="{ target }">
        <InvoiceDocument :invoice="printInv" :settings="store.settings" paper-size="thermal80" :target="target" />
      </template>
    </DualThermalPrintModal>
  </div>
</template>
