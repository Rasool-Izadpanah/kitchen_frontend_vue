/**
 * مهاجرت داده‌های موجود (فاز ۱–۲) — از stores/app.js جدا شد (فاز ۴)
 * داده‌های کاربر از دست نمی‌روند؛ فیلدهای جدید مقدار پیش‌فرض می‌گیرند.
 */
export function migrateData(data) {
  // ingredients/supplies: فیلد رزرو
  if (Array.isArray(data.ingredients)) {
    data.ingredients = data.ingredients.map((i) => ({ ...i, reserved: Number(i.reserved) || 0 }));
  }
  if (Array.isArray(data.supplies)) {
    data.supplies = data.supplies.map((s) => ({ ...s, reserved: Number(s.reserved) || 0 }));
  }
  // moves: userId/byDisplayName از person استخراج می‌شود
  if (Array.isArray(data.moves)) {
    data.moves = data.moves.map((m) => ({
      ...m,
      kind: m.kind || (m.ingredientId ? 'ingredient' : 'supply'),
      userId: m.userId || '',
      byUsername: m.byUsername || '',
      byRole: m.byRole || '',
      byDisplayName: m.byDisplayName || m.person || '—',
      refType: m.refType || '',
      refId: m.refId || '',
    }));
  }
  // plans: وضعیت‌های قدیمی → ماشین حالت جدید
  if (Array.isArray(data.plans)) {
    data.plans = data.plans.map((p) => ({
      ...p,
      status: p.status === 'temp' ? 'pending' : p.status === 'final' ? 'approved' : p.status,
      items: Array.isArray(p.items)
        ? p.items.map((it) => ({
            ...it,
            decision: it.decision || 'pending',
            approvedQty: it.approvedQty ?? null,
            rejectReason: it.rejectReason || '',
            decisionNote: it.decisionNote || '',
          }))
        : p.items,
      createdBy: p.createdBy || '—',
      reservedBy: p.reservedBy ?? null,
      reservedAt: p.reservedAt ?? null,
      approvedBy: p.approvedBy ?? null,
      approvedAt: p.approvedAt ?? null,
      rejectedBy: p.rejectedBy ?? null,
      rejectedAt: p.rejectedAt ?? null,
      rejectReason: p.rejectReason || '',
      cancelledBy: p.cancelledBy ?? null,
      cancelledAt: p.cancelledAt ?? null,
      cancelReason: p.cancelReason || '',
      reservationExpiresAt: p.reservationExpiresAt ?? null,
      reservationReleasedAt: p.reservationReleasedAt ?? null,
      deductStock: p.deductStock !== false,
    }));
  }
  // purchaseRequests / stockRequests: فیلدهای دلیل رد
  ['purchaseRequests', 'stockRequests'].forEach((k) => {
    if (Array.isArray(data[k])) {
      data[k] = data[k].map((r) => ({
        ...r,
        items: Array.isArray(r.items)
          ? r.items.map((it) => ({ ...it, rejectReason: it.rejectReason || '', decisionNote: it.decisionNote || '' }))
          : r.items,
      }));
    }
  });
  // settings: timeout رزرو + کلیدهای فاز ۲
  if (data.settings && typeof data.settings === 'object') {
    if (data.settings.reservationTimeoutHours === undefined) data.settings.reservationTimeoutHours = 24;
    if (data.settings.enableOnOrderInShortage === undefined) data.settings.enableOnOrderInShortage = false;
    if (data.settings.enableQualityCheck === undefined) data.settings.enableQualityCheck = false;
    if (data.settings.enableBatchTracking === undefined) data.settings.enableBatchTracking = false;
    if (data.settings.enableExpiryTracking === undefined) data.settings.enableExpiryTracking = false;
    if (data.settings.enableFifoReport === undefined) data.settings.enableFifoReport = false;
    // فاز ۳.۵ — بهای تمام‌شده سه‌لایه
    if (data.settings.standardPriceReviewDay === undefined) data.settings.standardPriceReviewDay = 1;
    if (data.settings.defaultSaleMarkupPercent === undefined) data.settings.defaultSaleMarkupPercent = 30;
  }
  // فاز ۳.۵ — سه لایه قیمت مواد: avgPrice (تاریخی) / price (جایگزینی) / standardPrice (استاندارد)
  if (Array.isArray(data.ingredients)) {
    data.ingredients = data.ingredients.map((ing) => {
      let out = {
        ...ing,
        avgPrice: ing.avgPrice ?? (Number(ing.price) || 0),
        standardPrice: ing.standardPrice ?? (Number(ing.price) || 0),
        standardPriceUpdatedAt: ing.standardPriceUpdatedAt ?? null,
        priceHistory: Array.isArray(ing.priceHistory) ? ing.priceHistory : [],
      };
      // بازسازی priceHistory از moves ورودی (اگر خالی است)
      if (out.priceHistory.length === 0 && Array.isArray(data.moves)) {
        out.priceHistory = data.moves
          .filter((m) => m.type === 'in' && m.ingredientId === ing.id && (Number(m.price) || 0) > 0)
          .sort((a, b) => (a.date > b.date ? 1 : -1))
          .map((m) => ({
            date: m.date,
            price: Math.round(Number(m.price) || 0),
            supplierId: m.supplierId || '',
            moveId: m.id,
            qty: Number(m.qty) || 0,
          }));
      }
      return out;
    });
  }
  return data;
}
