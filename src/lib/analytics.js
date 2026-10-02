/**
 * گزارش‌های پیشرفته (فاز ۳)
 * - Food Cost با سربار ماهانه
 * - مصرف واقعی vs استاندارد رسپی (اختلاف = ضایعات/هدر)
 * - رزروهای فعال/منقضی
 * - FIFO و اقلام نزدیک انقضا (نیازمند enableBatchTracking)
 * - کارایی تأمین‌کنندگان (قیمت، تحویل به‌موقع، کیفیت)
 * - هشدارهای داشبورد
 */
import { jalaliTodayString, jalaliToJdn, toFa } from './utils.js';
import { onOrderQty } from './purchasing.js';

// ===== Food Cost یک غذا =====
// (هزینه مواد رسپی + سربار هر پرس) — پرتی ماده در ضریب waste لحاظ می‌شود
export const foodCostOfDish = (store, dishId, overheadPerPortion) => {
  const rec = (store.recipes || []).find((r) => r.dishId === dishId);
  if (!rec) return null;
  let materialCost = 0;
  const details = rec.items.map((ri) => {
    const ing = store.ingredients.find((i) => i.id === ri.ingredientId);
    const waste = 1 + (Number(ing?.wastePercent) || 0) / 100;
    const cost = (ri.qty || 0) * (ing?.price || 0) * waste;
    materialCost += cost;
    return { name: ri.name, qty: ri.qty, unit: ri.unit, unitPrice: ing?.price || 0, wastePercent: ing?.wastePercent || 0, cost: Math.round(cost) };
  });
  return {
    materialCost: Math.round(materialCost),
    overhead: overheadPerPortion,
    totalCost: Math.round(materialCost + overheadPerPortion),
    details,
  };
};

// ===== مصرف واقعی vs استاندارد رسپی =====
// واقعی = moves type 'consume' گروه‌شده بر اساس برنامه‌های approved
// استاندارد = calcNeedsWithWaste برنامه‌های approved
export const consumptionVariance = (store) => {
  const approvedPlans = (store.plans || []).filter((p) => p.status === 'approved');
  const std = {}; // استاندارد
  approvedPlans.forEach((p) => {
    p.items.forEach((it) => {
      const rec = (store.recipes || []).find((r) => r.dishId === it.dishId);
      if (!rec) return;
      rec.items.forEach((ri) => {
        const ing = store.ingredients.find((i) => i.id === ri.ingredientId);
        const waste = 1 + (Number(ing?.wastePercent) || 0) / 100;
        if (!std[ri.ingredientId]) std[ri.ingredientId] = { name: ri.name, unit: ri.unit, qty: 0 };
        std[ri.ingredientId].qty += ri.qty * (it.approvedQty || it.qty) * waste;
      });
    });
  });
  // واقعی از moves مصرف
  const actual = {};
  (store.moves || []).filter((m) => m.type === 'consume').forEach((m) => {
    if (!actual[m.ingredientId]) actual[m.ingredientId] = { name: m.name, unit: m.unit, qty: 0 };
    actual[m.ingredientId].qty += m.qty;
  });
  const rows = Object.keys({ ...std, ...actual }).map((id) => {
    const s = std[id]?.qty || 0;
    const a = actual[id]?.qty || 0;
    const variance = Math.round((a - s) * 1000) / 1000;
    const pct = s > 0 ? Math.round((variance / s) * 100) : (a > 0 ? 100 : 0);
    return {
      ingredientId: id,
      name: std[id]?.name || actual[id]?.name || '—',
      unit: std[id]?.unit || actual[id]?.unit || '',
      standard: Math.round(s * 1000) / 1000,
      actual: Math.round(a * 1000) / 1000,
      variance,
      variancePct: pct,
      status: variance > 0.001 ? 'over' : variance < -0.001 ? 'under' : 'ok',
    };
  });
  return rows.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
};

// ===== رزروها — فعال/منقضی =====
export const reservationsReport = (store) => {
  const now = Date.now();
  const rows = (store.plans || []).filter((p) => ['reserved', 'pending', 'approved', 'rejected'].includes(p.status)).map((p) => {
    const expired = p.status === 'reserved' && p.reservationExpiresAt && p.reservationExpiresAt <= now;
    const hoursLeft = p.reservationExpiresAt ? Math.max(0, Math.ceil((p.reservationExpiresAt - now) / 3600000)) : null;
    return {
      id: p.id,
      date: p.date,
      status: p.status,
      items: p.items.length,
      reservedBy: p.reservedBy || '—',
      reservedAt: p.reservedAt || '',
      hoursLeft,
      expired,
    };
  });
  return {
    active: rows.filter((r) => r.status === 'reserved' && !r.expired),
    expiredCount: rows.filter((r) => r.expired).length,
    all: rows,
  };
};

// ===== FIFO و اقلام نزدیک انقضا =====
// نیازمند enableBatchTracking — از GRNها batchNo/expiryDate استخراج می‌شود
export const expiryReport = (store) => {
  const todayJdn = jalaliToJdn(jalaliTodayString());
  const lots = [];
  (store.goodsReceipts || []).filter((g) => g.status === 'final').forEach((g) => {
    g.items.forEach((it) => {
      if (!it.batchNo && !it.expiryDate) return;
      lots.push({
        grnId: g.id,
        grnDate: g.date,
        ingredientId: it.ingredientId || it.supplyId || '',
        name: it.name,
        unit: it.unit,
        receivedQty: it.receivedQty,
        batchNo: it.batchNo || '—',
        expiryDate: it.expiryDate || '',
        daysToExpiry: it.expiryDate ? jalaliToJdn(it.expiryDate) - todayJdn : null,
      });
    });
  });
  return lots
    .filter((l) => l.daysToExpiry !== null)
    .sort((a, b) => a.daysToExpiry - b.daysToExpiry);
};

// ===== کارایی تأمین‌کنندگان =====
// معیارها: تعداد PO، نرخ دریافت کامل، میانگین مغایرت فاکتور، جمع خرید
export const supplierPerformance = (store) => {
  return (store.suppliers || []).map((sup) => {
    const pos = (store.purchaseOrders || []).filter((po) => po.supplierId === sup.id && po.status !== 'cancelled');
    const receivedFull = pos.filter((po) => po.status === 'received').length;
    const invoices = (store.purchaseInvoices || []).filter((inv) => inv.supplierId === sup.id);
    const matched = invoices.filter((inv) => inv.matchStatus === 'matched').length;
    const totalPurchases = invoices.reduce((s, inv) => s + (inv.finalTotal || 0), 0);
    // تحویل به‌موقع: PO با expectedDate — دریافت کامل قبل/روز موعد
    let onTime = 0;
    let withDeadline = 0;
    pos.forEach((po) => {
      if (!po.expectedDate || po.status !== 'received') return;
      withDeadline++;
      const grns = (store.goodsReceipts || []).filter((g) => g.poId === po.id && g.status === 'final');
      if (grns.length > 0 && grns[0].date <= po.expectedDate) onTime++;
    });
    return {
      id: sup.id,
      name: sup.name,
      active: sup.active,
      poCount: pos.length,
      receivedFull,
      fulfillmentRate: pos.length ? Math.round((receivedFull / pos.length) * 100) : null,
      onTimeRate: withDeadline ? Math.round((onTime / withDeadline) * 100) : null,
      invoiceCount: invoices.length,
      matchRate: invoices.length ? Math.round((matched / invoices.length) * 100) : null,
      totalPurchases,
    };
  }).sort((a, b) => b.totalPurchases - a.totalPurchases);
};

// ===== هشدارهای داشبورد =====
export const dashboardAlerts = (store) => {
  const alerts = [];
  // اقلام نزدیک سطح پار
  (store.ingredients || []).forEach((ing) => {
    if (ing.minThreshold && ing.qty <= ing.minThreshold) {
      alerts.push({
        kind: 'low',
        severity: ing.qty <= ing.minThreshold * 0.5 ? 'danger' : 'warning',
        text: `${ing.name}: موجودی ${toFa(ing.qty)} ${ing.unit} (آستانه ${toFa(ing.minThreshold)})`,
      });
    }
  });
  // انقضای رزرو نزدیک (کمتر از ۳ ساعت)
  const now = Date.now();
  (store.plans || []).filter((p) => p.status === 'reserved' && p.reservationExpiresAt).forEach((p) => {
    const h = (p.reservationExpiresAt - now) / 3600000;
    if (h <= 3) {
      alerts.push({
        kind: 'reservation',
        severity: h <= 1 ? 'danger' : 'warning',
        text: `رزرو برنامه ${p.date} تا ${toFa(Math.max(0, Math.ceil(h)))} ساعت دیگر منقضی می‌شود`,
      });
    }
  });
  // اقلام نزدیک انقضا (اگر فعال)
  if (store.settings.enableExpiryTracking) {
    expiryReport(store).filter((l) => l.daysToExpiry <= 7).forEach((l) => {
      alerts.push({
        kind: 'expiry',
        severity: l.daysToExpiry <= 2 ? 'danger' : 'warning',
        text: `${l.name} (بچ ${l.batchNo}): ${l.daysToExpiry <= 0 ? 'منقضی شده' : `${toFa(l.daysToExpiry)} روز تا انقضا`}`,
      });
    });
  }
  // موجودی در راه کمتر از کسری (اگر فعال)
  if (store.settings.enableOnOrderInShortage) {
    (store.ingredients || []).forEach((ing) => {
      const avail = (ing.qty || 0) - (ing.reserved || 0);
      if (ing.minThreshold && avail < ing.minThreshold) {
        const oo = onOrderQty(store, ing.id);
        if (oo > 0) {
          alerts.push({
            kind: 'onorder',
            severity: 'info',
            text: `${ing.name}: ${toFa(oo)} ${ing.unit} در راه است`,
          });
        }
      }
    });
  }
  const order = { danger: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
};
