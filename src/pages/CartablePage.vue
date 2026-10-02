<script setup>
/**
 * کارتابل — معادل CartablePage.jsx
 * تایید/رد/بلاتکلیف قلمی درخواست‌ها، تحویل خرید به انبار، پیام‌های سیستم، چاپ لیست خرید
 */
import { ref, computed } from 'vue';
import {
  Inbox, FileText, ShoppingCart, PackagePlus, PackageMinus, UtensilsCrossed,
  Check, X, Eye, CheckCheck, Bell, MessageSquare, AlertTriangle, Trash2, Pencil, Printer,
} from 'lucide-vue-next';
import { toFa, formatMoney, jalaliTodayString, nowTime, uid, auditEntry, userDisplay } from '../lib/utils.js';
import { applyInventoryOp, calcNeedsWithWaste, shortageOnAvailable } from '../lib/inventory.js';
import { useAppStore } from '../stores/app.js';

const props = defineProps({
  showToast: { type: Function, required: true },
  userName: { type: String, default: '—' },
});

const store = useAppStore();
const toast = (msg, type) => props.showToast(msg, type);

const TABS = [
  { id: 'cookplan', label: 'برنامه غذایی', icon: UtensilsCrossed },
  { id: 'preinvoice', label: 'پیش‌فاکتور', icon: FileText },
  { id: 'purchase', label: 'درخواست خرید کالا', icon: ShoppingCart },
  { id: 'purchasing', label: 'تحویل خرید به انبار', icon: PackagePlus },
  { id: 'stockout', label: 'درخواست کالا از انبار', icon: PackageMinus },
];

const TYPE_META = {
  cookplan: { label: 'برنامه غذایی', icon: UtensilsCrossed, color: 'teal' },
  preinvoice: { label: 'پیش‌فاکتور', icon: FileText, color: 'sky' },
  purchase: { label: 'درخواست خرید کالا', icon: ShoppingCart, color: 'amber' },
  purchasing: { label: 'تحویل خرید به انبار', icon: PackagePlus, color: 'emerald' },
  stockout: { label: 'درخواست کالا ازانبار', icon: PackageMinus, color: 'rose' },
};

const COLORS = {
  teal: 'bg-teal-50 text-teal-700 border-teal-200',
  sky: 'bg-sky-50 text-sky-700 border-sky-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const tab = ref('cookplan');
const checked = ref({}); // { key: { itemIdx: true } }
const viewing = ref(null); // ردیف در حال مشاهده (صفحه نمایش)
const confirmAction = ref(null); // { type: 'approve'|'reject', row, message }
const showMessages = ref(false);
const editingRow = ref(null); // { key, idx, value } ویرایش مقدار قلم توسط تاییدکننده
const printPurchase = ref(null); // درخواست خرید جهت چاپ توسط مسئول خرید
const showArchived = ref(false);
const delivery = ref({}); // { key: { idx: { qty, note } } }

// فوکوس خودکار input ویرایش مقدار (معادل autoFocus در React)
const vFocus = { mounted: (el) => el.focus() };

/* ===== مجوز ویرایش مقدار قلم توسط تاییدکننده (طبق مجوز نقش) ===== */
const EDIT_PERM = { cookplan: 'edit_request_cookplan', preinvoice: 'edit_request_preinvoice', purchase: 'edit_request_purchase', stockout: 'edit_request_stockout', stockin: 'edit_request_purchase', purchasing: 'edit_request_purchase' };
const canEditRequest = (type) => store.can(EDIT_PERM[type] || 'edit_request_purchase');

const toggleItem = (key, idx) => {
  checked.value = { ...checked.value, [key]: { ...(checked.value[key] || {}), [idx]: !checked.value[key]?.[idx] } };
};

/* ===== پیام‌های سیستم ===== */
const myMessages = computed(() => (store.messages || []).filter((m) => m.to === props.userName && !!m.archived === showArchived.value));
const unreadCount = computed(() => (store.messages || []).filter((m) => m.to === props.userName && !m.read && !m.archived).length);
const archivedCount = computed(() => (store.messages || []).filter((m) => m.to === props.userName && m.archived).length);
const archiveMessage = (id) => {
  store.messages = (store.messages || []).map((m) => (m.id === id ? { ...m, read: true, archived: true, archivedAt: `${jalaliTodayString()} ${toFa(nowTime())}` } : m));
};
const deleteMessage = (id) => {
  store.messages = (store.messages || []).filter((m) => !(m.id === id && m.to === props.userName));
};
const restoreMessage = (id) => {
  store.messages = (store.messages || []).map((m) => (m.id === id ? { ...m, archived: false } : m));
};
const markAllMessagesRead = () => {
  store.messages = (store.messages || []).map((m) => (m.to === props.userName && !m.archived ? { ...m, read: true } : m));
};
const pushMessage = (to, text, kind = 'info') => {
  if (!to) return;
  store.messages = [...(store.messages || []), { id: uid('msg'), to, text, kind, read: false, date: jalaliTodayString(), time: toFa(nowTime()) }];
};

/* ===== ویرایش مقدار قلم توسط تاییدکننده (طبق مجوز نقش) ===== */
const saveItemEdit = ({ row, idx, qty }) => {
  const n = Number(qty);
  if (!n || n <= 0) return toast('مقدار باید عددی بزرگ‌تر از صفر باشد', 'error');
  const auditText = `ویرایش مقدار قلم «${row.items[idx].name}» از ${toFa(row.items[idx].qty)} به ${toFa(n)}`;
  if (row.type === 'cookplan') {
    const p = row.raw;
    store.plans = store.plans.map((x) => (x.id === p.id ? { ...x, items: x.items.map((it, i) => (i === idx ? { ...it, qty: n } : it)), audit: [...(x.audit || []), auditEntry(store.currentUser, auditText)] } : x));
  } else if (row.type === 'preinvoice') {
    const p = row.raw;
    store.preinvoices = store.preinvoices.map((x) => (x.id === p.id ? { ...x, items: x.items.map((it, i) => (i === idx ? { ...it, count: n, totalRow: n * (it.unitPrice || it.price || 0) } : it)) } : x));
  } else {
    const r = row.raw;
    const upd = (list) => list.map((x) => (x.id === r.id ? { ...x, items: x.items.map((it, i) => (i === idx ? { ...it, qty: n } : it)), audit: [...(x.audit || []), auditEntry(store.currentUser, auditText)] } : x));
    if (row.type === 'purchase' || row.type === 'purchasing') store.purchaseRequests = upd(store.purchaseRequests);
    else store.stockRequests = upd(store.stockRequests);
  }
  toast('مقدار قلم ویرایش شد');
  editingRow.value = null;
};

const startEdit = (type, key, idx, msg) => {
  if (!canEditRequest(type)) return toast(msg, 'error');
  editingRow.value = { key, idx };
};

/* ===== تحویل گرفتن اقلام سفارش‌شده توسط انباردار ===== */
const setDeliveryField = (key, idx, field, value) => {
  delivery.value = { ...delivery.value, [key]: { ...(delivery.value[key] || {}), [idx]: { ...(delivery.value[key]?.[idx] || {}), [field]: value } } };
};
// دو چک‌باکس متقابلاً انحصاری: تحویل شده / عدم تحویل
const setDeliveryDecision = (key, idx, decision) => {
  const cur = delivery.value[key]?.[idx] || {};
  const nextDecision = cur.decision === decision ? undefined : decision;
  const next = { ...cur, decision: nextDecision };
  if (nextDecision === 'notdelivered') next.qty = '';
  delivery.value = { ...delivery.value, [key]: { ...(delivery.value[key] || {}), [idx]: next } };
};

const confirmDelivery = (row) => {
  const r = row.raw;
  const entries = delivery.value[row.key] || {};
  const undecidedCount = r.items.filter((_, i) => !entries[i]?.decision).length;
  if (undecidedCount > 0) return toast(`وضعیت تحویل ${toFa(undecidedCount)} قلم مشخص نشده است`, 'error');

  // اعتبارسنجی مقادیر واردشده (فیلد خالی = همان مقدار تاییدشده)
  for (let i = 0; i < r.items.length; i++) {
    const it = r.items[i];
    const e = entries[i];
    if (e.decision !== 'delivered') continue;
    const raw = String(e.qty ?? '').trim();
    if (raw === '') continue;
    const n = Number(raw);
    if (Number.isNaN(n) || n < 0) return toast(`مقدار تحویل «${it.name}» نامعتبر است`, 'error');
    if (n > 0 && it.ingredientId && !store.ingredients.some((ing) => ing.id === it.ingredientId)) {
      return toast(`قلم «${it.name}» در انبار یافت نشد`, 'error');
    }
  }

  let anyAdded = false;
  const overReceipts = [];
  let notDelivered = 0;
  const updatedItems = r.items.map((it, i) => {
    const e = entries[i];
    if (e.decision !== 'delivered') {
      notDelivered++;
      return { ...it, receivedQty: 0, deliveryNote: (e.note || '').trim(), deliveredAt: `${jalaliTodayString()} ${toFa(nowTime())}`, deliveredBy: props.userName, notDelivered: true };
    }
    const raw = String(e.qty ?? '').trim();
    const recvQty = raw === '' ? it.qty : Number(raw);
    if (recvQty > 0) {
      store.ingredients = store.ingredients.map((ing) => (it.ingredientId === ing.id ? { ...ing, qty: Number((ing.qty + recvQty).toFixed(3)) } : ing));
      if (it.supplyId) store.supplies = (store.supplies || []).map((s) => (s.id === it.supplyId ? { ...s, qty: (s.qty || 0) + recvQty } : s));
      anyAdded = true;
      if (recvQty > it.qty) overReceipts.push(`${it.name} (+${toFa(Math.round((recvQty - it.qty) * 100) / 100)} بیش از سفارش)`);
    }
    return { ...it, receivedQty: recvQty, deliveryNote: (e.note || '').trim(), deliveredAt: `${jalaliTodayString()} ${toFa(nowTime())}`, deliveredBy: props.userName };
  });
  const deliveredCount = r.items.length - notDelivered;
  const newMoves = updatedItems.filter((it) => Number(it.receivedQty) > 0).map((it) => ({
    id: `m${Date.now()}_${Math.floor(Math.random() * 1000)}_${it.ingredientId || it.supplyId}`,
    date: jalaliTodayString(), time: toFa(nowTime()),
    ingredientId: it.ingredientId || '', supplyId: it.supplyId || '',
    name: it.name, type: 'in',
    qty: Number(it.receivedQty), unit: it.unit,
    desc: `تحویل خرید — درخواست ${r.id}${it.deliveryNote ? ` (${it.deliveryNote})` : ''}`, person: props.userName || 'انباردار',
    sender: 'خرید', receiver: props.userName || 'انباردار',
    batchId: `B${Date.now().toString(36)}`,
  }));
  if (newMoves.length) store.moves = [...newMoves, ...(store.moves || [])];
  // همه اقلام تعیین تکلیف شدند → درخواست بسته می‌شود
  const allNotDelivered = notDelivered === r.items.length;
  store.purchaseRequests = store.purchaseRequests.map((x) => (x.id === r.id ? {
    ...x,
    items: updatedItems,
    status: allNotDelivered ? 'cancelled' : 'completed',
    completedAt: `${jalaliTodayString()} ${toFa(nowTime())}`,
    completedBy: props.userName,
    audit: [...(x.audit || []), auditEntry(store.currentUser, `تحویل خرید — ${deliveredCount} قلم تحویل شد، ${notDelivered} قلم تحویل نشد`)],
  } : x));
  delivery.value = { ...delivery.value, [row.key]: {} };
  pushMessage(r.requester, allNotDelivered
    ? `درخواست خرید ${r.id} به دلیل عدم تهیه ابطال شد.`
    : `درخواست خرید ${r.id} بسته شد: ${toFa(deliveredCount)} قلم تحویل و به انبار اضافه شد${notDelivered > 0 ? `، ${toFa(notDelivered)} قلم تحویل نشد` : ''}.`, allNotDelivered ? 'danger' : 'success');
  viewing.value = null;
  toast(allNotDelivered
    ? 'درخواست به دلیل عدم تحویل بسته شد'
    : (anyAdded
      ? (overReceipts.length > 0 ? `به انبار اضافه شد — توجه: ${overReceipts.join('، ')}` : 'اقلام تحویل‌شده به انبار اضافه شد و درخواست بسته شد')
      : 'درخواست بسته شد'));
};

/* ===== rows assembly ===== */
// برنامه‌ها: pending → تأیید سرآشپز | reserved → تأیید/رد مدیر
const cookplanRows = computed(() => (store.plans || []).filter((p) => p.status === 'pending' || p.status === 'reserved').map((p) => ({
  key: `cp-${p.id}`, type: 'cookplan', id: p.id, title: `برنامه پخت ${p.date}`,
  date: p.date, time: p.createdAtTime || '', by: p.createdBy || '—',
  stage: p.status, // 'pending' | 'reserved'
  items: p.items.map((it) => ({ name: it.dishName, qty: it.qty, unit: 'پرس', decision: it.decision })),
  raw: p,
})));

const preinvoiceRows = computed(() => (store.preinvoices || []).map((p) => ({
  key: `pi-${p.id}`, type: 'preinvoice', id: p.id, title: `پیش‌فاکتور ${p.customer.firstName} ${p.customer.lastName}`,
  date: p.date, time: p.time, by: p.createdBy || '—',
  items: p.items.map((it) => ({ name: it.dishName, qty: it.count, unit: '' })),
  total: p.finalTotal, raw: p,
})));

const purchaseRows = computed(() => (store.purchaseRequests || []).filter((r) => r.status === 'temp').map((r) => ({
  key: `pr-${r.id}`, type: 'purchase', id: r.id, title: `درخواست خرید — ${r.requester}`,
  date: r.date, time: r.time, by: r.requester,
  items: r.items.map((it) => ({ name: it.name, qty: it.qty, unit: it.unit, decision: it.decision })),
  raw: r,
})));

// سفارش‌های تاییدشده در انتظار تحویل (مسئول خرید/انباردار)
const purchasingRows = computed(() => (store.purchaseRequests || []).filter((r) => r.status === 'ordered').map((r) => ({
  key: `po-${r.id}`, type: 'purchasing', id: r.id, title: `تحویل خرید — ${r.requester}`,
  date: r.date, time: r.time, by: r.approvedByUser || '—',
  items: r.items.map((it) => ({ name: it.name, qty: it.qty, unit: it.unit, decision: it.decision, receivedQty: it.receivedQty, deliveryNote: it.deliveryNote, ingredientId: it.ingredientId, supplyId: it.supplyId })),
  raw: r,
})));

const stockoutRows = computed(() => (store.stockRequests || []).filter((r) => r.status === 'temp' && r.kind === 'stockout').map((r) => ({
  key: `so-${r.id}`, type: 'stockout', id: r.id, title: `حواله انبار (خروج کالا) — ${r.requester}`,
  date: r.date, time: r.time, by: r.requester,
  items: r.items.map((it) => ({ name: it.name, qty: it.qty, unit: it.unit, ingredientId: it.ingredientId, supplyId: it.supplyId, kind: it.kind, decision: it.decision })),
  raw: r,
})));

const stockinReqRows = computed(() => (store.stockRequests || []).filter((r) => r.status === 'temp' && r.kind === 'stockin').map((r) => ({
  key: `si-${r.id}`, type: 'stockin', id: r.id, title: `رسید انبار (ورود کالا) — ${r.requester}`,
  date: r.date, time: r.time, by: r.requester,
  items: r.items.map((it) => ({ name: it.name, qty: it.qty, unit: it.unit, ingredientId: it.ingredientId, supplyId: it.supplyId, kind: it.kind, price: it.price, decision: it.decision })),
  raw: r,
})));

const allRows = computed(() => [...cookplanRows.value, ...preinvoiceRows.value, ...purchaseRows.value, ...purchasingRows.value, ...stockoutRows.value, ...stockinReqRows.value]);
const rows = computed(() => (tab.value === 'all' ? allRows.value : allRows.value.filter((r) => r.type === tab.value)));

// نشانگر: تعداد درخواست‌های باز به تفکیک نوع
// (برنامه/پیش‌فاکتور/خرید/حواله: دارای قلم تعیین‌تکلیف‌نشده | تحویل خرید: دارای قلم تحویل‌نگرفته)
const pendingCountByType = computed(() => {
  const counts = {};
  allRows.value.forEach((r) => {
    const open = r.type === 'purchasing'
      ? r.items.some((it) => it.receivedQty === undefined)
      : r.items.some((it) => it.decision !== 'approve' && it.decision !== 'reject');
    if (open) counts[r.type] = (counts[r.type] || 0) + 1;
  });
  return counts;
});

/* ===== actions (منطق بدون UI تایید — تایید در confirmAction انجام می‌شود) ===== */
const approvePreInvoice = (row) => {
  const p = row.raw;
  let nextNum = 1001;
  (store.invoices || []).forEach((inv) => { const m = String(inv.id).match(/(\d+)$/); if (m) nextNum = Math.max(nextNum, Number(m[1]) + 1); });
  const inv = {
    id: `INV-${nextNum}`, date: jalaliTodayString(), time: toFa(nowTime()),
    createdBy: props.userName, createdById: row.by || '',
    audit: [auditEntry(store.currentUser, `تبدیل پیش‌فاکتور ${p.id} به فاکتور قطعی`)],
    customer: p.customer, items: p.items, subtotal: p.subtotal,
    discountPercent: p.discountPercent, discountAmount: p.discountAmount,
    taxRate: p.taxRate, taxAmount: p.taxAmount, isTaxable: p.isTaxable,
    finalTotal: p.finalTotal, receiver: '', notes: `تبدیل از پیش‌فاکتور ${p.id}`,
  };
  store.invoices = [inv, ...(store.invoices || [])];
  store.preinvoices = store.preinvoices.filter((x) => x.id !== p.id);
  pushMessage(p.createdBy, `پیش‌فاکتور ${toFa(p.id)} شما تایید شد و فاکتور قطعی ${toFa(inv.id)} ثبت گردید.`, 'success');
  toast(`پیش‌فاکتور ${toFa(p.id)} تایید و فاکتور قطعی ${toFa(inv.id)} ثبت شد`);
};

const rejectPreInvoice = (row) => {
  const p = row.raw;
  store.preinvoices = store.preinvoices.filter((x) => x.id !== p.id);
  pushMessage(p.createdBy, `پیش‌فاکتور ${toFa(p.id)} شما ابطال شد.`, 'danger');
  toast(`پیش‌فاکتور ${toFa(p.id)} ابطال شد`);
};

/* ===== برنامه پخت — ماشین حالت دو مرحله‌ای (فاز ۱) =====
 * pending (ثبت سرآشپز) ──تأیید سرآشپز──▶ reserved (رزرو مواد)
 * reserved ──تأیید مدیر──▶ approved (consume) | ──رد مدیر──▶ rejected (release)
 */
const calcNeedsForItems = (planItems) => calcNeedsWithWaste(store, planItems);

const applyCookPlan = (row, decision, reason = '', decisionNote = '') => {
  const p = row.raw;
  const user = store.currentUser;

  // ─── مرحله ۱: تأیید سرآشپز → رزرو ───
  if (p.status === 'pending') {
    if (!store.can('approve_cookplan')) return toast('شما مجوز تأیید برنامه پخت را ندارید', 'error');
    if (decision !== 'approve') return toast('در این مرحله فقط تأیید (و رزرو) ممکن است؛ برای رد، ابتدا تأیید سرآشپز انجام شود', 'error');

    const tickedIdx = new Set(p.items.map((_, i) => i).filter((i) => checked.value[row.key]?.[i]));
    if (tickedIdx.size === 0) return toast('حداقل یک قلم را تیک بزنید', 'error');
    if (p.items.some((it, i) => tickedIdx.has(i) && it.decision === 'reject')) return toast('اقلام رد‌شده قابل تأیید نیستند', 'error');

    const updatedItems = p.items.map((it, i) => (tickedIdx.has(i)
      ? { ...it, decision: 'approve', approvedQty: it.qty, decidedAt: `${jalaliTodayString()} ${toFa(nowTime())}`, decidedBy: props.userName, decisionNote }
      : it));
    const approvedItems = updatedItems.filter((it) => it.decision === 'approve');

    // کسری بر مبنای موجودی قابل استفاده (qty - reserved)
    const approvedDishes = approvedItems.map((it) => ({ dishId: it.dishId, qty: it.qty }));
    const sh = shortageOnAvailable(store, approvedDishes);
    if (sh.hasShortage) {
      const list = sh.rows.filter((r) => !r.ok).map((s) => `${s.name} (قابل استفاده ${toFa(Math.round(s.available * 100) / 100)}، نیاز ${toFa(Math.round(s.need * 100) / 100)})`).join('، ');
      return toast(`موجودی قابل استفاده کافی نیست: ${list} — ابتدا کسری را جبران کنید`, 'error');
    }

    // رزرو مواد غذاهای تاییدشده
    const needs = calcNeedsForItems(approvedDishes);
    applyInventoryOp(store, needs, 'reserve', { user, plan: p, note: `رزرو — تأیید سرآشپز برنامه ${p.date}${decisionNote ? ` (${decisionNote})` : ''}` });

    const timeoutH = Number(store.settings.reservationTimeoutHours) || 24;
    const isFull = updatedItems.every((it) => it.decision === 'approve');
    store.plans = store.plans.map((x) => (x.id === p.id
      ? {
          ...x,
          items: updatedItems,
          status: 'reserved',
          reservedBy: props.userName,
          reservedAt: `${jalaliTodayString()} ${nowTime()}`,
          reservationExpiresAt: Date.now() + timeoutH * 3600000,
          audit: [...(x.audit || []), auditEntry(user, `تأیید سرآشپز — رزرو مواد ${approvedItems.length} غذا برای ${toFa(timeoutH)} ساعت${reason ? ` — دلیل: ${reason}` : ''}`)],
        }
      : x));
    pushMessage(p.createdBy, `برنامه پخت ${p.date} تأیید و مواد آن به مدت ${toFa(timeoutH)} ساعت رزرو شد — در انتظار تأیید نهایی مدیر.`, 'success');
    toast(`مواد رزرو شد — در انتظار تأیید نهایی مدیر (مهلت: ${toFa(timeoutH)} ساعت)`);
    checked.value = { ...checked.value, [row.key]: {} };
    return;
  }

  // ─── مرحله ۲: تأیید/رد مدیر روی برنامه رزرو‌شده ───
  if (p.status === 'reserved') {
    if (decision === 'approve') {
      if (!store.can('final_approve_cookplan')) return toast('شما مجوز تأیید نهایی برنامه پخت را ندارید', 'error');
    } else {
      if (!store.can('reject_cookplan')) return toast('شما مجوز رد برنامه پخت را ندارید', 'error');
      if (!reason) return toast('ثبت دلیل رد الزامی است', 'error');
    }

    const approvedItems = p.items.filter((it) => it.decision === 'approve');
    const approvedDishes = approvedItems.map((it) => ({ dishId: it.dishId, qty: it.approvedQty || it.qty }));

    if (decision === 'approve') {
      // consume: از رزرو به مصرف
      const needs = calcNeedsForItems(approvedDishes);
      applyInventoryOp(store, needs, 'consume', { user, plan: p, note: `مصرف از رزرو — تأیید نهایی مدیر برنامه ${p.date}${reason ? ` (${reason})` : ''}` });
      store.plans = store.plans.map((x) => (x.id === p.id
        ? {
            ...x,
            status: 'approved',
            approvedBy: props.userName,
            approvedAt: `${jalaliTodayString()} ${nowTime()}`,
            reservationExpiresAt: null,
            stockDeducted: true,
            audit: [...(x.audit || []), auditEntry(user, `تأیید نهایی مدیر — ${approvedItems.length} غذا مصرف شد${reason ? ` — دلیل: ${reason}` : ''}`)],
          }
        : x));
      pushMessage(p.createdBy, `برنامه پخت ${p.date} به تأیید نهایی مدیر رسید و مواد رزرو‌شده مصرف شد.`, 'success');
      toast('تأیید نهایی انجام شد — مواد از رزرو مصرف شد');
    } else {
      // release: آزادسازی رزرو
      const needs = calcNeedsForItems(approvedDishes);
      applyInventoryOp(store, needs, 'release', { user, plan: p, note: `آزادسازی رزرو — رد مدیر برنامه ${p.date} — دلیل: ${reason}` });
      store.plans = store.plans.map((x) => (x.id === p.id
        ? {
            ...x,
            status: 'rejected',
            rejectedBy: props.userName,
            rejectedAt: `${jalaliTodayString()} ${nowTime()}`,
            rejectReason: reason,
            reservationExpiresAt: null,
            audit: [...(x.audit || []), auditEntry(user, `رد مدیر — رزرو آزاد شد — دلیل: ${reason}`)],
          }
        : x));
      pushMessage(p.createdBy, `برنامه پخت ${p.date} توسط مدیر رد شد — رزرو مواد آزاد گردید. دلیل: ${reason}`, 'danger');
      toast('برنامه رد شد و رزرو آزاد شد');
    }
    checked.value = { ...checked.value, [row.key]: {} };
    viewing.value = null;
  }
};
const approveCookPlan = (row) => applyCookPlan(row, 'approve');
const rejectCookPlan = (row) => applyCookPlan(row, 'reject');

const applyPurchase = (row, decision) => {
  // decision: 'approve' | 'reject' — اقلام تیک‌خورده تعیین تکلیف می‌شوند؛ بدون تیک کل اقلام
  const r = row.raw;
  const tickedIdx = new Set(r.items.map((_, i) => i).filter((i) => checked.value[row.key]?.[i]));
  const targets = tickedIdx.size > 0 ? r.items.filter((_, i) => tickedIdx.has(i)) : r.items;
  if (tickedIdx.size === 0) return toast('حداقل یک قلم را تیک بزنید یا «تایید نهایی» را بزنید', 'error');
  if (targets.some((it) => it.decision && it.decision !== 'pending')) return toast('اقلام تعیین‌تکلیف‌شده قابل تغییر نیستند', 'error');

  const updatedItems = r.items.map((it, i) => (tickedIdx.has(i) ? { ...it, decision, decidedAt: `${jalaliTodayString()} ${toFa(nowTime())}`, decidedBy: props.userName } : it));
  const allDecided = updatedItems.every((it) => it.decision === 'approve' || it.decision === 'reject');
  const approvedCount = updatedItems.filter((it) => it.decision === 'approve').length;
  const rejectedCount = updatedItems.filter((it) => it.decision === 'reject').length;
  const pendingCount = updatedItems.length - approvedCount - rejectedCount;

  if (allDecided) {
    if (decision === 'approve') {
      // تایید مسئول: درخواست «سفارش‌شده» می‌شود و به کارتابل مسئول خرید + انباردار می‌رود (موجودی هنوز تغییر نمی‌کند)
      store.purchaseRequests = store.purchaseRequests.map((x) => (x.id === r.id ? { ...x, items: updatedItems, status: 'ordered', approvedAt: `${jalaliTodayString()} ${toFa(nowTime())}`, approvedByUser: props.userName, audit: [...(x.audit || []), auditEntry(store.currentUser, `تایید درخواست — ${approvedCount} قلم جهت خرید سفارش شد`)] } : x));
      (store.users || []).forEach((u) => {
        const isPurchaser = u.roles?.includes('manager') || u.role === 'manager';
        const isStorekeeper = u.roles?.includes('storekeeper');
        if (!isPurchaser && !isStorekeeper) return;
        const name = userDisplay(u);
        store.messages = [...(store.messages || []), { id: uid('msg'), to: name, text: `درخواست خرید ${r.id} تایید و جهت خرید/تحویل به کارتابل شما ارسال شد (${toFa(approvedCount)} قلم).`, kind: 'info', read: false, date: jalaliTodayString(), time: toFa(nowTime()) }];
      });
      pushMessage(r.requester, `درخواست خرید ${r.id} تایید شد و برای خرید و تحویل به مسئول خرید/انباردار ارسال گردید.`, 'success');
      toast('درخواست تایید و به کارتابل مسئول خرید و انباردار ارسال شد');
    } else {
      store.purchaseRequests = store.purchaseRequests.map((x) => (x.id === r.id ? { ...x, items: updatedItems, status: 'rejected', completedAt: `${jalaliTodayString()} ${toFa(nowTime())}`, completedBy: props.userName, audit: [...(x.audit || []), auditEntry(store.currentUser, `رد نهایی — ${rejectedCount} قلم رد شد`)] } : x));
      pushMessage(r.requester, `درخواست خرید ${r.id} رد شد (${toFa(rejectedCount)} قلم).`, 'danger');
      toast('درخواست رد و بسته شد');
    }
  } else {
    store.purchaseRequests = store.purchaseRequests.map((x) => (x.id === r.id ? { ...x, items: updatedItems, status: 'temp', audit: [...(x.audit || []), auditEntry(store.currentUser, decision === 'approve' ? `تایید ${approvedCount} قلم` : `رد ${rejectedCount} قلم`)] } : x));
    pushMessage(r.requester, `درخواست خرید ${r.id}: ${toFa(decision === 'approve' ? approvedCount : rejectedCount)} قلم ${decision === 'approve' ? 'تایید' : 'رد'} شد؛ ${toFa(pendingCount)} قلم در انتظار تعیین تکلیف در کارتابل است.`, 'info');
    toast(decision === 'approve'
      ? `${toFa(approvedCount)} قلم تایید شد؛ ${toFa(pendingCount)} قلم بلاتکلیف ماند`
      : `${toFa(rejectedCount)} قلم رد و به پایین جدول منتقل شد؛ ${toFa(pendingCount)} قلم بلاتکلیف در کارتابل ماند`);
  }
  checked.value = { ...checked.value, [row.key]: {} };
};
const approvePurchase = (row) => applyPurchase(row, 'approve');
const rejectPurchase = (row) => applyPurchase(row, 'reject');

const applyStockIn = (row, decision) => {
  const r = row.raw;
  const tickedIdx = new Set(r.items.map((_, i) => i).filter((i) => checked.value[row.key]?.[i]));
  if (tickedIdx.size === 0) return toast('حداقل یک قلم را تیک بزنید یا «تایید نهایی» را بزنید', 'error');
  const targets = r.items.filter((_, i) => tickedIdx.has(i));
  if (targets.some((it) => it.decision && it.decision !== 'pending')) return toast('اقلام تعیین‌تکلیف‌شده قابل تغییر نیستند', 'error');

  if (decision === 'approve') {
    store.ingredients = store.ingredients.map((ing) => {
      const dd = targets.find((x) => x.ingredientId === ing.id);
      if (!dd) return ing;
      if (dd.price > 0) {
        const oldCost = ing.qty * (ing.price || 0);
        const newCost = dd.qty * dd.price;
        const avgPrice = (ing.qty + dd.qty) > 0 ? Math.round((oldCost + newCost) / (ing.qty + dd.qty)) : dd.price;
        return { ...ing, qty: Number((ing.qty + dd.qty).toFixed(3)), price: avgPrice };
      }
      return { ...ing, qty: Number((ing.qty + dd.qty).toFixed(3)) };
    });
    const newMoves = targets.map((it) => ({
      id: `m${Date.now()}_${Math.floor(Math.random() * 1000)}_${it.ingredientId || it.supplyId}`,
      date: r.date, time: toFa(nowTime()),
      ingredientId: it.ingredientId || '', supplyId: it.supplyId || '',
      name: it.name, type: 'in', kind: it.kind,
      qty: it.qty, unit: it.unit, price: it.price || 0,
      total: it.qty * (it.price || 0),
      desc: r.desc || `رسید انبار ${r.id}`, person: props.userName || 'انباردار',
      sender: r.supplierName || '—', receiver: props.userName || 'انباردار',
      supplierName: r.supplierName || '', invoiceNo: r.invoiceNo || '',
      batchId: `B${Date.now().toString(36)}`,
    }));
    store.moves = [...newMoves, ...(store.moves || [])];
  }

  const updatedItems = r.items.map((it, i) => (tickedIdx.has(i) ? { ...it, decision, decidedAt: `${jalaliTodayString()} ${toFa(nowTime())}`, decidedBy: props.userName } : it));
  const allDecided = updatedItems.every((it) => it.decision === 'approve' || it.decision === 'reject');
  const approvedCount = updatedItems.filter((it) => it.decision === 'approve').length;
  const rejectedCount = updatedItems.filter((it) => it.decision === 'reject').length;
  const pendingCount = updatedItems.length - approvedCount - rejectedCount;

  if (allDecided) {
    store.stockRequests = store.stockRequests.map((x) => (x.id === r.id ? { ...x, items: updatedItems, status: decision === 'approve' ? 'approved' : 'rejected', approvedBy: props.userName, approvedAt: `${jalaliTodayString()} ${toFa(nowTime())}`, audit: [...(x.audit || []), auditEntry(store.currentUser, decision === 'approve' ? 'تایید نهایی رسید و ورود به انبار' : 'رد نهایی رسید انبار')] } : x));
    pushMessage(r.requester, `رسید انبار ${r.id} نهایی شد: ${toFa(approvedCount)} قلم تایید و به انبار اضافه شد، ${toFa(rejectedCount)} قلم رد شد.`, 'success');
    toast('تایید نهایی انجام شد و درخواست بسته شد');
  } else {
    store.stockRequests = store.stockRequests.map((x) => (x.id === r.id ? { ...x, items: updatedItems, status: 'temp', audit: [...(x.audit || []), auditEntry(store.currentUser, decision === 'approve' ? `تایید ${approvedCount} قلم` : `رد ${rejectedCount} قلم`)] } : x));
    pushMessage(r.requester, `رسید انبار ${r.id}: ${toFa(decision === 'approve' ? approvedCount : rejectedCount)} قلم ${decision === 'approve' ? 'تایید' : 'رد'} شد؛ ${toFa(pendingCount)} قلم در انتظار تعیین تکلیف است.`, 'info');
    toast(decision === 'approve'
      ? `مواد ${toFa(approvedCount)} قلم تاییدشده بلافاصله به انبار اضافه شد؛ ${toFa(pendingCount)} قلم بلاتکلیف ماند`
      : `${toFa(rejectedCount)} قلم رد و به پایین جدول منتقل شد؛ ${toFa(pendingCount)} قلم بلاتکلیف در کارتابل ماند`);
  }
  checked.value = { ...checked.value, [row.key]: {} };
};
const deliverStockIn = (row) => applyStockIn(row, 'approve');
const rejectStockIn = (row) => applyStockIn(row, 'reject');

const applyStockOut = (row, decision) => {
  const r = row.raw;
  const tickedIdx = new Set(r.items.map((_, i) => i).filter((i) => checked.value[row.key]?.[i]));
  if (tickedIdx.size === 0) return toast('حداقل یک قلم را تیک بزنید', 'error');
  const targets = r.items.filter((_, i) => tickedIdx.has(i));
  if (targets.some((it) => it.decision && it.decision !== 'pending')) return toast('اقلام تعیین‌تکلیف‌شده قابل تغییر نیستند', 'error');

  if (decision === 'approve') {
    store.ingredients = store.ingredients.map((ing) => {
      const dd = targets.find((x) => x.ingredientId === ing.id);
      if (!dd) return ing;
      return { ...ing, qty: Math.max(0, Number((ing.qty - dd.qty).toFixed(3))) };
    });
    store.supplies = (store.supplies || []).map((s) => {
      const dd = targets.find((x) => x.supplyId === s.id);
      if (!dd) return s;
      return { ...s, qty: Math.max(0, (s.qty || 0) - dd.qty) };
    });
    const newMoves = targets.map((it) => ({
      id: `m${Date.now()}_${Math.floor(Math.random() * 1000)}_${it.ingredientId || it.supplyId}`,
      date: jalaliTodayString(), time: toFa(nowTime()),
      ingredientId: it.ingredientId || '', supplyId: it.supplyId || '',
      name: it.name, type: 'out', kind: it.kind,
      qty: it.qty, unit: it.unit,
      desc: `حواله ${r.id}`, person: props.userName || 'انباردار',
      receiver: r.requester || '—', batchId: `B${Date.now().toString(36)}`,
    }));
    store.moves = [...newMoves, ...(store.moves || [])];
  }

  const updatedItems = r.items.map((it, i) => (tickedIdx.has(i) ? { ...it, decision, decidedAt: `${jalaliTodayString()} ${toFa(nowTime())}`, decidedBy: props.userName } : it));
  const allDecided = updatedItems.every((it) => it.decision === 'approve' || it.decision === 'reject');
  const approvedCount = updatedItems.filter((it) => it.decision === 'approve').length;
  const rejectedCount = updatedItems.filter((it) => it.decision === 'reject').length;
  const pendingCount = updatedItems.length - approvedCount - rejectedCount;

  if (allDecided) {
    store.stockRequests = store.stockRequests.map((x) => (x.id === r.id ? { ...x, items: updatedItems, status: decision === 'approve' ? 'approved' : 'rejected', approvedBy: props.userName, approvedAt: `${jalaliTodayString()} ${toFa(nowTime())}`, audit: [...(x.audit || []), auditEntry(store.currentUser, decision === 'approve' ? `تایید نهایی حواله — ${approvedCount} قلم از انبار کسر شد` : 'رد نهایی حواله — رزرو آزاد شد')] } : x));
    pushMessage(r.requester, decision === 'approve'
      ? `حواله انبار ${r.id} نهایی شد: ${toFa(approvedCount)} قلم تایید و از انبار کسر شد.`
      : `حواله انبار ${r.id} رد شد و رزرو آن آزاد گردید.`, decision === 'approve' ? 'success' : 'danger');
    toast(decision === 'approve' ? 'تایید نهایی انجام شد و اقلام از انبار کسر شد' : 'حواله رد و رزرو آن آزاد شد');
  } else {
    store.stockRequests = store.stockRequests.map((x) => (x.id === r.id ? { ...x, items: updatedItems, status: 'temp', audit: [...(x.audit || []), auditEntry(store.currentUser, decision === 'approve' ? `تایید ${approvedCount} قلم و کسر از انبار` : `رد ${rejectedCount} قلم`)] } : x));
    pushMessage(r.requester, `حواله انبار ${r.id}: ${toFa(decision === 'approve' ? approvedCount : rejectedCount)} قلم ${decision === 'approve' ? 'تایید و از انبار کسر شد' : 'رد شد'}؛ ${toFa(pendingCount)} قلم در انتظار تعیین تکلیف است.`, 'info');
    toast(decision === 'approve'
      ? `مواد ${toFa(approvedCount)} قلم تاییدشده بلافاصله از انبار کسر شد؛ ${toFa(pendingCount)} قلم بلاتکلیف ماند`
      : `${toFa(rejectedCount)} قلم رد و به پایین جدول منتقل شد؛ ${toFa(pendingCount)} قلم بلاتکلیف در کارتابل ماند`);
  }
  checked.value = { ...checked.value, [row.key]: {} };
};
const approveStockOut = (row) => applyStockOut(row, 'approve');
const rejectStockOut = (row) => applyStockOut(row, 'reject');

const requestConfirm = (type, row) => {
  const undecided = row.items.filter((it) => it.decision !== 'approve' && it.decision !== 'reject');
  const tickedCount = undecided.filter((_, i) => checked.value[row.key]?.[row.items.indexOf(undecided[i])]).length;
  const undecidedCount = undecided.length;
  const kindText = TYPE_META[row.type].label;
  // برنامه پخت: ماشین دو مرحله‌ای — عنوان مخصوص هر مرحله
  if (row.type === 'cookplan') {
    const stage = row.raw.status;
    const isReject = type === 'reject';
    let msg;
    if (stage === 'pending') {
      msg = `تأیید سرآشپز: مواد غذاهای تیک‌خورده (${toFa(Math.max(tickedCount, undecidedCount))} قلم) رزرو می‌شود و برنامه برای تأیید نهایی مدیر ارسال می‌گردد.`;
    } else if (stage === 'reserved') {
      msg = isReject
        ? `رد مدیر: رزرو مواد برنامه آزاد می‌شود و برنامه بسته خواهد شد.`
        : `تأیید نهایی مدیر: مواد رزرو‌شده مصرف می‌شود و برنامه قطعی می‌گردد.`;
    }
    confirmAction.value = { type, row, message: msg, needReason: isReject && stage === 'reserved' };
    return;
  }
  let msg;
  if (tickedCount > 0 && tickedCount < undecidedCount) {
    msg = type === 'approve'
      ? `${toFa(tickedCount)} قلم ${kindText} تایید شود و ${toFa(undecidedCount - tickedCount)} قلم بلاتکلیف بماند؟`
      : `${toFa(tickedCount)} قلم ${kindText} رد شود و ${toFa(undecidedCount - tickedCount)} قلم بلاتکلیف بماند؟`;
  } else if (tickedCount > 0 && tickedCount === undecidedCount) {
    msg = type === 'approve'
      ? `هر ${toFa(tickedCount)} قلم باقی‌مانده تایید شود و درخواست ${kindText} نهایی و بسته شود؟`
      : `هر ${toFa(tickedCount)} قلم باقی‌مانده رد شود و درخواست ${kindText} بسته شود؟`;
  } else {
    msg = type === 'approve'
      ? `اقلامی تیک نخورده است. ابتدا اقلام موردنظر را انتخاب کنید.`
      : `اقلامی تیک نخورده است. ابتدا اقلام موردنظر را انتخاب کنید.`;
  }
  confirmAction.value = { type, row, message: msg, needReason: false };
};

// دلیل رد / یادداشت تصمیم
const confirmReason = ref('');
const confirmNote = ref('');
const presetReasons = computed(() => (store.rejectionReasons || []));

const executeConfirm = () => {
  const { type, row, needReason } = confirmAction.value;
  const reason = confirmReason.value.trim();
  const note = confirmNote.value.trim();
  if (needReason && !reason) { confirmAction.value = null; return toast('انتخاب یا وارد کردن دلیل رد الزامی است', 'error'); }
  confirmAction.value = null;
  confirmReason.value = '';
  confirmNote.value = '';
  if (row.type === 'cookplan') {
    return applyCookPlan(row, type, reason, note);
  }
  const hasTick = row.items.some((_, i) => checked.value[row.key]?.[i] && !(row.raw?.items?.[i]?.decision === 'approve' || row.raw?.items?.[i]?.decision === 'reject'));
  if (!hasTick) return toast('ابتدا اقلام موردنظر را تیک بزنید', 'error');
  if (type === 'approve') {
    if (row.type === 'preinvoice') return approvePreInvoice(row);
    if (row.type === 'stockin') return deliverStockIn(row);
    if (row.type === 'stockout') return approveStockOut(row);
    if (row.type === 'purchase') return approvePurchase(row);
  } else {
    if (row.type === 'preinvoice') return rejectPreInvoice(row);
    if (row.type === 'stockin') return rejectStockIn(row);
    if (row.type === 'stockout') return rejectStockOut(row);
    if (row.type === 'purchase') return rejectPurchase(row);
  }
};

/* ===== ابطال درخواست خرید توسط انباردار (تهیه نشد) ===== */
const doPrint = () => window.print();

const voidPurchase = (row) => {
  if (!window.confirm(`درخواست خرید ${row.id} ابطال شود؟ رزرو اقلام آزاد و درخواست بسته خواهد شد.`)) return;
  const r = row.raw;
  store.purchaseRequests = store.purchaseRequests.map((x) => (x.id === r.id ? { ...x, status: 'cancelled', cancelledAt: `${jalaliTodayString()} ${toFa(nowTime())}`, cancelledBy: props.userName, audit: [...(x.audit || []), auditEntry(store.currentUser, 'ابطال درخواست توسط انباردار')] } : x));
  (store.users || []).forEach((u) => {
    const name = userDisplay(u);
    store.messages = [...(store.messages || []), { id: uid('msg'), to: name, text: `درخواست خرید ${r.id} توسط انباردار ابطال شد (ماده تهیه نشد).`, kind: 'danger', read: false, date: jalaliTodayString(), time: toFa(nowTime()) }];
  });
  pushMessage(r.requester, `درخواست خرید ${r.id} ابطال شد (ماده تهیه نشد).`, 'danger');
  viewing.value = null;
  toast('درخواست ابطال شد');
};

const viewingRow = computed(() => (viewing.value ? rows.value.find((r) => r.key === viewing.value) : null));
const viewingDecidedCount = computed(() => (viewingRow.value ? viewingRow.value.items.filter((it) => it.decision === 'approve' || it.decision === 'reject').length : 0));
const viewingAwaiting = computed(() => (viewingRow.value ? viewingRow.value.items.map((it, i) => ({ it, i })).filter(({ it }) => it.receivedQty === undefined) : []));
const viewingReceived = computed(() => (viewingRow.value ? viewingRow.value.items.filter((it) => it.receivedQty !== undefined) : []));
const viewingPending = computed(() => (viewingRow.value ? viewingRow.value.items.map((it, i) => ({ it, i })).filter(({ it }) => it.decision !== 'approve' && it.decision !== 'reject') : []));
const viewingDecided = computed(() => (viewingRow.value ? viewingRow.value.items.map((it, i) => ({ it, i })).filter(({ it }) => it.decision === 'approve' || it.decision === 'reject') : []));
</script>

<template>
  <div class="space-y-5">
    <!-- هدر + پیام‌های سیستم -->
    <div class="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
      <div class="p-3 bg-indigo-50 text-indigo-700 rounded-2xl"><Inbox class="w-6 h-6" /></div>
      <div class="flex-1">
        <h2 class="text-base font-black text-slate-900">کارتابل</h2>
        <p class="text-[11px] text-slate-500">موارد نیازمند بازبینی، بررسی و تایید — {{ toFa(rows.length) }} ردیف در حالت موقت</p>
      </div>
      <!-- کلید پیام‌های سیستم -->
      <button
        @click="showMessages = !showMessages"
        :class="`relative px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition border ${showMessages ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`"
      >
        <Bell class="w-4 h-4" />
        پیام‌های سیستم
        <span
          v-if="unreadCount > 0"
          class="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center animate-pulse"
        >
          {{ toFa(unreadCount) }}
        </span>
      </button>
    </div>

    <!-- پنل پیام‌های سیستم -->
    <div v-if="showMessages" class="bg-white rounded-2xl border border-indigo-200 p-4 space-y-2">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 text-xs font-black text-indigo-800"><MessageSquare class="w-4 h-4" /> پیام‌های سیستم شما</div>
        <button
          v-if="myMessages.length > 0 && unreadCount > 0"
          @click="markAllMessagesRead"
          class="text-[10px] font-bold text-indigo-600 hover:underline"
        >
          علامت‌گذاری همه به‌عنوان خوانده‌شده
        </button>
        <button
          @click="showArchived = !showArchived"
          :class="`text-[10px] font-black px-2.5 py-1 rounded-lg border transition ${showArchived ? 'bg-slate-600 text-white border-slate-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`"
        >
          {{ showArchived ? 'بازگشت به پیام‌های فعال' : `بایگانی (${toFa(archivedCount)})` }}
        </button>
      </div>
      <div v-if="myMessages.length === 0" class="text-xs text-slate-400 font-bold py-4 text-center">{{ showArchived ? 'بایگانی خالی است' : 'پیامی برای شما وجود ندارد' }}</div>
      <div v-else class="space-y-1.5 max-h-64 overflow-y-auto">
        <div
          v-for="m in myMessages"
          :key="m.id"
          :class="`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${m.kind === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : m.kind === 'danger' ? 'bg-rose-50 border-rose-200 text-rose-900' : m.kind === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-sky-50 border-sky-200 text-sky-900'} ${m.read ? 'opacity-60' : ''}`"
        >
          <span class="mt-0.5 shrink-0">
            <Check v-if="m.kind === 'success'" class="w-4 h-4" />
            <AlertTriangle v-else-if="m.kind === 'danger'" class="w-4 h-4" />
            <MessageSquare v-else class="w-4 h-4" />
          </span>
          <div class="flex-1">
            <div class="font-bold leading-5">{{ m.text }}</div>
            <div class="text-[9px] mt-1 opacity-70">{{ toFa(m.date) }} · {{ m.time }}<template v-if="m.archived && m.archivedAt"> · بایگانی: {{ toFa(m.archivedAt) }}</template></div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button
              v-if="showArchived"
              @click="restoreMessage(m.id)"
              class="text-[9px] font-black px-2 py-1 rounded-lg bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 transition"
            >بازگردانی</button>
            <button
              v-else
              @click="archiveMessage(m.id)"
              title="ارسال به بایگانی"
              class="text-[9px] font-black px-2 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition"
            >مشاهده شد</button>
            <button @click="deleteMessage(m.id)" title="حذف پیام" class="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"><Trash2 class="w-3.5 h-3.5" /></button>
          </div>
          <span v-if="!m.read && !m.archived" class="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1.5" title="خوانده نشده" />
        </div>
      </div>
    </div>

    <!-- فیلترها -->
    <div class="bg-white rounded-2xl border border-slate-200 p-2 flex gap-1.5 overflow-x-auto">
      <button
        v-for="t in TABS"
        :key="t.id"
        @click="tab = t.id"
        :class="`relative px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition ${tab === t.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`"
      >
        <component :is="t.icon" class="w-4 h-4" /> {{ t.label }}
        <span
          v-if="!!pendingCountByType[t.id]"
          class="absolute -top-1.5 -left-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow ring-2 ring-white"
        >
          {{ toFa(pendingCountByType[t.id]) }}
        </span>
      </button>
    </div>

    <!-- ردیف‌ها — فقط کلید نمایش -->
    <div class="space-y-3">
      <div v-if="rows.length === 0" class="bg-white border border-dashed border-slate-300 rounded-3xl p-12 text-center space-y-2">
        <Inbox class="w-10 h-10 text-slate-300 mx-auto" />
        <div class="text-sm font-black text-slate-400">کارتابل خالی است</div>
        <p class="text-xs text-slate-400">موردی برای بررسی وجود ندارد</p>
      </div>

      <div v-for="row in rows" :key="row.key" class="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <span :class="`p-2.5 rounded-xl border shrink-0 ${COLORS[TYPE_META[row.type].color]}`">
          <component :is="TYPE_META[row.type].icon" class="w-5 h-5" />
        </span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm font-black text-slate-800">{{ row.title }}</span>
            <span v-if="row.type === 'cookplan'" class="text-[9px] font-black px-2 py-0.5 rounded-full" :class="row.stage === 'reserved' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'">
              {{ row.stage === 'reserved' ? 'در انتظار تأیید مدیر' : 'در انتظار تأیید سرآشپز' }}
            </span>
            <span v-else class="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">موقت</span>
            <!-- فاز ۳: Timeout باقی‌مانده رزرو -->
            <span
              v-if="row.type === 'cookplan' && row.stage === 'reserved' && row.raw.reservationExpiresAt"
              class="text-[9px] font-black px-2 py-0.5 rounded-full tabular-nums"
              :class="(row.raw.reservationExpiresAt - Date.now()) <= 3600000 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'"
              title="مهلت رزرو — پس از انقضا رزرو خودکار آزاد می‌شود"
            >
              ⏱ {{ toFa(Math.max(0, Math.ceil((row.raw.reservationExpiresAt - Date.now()) / 3600000))) }} ساعت
            </span>
          </div>
          <div class="text-[10px] text-slate-500 font-bold mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{{ TYPE_META[row.type].label }}</span> · <span>{{ toFa(row.date) }}</span>
            <template v-if="row.time">· <span>{{ row.time }}</span></template> · <span>ثبت: {{ row.by }}</span>
          </div>
        </div>
        <button
          @click="viewing = row.key"
          class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-black flex items-center gap-1.5 transition shrink-0"
        >
          <Eye class="w-4 h-4" /> نمایش
        </button>
      </div>
    </div>

    <!-- صفحه نمایش درخواست — تیک اقلام + تایید/رد -->
    <div v-if="viewingRow" class="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 overflow-y-auto">
      <div class="bg-white rounded-3xl shadow-2xl w-full max-w-2xl my-auto">
        <div class="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="text-sm font-black text-slate-900">{{ viewingRow.title }}</h3>
              <span class="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">موقت</span>
              <span
                v-if="viewingDecidedCount > 0"
                class="text-[9px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700"
              >{{ toFa(viewingDecidedCount) }}/{{ toFa(viewingRow.items.length) }}</span>
            </div>
            <div class="text-[10px] text-slate-500 font-bold mt-1">
              {{ TYPE_META[viewingRow.type].label }} · {{ toFa(viewingRow.date) }} · ثبت: {{ viewingRow.by }}
            </div>
          </div>
          <button @click="viewing = null" class="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition"><X class="w-5 h-5" /></button>
        </div>

        <div class="p-5 space-y-4">
          <div class="text-[11px] font-bold text-slate-500">
            اقلام را تیک بزنید و «تایید» یا «رد» کنید — اقلام بدون تیک بلاتکلیف در کارتابل می‌مانند. وقتی همه اقلام تعیین تکلیف شدند با «تایید نهایی» درخواست بسته می‌شود.
          </div>

          <!-- تحویل خرید: چک‌باکس تحویل شده/عدم تحویل + مقدار تحویل‌گرفته -->
          <div v-if="viewingRow.type === 'purchasing'" class="space-y-3">
            <div class="text-[11px] font-bold text-slate-500">
              وضعیت تحویل هر قلم را مشخص کنید (تحویل شده یا عدم تحویل) — پس از تعیین تکلیف همه اقلام، درخواست بسته می‌شود.
            </div>
            <table class="w-full text-right text-xs">
              <thead class="text-slate-500 font-black border-b border-slate-200">
                <tr>
                  <th class="p-2 text-center">تحویل شده</th>
                  <th class="p-2 text-center">عدم تحویل</th>
                  <th class="p-2">شرح</th>
                  <th class="p-2 text-center">مقدار درخواست</th>
                  <th class="p-2 text-center">مقدار تایید شده</th>
                  <th class="p-2 text-center w-28">مقدار تحویل گرفته شده</th>
                  <th class="p-2">توضیحات</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                <tr
                  v-for="({ it, i }) in viewingRow.items.map((it, i) => ({ it, i }))"
                  :key="i"
                  :class="delivery[viewingRow.key]?.[i]?.decision === 'delivered' ? 'bg-emerald-50/50' : delivery[viewingRow.key]?.[i]?.decision === 'notdelivered' ? 'bg-rose-50/50' : ''"
                >
                  <td class="p-2.5 text-center">
                    <input
                      type="checkbox"
                      :checked="delivery[viewingRow.key]?.[i]?.decision === 'delivered'"
                      @change="setDeliveryDecision(viewingRow.key, i, 'delivered')"
                      class="w-4.5 h-4.5 accent-emerald-600 cursor-pointer"
                    />
                  </td>
                  <td class="p-2.5 text-center">
                    <input
                      type="checkbox"
                      :checked="delivery[viewingRow.key]?.[i]?.decision === 'notdelivered'"
                      @change="setDeliveryDecision(viewingRow.key, i, 'notdelivered')"
                      class="w-4.5 h-4.5 accent-rose-600 cursor-pointer"
                    />
                  </td>
                  <td class="p-2.5 font-bold text-slate-700">{{ it.name }}</td>
                  <td class="p-2.5 text-center font-black text-slate-600">{{ toFa(it.qty) }} {{ it.unit }}</td>
                  <td class="p-2.5 text-center font-black text-slate-600">{{ toFa(it.qty) }} {{ it.unit }}</td>
                  <td class="p-2.5 text-center">
                    <input
                      dir="ltr"
                      inputMode="decimal"
                      :disabled="delivery[viewingRow.key]?.[i]?.decision !== 'delivered'"
                      :value="delivery[viewingRow.key]?.[i]?.qty ?? ''"
                      @input="setDeliveryField(viewingRow.key, i, 'qty', $event.target.value)"
                      :placeholder="delivery[viewingRow.key]?.[i]?.decision === 'delivered' ? String(it.qty) : '—'"
                      class="w-20 border border-emerald-300 rounded-lg px-2 py-1 text-center font-black text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-300"
                    />
                  </td>
                  <td class="p-2.5">
                    <input
                      :value="delivery[viewingRow.key]?.[i]?.note ?? ''"
                      @input="setDeliveryField(viewingRow.key, i, 'note', $event.target.value)"
                      placeholder="توضیح درباره تحویل (اختیاری)..."
                      class="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="viewingReceived.length > 0" class="pt-2 border-t-2 border-dashed border-slate-300 space-y-1.5">
              <div class="text-[11px] font-black text-slate-600">تحویل‌گرفته‌شده‌ها:</div>
              <div v-for="it in viewingReceived" :key="it.name" class="flex items-center gap-2 text-[11px] bg-emerald-50 rounded-xl px-3 py-1.5">
                <span class="font-black text-emerald-700">✓ {{ it.name }}: {{ toFa(it.receivedQty) }} {{ it.unit }}</span>
                <span v-if="it.deliveryNote" class="text-slate-500">— {{ it.deliveryNote }}</span>
                <span v-if="it.deliveredBy" class="text-[9px] text-slate-400">({{ it.deliveredBy }})</span>
              </div>
            </div>
          </div>

          <!-- اقلام در انتظار تعیین تکلیف -->
          <template v-if="viewingRow.type !== 'purchasing'">
            <div
              v-if="viewingPending.length === 0"
              class="text-[11px] font-bold text-center bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-2.5"
            >
              همه اقلام تعیین تکلیف شده‌اند — برای بستن درخواست، «تایید نهایی» را روی اقلام باقی‌مانده (در صورت وجود) اعمال کنید یا فرم را ببندید.
            </div>
            <table v-else class="w-full text-right text-xs">
              <thead class="text-slate-500 font-black border-b border-slate-200">
                <tr>
                  <th class="p-2 w-12 text-center">انتخاب</th>
                  <th class="p-2">شرح</th>
                  <th class="p-2 text-center">مقدار</th>
                  <th v-if="viewingRow.total !== undefined" class="p-2 text-left">مبلغ</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                <tr v-for="({ it, i }) in viewingPending" :key="i" :class="checked[viewingRow.key]?.[i] ? 'bg-amber-50' : ''">
                  <td class="p-2.5 text-center">
                    <input
                      type="checkbox"
                      :checked="!!checked[viewingRow.key]?.[i]"
                      @change="toggleItem(viewingRow.key, i)"
                      class="w-4.5 h-4.5 accent-emerald-600 cursor-pointer"
                    />
                  </td>
                  <td class="p-2.5 font-bold text-slate-700">{{ it.name }}</td>
                  <td class="p-2.5 text-center font-black">
                    <span v-if="editingRow && editingRow.key === viewingRow.key && editingRow.idx === i" class="inline-flex items-center gap-1">
                      <input
                        v-focus
                        :value="editingRow.value ?? String(it.qty)"
                        @input="editingRow = { ...editingRow, value: $event.target.value }"
                        @keydown.enter="saveItemEdit({ row: viewingRow, idx: i, qty: $event.target.value })"
                        @keydown.esc="editingRow = null"
                        class="w-20 border border-emerald-400 rounded-lg px-2 py-1 text-center font-black text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <span class="text-[9px] text-slate-500">{{ it.unit }}</span>
                      <button @click="saveItemEdit({ row: viewingRow, idx: i, qty: editingRow.value ?? String(it.qty) })" class="px-2 py-1 bg-emerald-600 text-white rounded-lg text-[9px] font-black">ذخیره</button>
                      <button @click="editingRow = null" class="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black">لغو</button>
                    </span>
                    <button
                      v-else
                      @click="startEdit(viewingRow.type, viewingRow.key, i, 'شما مجوز ویرایش مقادیر این نوع درخواست را ندارید')"
                      :title="canEditRequest(viewingRow.type) ? 'ویرایش مقدار' : 'بدون مجوز ویرایش'"
                      :class="`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg transition ${canEditRequest(viewingRow.type) ? 'hover:bg-emerald-50 hover:text-emerald-700' : 'cursor-not-allowed opacity-60'}`"
                    >
                      {{ toFa(it.qty) }} {{ it.unit }}
                      <Pencil v-if="canEditRequest(viewingRow.type)" class="w-3 h-3 opacity-40" />
                    </button>
                  </td>
                  <td v-if="viewingRow.total !== undefined" class="p-2.5 text-left font-black tabular-nums">{{ formatMoney((it.unitPrice || 0) * it.qty) }}</td>
                </tr>
              </tbody>
            </table>
          </template>

          <!-- اقلام تعیین‌تکلیف‌شده — به پایین منتقل می‌شوند -->
          <div v-if="viewingDecided.length > 0" class="mt-4 pt-3 border-t-2 border-dashed border-slate-300 space-y-2">
            <div class="text-[11px] font-black text-slate-600">اقلام تعیین‌تکلیف‌شده ({{ toFa(viewingDecided.length) }}):</div>
            <table class="w-full text-right text-xs">
              <tbody class="divide-y divide-slate-100">
                <tr v-for="({ it }) in viewingDecided" :key="it.name + it.decidedAt" :class="it.decision === 'approve' ? 'bg-emerald-50/60' : 'bg-rose-50/60'">
                  <td class="p-2.5 font-bold text-slate-600">{{ it.name }}</td>
                  <td class="p-2.5 text-center font-black text-slate-500">{{ toFa(it.qty) }} {{ it.unit }}</td>
                  <td class="p-2.5 text-center">
                    <span :class="`text-[9px] font-black px-2 py-0.5 rounded-full ${it.decision === 'approve' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`">
                      {{ it.decision === 'approve' ? '✓ تایید شده' : '✗ رد شده' }}
                    </span>
                  </td>
                  <td class="p-2.5 text-center text-[9px] text-slate-400 font-bold">{{ it.decidedBy ? `${it.decidedBy} — ${it.decidedAt}` : '' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="viewingRow.total !== undefined" class="text-left text-xs font-black text-slate-700">مبلغ نهایی: {{ formatMoney(viewingRow.total) }}</div>
          <div class="flex gap-2 pt-2 border-t border-slate-100">
            <template v-if="viewingRow.type === 'purchasing'">
              <button
                @click="confirmDelivery(viewingRow)"
                class="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition"
              >
                <CheckCheck class="w-4 h-4" /> تایید
              </button>
              <button
                @click="voidPurchase(viewingRow)"
                class="flex-1 px-4 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition border border-rose-200"
              >
                <X class="w-4 h-4" /> ابطال درخواست
              </button>
              <button
                @click="viewing = null"
                class="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition border border-slate-200"
              >
                بستن
              </button>
            </template>
            <template v-else>
              <button
                @click="requestConfirm('approve', viewingRow)"
                class="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition"
              >
                <CheckCheck class="w-4 h-4" /> تایید
              </button>
              <button
                @click="requestConfirm('reject', viewingRow)"
                class="flex-1 px-4 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition border border-rose-200"
              >
                <X class="w-4 h-4" /> رد
              </button>
              <button
                @click="viewing = null"
                class="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition border border-slate-200"
              >
                بستن فرم
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- چاپ لیست درخواست خرید (مسئول خرید) -->
    <div v-if="printPurchase" class="fixed inset-0 z-[95] bg-black/50 flex items-center justify-center p-4" @click="printPurchase = null">
      <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" @click.stop>
        <div class="p-4 border-b flex items-center justify-between no-print">
          <h3 class="text-sm font-black text-slate-900">چاپ لیست خرید — {{ printPurchase.id }}</h3>
          <div class="flex gap-2">
            <button @click="doPrint" class="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black">چاپ</button>
            <button @click="printPurchase = null" class="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold">بستن</button>
          </div>
        </div>
        <div id="print-area" class="p-5 space-y-3 text-xs">
          <div class="text-center border-b-2 border-slate-800 pb-2">
            <div class="text-sm font-black">لیست خرید — آشپزخانه نسیم</div>
            <div class="text-[10px] text-slate-600">درخواست: {{ toFa(printPurchase.id) }} · تاریخ درخواست: {{ toFa(printPurchase.date) }} · درخواست‌دهنده: {{ printPurchase.requester }} · تایید: {{ printPurchase.approvedByUser || '—' }}</div>
          </div>
          <table class="w-full text-right border-collapse">
            <thead>
              <tr class="bg-slate-100">
                <th class="border border-slate-300 p-2">#</th>
                <th class="border border-slate-300 p-2">شرح کالا</th>
                <th class="border border-slate-300 p-2 text-center">مقدار تاییدشده</th>
                <th class="border border-slate-300 p-2 text-center">خریداری شد</th>
                <th class="border border-slate-300 p-2">توضیحات</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(it, i) in printPurchase.items" :key="i">
                <td class="border border-slate-300 p-2 text-center">{{ toFa(i + 1) }}</td>
                <td class="border border-slate-300 p-2 font-bold">{{ it.name }}</td>
                <td class="border border-slate-300 p-2 text-center font-black">{{ toFa(it.qty) }} {{ it.unit }}</td>
                <td class="border border-slate-300 p-2 text-center">{{ it.receivedQty !== undefined ? toFa(it.receivedQty) : '...............' }}</td>
                <td class="border border-slate-300 p-2">{{ it.deliveryNote || '....................' }}</td>
              </tr>
            </tbody>
          </table>
          <div class="flex justify-between pt-6 text-[10px] font-bold text-slate-600">
            <span>امضای مسئول خرید: ........................</span>
            <span>امضای انباردار: ........................</span>
          </div>
        </div>
      </div>
    </div>

    <!-- مودال تایید نهایی -->
    <div v-if="confirmAction" class="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div :class="`p-3 w-fit rounded-2xl ${confirmAction.type === 'approve' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`">
          <AlertTriangle class="w-6 h-6" />
        </div>
        <h3 class="text-sm font-black text-slate-900">
          {{ confirmAction.type === 'approve' ? 'تایید درخواست' : 'رد درخواست' }}
        </h3>
        <p class="text-xs font-bold text-slate-600 leading-6">{{ confirmAction.message }}</p>
        <!-- دلیل رد / یادداشت تصمیم (فاز ۱) -->
        <div v-if="confirmAction.type === 'reject' || confirmAction.row?.type === 'cookplan'" class="space-y-2">
          <label class="block text-[11px] font-black text-slate-700">
            {{ confirmAction.needReason ? 'دلیل رد (الزامی):' : 'دلیل / یادداشت (اختیاری):' }}
          </label>
          <select v-if="(presetReasons || []).length > 0" v-model="confirmReason" :class="`w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500`">
            <option value="">— انتخاب دلیل آماده —</option>
            <option v-for="r in presetReasons" :key="r.id" :value="r.text">{{ r.text }}</option>
          </select>
          <input
            v-model="confirmReason"
            placeholder="یا دلیل را آزاد بنویسید..."
            class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            v-model="confirmNote"
            placeholder="یادداشت تصمیم (اختیاری)..."
            class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <p class="text-[10px] text-slate-400 font-bold">پس از انجام، پیام اطلاع‌رسانی به درخواست‌کننده ارسال می‌شود.</p>
        <div class="flex gap-2 pt-1">
          <button
            @click="executeConfirm"
            :class="`flex-1 px-4 py-3 text-white rounded-xl text-xs font-black transition ${confirmAction.type === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`"
          >
            بله، {{ confirmAction.type === 'approve' ? 'تایید می‌کنم' : 'رد می‌کنم' }}
          </button>
          <button
            @click="confirmAction = null; confirmReason = ''; confirmNote = ''"
            class="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
          >
            انصراف
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
