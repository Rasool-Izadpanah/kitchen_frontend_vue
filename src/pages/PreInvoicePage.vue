<script setup>
/**
 * صدور پیش‌فاکتور — معادل PreInvoicePage.jsx
 * سند موقت (PRE-####) — در کارتابل تأیید/رد می‌شود یا فقط چاپ/ویرایش
 */
import { ref, computed } from 'vue';
import { FileText, Plus, Trash2, Printer, XCircle, Save, Pencil } from 'lucide-vue-next';
import { toFa, formatMoney, jalaliTodayString, nowTime, auditEntry } from '../lib/utils.js';
import { useAppStore } from '../stores/app.js';
import SearchableSelect from '../components/SearchableSelect.vue';
import PrintModal from '../components/PrintModal.vue';
import FaNumberInput from '../components/ui/FaNumberInput.vue';
import { inputCls } from '../components/ui/inputCls.js';

const props = defineProps({
  showToast: { type: Function, required: true },
  userName: { type: String, default: '—' },
});

const store = useAppStore();
const toast = (m, t) => props.showToast(m, t);

const customerId = ref('');
const dishId = ref('');
const count = ref('1');
const supplyId = ref('');
const supplyQty = ref('1');
const items = ref([]);
const discountPercent = ref('0');
const isTaxable = ref(false);
const notes = ref('');
const printDoc = ref(null);
const editDoc = ref(null);

const customer = computed(() => store.customers.find((c) => c.id === customerId.value) || null);
const taxRate = computed(() => Number(store.settings?.taxRate) || 0);
const currency = computed(() => store.settings?.currency || 'تومان');

const subtotal = computed(() => items.value.reduce((s, it) => s + it.totalRow, 0));
const discountAmount = computed(() => Math.round((subtotal.value * (Number(discountPercent.value) || 0)) / 100));
const taxAmount = computed(() => (isTaxable.value ? Math.round(((subtotal.value - discountAmount.value) * taxRate.value) / 100) : 0));
const grandTotal = computed(() => subtotal.value - discountAmount.value + taxAmount.value);

const addDish = () => {
  const d = store.dishes.find((x) => x.id === dishId.value);
  if (!d) return toast('انتخاب غذا الزامی است', 'error');
  const n = Math.max(1, Number(count.value) || 1);
  const ex = items.value.find((it) => it.kind !== 'supply' && it.dishId === d.id);
  if (ex) {
    items.value = items.value.map((it) => (it === ex ? { ...it, count: it.count + n, totalRow: (it.count + n) * it.unitPrice } : it));
  } else {
    items.value = [...items.value, { kind: 'dish', dishId: d.id, dishName: d.name, count: n, unitPrice: d.price, totalRow: n * d.price }];
  }
  dishId.value = '';
  count.value = '1';
};

const addSupply = () => {
  const s = store.supplies.find((x) => x.id === supplyId.value);
  if (!s) return toast('انتخاب قلم جانبی الزامی است', 'error');
  const n = Math.max(1, Number(supplyQty.value) || 1);
  const ex = items.value.find((it) => it.kind === 'supply' && it.dishId === s.id);
  if (ex) {
    items.value = items.value.map((it) => (it === ex ? { ...it, count: it.count + n, totalRow: (it.count + n) * it.unitPrice } : it));
  } else {
    items.value = [...items.value, { kind: 'supply', dishId: s.id, dishName: s.name, count: n, unitPrice: s.price, totalRow: n * s.price }];
  }
  supplyId.value = '';
  supplyQty.value = '1';
};

const removeItem = (idx) => { items.value = items.value.filter((_, i) => i !== idx); };

const reset = () => {
  items.value = [];
  customerId.value = '';
  discountPercent.value = '0';
  isTaxable.value = false;
  notes.value = '';
  editDoc.value = null;
};

const nextNum = (list) => {
  let n = 2001;
  list.forEach((p) => { const m = String(p.id).match(/(\d+)$/); if (m) n = Math.max(n, Number(m[1]) + 1); });
  return n;
};

const saveDoc = () => {
  if (!customer.value) return toast('انتخاب مشتری الزامی است', 'error');
  if (items.value.length === 0) return toast('حداقل یک ردیف لازم است', 'error');
  const doc = {
    id: editDoc.value ? editDoc.value.id : `PRE-${nextNum(store.preinvoices)}`,
    date: editDoc.value ? editDoc.value.date : jalaliTodayString(),
    time: editDoc.value ? editDoc.value.time : toFa(nowTime()),
    createdBy: editDoc.value ? editDoc.value.createdBy : props.userName,
    editedBy: editDoc.value ? props.userName : undefined,
    editedAt: editDoc.value ? `${jalaliTodayString()} ${toFa(nowTime())}` : undefined,
    audit: editDoc.value
      ? [...(editDoc.value.audit || [{ by: editDoc.value.createdBy, at: `${editDoc.value.date} ${editDoc.value.time}`, action: 'ثبت پیش‌فاکتور' }]), auditEntry(store.currentUser, 'ویرایش پیش‌فاکتور')]
      : [auditEntry(store.currentUser, 'ثبت پیش‌فاکتور')],
    customer: customer.value,
    items: [...items.value],
    subtotal: subtotal.value,
    discountPercent: Number(discountPercent.value) || 0,
    discountAmount: discountAmount.value,
    taxRate: taxRate.value,
    taxAmount: taxAmount.value,
    isTaxable: isTaxable.value,
    finalTotal: grandTotal.value,
    notes: notes.value.trim(),
  };
  if (editDoc.value) {
    store.preinvoices = store.preinvoices.map((x) => (x.id === editDoc.value.id ? doc : x));
    toast(`پیش‌فاکتور ${toFa(doc.id)} ویرایش و به‌روزرسانی شد`);
  } else {
    store.preinvoices = [doc, ...store.preinvoices];
    toast(`پیش‌فاکتور ${toFa(doc.id)} ذخیره شد`);
  }
  reset();
  return doc;
};

const saveAndPrint = () => {
  const doc = saveDoc();
  if (doc) printDoc.value = doc;
};

const startEdit = (doc) => {
  if (!store.can('edit_preinvoice')) return toast('شما مجوز ویرایش پیش‌فاکتور را ندارید', 'error');
  editDoc.value = doc;
  customerId.value = doc.customer?.id || '';
  items.value = doc.items.map((it) => ({ ...it }));
  discountPercent.value = String(doc.discountPercent || 0);
  isTaxable.value = !!doc.isTaxable;
  notes.value = doc.notes || '';
  toast(`پیش‌فاکتور ${toFa(doc.id)} برای ویرایش بارگذاری شد`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const cancelEdit = () => {
  editDoc.value = null;
  reset();
};

const deleteSaved = (doc) => {
  store.preinvoices = store.preinvoices.filter((x) => x.id !== doc.id);
  toast('پیش‌فاکتور حذف شد');
};
</script>

<template>
  <div class="space-y-6">
    <!-- هدر -->
    <div class="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
      <div class="p-3 bg-sky-50 text-sky-700 rounded-2xl"><FileText class="w-6 h-6" /></div>
      <div>
        <h2 class="text-base font-black text-slate-900">صدور پیش‌فاکتور</h2>
        <p class="text-[11px] text-slate-500">پیش‌فاکتور سند موقت است، در فاکتورهای فروش ثبت نمی‌شود و برای چاپ/مشاهده ذخیره می‌شود</p>
      </div>
    </div>

    <!-- نوار حالت ویرایش -->
    <div v-if="editDoc" class="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div class="text-xs font-black text-amber-900">
        حالت ویرایش پیش‌فاکتور {{ toFa(editDoc.id) }} — پس از ذخیره، تغییرات جایگزین می‌شود
      </div>
      <button @click="cancelEdit" class="px-4 py-2 bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 rounded-xl text-xs font-bold transition">
        انصراف از ویرایش
      </button>
    </div>

    <!-- فرم -->
    <div class="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5">
      <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
        <div class="sm:col-span-5">
          <label class="block text-xs font-bold text-slate-700 mb-1.5">مشتری: <span class="text-rose-500">*</span></label>
          <SearchableSelect
            v-model="customerId"
            :options="store.customers.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))"
            placeholder="-- انتخاب مشتری --"
          />
        </div>
        <div class="sm:col-span-5">
          <label class="block text-xs font-bold text-slate-700 mb-1.5">غذا:</label>
          <SearchableSelect
            v-model="dishId"
            :options="store.dishes.map((d) => ({ value: d.id, label: `${d.name} — ${formatMoney(d.price)}` }))"
            placeholder="-- انتخاب غذا --"
          />
        </div>
        <div class="sm:col-span-2 flex gap-2">
          <FaNumberInput v-model="count" placeholder="تعداد" />
          <button @click="addDish" class="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition shrink-0"><Plus class="w-4 h-4" /></button>
        </div>
      </div>

      <div v-if="store.supplies.length > 0" class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
        <div class="sm:col-span-5 sm:col-start-2">
          <label class="block text-xs font-bold text-slate-700 mb-1.5">قلم جانبی:</label>
          <SearchableSelect
            v-model="supplyId"
            :options="store.supplies.map((s) => ({ value: s.id, label: `${s.name} — ${formatMoney(s.price)}` }))"
            placeholder="-- انتخاب قلم جانبی --"
          />
        </div>
        <div class="sm:col-span-2 flex gap-2">
          <FaNumberInput v-model="supplyQty" placeholder="تعداد" />
          <button @click="addSupply" class="px-3 py-2.5 bg-slate-600 hover:bg-slate-700 text-white rounded-xl text-xs font-black transition shrink-0"><Plus class="w-4 h-4" /></button>
        </div>
      </div>

      <!-- جدول اقلام -->
      <div v-if="items.length > 0" class="border border-slate-200 rounded-2xl overflow-hidden">
        <table class="w-full text-right text-xs">
          <thead class="bg-slate-50 font-black text-slate-700 border-b border-slate-200">
            <tr>
              <th class="p-2.5">#</th>
              <th class="p-2.5">شرح</th>
              <th class="p-2.5 text-center">تعداد</th>
              <th class="p-2.5 text-left">قیمت واحد</th>
              <th class="p-2.5 text-left">جمع</th>
              <th class="p-2.5 text-center w-12"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="(it, i) in items" :key="i" class="hover:bg-slate-50">
              <td class="p-2.5 text-slate-400">{{ toFa(i + 1) }}</td>
              <td class="p-2.5 font-bold text-slate-800">
                {{ it.dishName }}
                <span v-if="it.kind === 'supply'" class="mr-1.5 text-[9px] px-1.5 py-0.5 bg-slate-100 rounded-full text-slate-500">جانبی</span>
              </td>
              <td class="p-2.5 text-center font-black">{{ toFa(it.count) }}</td>
              <td class="p-2.5 text-left tabular-nums">{{ formatMoney(it.unitPrice) }}</td>
              <td class="p-2.5 text-left font-black text-slate-900 tabular-nums">{{ formatMoney(it.totalRow) }}</td>
              <td class="p-2.5 text-center">
                <button @click="removeItem(i)" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"><Trash2 class="w-4 h-4" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- تخفیف/مالیات + جمع -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="space-y-3">
          <div class="flex items-center gap-3">
            <label class="text-xs font-bold text-slate-700 shrink-0">تخفیف (٪):</label>
            <FaNumberInput v-model="discountPercent" class="w-24" />
          </div>
          <label class="flex items-center gap-2 cursor-pointer w-fit">
            <input v-model="isTaxable" type="checkbox" class="w-4 h-4 accent-emerald-600" />
            <span class="text-xs font-bold text-slate-700">مشمول مالیات ({{ toFa(taxRate) }}٪)</span>
          </label>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">توضیحات:</label>
            <textarea v-model="notes" rows="2" :class="`${inputCls} resize-none`" />
          </div>
        </div>
        <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
          <div class="flex justify-between"><span class="text-slate-500 font-bold">جمع کل:</span><span class="font-black tabular-nums">{{ formatMoney(subtotal) }} {{ currency }}</span></div>
          <div class="flex justify-between"><span class="text-slate-500 font-bold">تخفیف:</span><span class="font-black text-rose-600 tabular-nums">−{{ formatMoney(discountAmount) }}</span></div>
          <div v-if="isTaxable" class="flex justify-between"><span class="text-slate-500 font-bold">مالیات ({{ toFa(taxRate) }}٪):</span><span class="font-black tabular-nums">{{ formatMoney(taxAmount) }}</span></div>
          <div class="flex justify-between pt-2 border-t border-dashed border-slate-300"><span class="font-black text-slate-800">مبلغ نهایی:</span><span class="text-base font-black text-emerald-700 tabular-nums">{{ formatMoney(grandTotal) }} {{ currency }}</span></div>
        </div>
      </div>

      <div class="flex gap-2 flex-wrap">
        <button @click="saveDoc" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition flex items-center gap-1.5"><Save class="w-4 h-4" /> {{ editDoc ? 'ذخیره تغییرات' : 'ذخیره پیش‌فاکتور' }}</button>
        <button @click="saveAndPrint" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5"><Printer class="w-4 h-4" /> ذخیره و چاپ</button>
        <button @click="reset" class="px-5 py-2.5 bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition flex items-center gap-1.5"><XCircle class="w-4 h-4" /> پاک کردن فرم</button>
      </div>
    </div>

    <!-- لیست پیش‌فاکتورهای ذخیره‌شده -->
    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div class="p-4 border-b border-slate-100 flex items-center justify-between">
        <h3 class="text-sm font-black text-slate-800">پیش‌فاکتورهای ذخیره‌شده ({{ toFa(store.preinvoices.length) }})</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-right text-xs">
          <thead class="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
            <tr>
              <th class="p-3">شماره</th>
              <th class="p-3">تاریخ</th>
              <th class="p-3">مشتری</th>
              <th class="p-3">اقلام</th>
              <th class="p-3 text-left">مبلغ نهایی</th>
              <th class="p-3 text-center w-24">عملیات</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="store.preinvoices.length === 0">
              <td colspan="6" class="p-6 text-center text-slate-400 font-bold">پیش‌فاکتوری ذخیره نشده است</td>
            </tr>
            <template v-else>
              <tr v-for="doc in store.preinvoices" :key="doc.id" class="hover:bg-slate-50">
                <td class="p-3 font-black text-sky-700" dir="ltr">{{ toFa(doc.id) }}</td>
                <td class="p-3 text-slate-600">{{ toFa(doc.date) }}</td>
                <td class="p-3 font-bold text-slate-800">{{ doc.customer?.firstName }} {{ doc.customer?.lastName }}</td>
                <td class="p-3 text-slate-500">{{ doc.items.map((it) => `${it.dishName} (${toFa(it.count)})`).join(' + ') }}</td>
                <td class="p-3 text-left font-black tabular-nums">
                  {{ formatMoney(doc.finalTotal) }}
                  <span v-if="doc.editedAt" class="block text-[9px] font-bold text-sky-600">ویرایش‌شده</span>
                </td>
                <td class="p-3 text-center">
                  <div class="flex items-center justify-center gap-1">
                    <button v-if="store.can('edit_preinvoice')" @click="startEdit(doc)" title="ویرایش" class="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition"><Pencil class="w-4 h-4" /></button>
                    <button @click="printDoc = doc" title="چاپ" class="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"><Printer class="w-4 h-4" /></button>
                    <button @click="deleteSaved(doc)" title="حذف" class="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"><Trash2 class="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- مودال چاپ -->
    <PrintModal
      :open="!!printDoc"
      :title="`چاپ پیش‌فاکتور ${printDoc ? toFa(printDoc.id) : ''}`"
      v-model:paper-size="store.paperSize"
      v-model:copies="store.copies"
      :font-family="store.settings?.reportFont || 'Vazirmatn'"
      @close="printDoc = null"
    >
      <div v-if="printDoc" id="print-area" class="space-y-4 text-slate-900">
        <div class="text-center space-y-1 pb-3 border-b-2 border-slate-800">
          <div class="text-lg font-black">{{ store.settings?.kitchenName || 'آشپزخانه نسیم' }}</div>
          <div v-if="store.settings?.charityName" class="text-[11px] text-slate-600">وابسته به {{ store.settings.charityName }}</div>
          <div class="text-sm font-black mt-2">پیش‌فاکتور فروش</div>
        </div>
        <div class="grid grid-cols-2 gap-2 text-[11px]">
          <div class="flex justify-between"><span class="text-slate-500">شماره:</span><strong>{{ toFa(printDoc.id) }}</strong></div>
          <div class="flex justify-between"><span class="text-slate-500">تاریخ:</span><span>{{ toFa(printDoc.date) }}</span></div>
          <div class="flex justify-between"><span class="text-slate-500">ساعت:</span><span>{{ toFa(printDoc.time) }}</span></div>
          <div class="flex justify-between"><span class="text-slate-500">کاربر:</span><span>{{ printDoc.createdBy }}</span></div>
          <div class="col-span-2 flex justify-between"><span class="text-slate-500">مشتری:</span><strong>{{ printDoc.customer?.firstName }} {{ printDoc.customer?.lastName }}</strong></div>
          <div v-if="printDoc.customer?.mobile" class="col-span-2 flex justify-between"><span class="text-slate-500">موبایل:</span><span dir="ltr">{{ toFa(printDoc.customer.mobile) }}</span></div>
        </div>
        <table class="w-full text-right text-[11px] border border-slate-300">
          <thead class="bg-slate-100 font-black border-b border-slate-300">
            <tr>
              <th class="p-2 border-l border-slate-300">#</th>
              <th class="p-2 border-l border-slate-300">شرح</th>
              <th class="p-2 border-l border-slate-300 text-center">تعداد</th>
              <th class="p-2 border-l border-slate-300 text-left">قیمت واحد</th>
              <th class="p-2 text-left">جمع</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            <tr v-for="(it, i) in printDoc.items" :key="i">
              <td class="p-2 border-l border-slate-200">{{ toFa(i + 1) }}</td>
              <td class="p-2 border-l border-slate-200 font-bold">{{ it.dishName }}</td>
              <td class="p-2 border-l border-slate-200 text-center">{{ toFa(it.count) }}</td>
              <td class="p-2 border-l border-slate-200 text-left tabular-nums">{{ formatMoney(it.unitPrice) }}</td>
              <td class="p-2 text-left font-black tabular-nums">{{ formatMoney(it.totalRow) }}</td>
            </tr>
          </tbody>
        </table>
        <div class="flex justify-end">
          <div class="w-64 space-y-1.5 text-[11px]">
            <div class="flex justify-between"><span class="text-slate-500">جمع کل:</span><span class="font-black tabular-nums">{{ formatMoney(printDoc.subtotal) }} {{ currency }}</span></div>
            <div v-if="printDoc.discountAmount > 0" class="flex justify-between"><span class="text-slate-500">تخفیف ({{ toFa(printDoc.discountPercent) }}٪):</span><span class="tabular-nums">−{{ formatMoney(printDoc.discountAmount) }}</span></div>
            <div v-if="printDoc.isTaxable" class="flex justify-between"><span class="text-slate-500">مالیات ({{ toFa(printDoc.taxRate) }}٪):</span><span class="tabular-nums">{{ formatMoney(printDoc.taxAmount) }}</span></div>
            <div class="flex justify-between pt-2 border-t-2 border-slate-800"><span class="font-black">مبلغ نهایی:</span><span class="text-sm font-black tabular-nums">{{ formatMoney(printDoc.finalTotal) }} {{ currency }}</span></div>
          </div>
        </div>
        <div v-if="printDoc.notes" class="text-[11px] pt-2 border-t border-dashed border-slate-300"><strong>توضیحات:</strong> {{ printDoc.notes }}</div>
        <div class="text-[10px] text-slate-400 text-center pt-3 border-t border-dashed border-slate-200">
          این سند یک پیش‌فاکتور است و سند حسابداری محسوب نمی‌شود.
        </div>
      </div>
    </PrintModal>
  </div>
</template>
