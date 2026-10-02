/**
 * چرخه خرید (فاز ۲) — PR → PO → GRN → فاکتور خرید → تطبیق سه‌طرفه
 * قواعد:
 * - PO سند رسمی به تأمین‌کننده (جدا از PR)
 * - GRN موجودی فیزیکی را افزایش می‌دهد (از طریق stockRequest به کارتابل)
 * - فاکتور خرید بدهی مالی است (جدا از GRN)
 * - تحویل جزئی: یک PO می‌تواند چند GRN داشته باشد
 * - تطبیق سه‌طرفه: matched فقط وقتی مقدار و قیمت PR/GRN/Invoice سازگار باشند
 */
import { jalaliTodayString, nowTime, toFa, uid, auditEntry } from './utils.js';
import { roundQty } from './units.js';

// ===== موجودی در راه (On-Order) برای یک ماده =====
export const onOrderQty = (store, ingredientId) => {
  let total = 0;
  (store.purchaseOrders || []).forEach((po) => {
    if (['sent', 'partially_received'].includes(po.status)) {
      po.items.forEach((it) => {
        if (it.ingredientId === ingredientId) total += Math.max(0, (it.qty || 0) - (it.receivedQty || 0));
      });
    }
  });
  return roundQty(total);
};

// ===== صدور PO از PR تأیید‌شده =====
export const createPO = (store, { prId, supplierId, items, expectedDate = '', notes = '' }) => {
  const po = {
    id: `PO-${Date.now().toString(36)}`,
    prId,
    supplierId,
    date: jalaliTodayString(),
    time: toFa(nowTime()),
    expectedDate,
    items: items.map((it) => ({ ...it, unitPrice: it.unitPrice || 0, total: roundQty((it.qty || 0) * (it.unitPrice || 0)), receivedQty: 0 })),
    status: 'draft',
    createdBy: store.currentUser ? userDisp(store.currentUser) : '—',
    createdAt: `${jalaliTodayString()} ${toFa(nowTime())}`,
    sentBy: null, sentAt: null,
    notes,
    audit: [auditEntry(store.currentUser, `صدور سفارش خرید از درخواست ${prId}`)],
  };
  store.purchaseOrders = [po, ...(store.purchaseOrders || [])];
  return po;
};

export const sendPO = (store, po) => {
  store.purchaseOrders = store.purchaseOrders.map((x) => (x.id === po.id
    ? { ...x, status: 'sent', sentBy: store.currentUser ? userDisp(store.currentUser) : '—', sentAt: `${jalaliTodayString()} ${toFa(nowTime())}`, audit: [...(x.audit || []), auditEntry(store.currentUser, 'ارسال سفارش به تأمین‌کننده')] }
    : x));
};

export const cancelPO = (store, po, reason = '') => {
  store.purchaseOrders = store.purchaseOrders.map((x) => (x.id === po.id
    ? { ...x, status: 'cancelled', audit: [...(x.audit || []), auditEntry(store.currentUser, `ابطال سفارش خرید${reason ? ` — ${reason}` : ''}`)] }
    : x));
};

const userDisp = (u) => u?.fullName || u?.username || '—';

// ===== GRN — رسید انبار =====
// items: [{ingredientId, supplyId, name, orderedQty, approvedQty, receivedQty, unit, unitPrice, ...}]
export const createGRN = (store, { po, items, notes = '', warehouseDestination = 'انبار اصلی' }) => {
  const supplier = store.suppliers.find((s) => s.id === po?.supplierId);
  const grn = {
    id: `GRN-${Date.now().toString(36)}`,
    poId: po?.id || '',
    prId: po?.prId || '',
    supplierId: po?.supplierId || '',
    supplierName: supplier?.name || '—',
    date: jalaliTodayString(),
    time: toFa(nowTime()),
    items: items.map((it) => ({
      ...it,
      receivedQty: roundQty(it.receivedQty || 0),
      rejectedQty: roundQty(it.rejectedQty || 0),
      qualityOk: it.qualityOk !== false,
      total: roundQty((it.receivedQty || 0) * (it.unitPrice || 0)),
    })),
    warehouseDestination,
    receivedBy: store.currentUser ? userDisp(store.currentUser) : '—',
    receivedAt: `${jalaliTodayString()} ${toFa(nowTime())}`,
    qualityCheckedBy: null, qualityCheckedAt: null,
    status: 'draft',
    notes,
    audit: [auditEntry(store.currentUser, `ثبت رسید انبار${po ? ` برای سفارش ${po.id}` : ''}`)],
  };
  store.goodsReceipts = [grn, ...(store.goodsReceipts || [])];
  return grn;
};

// نهایی‌سازی GRN → به‌روزرسانی receivedQty روی PO و ارجاع به کارتابل انبار (ورود کالا)
export const finalizeGRN = (store, grn) => {
  // به‌روزرسانی PO
  if (grn.poId) {
    store.purchaseOrders = store.purchaseOrders.map((po) => {
      if (po.id !== grn.poId) return po;
      const items = po.items.map((it) => {
        const g = grn.items.find((gi) => gi.ingredientId === it.ingredientId || gi.supplyId === it.supplyId);
        if (!g) return it;
        return { ...it, receivedQty: roundQty((it.receivedQty || 0) + (g.receivedQty || 0)) };
      });
      const fully = items.every((it) => (it.receivedQty || 0) >= (it.qty || 0));
      const partly = items.some((it) => (it.receivedQty || 0) > 0);
      return {
        ...po,
        items,
        status: fully ? 'received' : partly ? 'partially_received' : po.status,
        audit: [...(po.audit || []), auditEntry(store.currentUser, `رسید ${grn.id} ثبت شد (${grn.items.reduce((s, gi) => s + (gi.receivedQty || 0) * (gi.unitPrice || 0), 0) > 0 ? 'با قیمت' : 'بدون قیمت'})`)],
      };
    });
  }
  store.goodsReceipts = store.goodsReceipts.map((x) => (x.id === grn.id
    ? { ...x, status: 'final', audit: [...(x.audit || []), auditEntry(store.currentUser, 'نهایی‌سازی رسید انبار')] }
    : x));
};

// ===== فاکتور خرید =====
export const createPurchaseInvoice = (store, { supplierId, invoiceNumber, date, items, grnIds = [], taxAmount = 0, discount = 0 }) => {
  const subtotal = roundQty(items.reduce((s, it) => s + (it.qty || 0) * (it.unitPrice || 0), 0));
  const inv = {
    id: `PINV-${Date.now().toString(36)}`,
    supplierId,
    supplierName: store.suppliers.find((s) => s.id === supplierId)?.name || '—',
    invoiceNumber: invoiceNumber || '',
    date: date || jalaliTodayString(),
    items: items.map((it) => ({ ...it, total: roundQty((it.qty || 0) * (it.unitPrice || 0)) })),
    subtotal,
    taxAmount: roundQty(taxAmount),
    discount: roundQty(discount),
    finalTotal: roundQty(subtotal + (taxAmount || 0) - (discount || 0)),
    grnIds,
    matchStatus: 'unmatched',
    mismatchNotes: '',
    paymentStatus: 'unpaid',
    paidAmount: 0, paidAt: null,
    createdBy: store.currentUser ? userDisp(store.currentUser) : '—',
    createdAt: `${jalaliTodayString()} ${toFa(nowTime())}`,
    audit: [auditEntry(store.currentUser, `ثبت فاکتور خرید ${invoiceNumber || ''}`)],
  };
  inv.matchStatus = computeMatch(store, inv).status;
  store.purchaseInvoices = [inv, ...(store.purchaseInvoices || [])];
  return inv;
};

// ===== تطبیق سه‌طرفه (PR ↔ GRN ↔ Invoice) =====
// سازگار: مقدار هر قلم فاکتور ≤ مقدار تاییدشده PR و ≤ مجموع دریافتی GRNها
// و قیمت واحد فاکتور با قیمت GRN (اگر ثبت شده) برابر باشد (تلورانس ۱٪)
export const computeMatch = (store, invoice) => {
  const notes = [];
  let ok = true;

  // PR مرتبط (از grnIds → grn.prId)
  const grns = (store.goodsReceipts || []).filter((g) => invoice.grnIds.includes(g.id));
  const prId = grns[0]?.prId || '';
  const pr = (store.purchaseRequests || []).find((r) => r.id === prId);

  invoice.items.forEach((it) => {
    const key = it.ingredientId || it.supplyId || it.name;
    // مقایسه با GRN
    const grnQty = grns.reduce((s, g) => s + (g.items.find((gi) => (gi.ingredientId || gi.supplyId) === key)?.receivedQty || 0), 0);
    if (grns.length > 0 && (it.qty || 0) > grnQty + 0.001) {
      ok = false;
      notes.push(`${it.name}: مقدار فاکتور (${toFa(it.qty)}) بیشتر از دریافتی GRN (${toFa(grnQty)})`);
    }
    // مقایسه با PR تأییدشده
    if (pr) {
      const prItem = pr.items.find((pi) => (pi.ingredientId || pi.supplyId || pi.name) === key);
      if (prItem && (it.qty || 0) > (prItem.qty || 0) + 0.001) {
        ok = false;
        notes.push(`${it.name}: مقدار فاکتور بیشتر از مقدار تأییدشده PR (${toFa(prItem.qty)})`);
      }
    }
    // مقایسه قیمت با GRN
    const grnItem = grns.map((g) => g.items.find((gi) => (gi.ingredientId || gi.supplyId) === key)).find(Boolean);
    if (grnItem && (grnItem.unitPrice || 0) > 0 && (it.unitPrice || 0) > 0) {
      const diff = Math.abs((it.unitPrice - grnItem.unitPrice) / grnItem.unitPrice);
      if (diff > 0.01) {
        ok = false;
        notes.push(`${it.name}: قیمت فاکتور (${toFa(it.unitPrice)}) با رسید (${toFa(grnItem.unitPrice)}) مغایرت دارد`);
      }
    }
  });

  if (grns.length === 0) {
    ok = false;
    notes.push('فاکتور به هیچ رسید انباری متصل نیست');
  }

  return {
    status: ok ? 'matched' : 'mismatch',
    notes: notes.join('؛ '),
  };
};

export const recomputeMatch = (store, invoiceId) => {
  store.purchaseInvoices = store.purchaseInvoices.map((inv) => {
    if (inv.id !== invoiceId) return inv;
    const m = computeMatch(store, inv);
    return { ...inv, matchStatus: m.status, mismatchNotes: m.notes, audit: [...(inv.audit || []), auditEntry(store.currentUser, `تطبیق سه‌طرفه: ${m.status === 'matched' ? 'سازگار' : 'مغایرت'}${m.notes ? ` — ${m.notes}` : ''}`)] };
  });
};

// ===== پرداخت فاکتور خرید =====
export const payInvoice = (store, invoiceId, amount) => {
  store.purchaseInvoices = store.purchaseInvoices.map((inv) => {
    if (inv.id !== invoiceId) return inv;
    const paid = roundQty(Math.min((inv.paidAmount || 0) + amount, inv.finalTotal));
    return {
      ...inv,
      paidAmount: paid,
      paidAt: paid >= inv.finalTotal ? `${jalaliTodayString()} ${toFa(nowTime())}` : inv.paidAt,
      paymentStatus: paid >= inv.finalTotal ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
      audit: [...(inv.audit || []), auditEntry(store.currentUser, `پرداخت ${toFa(amount)} — مانده ${toFa(inv.finalTotal - paid)}`)],
    };
  });
};

// ===== برچسب‌های وضعیت =====
export const PO_STATUS = {
  draft: { label: 'پیش‌نویس', cls: 'bg-slate-100 text-slate-700' },
  sent: { label: 'ارسال‌شده به تأمین‌کننده', cls: 'bg-amber-100 text-amber-700' },
  partially_received: { label: 'دریافت جزئی', cls: 'bg-sky-100 text-sky-700' },
  received: { label: 'دریافت کامل', cls: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'ابطال‌شده', cls: 'bg-rose-100 text-rose-700' },
};
export const MATCH_STATUS = {
  unmatched: { label: 'تطبیق‌نشده', cls: 'bg-slate-100 text-slate-600' },
  matched: { label: 'سازگار ✓', cls: 'bg-emerald-100 text-emerald-700' },
  mismatch: { label: 'مغایرت', cls: 'bg-rose-100 text-rose-700' },
};
export const PAY_STATUS = {
  unpaid: { label: 'پرداخت‌نشده', cls: 'bg-rose-100 text-rose-700' },
  partial: { label: 'پرداخت جزئی', cls: 'bg-amber-100 text-amber-700' },
  paid: { label: 'تسویه‌شده', cls: 'bg-emerald-100 text-emerald-700' },
};
