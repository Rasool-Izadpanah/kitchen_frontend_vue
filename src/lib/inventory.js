/**
 * هسته انبار — رزرو/آزادسازی/مصرف + ماشین حالت برنامه پخت (فاز ۱)
 * قاعده: هیچ تغییر موجودی مستقیم نیست؛ همه از طریق moves و این توابع.
 * موجودی قابل استفاده = qty - reserved
 */
import { jalaliTodayString, nowTime, toFa, userDisplay, auditEntry } from './utils.js';
import { convertQty, roundQty } from './units.js';

// ===== موجودی قابل استفاده =====
export const availableOf = (item) => Math.max(0, (Number(item?.qty) || 0) - (Number(item?.reserved) || 0));

// ===== سازنده move استاندارد =====
// type: in|out|reserve|release|consume|return|adjust|receive
export const makeMove = ({ user, type, ingredientId = '', supplyId = '', name, kind, qty, unit, extra = {} }) => ({
  id: `m${Date.now()}_${Math.floor(Math.random() * 1000)}_${ingredientId || supplyId}`,
  date: jalaliTodayString(),
  time: toFa(nowTime()),
  ingredientId, supplyId,
  name, kind, type,
  qty, unit,
  userId: user?.id || '',
  byUsername: user?.username || '',
  byRole: (user?.roles || [user?.role]).filter(Boolean)[0] || '',
  byDisplayName: userDisplay(user),
  createdAt: Date.now(),
  ...extra,
});

// ===== رزرو/آزادسازی/مصرف برای یک نگاشت { ingId: need } =====
// op: 'reserve' | 'release' | 'consume' — همه با ثبت move و audit
export const applyInventoryOp = (store, needs, op, { user, plan, note = '' } = {}) => {
  const entries = Object.entries(needs).filter(([, n]) => n > 0);
  if (entries.length === 0) return [];

  const descBase = {
    reserve: `رزرو مواد — برنامه ${plan?.date || ''}`,
    release: `آزادسازی رزرو — برنامه ${plan?.date || ''}`,
    consume: `مصرف مواد — برنامه ${plan?.date || ''}`,
  }[op] || op;

  const newMoves = entries.map(([ingId, need]) => {
    const ing = store.ingredients.find((i) => i.id === ingId);
    return makeMove({
      user, op, type: op,
      ingredientId: ingId, name: need.name, kind: 'ingredient',
      qty: need.need ?? need.qty ?? need, unit: need.unit,
      extra: {
        desc: note || descBase,
        refType: 'plan', refId: plan?.id || '',
        receiver: op === 'consume' ? 'آشپزخانه' : 'رزرو',
        sender: op === 'release' ? 'رزرو' : (user?.fullName || user?.username || '—'),
        batchId: `B${Date.now().toString(36)}`,
        ...(plan ? { planDate: plan.date } : {}),
      },
    });
  });

  // اعمال روی موجودی: reserve/release → reserved ± , consume → qty -
  store.ingredients = store.ingredients.map((ing) => {
    const e = entries.find(([id]) => id === ing.id);
    if (!e) return ing;
    const [, n] = e;
    const amount = roundQty(n.need ?? n.qty ?? n);
    if (op === 'reserve') return { ...ing, reserved: roundQty((ing.reserved || 0) + amount) };
    if (op === 'release') return { ...ing, reserved: Math.max(0, roundQty((ing.reserved || 0) - amount)) };
    if (op === 'consume') {
      // مصرف از رزرو: qty کاهش، reserved کاهش
      return {
        ...ing,
        qty: Math.max(0, roundQty(ing.qty - amount)),
        reserved: Math.max(0, roundQty((ing.reserved || 0) - amount)),
      };
    }
    return ing;
  });

  store.moves = [...newMoves, ...(store.moves || [])];
  return newMoves;
};

// ===== نیاز مواد با احتساب پرتی (wastePercent) =====
// need = recipeQty × planQty × (1 + wastePercent / 100)
export const calcNeedsWithWaste = (store, planItems) => {
  const map = {};
  planItems.forEach((it) => {
    const rec = (store.recipes || []).find((r) => r.dishId === it.dishId);
    if (!rec) return;
    rec.items.forEach((ri) => {
      const ing = store.ingredients.find((i) => i.id === ri.ingredientId);
      const waste = 1 + (Number(ing?.wastePercent) || 0) / 100;
      const need = ri.qty * it.qty * waste;
      if (!map[ri.ingredientId]) map[ri.ingredientId] = { name: ri.name, unit: ri.unit, need: 0 };
      map[ri.ingredientId].need += need;
    });
  });
  return map;
};

// ===== کسری بر مبنای موجودی قابل استفاده (qty - reserved) =====
export const shortageOnAvailable = (store, planItems) => {
  const needs = calcNeedsWithWaste(store, planItems);
  const rows = Object.entries(needs).map(([ingId, n]) => {
    const ing = store.ingredients.find((i) => i.id === ingId);
    const avail = availableOf(ing);
    const need = roundQty(n.need);
    const shortage = Math.max(0, roundQty(need - avail));
    return {
      ingId, name: n.name, unit: n.unit, need,
      stock: ing?.qty ?? 0, reserved: ing?.reserved || 0, available: avail,
      shortage, ok: shortage <= 0,
    };
  });
  return {
    rows: rows.sort((a, b) => (a.ok === b.ok ? b.need - a.need : a.ok ? 1 : -1)),
    hasShortage: rows.some((r) => !r.ok),
  };
};

// ===== Timeout رزرو — آزادسازی خودکار رزروهای منقضی =====
// reservationExpiresAt به‌صورت timestamp (Date.now() + hours*3600*1000) ذخیره می‌شود
export const checkExpiredReservations = (store) => {
  const now = Date.now();
  const expired = (store.plans || []).filter(
    (p) => p.status === 'reserved' && p.reservationExpiresAt && p.reservationExpiresAt <= now
  );
  if (expired.length === 0) return 0;

  expired.forEach((p) => {
    const needs = calcNeedsWithWaste(store, p.items);
    applyInventoryOp(store, needs, 'release', {
      user: store.currentUser || { fullName: 'سیستم' },
      plan: p,
      note: `انقضای مهلت رزرو (${store.settings.reservationTimeoutHours || 24} ساعت) — آزادسازی خودکار`,
    });
    store.plans = store.plans.map((x) => (x.id === p.id
      ? {
          ...x,
          status: 'pending',
          reservedBy: null, reservedAt: null,
          reservationExpiresAt: null,
          reservationReleasedAt: `${jalaliTodayString()} ${toFa(nowTime())}`,
          audit: [...(x.audit || []), auditEntry(store.currentUser || { fullName: 'سیستم' }, 'انقضای مهلت رزرو — آزادسازی خودکار مواد')],
        }
      : x));
  });
  return expired.length;
};

// ===== برچسب فارسی وضعیت برنامه =====
export const PLAN_STATUS_META = {
  draft: { label: 'پیش‌نویس', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  pending: { label: 'در انتظار تأیید سرآشپز', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  reserved: { label: 'رزرو شده — در انتظار تأیید مدیر', cls: 'bg-sky-100 text-sky-800 border-sky-200' },
  approved: { label: 'تأیید نهایی — مواد مصرف شد', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  rejected: { label: 'رد شده', cls: 'bg-rose-100 text-rose-800 border-rose-200' },
  cancelled: { label: 'لغو شده', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  // سازگاری با داده‌های قدیمی
  temp: { label: 'موقت', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  final: { label: 'قطعی', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
};
