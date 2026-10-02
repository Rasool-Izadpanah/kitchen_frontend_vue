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
  }
  return data;
}
