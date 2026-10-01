<script setup>
/**
 * ورود و خروج انبار — معادل WarehousePage.jsx
 * تب‌ها: خروج کالا — موجودی انبار — کاردکس کالا — گزارش خرید — اسناد انبار
 * نکته: ورود/خروج مستقیم موجودی را اعمال نمی‌کند؛ به‌صورت درخواست (stockRequest)
 * به کارتابل می‌رود و پس از تایید انباردار اعمال می‌شود.
 */
import { ref, computed } from 'vue';
import {
  Package, ArrowDownToLine, ArrowUpFromLine, ClipboardList, Printer, History,
  AlertTriangle, Boxes, ShoppingBag, Plus, Trash2, FileText, Pencil,
} from 'lucide-vue-next';
import { toFa, formatMoney, nowTime, jalaliTodayString, faDate, jalaliToJdn, uid } from '../lib/utils.js';
import { convertQty, compatibleUnits, roundQty } from '../lib/units.js';
import { inputCls } from '../components/ui/inputCls.js';
import EmptyRow from '../components/ui/EmptyRow.vue';
import NumberSpinner from '../components/ui/NumberSpinner.vue';
import MoneyInput from '../components/ui/MoneyInput.vue';
import SearchableSelect from '../components/SearchableSelect.vue';
import JalaliDatePicker from '../components/JalaliDatePicker.vue';
import PrintModal from '../components/PrintModal.vue';
import ExportButtons from '../components/ExportButtons.vue';
import { useAppStore } from '../stores/app.js';

const props = defineProps({
  showToast: { type: Function, required: true },
  userName: { type: String, default: '—' },
  initialTab: { type: String, default: null },
  showTabs: { type: Boolean, default: true },
});

const store = useAppStore();

// تاییدکنندگان کارتابل (در React از App با approvers={['admin']} می‌آمد)
const approvers = ['admin'];

const tab = ref(props.initialTab || 'balance'); // out | balance | cardex | purchase | documents (ورود کالا فقط از طریق تایید درخواست خرید)
// فرم چندقمه‌ای: { kind: 'ingredient'|'supply', id, qty, price }
const moveRows = ref([]);
const moveRowSel = ref({ kind: 'ingredient', id: '', qty: '', price: '' });
const moveForm = ref({ date: jalaliTodayString(), supplierId: '', sender: '', receiver: '', invoiceNo: '', invoiceDate: '', desc: '' });
const cardexId = ref('');
const printCardex = ref(false);
// اسناد انبار: ویرایش/حذف رسید و حواله
const docFilter = ref('all'); // all | in | out
const editDocId = ref(null); // batchId در حال ویرایش
const editDocRows = ref([]);
const editDocForm = ref({});
const confirmDocDel = ref(null); // {batchId, type}

// گزارش خرید
const purSupplierId = ref('');
const purFrom = ref('');
const purTo = ref('');
const printPurchase = ref(false);

// ورود کالا فقط از طریق تایید درخواست خرید در کارتابل انجام می‌شود
const isIn = false;

// انتخاب‌گر قلم ترکیبی: مواد غذایی + اقلام جانبی
const allItemOptions = computed(() => [
  ...store.ingredients.map((i) => ({
    kind: 'ingredient', id: i.id,
    label: `${i.name} (موجودی: ${toFa(i.qty)} ${i.unit})`,
    searchText: `ماده ${i.name} ${i.unit} ${i.storage || ''}`,
    qty: i.qty, unit: i.unit, name: i.name,
  })),
  ...store.supplies.map((s) => ({
    kind: 'supply', id: s.id,
    label: `${s.name} — قلم جانبی (موجودی: ${toFa(s.qty || 0)} عدد)`,
    searchText: `قلم جانبی ${s.name}`,
    qty: s.qty || 0, unit: 'عدد', name: s.name,
  })),
]);

const itemSelectOptions = computed(() => allItemOptions.value.map((o) => ({ value: o.id, label: o.label, searchText: o.searchText })));

const selectedItem = computed(() => allItemOptions.value.find((o) => o.kind === moveRowSel.value.kind && o.id === moveRowSel.value.id) || null);

const pickMoveRowItem = (v) => {
  const opt = allItemOptions.value.find((o) => o.id === v);
  moveRowSel.value = { kind: opt?.kind || 'ingredient', id: v, qty: moveRowSel.value.qty, price: '', entryUnit: '' };
};

// واحد ثبت: پیش‌فرض واحد خود قلم؛ قابل تغییر به واحدهای هم‌خانواده (مثلاً کارتن ← عدد)
const entryUnitOptions = computed(() => {
  if (!selectedItem.value) return [];
  const ing = selectedItem.value.kind === 'ingredient' ? store.ingredients.find((i) => i.id === selectedItem.value.id) : null;
  const base = ing?.unit || selectedItem.value.unit;
  return compatibleUnits(store.units, base).map((n) => ({ value: n, label: n, searchText: n }));
});
const entryUnit = computed(() => moveRowSel.value.entryUnit || selectedItem.value?.unit || '');
// ضریب تبدیل: 1 [entryUnit] = ? [واحد انبار]
const entryConvFactor = computed(() => {
  if (!selectedItem.value) return 1;
  const ing = selectedItem.value.kind === 'ingredient' ? store.ingredients.find((i) => i.id === selectedItem.value.id) : null;
  const base = ing?.unit || selectedItem.value.unit;
  const c = convertQty(store.units, 1, entryUnit.value, base);
  return c === null ? null : roundQty(c);
});

const addMoveRow = () => {
  if (!selectedItem.value) return props.showToast('انتخاب قلم الزامی است', 'error');
  const q = Number(moveRowSel.value.qty);
  if (!q || q <= 0) return props.showToast('مقدار باید بیشتر از صفر باشد', 'error');
  const price = Number(moveRowSel.value.price) || 0;
  const ing = selectedItem.value.kind === 'ingredient' ? store.ingredients.find((i) => i.id === selectedItem.value.id) : null;
  const stockUnit = ing?.unit || selectedItem.value.unit;
  // تبدیل مقدار ورودی به واحد انبار
  let stockQty = q;
  let convNote = '';
  if (entryUnit.value !== stockUnit) {
    const c = convertQty(store.units, q, entryUnit.value, stockUnit);
    if (c === null) return props.showToast(`تبدیل «${entryUnit.value}» به «${stockUnit}» تعریف نشده است — ابتدا در تنظیمات، تبدیل واحد را تعریف کنید`, 'error');
    stockQty = roundQty(c);
    convNote = `${toFa(q)} ${entryUnit.value} = ${toFa(stockQty)} ${stockUnit}`;
  }
  const ex = moveRows.value.findIndex((r) => r.kind === selectedItem.value.kind && r.id === selectedItem.value.id);
  if (ex > -1) {
    const upd = [...moveRows.value];
    upd[ex] = { ...upd[ex], qty: roundQty(upd[ex].qty + stockQty), price: price || upd[ex].price || 0 };
    moveRows.value = upd;
  } else {
    moveRows.value = [...moveRows.value, {
      kind: selectedItem.value.kind, id: selectedItem.value.id, name: selectedItem.value.name,
      unit: stockUnit, qty: stockQty, price,
      entryQty: q, entryUnit: entryUnit.value, convNote,
    }];
  }
  moveRowSel.value = { kind: 'ingredient', id: '', qty: '', price: '', entryUnit: '' };
};

const removeMoveRow = (idx) => { moveRows.value = moveRows.value.filter((_, i) => i !== idx); };

// مجموع فاکتور خرید
const purchaseTotal = computed(() => moveRows.value.reduce((s, r) => s + r.qty * (r.price || 0), 0));

const resetMoveForm = () => {
  moveRows.value = [];
  moveRowSel.value = { kind: 'ingredient', id: '', qty: '', price: '' };
  moveForm.value = { date: jalaliTodayString(), supplierId: '', sender: '', receiver: '', invoiceNo: '', invoiceDate: '', desc: '' };
};

const statusOf = (i) => {
  if (i.qty <= i.minThreshold * 0.5) return 'red';
  if (i.qty <= i.minThreshold) return 'yellow';
  return 'ok';
};

// شماره حواله یکتا برای خروج کالا
const nextWaybillNo = () => {
  const nums = store.moves.filter((m) => m.waybillNo).map((m) => {
    const mm = String(m.waybillNo).match(/(\d+)$/);
    return mm ? Number(mm[1]) : 0;
  });
  const next = (nums.length ? Math.max(...nums) : 1000) + 1;
  return `HW-${next}`;
};

const submitMove = (type) => {
  if (moveRows.value.length === 0) return props.showToast('حداقل یک قلم به فرم اضافه کنید', 'error');
  if (!moveForm.value.date) return props.showToast('انتخاب تاریخ الزامی است', 'error');
  if (type === 'in' && !moveForm.value.supplierId && !moveForm.value.sender.trim()) return props.showToast('تحویل‌دهنده را انتخاب یا تایپ کنید', 'error');
  if (type === 'out' && !moveForm.value.receiver.trim()) return props.showToast('تحویل‌گیرنده را انتخاب یا تایپ کنید', 'error');

  // کنترل موجودی برای خروج (مواد و اقلام جانبی)
  if (type === 'out') {
    for (const r of moveRows.value) {
      const stock = r.kind === 'ingredient'
        ? (store.ingredients.find((i) => i.id === r.id)?.qty || 0)
        : (store.supplies.find((s) => s.id === r.id)?.qty || 0);
      if (r.qty > stock) return props.showToast(`موجودی «${r.name}» کافی نیست (موجودی: ${toFa(stock)} ${r.unit})`, 'error');
    }
  }

  const supplier = store.customers.find((c) => c.id === moveForm.value.supplierId) || null;
  const supplierName = supplier ? `${supplier.firstName} ${supplier.lastName}` : '';
  const waybillNo = type === 'out' ? nextWaybillNo() : '';

  const newMoves = moveRows.value.map((r) => ({
    id: uid('m'),
    date: moveForm.value.date,
    time: nowTime(),
    kind: r.kind,
    ingredientId: r.kind === 'ingredient' ? r.id : '',
    supplyId: r.kind === 'supply' ? r.id : '',
    name: r.name,
    type,
    qty: r.qty,
    unit: r.unit,
    price: type === 'in' ? (r.price || 0) : 0,
    total: type === 'in' ? r.qty * (r.price || 0) : 0,
    desc: moveForm.value.desc.trim() || (type === 'in' ? 'ورود کالا' : 'خروج کالا'),
    person: type === 'in' ? (moveForm.value.receiver.trim() || props.userName || '—') : (moveForm.value.receiver.trim() || props.userName || '—'),
    sender: type === 'in' ? (supplierName || moveForm.value.sender.trim()) : (moveForm.value.sender.trim() || props.userName || '—'),
    receiver: moveForm.value.receiver.trim() || props.userName || '—',
    supplierId: type === 'in' ? (supplier?.id || '') : '',
    supplierName,
    invoiceNo: moveForm.value.invoiceNo.trim(),
    invoiceDate: moveForm.value.invoiceDate,
    waybillNo,
    batchId: `B${Date.now().toString(36)}`,
  }));

  // ثبت درخواست در کارتابل — اعمال موجودی پس از تایید انباردار انجام می‌شود
  // (در نسخه Vue استور سراسری همیشه موجود است؛ مسیر fallback فقط برای هم‌ارزی نگه داشته شده)
  const req = {
    id: `SR-${Date.now()}`,
    kind: type === 'in' ? 'stockin' : 'stockout',
    date: moveForm.value.date,
    time: nowTime(),
    requester: props.userName || '—',
    supplierName,
    waybillNo,
    invoiceNo: moveForm.value.invoiceNo.trim(),
    items: moveRows.value.map((r) => ({
      ingredientId: r.kind === 'ingredient' ? r.id : '',
      supplyId: r.kind === 'supply' ? r.id : '',
      name: r.name, kind: r.kind,
      qty: r.qty, unit: r.unit, price: r.price || 0,
    })),
    desc: moveForm.value.desc.trim(),
    status: 'temp',
  };
  if (true /* کارتابل همیشه فعال است */) {
    store.stockRequests = [req, ...(store.stockRequests || [])];
    // اطلاع‌رسانی به انبارداران/تاییدکنندگان
    const kindText = type === 'in' ? 'رسید انبار (ورود کالا)' : 'حواله انبار (خروج کالا)';
    (approvers || []).forEach((to) => {
      store.messages.push({
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        to, kind: 'info',
        text: `${kindText} جدید از ${req.requester} با ${toFa(moveRows.value.length)} قلم در کارتابل قرار گرفت و نیازمند تایید است.`,
        read: false, date: req.date, time: req.time,
      });
    });
    props.showToast(
      type === 'in'
        ? `رسید ورود ${toFa(moveRows.value.length)} قلم ثبت و برای تایید به کارتابل رفت`
        : `حواله خروج ${toFa(moveRows.value.length)} قلم ثبت و برای تایید به کارتابل رفت`
    );
  } else {
    // حالت بدون کارتابل (fallback): مستقیم اعمال شود
    applyMoveDirect(type, { newMoves, moveRows: moveRows.value, supplierName, waybillNo });
    props.showToast(type === 'in' ? `${toFa(moveRows.value.length)} قلم به موجودی افزوده شد` : `حواله خروج ${toFa(waybillNo)} ثبت شد`);
  }
  resetMoveForm();
};

// اعمال مستقیم (فقط fallback — با وجود استور سراسری هرگز اجرا نمی‌شود)
const applyMoveDirect = (type, { newMoves, moveRows: rows }) => {
  store.moves = [...newMoves, ...store.moves];
  if (type === 'in') {
    store.ingredients = store.ingredients.map((i) => {
      const r = rows.find((x) => x.kind === 'ingredient' && x.id === i.id);
      if (!r) return i;
      if (r.price > 0) {
        const oldCost = i.qty * (i.price || 0);
        const newCost = r.qty * r.price;
        const avgPrice = (i.qty + r.qty) > 0 ? Math.round((oldCost + newCost) / (i.qty + r.qty)) : r.price;
        return { ...i, qty: i.qty + r.qty, price: avgPrice };
      }
      return { ...i, qty: i.qty + r.qty };
    });
    store.supplies = store.supplies.map((s) => {
      const r = rows.find((x) => x.kind === 'supply' && x.id === s.id);
      if (!r) return s;
      const upd = { ...s, qty: (s.qty || 0) + r.qty };
      if (r.price > 0) upd.purchasePrice = r.price;
      return upd;
    });
  } else {
    store.ingredients = store.ingredients.map((i) => {
      const r = rows.find((x) => x.kind === 'ingredient' && x.id === i.id);
      return r ? { ...i, qty: i.qty - r.qty } : i;
    });
    store.supplies = store.supplies.map((s) => {
      const r = rows.find((x) => x.kind === 'supply' && x.id === s.id);
      return r ? { ...s, qty: Math.max(0, (s.qty || 0) - r.qty) } : s;
    });
  }
};

const cardexMoves = computed(
  () => store.moves.filter((m) => m.ingredientId === cardexId.value).sort((a, b) => (a.date > b.date ? 1 : -1))
);

const cardexItem = computed(() => store.ingredients.find((i) => i.id === cardexId.value) || null);

// محاسبه مانده متوالی کاردکس
const cardexRows = computed(() => {
  let bal = 0;
  return cardexMoves.value.map((m) => {
    bal += m.type === 'in' ? m.qty : -m.qty;
    return { ...m, balance: bal };
  });
});

// ===== گزارش خرید: حرکات «ورود» مواد غذایی با انتخاب فروشنده و دوره زمانی =====
const inRange = (date, from, to) => {
  const jdn = jalaliToJdn(date);
  if (from && jdn < jalaliToJdn(from)) return false;
  if (to && jdn > jalaliToJdn(to)) return false;
  return true;
};

const purchaseRows = computed(() => {
  if (!purSupplierId.value) return [];
  return store.moves
    .filter((m) => m.type === 'in' && m.kind !== 'supply' && m.supplierId === purSupplierId.value && inRange(m.date, purFrom.value, purTo.value))
    .sort((a, b) => (a.date > b.date ? 1 : -1));
});

const purchaseTotals = computed(() => purchaseRows.value.reduce(
  (acc, m) => ({ count: acc.count + 1, items: acc.items + (m.ingredientId ? 1 : 0) }),
  { count: 0, items: 0 }
));

// جمع اقلام بر اساس قلم (برای خلاصه گزارش خرید)
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

// ===== اقلام استفاده‌شده در فاکتورها =====
// مواد غذایی: از طریق رسپی‌ها به غذاها و از غذاها به اقلام فاکتورها می‌رسیم
const usedIngredientIds = computed(() => {
  const usedDishIdsSet = new Set();
  store.invoices.forEach((inv) => inv.items.forEach((it) => usedDishIdsSet.add(it.dishId)));
  const used = new Set();
  store.recipes.forEach((r) => {
    if (usedDishIdsSet.has(r.dishId)) r.items.forEach((it) => used.add(it.ingredientId));
  });
  return used;
});

const usedDishIds = computed(() => {
  const s = new Set();
  store.invoices.forEach((inv) => inv.items.forEach((it) => s.add(it.dishId)));
  return s;
});

const usedUnitNames = computed(() => {
  const s = new Set();
  store.ingredients.forEach((i) => { if (usedIngredientIds.value.has(i.id)) s.add(i.unit); });
  return s;
});

const lowCount = computed(() => store.ingredients.filter((i) => statusOf(i) === 'red' || statusOf(i) === 'yellow').length);

// ===== اسناد انبار (رسیدها و حواله‌ها) =====
const documents = computed(() => {
  const map = {};
  store.moves.forEach((m) => {
    const key = m.batchId || m.id;
    if (!map[key]) {
      map[key] = {
        batchId: key,
        type: m.type,
        date: m.date,
        time: m.time,
        sender: m.sender || m.person,
        receiver: m.receiver || '',
        supplierName: m.supplierName || '',
        supplierId: m.supplierId || '',
        invoiceNo: m.invoiceNo || '',
        invoiceDate: m.invoiceDate || '',
        waybillNo: m.waybillNo || '',
        desc: m.desc || '',
        items: [],
      };
    }
    map[key].items.push({ kind: m.kind || 'ingredient', id: m.ingredientId || m.supplyId, name: m.name, qty: m.qty, unit: m.unit, price: m.price || 0 });
  });
  return Object.values(map).sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : (a.time > b.time ? -1 : 1)));
});

const filteredDocuments = computed(() => documents.value.filter((d) => docFilter.value === 'all' || d.type === docFilter.value));

const startDocEdit = (doc) => {
  editDocId.value = doc.batchId;
  editDocRows.value = doc.items.map((it) => ({ ...it }));
  editDocForm.value = {
    date: doc.date, sender: doc.sender || '', receiver: doc.receiver || '',
    supplierId: doc.supplierId || '', invoiceNo: doc.invoiceNo, desc: doc.desc,
  };
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const cancelDocEdit = () => {
  editDocId.value = null;
  editDocRows.value = [];
  editDocForm.value = {};
};

const saveDocEdit = () => {
  if (editDocRows.value.length === 0) return props.showToast('حداقل یک قلم لازم است', 'error');
  const docType = store.moves.find((m) => (m.batchId || m.id) === editDocId.value)?.type;
  // ۱) برگرداندن اثر سند قدیمی
  let newIngredients = [...store.ingredients];
  let newSupplies = [...store.supplies];
  const oldMoves = store.moves.filter((m) => (m.batchId || m.id) === editDocId.value);
  oldMoves.forEach((m) => {
    if (m.type === 'in') {
      newIngredients = newIngredients.map((i) => (i.id === m.ingredientId ? { ...i, qty: i.qty - m.qty } : i));
      newSupplies = newSupplies.map((s) => (s.id === m.supplyId ? { ...s, qty: Math.max(0, (s.qty || 0) - m.qty) } : s));
    } else {
      newIngredients = newIngredients.map((i) => (i.id === m.ingredientId ? { ...i, qty: i.qty + m.qty } : i));
      newSupplies = newSupplies.map((s) => (s.id === m.supplyId ? { ...s, qty: (s.qty || 0) + m.qty } : s));
    }
  });
  // ۲) کنترل موجودی برای خروج جدید
  if (docType === 'out') {
    for (const r of editDocRows.value) {
      const stock = r.kind === 'supply'
        ? (newSupplies.find((s) => s.id === r.id)?.qty || 0)
        : (newIngredients.find((i) => i.id === r.id)?.qty || 0);
      if (r.qty > stock) return props.showToast(`موجودی «${r.name}» کافی نیست (موجودی: ${toFa(stock)} ${r.unit})`, 'error');
    }
  }
  // ۳) اعمال سند جدید
  editDocRows.value.forEach((r) => {
    if (docType === 'in') {
      newIngredients = newIngredients.map((i) => (i.kind !== 'supply' && i.id === r.id && r.kind === 'ingredient' ? { ...i, qty: i.qty + r.qty } : i));
      newSupplies = newSupplies.map((s) => (s.id === r.id && r.kind === 'supply' ? { ...s, qty: (s.qty || 0) + r.qty } : s));
    } else {
      newIngredients = newIngredients.map((i) => (i.id === r.id && r.kind === 'ingredient' ? { ...i, qty: i.qty - r.qty } : i));
      newSupplies = newSupplies.map((s) => (s.id === r.id && r.kind === 'supply' ? { ...s, qty: Math.max(0, (s.qty || 0) - r.qty) } : s));
    }
  });
  store.ingredients = newIngredients;
  store.supplies = newSupplies;
  // ۴) به‌روزرسانی حرکات
  const supplier = store.customers.find((c) => c.id === editDocForm.value.supplierId);
  store.moves = store.moves.map((m) => {
    if ((m.batchId || m.id) !== editDocId.value) return m;
    const r = editDocRows.value.find((x) => (x.kind === 'ingredient' ? x.id === m.ingredientId : x.id === m.supplyId));
    if (!r) return null; // این قلم حذف شده
    return {
      ...m,
      date: editDocForm.value.date,
      name: r.name, qty: r.qty, unit: r.unit, price: docType === 'in' ? (r.price || 0) : 0,
      total: docType === 'in' ? r.qty * (r.price || 0) : 0,
      sender: docType === 'in' ? (supplier ? `${supplier.firstName} ${supplier.lastName}` : editDocForm.value.sender) : editDocForm.value.sender,
      receiver: editDocForm.value.receiver,
      supplierId: editDocForm.value.supplierId,
      supplierName: supplier ? `${supplier.firstName} ${supplier.lastName}` : '',
      invoiceNo: editDocForm.value.invoiceNo,
      desc: editDocForm.value.desc || m.desc,
    };
  }).filter(Boolean);
  cancelDocEdit();
  props.showToast('سند ویرایش و موجودی انبار اصلاح شد');
};

const removeDocRow = (idx) => { editDocRows.value = editDocRows.value.filter((_, i) => i !== idx); };

const doDeleteDoc = () => {
  const { batchId } = confirmDocDel.value;
  const oldMoves = store.moves.filter((m) => (m.batchId || m.id) === batchId);
  const docType = oldMoves[0]?.type;
  // برگرداندن اثر سند روی موجودی
  let newIngredients = [...store.ingredients];
  let newSupplies = [...store.supplies];
  oldMoves.forEach((m) => {
    if (m.type === 'in') {
      newIngredients = newIngredients.map((i) => (i.id === m.ingredientId ? { ...i, qty: Math.max(0, i.qty - m.qty) } : i));
      newSupplies = newSupplies.map((s) => (s.id === m.supplyId ? { ...s, qty: Math.max(0, (s.qty || 0) - m.qty) } : s));
    } else {
      newIngredients = newIngredients.map((i) => (i.id === m.ingredientId ? { ...i, qty: i.qty + m.qty } : i));
      newSupplies = newSupplies.map((s) => (s.id === m.supplyId ? { ...s, qty: (s.qty || 0) + m.qty } : s));
    }
  });
  store.ingredients = newIngredients;
  store.supplies = newSupplies;
  store.moves = store.moves.filter((m) => (m.batchId || m.id) !== batchId);
  confirmDocDel.value = null;
  props.showToast(`${docType === 'in' ? 'رسید ورود' : 'حواله خروج'} حذف شد و موجودی انبار اصلاح شد`);
};

const TABS = [
  { id: 'out', label: 'خروج کالا', icon: ArrowUpFromLine },
  { id: 'balance', label: 'موجودی انبار', icon: Boxes },
  { id: 'cardex', label: 'کاردکس کالا', icon: History },
  { id: 'purchase', label: 'گزارش خرید', icon: ShoppingBag },
  { id: 'documents', label: 'اسناد انبار', icon: FileText },
];
</script>

<template>
  <div class="space-y-6">
    <!-- هدر صفحه -->
    <div class="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="p-3 bg-amber-50 text-amber-700 rounded-2xl">
          <Package class="w-6 h-6" />
        </div>
        <div>
          <h2 class="text-base font-black text-slate-900">ورود و خروج انبار مواد غذایی</h2>
          <p class="text-[11px] text-slate-500">موجودی لحظه‌ای، ورود و خروج کالا، کاردکس اقلام و گزارش خرید با انتخاب فروشنده</p>
        </div>
        <span
          v-if="lowCount > 0"
          class="flex items-center gap-1.5 text-[11px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-full"
        >
          <AlertTriangle class="w-3.5 h-3.5" />
          {{ toFa(lowCount) }} قلم نیازمند خرید
        </span>
      </div>
    </div>

    <!-- تب‌ها — وقتی از ساید‌بار با زیربخش مشخص وارد شده، پنهان می‌شود -->
    <div v-if="showTabs" class="bg-white rounded-2xl border border-slate-200 p-2 overflow-x-auto flex gap-1.5">
      <button
        v-for="t in TABS"
        :key="t.id"
        class="px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition"
        :class="tab === t.id ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'"
        @click="tab = t.id"
      >
        <component :is="t.icon" class="w-4 h-4" />
        {{ t.label }}
      </button>
    </div>

    <!-- تب ورود / خروج کالا -->
    <div v-if="tab === 'out'" class="max-w-4xl space-y-4">
      <div class="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <h3 class="text-sm font-black flex items-center gap-2" :class="isIn ? 'text-emerald-700' : 'text-rose-700'">
          <ArrowDownToLine v-if="isIn" class="w-5 h-5" />
          <ArrowUpFromLine v-else class="w-5 h-5" />
          {{ isIn ? 'ثبت ورود کالا به انبار (چند قلم)' : 'ثبت حواله خروج کالا از انبار (چند قلم)' }}
        </h3>

        <!-- افزودن قلم -->
        <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <div class="text-xs font-black text-slate-700">افزودن قلم (مواد غذایی و اقلام جانبی):</div>
          <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div class="sm:col-span-5">
              <label class="block text-[11px] font-bold text-slate-600 mb-1">قلم انبار:</label>
              <SearchableSelect
                :model-value="moveRowSel.id"
                placeholder="-- انتخاب قلم --"
                search-placeholder="جستجوی نام قلم، ماده یا قلم جانبی..."
                :options="itemSelectOptions"
                @update:model-value="pickMoveRowItem"
              />
            </div>
            <div class="sm:col-span-3">
              <label class="block text-[11px] font-bold text-slate-600 mb-1">مقدار:</label>
              <NumberSpinner v-model="moveRowSel.qty" :min="0" :step="1" />
            </div>
            <div class="sm:col-span-2">
              <label class="block text-[11px] font-bold text-slate-600 mb-1">واحد ثبت:</label>
              <select
                v-if="entryUnitOptions.length > 1"
                v-model="moveRowSel.entryUnit"
                :class="`${inputCls} text-xs py-2`"
              >
                <option v-for="o in entryUnitOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
              <div v-else :class="`${inputCls} bg-slate-50 text-center text-xs py-2 text-slate-500`">{{ selectedItem ? selectedItem.unit : '—' }}</div>
              <p v-if="entryUnitOptions.length > 1 && entryConvFactor" class="text-[9px] text-slate-500 mt-1 font-bold">
                1 {{ entryUnit }} = {{ toFa(entryConvFactor) }} {{ selectedItem?.unit }}
              </p>
            </div>
            <div v-if="isIn" class="sm:col-span-3">
              <label class="block text-[11px] font-bold text-slate-600 mb-1">قیمت واحد:</label>
              <MoneyInput
                v-model="moveRowSel.price"
                :class="`${inputCls} text-center font-black`"
                placeholder="قیمت فاکتور"
              />
            </div>
            <div :class="isIn ? 'sm:col-span-2' : 'sm:col-span-2'">
              <button type="button" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5" @click="addMoveRow">
                <Plus class="w-4 h-4" /> افزودن
              </button>
            </div>
          </div>
        </div>

        <!-- جدول اقلام فرم -->
        <div v-if="moveRows.length > 0" class="border border-slate-200 rounded-2xl overflow-hidden">
          <table class="w-full text-right text-xs">
            <thead class="bg-slate-50 font-black text-slate-700 border-b border-slate-200">
              <tr>
                <th class="p-2.5 w-10 text-center">#</th>
                <th class="p-2.5">قلم</th>
                <th class="p-2.5 text-center w-24">مقدار</th>
                <th v-if="isIn" class="p-2.5 text-left w-32">قیمت واحد</th>
                <th v-if="isIn" class="p-2.5 text-left w-32">جمع ردیف</th>
                <th class="p-2.5 text-center w-12">حذف</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(r, idx) in moveRows" :key="`${r.kind}-${r.id}`" class="hover:bg-slate-50">
                <td class="p-2.5 text-center text-slate-500">{{ toFa(idx + 1) }}</td>
                <td class="p-2.5 font-black text-slate-800">
                  {{ r.name }}
                  <span v-if="r.kind === 'supply'" class="mr-1.5 text-[9px] font-black bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">قلم جانبی</span>
                  <div v-if="r.convNote" class="text-[9px] font-bold text-slate-400 mt-0.5">{{ r.convNote }}</div>
                </td>
                <td class="p-2.5 text-center font-black text-emerald-700">{{ toFa(r.qty) }} {{ r.unit }}</td>
                <td v-if="isIn" class="p-2.5 text-left font-bold">{{ r.price ? formatMoney(r.price) : '—' }}</td>
                <td v-if="isIn" class="p-2.5 text-left font-black text-slate-800">{{ r.price ? formatMoney(r.qty * r.price) : '—' }}</td>
                <td class="p-2.5 text-center">
                  <button class="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded-lg transition" @click="removeMoveRow(idx)">
                    <Trash2 class="w-4 h-4" />
                  </button>
                </td>
              </tr>
            </tbody>
            <tfoot v-if="isIn && moveRows.length > 0" class="bg-emerald-50 font-black border-t-2 border-emerald-400">
              <tr>
                <td colspan="4" class="p-2.5 text-xs">جمع کل فاکتور خرید:</td>
                <td class="p-2.5 text-left text-sm text-emerald-900">{{ formatMoney(purchaseTotal) }} تومان</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- اطلاعات سند -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">تاریخ (هجری شمسی): <span class="text-rose-500">*</span></label>
            <JalaliDatePicker v-model="moveForm.date" />
          </div>
          <div v-if="isIn">
            <label class="block text-xs font-bold text-slate-700 mb-1.5">نام فروشنده (از لیست مشتریان):</label>
            <SearchableSelect
              v-model="moveForm.supplierId"
              placeholder="-- انتخاب فروشنده --"
              search-placeholder="جستجوی نام یا موبایل فروشنده..."
              :options="store.customers.map((c) => ({
                value: c.id,
                label: `${c.firstName} ${c.lastName} — ${toFa(c.mobile || '-')}`,
                searchText: `${c.firstName} ${c.lastName} ${c.mobile || ''} فروشنده`,
              }))"
            />
          </div>
          <div v-else class="bg-sky-50 border border-sky-200 rounded-2xl p-3 text-[11px] font-black text-sky-900 flex items-center gap-2">
            <ClipboardList class="w-4 h-4 shrink-0" />
            شماره حواله خروج به‌صورت خودکار و یکتا ثبت می‌شود
          </div>
          <!-- تحویل‌دهنده: انتخاب از مشتریان یا تایپ دستی -->
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">تحویل‌دهنده: <span class="text-rose-500">*</span></label>
            <input
              v-model="moveForm.sender"
              list="wh-customers-list"
              placeholder="تایپ دستی یا انتخاب از لیست مشتریان..."
              :class="inputCls"
            />
          </div>
          <!-- تحویل‌گیرنده: انتخاب از مشتریان یا تایپ دستی -->
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">تحویل‌گیرنده: <span class="text-rose-500">*</span></label>
            <input
              v-model="moveForm.receiver"
              list="wh-customers-list"
              placeholder="تایپ دستی یا انتخاب از لیست مشتریان..."
              :class="inputCls"
            />
          </div>
          <datalist id="wh-customers-list">
            <option v-for="c in store.customers" :key="c.id" :value="`${c.firstName} ${c.lastName}`" />
          </datalist>
          <template v-if="isIn">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5">شماره فاکتور خرید (اختیاری):</label>
              <input
                v-model="moveForm.invoiceNo"
                dir="ltr"
                placeholder="مثلاً INV-1234"
                :class="inputCls"
              />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5">تاریخ صدور فاکتور (اختیاری):</label>
              <JalaliDatePicker v-model="moveForm.invoiceDate" />
            </div>
          </template>
          <div class="sm:col-span-2">
            <label class="block text-xs font-bold text-slate-700 mb-1.5">شرح ({{ isIn ? 'فاکتور خرید / توضیحات' : 'بخش/غذای مصرفی' }}):</label>
            <input v-model="moveForm.desc" type="text" :placeholder="isIn ? 'مثلاً خرید از بازار روز' : 'مثلاً پخت چلوکباب — سرو ناهار'" :class="inputCls" />
          </div>
        </div>

        <button
          class="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-black text-white transition shadow-md"
          :class="isIn ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'"
          @click="submitMove(tab)"
        >
          {{ isIn ? 'ثبت ورود کالا' : 'ثبت حواله خروج' }}
        </button>
      </div>
    </div>

    <!-- تب موجودی -->
    <div v-if="tab === 'balance'" class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div class="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <h3 class="text-sm font-black text-slate-800">جدول موجودی اقلام اصلی انبار</h3>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-[11px] text-slate-500">{{ toFa(store.ingredients.length) }} قلم کالا</span>
          <ExportButtons
            filename="موجودی-انبار"
            title="موجودی اقلام انبار"
            :subtitle="`تاریخ گزارش: ${faDate(jalaliTodayString())}`"
            :headers="['ردیف', 'نام ماده غذایی', 'واحد', 'محل نگهداری', 'موجودی', 'آستانه هشدار', 'درصد پرتی']"
            :rows="store.ingredients.map((i, idx) => [idx + 1, i.name, i.unit, i.storage || '', i.qty, i.minThreshold, i.wastePercent])"
            :font-family="store.settings.reportFont || 'Vazirmatn'"
          />
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-right text-xs">
          <thead class="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
            <tr>
              <th class="p-3 w-12 text-center">#</th>
              <th class="p-3">نام ماده غذایی</th>
              <th class="p-3">واحد</th>
              <th class="p-3">محل نگهداری</th>
              <th class="p-3">موجودی</th>
              <th class="p-3">آستانه هشدار</th>
              <th class="p-3">درصد پرتی</th>
              <th class="p-3 text-center">وضعیت</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <EmptyRow v-if="store.ingredients.length === 0" :col-span="8" text="قلمی ثبت نشده است" />
            <tr
              v-for="(i, idx) in store.ingredients"
              v-else
              :key="i.id"
              class="hover:bg-slate-50"
              :class="statusOf(i) === 'red' ? 'bg-rose-50/40' : statusOf(i) === 'yellow' ? 'bg-amber-50/30' : ''"
            >
              <td class="p-3 text-center font-bold text-slate-500">{{ toFa(idx + 1) }}</td>
              <td class="p-3 font-black text-slate-800">{{ i.name }}</td>
              <td class="p-3 text-slate-600">{{ i.unit }}</td>
              <td class="p-3 text-slate-600">{{ i.storage || '—' }}</td>
              <td class="p-3">
                <span class="font-black text-slate-900">{{ toFa(i.qty) }}</span>
                {{ ' ' }}
                <span class="text-slate-500 text-[11px]">{{ i.unit }}</span>
              </td>
              <td class="p-3 text-slate-600">{{ toFa(i.minThreshold) }}</td>
              <td class="p-3 text-slate-600">{{ toFa(i.wastePercent) }}٪</td>
              <td class="p-3 text-center">
                <span
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black border"
                  :class="
                    statusOf(i) === 'red' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                    statusOf(i) === 'yellow' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                    'bg-emerald-100 text-emerald-800 border-emerald-200'
                  "
                >
                  <span class="w-2 h-2 rounded-full" :class="statusOf(i) === 'red' ? 'bg-rose-500' : statusOf(i) === 'yellow' ? 'bg-amber-500' : 'bg-emerald-500'" />
                  {{ statusOf(i) === 'red' ? 'قرمز — بحرانی' : statusOf(i) === 'yellow' ? 'زرد — رو به اتمام' : 'مطلوب' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- تب کاردکس -->
    <div v-if="tab === 'cardex'" class="space-y-4">
      <div class="bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1.5">انتخاب قلم برای مشاهده کاردکس:</label>
          <SearchableSelect
            v-model="cardexId"
            placeholder="-- انتخاب قلم --"
            search-placeholder="جستجوی نام قلم، واحد، محل نگهداری..."
            :options="store.ingredients.map((i) => ({
              value: i.id,
              label: `${i.name} (${toFa(i.qty)} ${i.unit})`,
              searchText: `${i.name} ${i.unit} ${i.storage || ''}`,
            }))"
          />
        </div>
        <div v-if="cardexItem" class="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
          <ClipboardList class="w-8 h-8 text-emerald-600" />
          <div class="text-xs space-y-0.5">
            <div class="font-black text-slate-800">{{ cardexItem.name }}</div>
            <div class="text-slate-500">مانده فعلی: <strong class="text-slate-800">{{ toFa(cardexItem.qty) }} {{ cardexItem.unit }}</strong></div>
            <div class="text-slate-500">محل نگهداری: {{ cardexItem.storage || '—' }}</div>
          </div>
        </div>
      </div>

      <div v-if="cardexItem" class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div class="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <h3 class="text-sm font-black text-slate-800">گردش «{{ cardexItem.name }}»</h3>
          <div class="flex items-center gap-2 flex-wrap">
            <button class="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-blue-100 transition" @click="printCardex = true">
              <Printer class="w-4 h-4" /> چاپ کاردکس
            </button>
            <ExportButtons
              :filename="`کاردکس-${cardexItem.name}`"
              :title="`کاردکس «${cardexItem.name}»`"
              :subtitle="`مانده فعلی: ${cardexItem.qty} ${cardexItem.unit}`"
              :headers="['ردیف', 'تاریخ', 'ساعت', 'شرح', 'شخص', 'ورود', 'خروج', 'مانده']"
              :rows="cardexRows.map((m, idx) => [idx + 1, m.date, m.time, m.desc, m.person, m.type === 'in' ? m.qty : 0, m.type === 'out' ? m.qty : 0, m.balance])"
              :font-family="store.settings.reportFont || 'Vazirmatn'"
            />
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-right text-xs">
            <thead class="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
              <tr>
                <th class="p-3 w-12 text-center">ردیف</th>
                <th class="p-3">تاریخ</th>
                <th class="p-3">ساعت</th>
                <th class="p-3">شرح</th>
                <th class="p-3">تحویل‌دهنده</th>
                <th class="p-3">تحویل‌گیرنده</th>
                <th class="p-3">فاکتور / حواله</th>
                <th class="p-3 text-center">ورود</th>
                <th class="p-3 text-center">خروج</th>
                <th class="p-3 text-center">مانده</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <EmptyRow v-if="cardexRows.length === 0" :col-span="10" text="گردشی برای این قلم ثبت نشده است" />
              <tr v-for="(m, idx) in cardexRows" v-else :key="m.id" class="hover:bg-slate-50">
                <td class="p-3 text-center font-bold text-slate-500">{{ toFa(idx + 1) }}</td>
                <td class="p-3 text-slate-700">{{ faDate(m.date) }}</td>
                <td class="p-3 text-slate-500">{{ toFa(m.time) }}</td>
                <td class="p-3 text-slate-700">{{ m.desc }}</td>
                <td class="p-3 text-slate-600">{{ m.sender || m.person }}</td>
                <td class="p-3 text-slate-600">{{ m.receiver || '—' }}</td>
                <td class="p-3 text-slate-600">
                  <span v-if="m.waybillNo" class="text-[10px] font-black bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full ml-1">{{ toFa(m.waybillNo) }}</span>
                  <span v-if="m.invoiceNo" class="text-[10px] font-bold text-slate-600 inline-flex items-center gap-1">
                    <FileText class="w-3 h-3" /> {{ toFa(m.invoiceNo) }}{{ m.invoiceDate ? ` — ${faDate(m.invoiceDate)}` : '' }}
                  </span>
                  <template v-if="!m.waybillNo && !m.invoiceNo">—</template>
                </td>
                <td class="p-3 text-center font-black text-emerald-700">{{ m.type === 'in' ? `${toFa(m.qty)} ${m.unit}` : '—' }}</td>
                <td class="p-3 text-center font-black text-rose-600">{{ m.type === 'out' ? `${toFa(m.qty)} ${m.unit}` : '—' }}</td>
                <td class="p-3 text-center font-black text-slate-800">{{ toFa(m.balance) }} {{ m.unit }}</td>
              </tr>
            </tbody>
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
            <JalaliDatePicker v-model="purFrom" placeholder="ابتدای دوره" :max-date="purTo || undefined" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">تا تاریخ:</label>
            <JalaliDatePicker v-model="purTo" placeholder="انتهای دوره" :min-date="purFrom || undefined" />
          </div>
        </div>
        <div v-if="purchaseRows.length > 0" class="flex flex-wrap gap-2 pt-1">
          <button class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-emerald-600/20" @click="printPurchase = true">
            <Printer class="w-4 h-4" /> چاپ گزارش خرید
          </button>
          <ExportButtons
            :filename="`گزارش-خرید-${purSupplier?.lastName || 'فروشنده'}`"
            :title="`گزارش خرید از ${purSupplier ? purSupplier.firstName + ' ' + purSupplier.lastName : ''}`"
            :subtitle="`بازه: ${purFrom ? faDate(purFrom) : 'ابتدا'} تا ${purTo ? faDate(purTo) : 'امروز'}`"
            :headers="['ردیف', 'تاریخ', 'ساعت', 'ماده غذایی', 'مقدار', 'واحد', 'شرح', 'تحویل‌دهنده']"
            :rows="purchaseRows.map((m, i) => [i + 1, m.date, m.time, m.name, m.qty, m.unit, m.desc, m.person])"
            :font-family="store.settings.reportFont || 'Vazirmatn'"
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
            <tfoot v-if="purchaseRows.length > 0" class="bg-emerald-50 font-black text-xs border-t-2 border-emerald-500">
              <tr>
                <td colspan="3" class="p-3">جمع کل ({{ toFa(purchaseRows.length) }} فاکتور خرید):</td>
                <td class="p-3">{{ toFa(purchaseByItem.length) }} قلم ماده</td>
                <td class="p-3 text-center text-emerald-900">—</td>
                <td colspan="2" class="p-3"></td>
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

    <!-- تب اسناد انبار (رسیدها و حواله‌ها) -->
    <div v-if="tab === 'documents'" class="space-y-4">
      <div v-if="editDocId" class="bg-amber-50 border border-amber-300 rounded-2xl p-5 space-y-4">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <h3 class="text-sm font-black text-amber-900">ویرایش سند — پس از ذخیره، موجودی انبار اصلاح می‌شود</h3>
          <div class="flex gap-2">
            <button class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition" @click="saveDocEdit">ذخیره ویرایش</button>
            <button class="px-4 py-2 bg-white border border-amber-300 text-amber-800 rounded-xl text-xs font-bold transition" @click="cancelDocEdit">انصراف</button>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label class="block text-[11px] font-bold text-slate-600 mb-1">تاریخ:</label>
            <JalaliDatePicker v-model="editDocForm.date" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-600 mb-1">تحویل‌دهنده:</label>
            <input v-model="editDocForm.sender" list="wh-customers-list" :class="inputCls" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-600 mb-1">تحویل‌گیرنده:</label>
            <input v-model="editDocForm.receiver" list="wh-customers-list" :class="inputCls" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-600 mb-1">شماره فاکتور:</label>
            <input v-model="editDocForm.invoiceNo" dir="ltr" :class="inputCls" />
          </div>
        </div>
        <div class="border border-amber-200 rounded-2xl overflow-hidden bg-white">
          <table class="w-full text-right text-xs">
            <thead class="bg-slate-50 font-black text-slate-700 border-b border-slate-200">
              <tr>
                <th class="p-2.5 w-10 text-center">#</th>
                <th class="p-2.5">قلم</th>
                <th class="p-2.5 text-center w-36">مقدار</th>
                <th class="p-2.5 text-center w-12">حذف</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(r, idx) in editDocRows" :key="`${r.kind}-${r.id}`">
                <td class="p-2.5 text-center text-slate-500">{{ toFa(idx + 1) }}</td>
                <td class="p-2.5 font-black text-slate-800">{{ r.name }}</td>
                <td class="p-2.5">
                  <NumberSpinner
                    :model-value="String(r.qty)"
                    :min="0"
                    :step="1"
                    @update:model-value="(v) => { editDocRows[idx].qty = Number(v) || 0 }"
                  />
                </td>
                <td class="p-2.5 text-center">
                  <button class="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded-lg transition" @click="removeDocRow(idx)"><Trash2 class="w-4 h-4" /></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div class="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <h3 class="text-sm font-black text-slate-800">رسیدهای ورود و حواله‌های خروج انبار</h3>
          <div class="flex gap-1.5">
            <button
              v-for="f in [{ id: 'all', label: 'همه' }, { id: 'in', label: 'رسید ورود' }, { id: 'out', label: 'حواله خروج' }]"
              :key="f.id"
              class="px-3.5 py-2 rounded-xl text-[11px] font-black transition"
              :class="docFilter === f.id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
              @click="docFilter = f.id"
            >
              {{ f.label }}
            </button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-right text-xs">
            <thead class="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
              <tr>
                <th class="p-3 w-12 text-center">#</th>
                <th class="p-3">نوع سند</th>
                <th class="p-3">شماره</th>
                <th class="p-3">تاریخ</th>
                <th class="p-3">اقلام</th>
                <th class="p-3">تحویل‌دهنده</th>
                <th class="p-3">تحویل‌گیرنده</th>
                <th class="p-3 text-center w-24">عملیات</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <EmptyRow v-if="filteredDocuments.length === 0" :col-span="8" text="سندی ثبت نشده است" />
              <tr
                v-for="(doc, idx) in filteredDocuments"
                v-else
                :key="doc.batchId"
                class="hover:bg-slate-50"
                :class="editDocId === doc.batchId ? 'bg-amber-50/60' : ''"
              >
                <td class="p-3 text-center font-bold text-slate-500">{{ toFa(idx + 1) }}</td>
                <td class="p-3">
                  <span class="px-2.5 py-1 rounded-full text-[10px] font-black" :class="doc.type === 'in' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'">
                    {{ doc.type === 'in' ? 'رسید ورود' : 'حواله خروج' }}
                  </span>
                </td>
                <td class="p-3 font-black text-slate-700">
                  <template v-if="doc.waybillNo">{{ toFa(doc.waybillNo) }}</template>
                  <template v-else-if="doc.invoiceNo">
                    <span class="inline-flex items-center gap-1"><FileText class="w-3 h-3" />{{ toFa(doc.invoiceNo) }}</span>
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="p-3 text-slate-600">{{ faDate(doc.date) }}</td>
                <td class="p-3 text-slate-600 max-w-[260px]">
                  {{ doc.items.map((it) => `${it.name} (${toFa(it.qty)})`).join(' + ') }}
                </td>
                <td class="p-3 text-slate-600">{{ doc.sender || '—' }}</td>
                <td class="p-3 text-slate-600">{{ doc.receiver || '—' }}</td>
                <td class="p-3 text-center">
                  <div class="flex items-center justify-center gap-1">
                    <button title="ویرایش سند" class="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" @click="startDocEdit(doc)">
                      <Pencil class="w-4 h-4" />
                    </button>
                    <button title="حذف سند" class="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" @click="confirmDocDel = { batchId: doc.batchId, type: doc.type }">
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- مودال تأیید حذف سند انبار -->
    <div v-if="confirmDocDel" class="fixed inset-0 z-[96] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 no-print">
      <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-rose-100">
        <div class="flex items-center gap-3 mb-4">
          <div class="p-3 bg-rose-100 text-rose-600 rounded-2xl">
            <AlertTriangle class="w-6 h-6" />
          </div>
          <h3 class="font-black text-slate-900 text-sm">تأیید حذف {{ confirmDocDel.type === 'in' ? 'رسید ورود' : 'حواله خروج' }}</h3>
        </div>
        <p class="text-xs text-slate-700 leading-relaxed mb-4">
          با حذف این سند، اثر آن بر موجودی انبار برمی‌گردد (اقلام سند
          {{ confirmDocDel.type === 'in' ? ' از موجودی کسر' : ' به موجودی افزوده' }} می‌شود). ادامه می‌دهید؟
        </p>
        <div class="flex items-center gap-2">
          <button class="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition" @click="doDeleteDoc">بله، حذف کن</button>
          <button class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition" @click="confirmDocDel = null">انصراف</button>
        </div>
      </div>
    </div>

    <!-- مودال چاپ کاردکس -->
    <PrintModal
      v-if="printCardex && cardexItem"
      :open="true"
      :title="`چاپ کاردکس «${cardexItem.name}»`"
      v-model:paper-size="store.paperSize"
      v-model:copies="store.copies"
      :font-family="store.settings.reportFont || 'Vazirmatn'"
      @close="printCardex = false"
    >
      <div class="space-y-4">
        <div class="text-center border-b-2 border-slate-800 pb-3">
          <h3 class="font-black text-slate-900">کاردکس کالا — آشپزخانه نسیم</h3>
          <p class="text-[11px] text-slate-600">قلم: {{ cardexItem.name }} | واحد: {{ cardexItem.unit }} | مانده فعلی: {{ toFa(cardexItem.qty) }} {{ cardexItem.unit }}</p>
        </div>
        <table class="w-full text-right text-[11px] border border-slate-300">
          <thead class="bg-slate-100 font-bold">
            <tr>
              <th class="p-2 border-l border-slate-200">تاریخ</th>
              <th class="p-2 border-l border-slate-200">شرح</th>
              <th class="p-2 border-l border-slate-200 text-center">ورود</th>
              <th class="p-2 border-l border-slate-200 text-center">خروج</th>
              <th class="p-2 text-center">مانده</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="m in cardexRows" :key="m.id">
              <td class="p-2 border-l border-slate-100">{{ faDate(m.date) }}</td>
              <td class="p-2 border-l border-slate-100">{{ m.desc }}</td>
              <td class="p-2 border-l border-slate-100 text-center font-bold text-emerald-700">{{ m.type === 'in' ? toFa(m.qty) : '—' }}</td>
              <td class="p-2 border-l border-slate-100 text-center font-bold text-rose-600">{{ m.type === 'out' ? toFa(m.qty) : '—' }}</td>
              <td class="p-2 text-center font-bold">{{ toFa(m.balance) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </PrintModal>

    <!-- مودال چاپ گزارش خرید -->
    <PrintModal
      v-if="printPurchase && purSupplier"
      :open="true"
      :title="`چاپ گزارش خرید از ${purSupplier.firstName} ${purSupplier.lastName}`"
      v-model:paper-size="store.paperSize"
      v-model:copies="store.copies"
      :font-family="store.settings.reportFont || 'Vazirmatn'"
      @close="printPurchase = false"
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
