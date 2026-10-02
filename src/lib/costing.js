/**
 * سامانه بهای تمام‌شده سه‌لایه (فاز ۳.۵)
 *
 * سه لایه قیمت موازی برای شرایط تورمی:
 * - Historical  (avgPrice)      : میانگین موزون متحرک — دفاتر رسمی
 * - Replacement (price)         : آخرین قیمت خرید — قیمت‌گذاری فروش
 * - Standard    (standardPrice) : قیمت مصوب دوره‌ای — بودجه/واریانس
 *
 * قواعد:
 * - avgPrice فقط با ورود کالا به‌روز می‌شود
 * - بهای تاریخی در لحظه consume قفل می‌شود (در plan.costBreakdown)
 * - بهای جایگزینی زنده است (از ingredient.price هنگام گزارش خوانده می‌شود)
 * - قیمت استاندارد فقط دستی یا با دکمه بازنگری
 */
import { jalaliTodayString, nowTime, toFa } from './utils.js';
import { roundQty } from './units.js';

// ===== به‌روزرسانی میانگین موزون متحرک (اتمی روی یک ماده) =====
// unitPrice خالی → از ingredient.price قبلی (قاعده ۳.۵.۷) — caller هشدار می‌دهد
export const applyWeightedAverage = (ingredient, { qtyIn, unitPrice, moveDate, moveId, supplierId }) => {
  const qtyOld = Number(ingredient.qty) || 0;
  const avgOld = Number(ingredient.avgPrice) || 0;
  const qty = roundQty(qtyIn);
  const price = Number(unitPrice) || 0;

  const qtyNew = roundQty(qtyOld + qty);
  const avgNew = qtyNew > 0 ? (qtyOld * avgOld + qty * price) / qtyNew : price;

  const history = Array.isArray(ingredient.priceHistory) ? [...ingredient.priceHistory] : [];
  if (price > 0) {
    history.push({
      date: moveDate || jalaliTodayString(),
      price: Math.round(price),
      supplierId: supplierId || '',
      moveId: moveId || '',
      qty,
    });
  }

  return {
    ...ingredient,
    qty: qtyNew,
    avgPrice: Math.round(avgNew),
    price: price > 0 ? Math.round(price) : ingredient.price, // آخرین قیمت خرید
    priceHistory: history,
    _avgPriceAfter: Math.round(avgNew), // برای move.avgPriceAfter
  };
};

// ===== سربار روزانه =====
export const dailyOverhead = (store) => {
  const total = (store.overheads || []).reduce((s, o) => s + (o.amount || 0), 0);
  return { total, daily: total / 30 }; // ماه ۳۰ روزه شمسی (تقریب استاندارد حسابداری)
};

// ===== محاسبه سه‌لایه یک برنامه تأییدشده =====
export const calcPlanCost = (store, plan) => {
  const approvedItems = plan.items.filter((it) => it.decision === 'approve');
  const totalPortions = approvedItems.reduce((s, it) => s + (it.approvedQty || it.qty), 0);

  let costHist = 0, costRepl = 0, costStd = 0;
  const breakdown = [];

  approvedItems.forEach((planItem) => {
    const recipe = (store.recipes || []).find((r) => r.dishId === planItem.dishId);
    if (!recipe) return;
    recipe.items.forEach((ri) => {
      const ing = store.ingredients.find((i) => i.id === ri.ingredientId);
      if (!ing) return;
      const qtyUsed = ri.qty * (planItem.approvedQty || planItem.qty) * (1 + (Number(ing.wastePercent) || 0) / 100);
      const avg = Number(ing.avgPrice) || 0;
      const repl = Number(ing.price) || 0;
      const std = Number(ing.standardPrice) || avg;
      const cH = qtyUsed * avg;
      const cR = qtyUsed * repl;
      const cS = qtyUsed * std;
      costHist += cH; costRepl += cR; costStd += cS;
      breakdown.push({
        ingredientId: ing.id,
        name: ing.name,
        qtyUsed: roundQty(qtyUsed),
        unit: ri.unit,
        avgPriceAtTime: avg,
        replacementPriceAtTime: repl,
        standardPriceAtTime: ing.standardPrice ?? null,
        costHistorical: Math.round(cH),
        costReplacement: Math.round(cR),
        costStandard: Math.round(cS),
      });
    });
  });

  const { daily } = dailyOverhead(store);
  const overheadPerPortion = totalPortions > 0 ? Math.round(daily / totalPortions) : 0;

  return {
    totalPortions,
    overheadPerPortion,
    costHistorical: Math.round(costHist),
    costReplacement: Math.round(costRepl),
    costStandard: Math.round(costStd),
    costPerPortionHistorical: totalPortions > 0 ? Math.round(costHist / totalPortions + overheadPerPortion) : 0,
    costPerPortionReplacement: totalPortions > 0 ? Math.round(costRepl / totalPortions + overheadPerPortion) : 0,
    costPerPortionStandard: totalPortions > 0 ? Math.round(costStd / totalPortions + overheadPerPortion) : 0,
    costBreakdown: breakdown,
    costCalculatedAt: `${jalaliTodayString()} ${toFa(nowTime())}`,
  };
};

// ===== گزارش سه‌ستونی غذاها (بر اساس آخرین برنامه تأییدشده هر غذا) =====
export const dishCostReport = (store) => {
  const latest = {}; // dishId → آخرین برنامه approved
  (store.plans || []).filter((p) => p.status === 'approved')
    .sort((a, b) => (a.date > b.date ? 1 : -1))
    .forEach((p) => p.items.forEach((it) => { latest[it.dishId] = p; }));

  return (store.dishes || []).map((d) => {
    const p = latest[d.id];
    if (!p) return { dish: d, hasCost: false };
    const replPerPortion = p.items.find((it) => it.dishId === d.id)?.approvedQty
      ? p.costPerPortionReplacement : p.costPerPortionReplacement;
    const marginHist = d.price > 0 ? Math.round(((d.price - p.costPerPortionHistorical) / d.price) * 100) : null;
    const marginRepl = d.price > 0 ? Math.round(((d.price - p.costPerPortionReplacement) / d.price) * 100) : null;
    const suggested = Math.round(p.costPerPortionReplacement * (1 + (Number(store.settings.defaultSaleMarkupPercent) || 30) / 100));
    return {
      dish: d,
      hasCost: true,
      planDate: p.date,
      costH: p.costPerPortionHistorical,
      costR: p.costPerPortionReplacement,
      costS: p.costPerPortionStandard,
      marginHist, marginRepl,
      suggested,
    };
  });
};

// ===== روند تورم مواد (بر اساس priceHistory) =====
export const priceInflationReport = (store) => {
  const todayJdn = jalaliToJdnS(jalaliTodayString());
  return (store.ingredients || []).map((ing) => {
    const hist = (ing.priceHistory || []).filter((h) => h.price > 0).sort((a, b) => (a.date > b.date ? 1 : -1));
    if (hist.length < 2) return { ing, rows: [], growth30: null, hasData: false };
    // رشد ۳۰ روز: قدیمی‌ترین قیمت ≤ ۳۰ روز پیش vs جدیدترین
    const cutoff = todayJdn - 30;
    const old30 = hist.filter((h) => jalaliToJdnS(h.date) <= cutoff).pop();
    const newest = hist[hist.length - 1];
    const growth30 = old30 && newest.price > 0 ? Math.round(((newest.price - old30.price) / old30.price) * 100) : null;
    const rows = hist.map((h) => ({ ...h, jdn: jalaliToJdnS(h.date) }));
    return { ing, rows, growth30, hasData: true, newestPrice: newest.price };
  });
};

// jdn ساده برای مقایسه تاریخ شمسی (کافی برای اختلاف روز)
export const jalaliToJdnS = (s) => {
  const [y, m, d] = String(s).split('/').map(Number);
  return y * 365 + m * 31 + d;
};

// ===== واریانس =====
export const varianceCostReport = (store) => {
  const rows = [];
  (store.plans || []).filter((p) => p.status === 'approved').forEach((p) => {
    (p.costBreakdown || []).forEach((b) => {
      const priceVar = (b.avgPriceAtTime - b.replacementPriceAtTime) * b.qtyUsed;
      rows.push({
        planDate: p.date,
        name: b.name,
        qtyUsed: b.qtyUsed,
        unit: b.unit,
        priceVariance: Math.round(priceVar),
        // مصرف واقعی vs استاندارد در سطح ماده اینجا نیاز به moves دارد — خلاصه قیمت کافی است
      });
    });
  });
  // تجمیع بر اساس ماده
  const agg = {};
  rows.forEach((r) => {
    if (!agg[r.name]) agg[r.name] = { name: r.name, unit: r.unit, qtyUsed: 0, priceVariance: 0 };
    agg[r.name].qtyUsed = roundQty(agg[r.name].qtyUsed + r.qtyUsed);
    agg[r.name].priceVariance += r.priceVariance;
  });
  return Object.values(agg).map((r) => ({ ...r, priceVariance: Math.round(r.priceVariance) }))
    .sort((a, b) => Math.abs(b.priceVariance) - Math.abs(a.priceVariance));
};

// ===== ارزش موجودی انبار سه‌لایه =====
export const inventoryValuation = (store) => {
  const rows = (store.ingredients || []).map((ing) => {
    const qty = Number(ing.qty) || 0;
    const hist = qty * (Number(ing.avgPrice) || 0);
    const repl = qty * (Number(ing.price) || 0);
    const std = qty * (Number(ing.standardPrice) || Number(ing.avgPrice) || 0);
    return { ing, qty, hist: Math.round(hist), repl: Math.round(repl), std: Math.round(std), gain: Math.round(repl - hist) };
  });
  const total = rows.reduce((s, r) => ({
    hist: s.hist + r.hist, repl: s.repl + r.repl, std: s.std + r.std, gain: s.gain + r.gain,
  }), { hist: 0, repl: 0, std: 0, gain: 0 });
  return { rows, total };
};

// ===== بدهی به تأمین‌کنندگان =====
export const supplierDebtReport = (store) => {
  const rows = (store.purchaseInvoices || []).filter((inv) => inv.paymentStatus !== 'paid').map((inv) => {
    const remaining = (inv.finalTotal || 0) - (inv.paidAmount || 0);
    return {
      inv,
      supplierName: inv.supplierName,
      invoiceNumber: inv.invoiceNumber || inv.id,
      date: inv.date,
      remaining,
    };
  });
  const totalDebt = rows.reduce((s, r) => s + r.remaining, 0);
  return { rows, totalDebt };
};
