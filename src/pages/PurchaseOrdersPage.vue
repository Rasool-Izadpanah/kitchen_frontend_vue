<script setup>
/**
 * چرخه خرید (فاز ۲) — PO، GRN، فاکتور خرید، تطبیق سه‌طرفه
 * جریان: PR تأییدشده → صدور PO → ارسال → دریافت (GRN جزئی/کامل) → فاکتور خرید → تطبیق سه‌طرفه → پرداخت
 */
import { ref, computed } from 'vue';
import {
  ClipboardList, Truck, FileText, Plus, Trash2, Send, CheckCheck, XCircle,
  Scale, Banknote, Eye, Package, AlertTriangle, CheckCircle2,
} from 'lucide-vue-next';
import { toFa, formatMoney, jalaliTodayString, nowTime, uid } from '../lib/utils.js';
import {
  createPO, sendPO, cancelPO, createGRN, finalizeGRN,
  createPurchaseInvoice, recomputeMatch, payInvoice, onOrderQty,
  PO_STATUS, MATCH_STATUS, PAY_STATUS,
} from '../lib/purchasing.js';
import { useAppStore } from '../stores/app.js';
import SearchableSelect from '../components/SearchableSelect.vue';
import Modal from '../components/ui/Modal.vue';
import FaNumberInput from '../components/ui/FaNumberInput.vue';
import MoneyInput from '../components/ui/MoneyInput.vue';
import JalaliDatePicker from '../components/JalaliDatePicker.vue';
import EmptyRow from '../components/ui/EmptyRow.vue';
import { inputCls } from '../components/ui/inputCls.js';

const props = defineProps({
  showToast: { type: Function, required: true },
  userName: { type: String, default: '—' },
});

const store = useAppStore();
const toast = (m, t) => props.showToast(m, t);
const user = () => store.currentUser;

const tab = ref('orders'); // orders | receipts | invoices

// ===== صدور PO =====
const poModal = ref(null); // { pr }
const poF = ref({ supplierId: '', expectedDate: '', notes: '' });
const poItems = ref([]); // {ingredientId, name, unit, qty, unitPrice}

const openPoModal = (pr) => {
  if (!store.can('create_purchase_order')) return toast('شما مجوز صدور سفارش خرید را ندارید', 'error');
  poModal.value = { pr };
  poF.value = { supplierId: '', expectedDate: '', notes: '' };
  poItems.value = pr.items
    .filter((it) => it.decision === 'approve')
    .map((it) => ({ ingredientId: it.ingredientId || '', supplyId: it.supplyId || '', name: it.name, unit: it.unit, qty: it.qty, unitPrice: 0 }));
};

const poSubmit = (asSend) => {
  if (!poF.value.supplierId) return toast('انتخاب تأمین‌کننده الزامی است', 'error');
  if (poItems.value.some((it) => !it.qty || it.qty <= 0)) return toast('مقدار همه اقلام باید بزرگ‌تر از صفر باشد', 'error');
  const po = createPO(store, {
    prId: poModal.value.pr.id,
    supplierId: poF.value.supplierId,
    items: poItems.value,
    expectedDate: poF.value.expectedDate,
    notes: poF.value.notes,
  });
  if (asSend) sendPO(store, po);
  // اطلاع به انباردار
  (store.users || []).filter((u) => u.roles?.includes('storekeeper') || u.roles?.includes('admin')).forEach((u) => {
    store.messages.push({ id: uid('msg'), to: u.fullName || u.username, kind: 'info', text: `سفارش خرید ${po.id} برای ${store.suppliers.find((s) => s.id === poF.value.supplierId)?.name || '—'} صادر شد (${toFa(poItems.value.length)} قلم).`, read: false, date: jalaliTodayString(), time: toFa(nowTime()) });
  });
  poModal.value = null;
  toast(asSend ? `سفارش ${po.id} صادر و به تأمین‌کننده ارسال شد` : `سفارش ${po.id} به‌صورت پیش‌نویس ذخیره شد`);
};

// ===== GRN =====
const grnModal = ref(null); // { po }
const grnItems = ref([]);
const grnF = ref({ notes: '', warehouseDestination: 'انبار اصلی' });

const openGrnModal = (po) => {
  if (!store.can('receive_goods')) return toast('شما مجوز ثبت رسید انبار را ندارید', 'error');
  const outstanding = po.items.filter((it) => (it.receivedQty || 0) < (it.qty || 0));
  if (outstanding.length === 0) return toast('همه اقلام این سفارش دریافت شده‌اند', 'info');
  grnModal.value = { po };
  grnF.value = { notes: '', warehouseDestination: 'انبار اصلی' };
  grnItems.value = outstanding.map((it) => ({
    ingredientId: it.ingredientId || '', supplyId: it.supplyId || '', name: it.name,
    unit: it.unit, orderedQty: it.qty,
    remaining: Math.round((it.qty - (it.receivedQty || 0)) * 1000) / 1000,
    receivedQty: Math.round((it.qty - (it.receivedQty || 0)) * 1000) / 1000,
    rejectedQty: 0, rejectReason: '', unitPrice: it.unitPrice || 0,
    batchNo: '', expiryDate: '', qualityOk: true, temperature: '',
  }));
};

const grnSubmit = () => {
  const { po } = grnModal.value;
  const valid = grnItems.value.filter((it) => (Number(it.receivedQty) || 0) > 0 || (Number(it.rejectedQty) || 0) > 0);
  if (valid.length === 0) return toast('حداقل برای یک قلم مقدار دریافت یا رد وارد کنید', 'error');
  const grn = createGRN(store, { po, items: valid, notes: grnF.value.notes, warehouseDestination: grnF.value.warehouseDestination });
  finalizeGRN(store, grn);
  // ساخت درخواست ورود کالا به کارتابل (نهایی GRN موجودی را از طریق تایید انباردار افزایش می‌دهد)
  const req = {
    id: `SR-${Date.now()}`,
    kind: 'stockin',
    date: jalaliTodayString(), time: toFa(nowTime()),
    requester: props.userName || '—',
    supplierName: grn.supplierName,
    grnId: grn.id,
    desc: `رسید انبار ${grn.id} — سفارش ${po?.id || ''}`,
    items: valid.filter((it) => (Number(it.receivedQty) || 0) > 0).map((it) => ({
      ingredientId: it.ingredientId, supplyId: it.supplyId, name: it.name, kind: it.ingredientId ? 'ingredient' : 'supply',
      qty: Number(it.receivedQty), unit: it.unit, price: Number(it.unitPrice) || 0,
      batchNo: it.batchNo || '', expiryDate: it.expiryDate || '',
    })),
    status: 'temp',
  };
  store.stockRequests = [req, ...(store.stockRequests || [])];
  grnModal.value = null;
  toast(`رسید ${grn.id} ثبت شد — اقلام برای ورود به انبار به کارتابل ارسال شد`);
};

// ===== فاکتور خرید =====
const invModal = ref(null);
const invF = ref({ supplierId: '', invoiceNumber: '', date: jalaliTodayString(), taxAmount: 0, discount: 0 });
const invItems = ref([]);
const invGrnIds = ref([]);

const openInvModal = (grns) => {
  if (!store.can('record_purchase_invoice')) return toast('شما مجوز ثبت فاکتور خرید را ندارید', 'error');
  const g = grns[0];
  invModal.value = {};
  invF.value = { supplierId: g.supplierId, invoiceNumber: '', date: jalaliTodayString(), taxAmount: 0, discount: 0 };
  invGrnIds.value = grns.map((x) => x.id);
  // اقلام از GRNها
  const map = {};
  grns.forEach((gr) => gr.items.forEach((it) => {
    const key = it.ingredientId || it.supplyId || it.name;
    if (!map[key]) map[key] = { ingredientId: it.ingredientId || '', supplyId: it.supplyId || '', name: it.name, unit: it.unit, qty: 0, unitPrice: it.unitPrice || 0 };
    map[key].qty += it.receivedQty || 0;
  }));
  invItems.value = Object.values(map);
};

const invSubmit = () => {
  if (!invF.value.invoiceNumber.trim()) return toast('شماره فاکتور تأمین‌کننده الزامی است', 'error');
  const inv = createPurchaseInvoice(store, {
    supplierId: invF.value.supplierId,
    invoiceNumber: invF.value.invoiceNumber.trim(),
    date: invF.value.date,
    items: invItems.value,
    grnIds: invGrnIds.value,
    taxAmount: Number(invF.value.taxAmount) || 0,
    discount: Number(invF.value.discount) || 0,
  });
  invModal.value = null;
  toast(`فاکتور خرید ${inv.invoiceNumber} ثبت شد — وضعیت تطبیق: ${inv.matchStatus === 'matched' ? 'سازگار' : 'مغایرت'}`);
};

// ===== داده‌های نمایش =====
const openPOs = computed(() => (store.purchaseOrders || []).filter((po) => ['draft', 'sent', 'partially_received'].includes(po.status)));
const finalGrns = computed(() => (store.goodsReceipts || []).filter((g) => g.status === 'final'));
const supplierName = (id) => store.suppliers.find((s) => s.id === id)?.name || '—';
const prLabel = (prId) => {
  const pr = (store.purchaseRequests || []).find((r) => r.id === prId);
  return pr ? `${pr.id} — ${pr.date}` : prId || '—';
};
const poMeta = (s) => PO_STATUS[s] || { label: s, cls: 'bg-slate-100 text-slate-600' };
const matchMeta = (s) => MATCH_STATUS[s] || { label: s, cls: 'bg-slate-100 text-slate-600' };
const payMeta = (s) => PAY_STATUS[s] || { label: s, cls: 'bg-slate-100 text-slate-600' };

// PRهای تأییدشده که هنوز PO ندارند
const approvedPRs = computed(() => (store.purchaseRequests || []).filter((r) => r.status === 'ordered'));
const hasPO = (prId) => (store.purchaseOrders || []).some((po) => po.prId === prId && po.status !== 'cancelled');

// ===== تأمین‌کنندگان (مدیریت سریع) =====
const supF = ref(null); // ویرایش/افزودن
const supSubmit = () => {
  const f = supF.value;
  if (!(f.name || '').trim()) return toast('نام تأمین‌کننده الزامی است', 'error');
  if (f.id) {
    store.suppliers = store.suppliers.map((s) => (s.id === f.id ? { ...s, ...f } : s));
    toast('تأمین‌کننده ویرایش شد');
  } else {
    store.suppliers = [...store.suppliers, { ...f, id: uid('sup'), active: f.active !== false, audit: [] }];
    toast('تأمین‌کننده جدید ثبت شد');
  }
  supF.value = null;
};
</script>

<template>
  <div class="space-y-6">
    <!-- هدر -->
    <div class="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
      <div class="p-3 bg-indigo-50 text-indigo-700 rounded-2xl"><ClipboardList class="w-6 h-6" /></div>
      <div>
        <h2 class="text-base font-black text-slate-900">چرخه خرید — سفارش، رسید، فاکتور</h2>
        <p class="text-[11px] text-slate-500">PR → سفارش خرید → رسید انبار (GRN) → فاکتور خرید → تطبیق سه‌طرفه → پرداخت</p>
      </div>
    </div>

    <!-- تب‌ها -->
    <div class="bg-white rounded-2xl border border-slate-200 p-2 flex gap-1.5 overflow-x-auto">
      <button @click="tab = 'orders'" :class="`relative px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition ${tab === 'orders' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`">
        <ClipboardList class="w-4 h-4" /> سفارش‌های خرید
      </button>
      <button @click="tab = 'receipts'" :class="`relative px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition ${tab === 'receipts' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`">
        <Truck class="w-4 h-4" /> رسیدهای انبار (GRN)
      </button>
      <button @click="tab = 'invoices'" :class="`relative px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition ${tab === 'invoices' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`">
        <FileText class="w-4 h-4" /> فاکتورهای خرید
      </button>
      <button v-if="store.can('manage_suppliers')" @click="tab = 'suppliers'" :class="`relative px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition ${tab === 'suppliers' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`">
        تأمین‌کنندگان
      </button>
    </div>

    <!-- ===== تب سفارش‌ها ===== -->
    <div v-if="tab === 'orders'" class="space-y-4">
      <!-- PRهای آماده صدور PO -->
      <div v-if="store.can('create_purchase_order') && approvedPRs.filter((r) => !hasPO(r.id)).length > 0" class="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
        <div class="text-xs font-black text-amber-900 flex items-center gap-1.5"><AlertTriangle class="w-4 h-4" /> درخواست‌های خرید تأیید‌شده بدون سفارش:</div>
        <div v-for="pr in approvedPRs.filter((r) => !hasPO(r.id))" :key="pr.id" class="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-amber-200">
          <span class="text-[11px] font-bold text-slate-700">{{ prLabel(pr.id) }} — {{ toFa(pr.items.length) }} قلم ({{ pr.items.filter((i) => i.decision === 'approve').length }} تأییدشده)</span>
          <button class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black" @click="openPoModal(pr)">
            <Plus class="w-3.5 h-3.5 inline" /> صدور سفارش خرید
          </button>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div class="p-4 border-b border-slate-100"><h3 class="text-sm font-black text-slate-800">سفارش‌های خرید (PO)</h3></div>
        <table class="w-full text-right text-xs">
          <thead class="bg-slate-50 font-black text-slate-700 border-b border-slate-200">
            <tr>
              <th class="p-3">شماره</th><th class="p-3">درخواست مبدأ</th><th class="p-3">تأمین‌کننده</th>
              <th class="p-3 text-center">اقلام</th><th class="p-3 text-left">جمع ({{ store.currency }})</th>
              <th class="p-3 text-center">وضعیت</th><th class="p-3 text-center w-40">عملیات</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <EmptyRow v-if="(store.purchaseOrders || []).length === 0" :col-span="7" text="سفارشی ثبت نشده" />
            <tr v-for="po in store.purchaseOrders" v-else :key="po.id" class="hover:bg-slate-50">
              <td class="p-3 font-mono text-slate-600" dir="ltr">{{ po.id }}</td>
              <td class="p-3 text-slate-500">{{ prLabel(po.prId) }}</td>
              <td class="p-3 font-bold text-slate-800">{{ supplierName(po.supplierId) }}</td>
              <td class="p-3 text-center">{{ toFa(po.items.length) }}</td>
              <td class="p-3 text-left font-black tabular-nums">{{ formatMoney(po.items.reduce((s, it) => s + it.qty * (it.unitPrice || 0), 0)) }}</td>
              <td class="p-3 text-center"><span class="px-2 py-1 rounded-full text-[10px] font-black" :class="poMeta(po.status).cls">{{ poMeta(po.status).label }}</span></td>
              <td class="p-3 text-center">
                <div class="flex items-center justify-center gap-1">
                  <button v-if="po.status === 'draft'" title="ارسال به تأمین‌کننده" class="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg" @click="sendPO(store, po); toast('سفارش ارسال شد')"><Send class="w-4 h-4" /></button>
                  <button v-if="['sent', 'partially_received'].includes(po.status)" title="ثبت رسید انبار (GRN)" class="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg" @click="openGrnModal(po)"><Truck class="w-4 h-4" /></button>
                  <button v-if="['draft', 'sent', 'partially_received'].includes(po.status)" title="ابطال" class="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg" @click="cancelPO(store, po, 'ابطال دستی'); toast('سفارش ابطال شد')"><XCircle class="w-4 h-4" /></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ===== تب رسیدهای انبار ===== -->
    <div v-if="tab === 'receipts'" class="space-y-4">
      <div v-if="finalGrns.filter((g) => g.status === 'final').length > 0" class="bg-sky-50 border border-sky-200 rounded-2xl p-4 space-y-2">
        <div class="text-xs font-black text-sky-900 flex items-center gap-1.5"><FileText class="w-4 h-4" /> ثبت فاکتور خرید برای رسیدهای نهایی:</div>
        <button class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-black" @click="openInvModal(finalGrns)">
          <FileText class="w-4 h-4 inline" /> ثبت فاکتور برای {{ toFa(finalGrns.length) }} رسید
        </button>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div class="p-4 border-b border-slate-100"><h3 class="text-sm font-black text-slate-800">رسیدهای انبار (GRN)</h3></div>
        <table class="w-full text-right text-xs">
          <thead class="bg-slate-50 font-black text-slate-700 border-b border-slate-200">
            <tr>
              <th class="p-3">شماره</th><th class="p-3">سفارش</th><th class="p-3">تأمین‌کننده</th>
              <th class="p-3">دریافت‌کننده</th><th class="p-3 text-center">اقلام</th>
              <th class="p-3 text-left">جمع دریافتی</th><th class="p-3 text-center">وضعیت</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <EmptyRow v-if="(store.goodsReceipts || []).length === 0" :col-span="7" text="رسیدی ثبت نشده" />
            <tr v-for="g in store.goodsReceipts" v-else :key="g.id" class="hover:bg-slate-50">
              <td class="p-3 font-mono text-slate-600" dir="ltr">{{ g.id }}</td>
              <td class="p-3 text-slate-500" dir="ltr">{{ g.poId || '—' }}</td>
              <td class="p-3 font-bold text-slate-800">{{ g.supplierName }}</td>
              <td class="p-3 text-slate-600">{{ g.receivedBy }}</td>
              <td class="p-3 text-center">{{ toFa(g.items.length) }}</td>
              <td class="p-3 text-left font-black tabular-nums">{{ formatMoney(g.items.reduce((s, it) => s + it.total, 0)) }}</td>
              <td class="p-3 text-center"><span class="px-2 py-1 rounded-full text-[10px] font-black" :class="g.status === 'final' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'">{{ g.status === 'final' ? 'نهایی' : 'پیش‌نویس' }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ===== تب فاکتورهای خرید ===== -->
    <div v-if="tab === 'invoices'" class="space-y-4">
      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div class="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 class="text-sm font-black text-slate-800">فاکتورهای خرید و تطبیق سه‌طرفه</h3>
        </div>
        <table class="w-full text-right text-xs">
          <thead class="bg-slate-50 font-black text-slate-700 border-b border-slate-200">
            <tr>
              <th class="p-3">شماره فاکتور</th><th class="p-3">تأمین‌کننده</th><th class="p-3">تاریخ</th>
              <th class="p-3 text-left">مبلغ نهایی</th><th class="p-3 text-left">مانده</th>
              <th class="p-3 text-center">تطبیق</th><th class="p-3 text-center">پرداخت</th>
              <th class="p-3 text-center w-24">عملیات</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <EmptyRow v-if="(store.purchaseInvoices || []).length === 0" :col-span="8" text="فاکتوری ثبت نشده" />
            <tr v-for="inv in store.purchaseInvoices" v-else :key="inv.id" class="hover:bg-slate-50">
              <td class="p-3 font-bold text-slate-800" dir="ltr">{{ inv.invoiceNumber || inv.id }}</td>
              <td class="p-3">{{ inv.supplierName }}</td>
              <td class="p-3">{{ toFa(inv.date) }}</td>
              <td class="p-3 text-left font-black tabular-nums">{{ formatMoney(inv.finalTotal) }}</td>
              <td class="p-3 text-left tabular-nums" :class="inv.finalTotal - (inv.paidAmount || 0) > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600'">{{ formatMoney(inv.finalTotal - (inv.paidAmount || 0)) }}</td>
              <td class="p-3 text-center">
                <span class="px-2 py-1 rounded-full text-[10px] font-black" :class="matchMeta(inv.matchStatus).cls" :title="inv.mismatchNotes">{{ matchMeta(inv.matchStatus).label }}</span>
                <button v-if="store.can('three_way_match')" class="block mx-auto mt-1 text-[9px] text-indigo-600 hover:underline font-bold" @click="recomputeMatch(store, inv.id); toast('تطبیق مجدد انجام شد')">تطبیق مجدد</button>
                <p v-if="inv.matchStatus === 'mismatch' && inv.mismatchNotes" class="text-[9px] text-rose-600 mt-1 max-w-[200px]" :title="inv.mismatchNotes">{{ inv.mismatchNotes.slice(0, 60) }}...</p>
              </td>
              <td class="p-3 text-center"><span class="px-2 py-1 rounded-full text-[10px] font-black" :class="payMeta(inv.paymentStatus).cls">{{ payMeta(inv.paymentStatus).label }}</span></td>
              <td class="p-3 text-center">
                <button
                  v-if="store.can('three_way_match') && inv.paymentStatus !== 'paid'"
                  title="ثبت پرداخت (تسویه کامل)"
                  class="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                  @click="payInvoice(store, inv.id, inv.finalTotal - (inv.paidAmount || 0)); toast('پرداخت ثبت شد')"
                ><Banknote class="w-4 h-4" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ===== تب تأمین‌کنندگان ===== -->
    <div v-if="tab === 'suppliers'" class="space-y-4">
      <div class="flex justify-end">
        <button class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5" @click="supF = { name: '', phone: '', address: '', economicCode: '', nationalId: '', notes: '', active: true }">
          <Plus class="w-4 h-4" /> تأمین‌کننده جدید
        </button>
      </div>
      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table class="w-full text-right text-xs">
          <thead class="bg-slate-50 font-black text-slate-700 border-b border-slate-200">
            <tr><th class="p-3">نام</th><th class="p-3">تلفن</th><th class="p-3">آدرس</th><th class="p-3 text-center">وضعیت</th><th class="p-3 text-center w-20">ویرایش</th></tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <EmptyRow v-if="store.suppliers.length === 0" :col-span="5" text="تأمین‌کننده‌ای ثبت نشده" />
            <tr v-for="s in store.suppliers" v-else :key="s.id" class="hover:bg-slate-50">
              <td class="p-3 font-black text-slate-800">{{ s.name }}</td>
              <td class="p-3" dir="ltr">{{ s.phone || '—' }}</td>
              <td class="p-3 text-slate-500">{{ s.address || '—' }}</td>
              <td class="p-3 text-center">
                <span class="px-2 py-1 rounded-full text-[10px] font-black" :class="s.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'">{{ s.active ? 'فعال' : 'غیرفعال' }}</span>
              </td>
              <td class="p-3 text-center"><button class="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg" @click="supF = { ...s }"><Eye class="w-4 h-4" /></button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ===== مودال صدور PO ===== -->
    <Modal v-if="poModal" wide title="صدور سفارش خرید" @close="poModal = null">
      <div class="space-y-4 text-xs">
        <p class="font-bold text-slate-600">درخواست مبدأ: {{ poModal.pr.id }} — {{ toFa(poItems.length) }} قلم تأییدشده</p>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">تأمین‌کننده: <span class="text-rose-500">*</span></label>
            <SearchableSelect v-model="poF.supplierId" placeholder="-- انتخاب --" :options="store.suppliers.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name, searchText: s.name }))" />
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">تاریخ تحویل موردانتظار:</label>
            <JalaliDatePicker v-model="poF.expectedDate" :min-date="jalaliTodayString()" />
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">یادداشت:</label>
            <input v-model="poF.notes" :class="inputCls" placeholder="اختیاری..." />
          </div>
        </div>
        <table class="w-full text-right border border-slate-200 rounded-xl overflow-hidden">
          <thead class="bg-slate-50 font-black text-slate-700">
            <tr><th class="p-2">کالا</th><th class="p-2 text-center">مقدار</th><th class="p-2">واحد</th><th class="p-2 text-center">قیمت واحد</th><th class="p-2 text-left">جمع</th></tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="(it, i) in poItems" :key="i">
              <td class="p-2 font-bold">{{ it.name }}</td>
              <td class="p-2 text-center"><FaNumberInput v-model="it.qty" class="w-20 text-center" /></td>
              <td class="p-2 text-slate-500">{{ it.unit }}</td>
              <td class="p-2"><MoneyInput v-model="it.unitPrice" class="w-28 text-center" /></td>
              <td class="p-2 text-left font-black tabular-nums">{{ formatMoney((Number(it.qty) || 0) * (Number(it.unitPrice) || 0)) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <template #footer>
        <div class="flex gap-2">
          <button class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold" @click="poSubmit(false)">ذخیره پیش‌نویس</button>
          <button class="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black" @click="poSubmit(true)">صادر و ارسال به تأمین‌کننده</button>
          <button class="px-5 py-2.5 bg-white border border-slate-300 text-slate-600 rounded-xl text-xs font-bold" @click="poModal = null">انصراف</button>
        </div>
      </template>
    </Modal>

    <!-- ===== مودال GRN ===== -->
    <Modal v-if="grnModal" wide title="ثبت رسید انبار (GRN)" @close="grnModal = null">
      <div class="space-y-4 text-xs">
        <p class="font-bold text-slate-600">
          سفارش {{ grnModal.po.id }} — تأمین‌کننده: {{ supplierName(grnModal.po.supplierId) }}
          <span class="text-slate-400">(مقدار پیش‌فرض = مانده دریافت)</span>
        </p>
        <table class="w-full text-right border border-slate-200 rounded-xl overflow-hidden">
          <thead class="bg-slate-50 font-black text-slate-700">
            <tr>
              <th class="p-2">کالا</th><th class="p-2 text-center">سفارش</th><th class="p-2 text-center">مانده</th>
              <th class="p-2 text-center">دریافتی</th><th class="p-2 text-center">رد‌شده</th>
              <template v-if="store.settings.enableQualityCheck"><th class="p-2 text-center">کیفیت OK</th></template>
              <template v-if="store.settings.enableBatchTracking"><th class="p-2">شماره بچ</th></template>
              <template v-if="store.settings.enableExpiryTracking"><th class="p-2">انقضا</th></template>
              <th class="p-2 text-center">قیمت واحد</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="(it, i) in grnItems" :key="i">
              <td class="p-2 font-bold">{{ it.name }}</td>
              <td class="p-2 text-center text-slate-500">{{ toFa(it.orderedQty) }} {{ it.unit }}</td>
              <td class="p-2 text-center font-black text-indigo-700">{{ toFa(it.remaining) }}</td>
              <td class="p-2 text-center"><FaNumberInput v-model="it.receivedQty" class="w-20 text-center" /></td>
              <td class="p-2 text-center"><FaNumberInput v-model="it.rejectedQty" class="w-20 text-center" /></td>
              <template v-if="store.settings.enableQualityCheck"><td class="p-2 text-center"><input type="checkbox" v-model="it.qualityOk" class="w-4 h-4 accent-emerald-600" /></td></template>
              <template v-if="store.settings.enableBatchTracking"><td class="p-2"><input v-model="it.batchNo" :class="`${inputCls} w-24 text-center`" /></td></template>
              <template v-if="store.settings.enableExpiryTracking"><td class="p-2"><input v-model="it.expiryDate" :class="`${inputCls} w-28 text-center`" dir="ltr" placeholder="1405/01/01" /></td></template>
              <td class="p-2"><MoneyInput v-model="it.unitPrice" class="w-28 text-center" /></td>
            </tr>
          </tbody>
        </table>
        <input v-model="grnF.notes" :class="inputCls" placeholder="یادداشت رسید (اختیاری)..." />
        <div class="bg-sky-50 border border-sky-200 rounded-xl p-3 text-[11px] font-bold text-sky-900">
          با ثبت، اقلام دریافتی برای ورود به انبار به کارتابل ارسال می‌شود (پس از تایید انباردار به موجودی اضافه می‌گردد).
        </div>
      </div>
      <template #footer>
        <div class="flex gap-2">
          <button class="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black" @click="grnSubmit">ثبت رسید و ارسال به کارتابل</button>
          <button class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold" @click="grnModal = null">انصراف</button>
        </div>
      </template>
    </Modal>

    <!-- ===== مودال فاکتور خرید ===== -->
    <Modal v-if="invF.supplierId !== '' && invItems.length > 0" wide title="ثبت فاکتور خرید" @close="invF.supplierId = ''; invItems = []">
      <div class="space-y-4 text-xs">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">شماره فاکتور تأمین‌کننده: <span class="text-rose-500">*</span></label>
            <input v-model="invF.invoiceNumber" :class="inputCls" dir="ltr" />
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">تاریخ فاکتور:</label>
            <JalaliDatePicker v-model="invF.date" />
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">تأمین‌کننده:</label>
            <input :value="supplierName(invF.supplierId)" :class="`${inputCls} bg-slate-50`" disabled />
          </div>
        </div>
        <table class="w-full text-right border border-slate-200 rounded-xl overflow-hidden">
          <thead class="bg-slate-50 font-black text-slate-700">
            <tr><th class="p-2">کالا</th><th class="p-2 text-center">مقدار (از GRN)</th><th class="p-2 text-center">قیمت واحد</th><th class="p-2 text-left">جمع</th></tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="(it, i) in invItems" :key="i">
              <td class="p-2 font-bold">{{ it.name }}</td>
              <td class="p-2 text-center">{{ toFa(it.qty) }} {{ it.unit }}</td>
              <td class="p-2"><MoneyInput v-model="it.unitPrice" class="w-28 text-center" /></td>
              <td class="p-2 text-left font-black tabular-nums">{{ formatMoney((it.qty || 0) * (Number(it.unitPrice) || 0)) }}</td>
            </tr>
          </tbody>
        </table>
        <div class="grid grid-cols-2 gap-3 max-w-sm">
          <div>
            <label class="block font-bold text-slate-700 mb-1">مالیات:</label>
            <MoneyInput v-model="invF.taxAmount" :class="inputCls" />
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">تخفیف:</label>
            <MoneyInput v-model="invF.discount" :class="inputCls" />
          </div>
        </div>
        <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 font-black">
          جمع: {{ formatMoney(invItems.reduce((s, it) => s + (it.qty || 0) * (Number(it.unitPrice) || 0), 0)) }} {{ store.currency }}
        </div>
      </div>
      <template #footer>
        <div class="flex gap-2">
          <button class="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black" @click="invSubmit">ثبت فاکتور و تطبیق</button>
          <button class="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold" @click="invF.supplierId = ''; invItems = []">انصراف</button>
        </div>
      </template>
    </Modal>

    <!-- ===== مودال تأمین‌کننده ===== -->
    <Modal v-if="supF" :title="supF.id ? 'ویرایش تأمین‌کننده' : 'تأمین‌کننده جدید'" @close="supF = null">
      <div class="space-y-3 text-xs">
        <div><label class="block font-bold text-slate-700 mb-1">نام: <span class="text-rose-500">*</span></label><input v-model="supF.name" :class="inputCls" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block font-bold text-slate-700 mb-1">تلفن:</label><input v-model="supF.phone" :class="inputCls" dir="ltr" /></div>
          <div><label class="block font-bold text-slate-700 mb-1">کد اقتصادی:</label><input v-model="supF.economicCode" :class="inputCls" dir="ltr" /></div>
        </div>
        <div><label class="block font-bold text-slate-700 mb-1">آدرس:</label><input v-model="supF.address" :class="inputCls" /></div>
        <div><label class="block font-bold text-slate-700 mb-1">یادداشت:</label><input v-model="supF.notes" :class="inputCls" /></div>
        <label class="flex items-center gap-2 font-bold text-slate-700"><input type="checkbox" v-model="supF.active" class="w-4 h-4 accent-emerald-600" /> فعال</label>
      </div>
      <template #footer>
        <div class="flex gap-2">
          <button class="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black" @click="supSubmit">ذخیره</button>
          <button class="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold" @click="supF = null">انصراف</button>
        </div>
      </template>
    </Modal>
  </div>
</template>
