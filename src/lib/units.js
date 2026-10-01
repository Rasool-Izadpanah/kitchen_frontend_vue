/**
 * تبدیل واحدهای اندازه‌گیری
 * مدل: هر واحد می‌تواند baseUnit (نام واحد مبنا) و factor داشته باشد:
 * 1 [این واحد] = factor × [واحد مبنا]
 * مثال: گرم ← baseUnit: 'کیلوگرم', factor: 0.001 | کارتن ← baseUnit: 'عدد', factor: 30
 * واحد بدون baseUnit، واحد ریشه است.
 */

// زنجیره یک واحد تا ریشه: { root, factor } — 1 [name] = factor [root]
export const unitChain = (units, name) => {
  let factor = 1;
  let cur = name;
  let guard = 0;
  while (guard++ < 10) {
    const u = (units || []).find((x) => x.name === cur);
    if (!u || !u.baseUnit || !u.factor) break;
    factor *= Number(u.factor) || 1;
    cur = u.baseUnit;
  }
  return { root: cur, factor };
};

// تبدیل مقدار از واحدی به واحد دیگر؛ ناموفق (ناسازگار) = null
export const convertQty = (units, qty, fromName, toName) => {
  const q = Number(qty);
  if (!fromName || !toName || Number.isNaN(q)) return null;
  if (fromName === toName) return q;
  const a = unitChain(units, fromName);
  const b = unitChain(units, toName);
  if (a.root !== b.root) return null;
  return q * (a.factor / b.factor);
};

// همه واحدهای سازگار با یک واحد (هم‌ریشه) — برای نمایش در select
export const compatibleUnits = (units, name) => {
  if (!name) return [];
  const root = unitChain(units, name).root;
  return (units || [])
    .filter((u) => unitChain(units, u.name).root === root)
    .map((u) => u.name);
};

// گرد کردن مقادیر تبدیل‌شده (حذف خطای اعشار ممیز شناور)
export const roundQty = (q) => Math.round(Number(q) * 1e6) / 1e6;
