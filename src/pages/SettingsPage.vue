<script setup>
/**
 * تنظیمات و تعاریف پایه — معادل SettingsPage.jsx
 * تب‌ها: اطلاعات پایه، مشتریان، غذا، ماده غذایی، رسپی، اقلام جانبی،
 * واحد اندازه‌گیری، نرخ مالیات، هزینه‌های سربار، واحد پول، فونت، کاربران، نقش‌ها
 */
import { ref, computed } from 'vue';
import {
  Sliders, Users, ChefHat, Layers, BookOpen, Ruler, Percent, UserCog, Trash2, Edit3, Plus,
  Type, Lock, FolderTree, Settings as SettingsIcon, Package2, AlertTriangle, Receipt, Coins, Building2,
} from 'lucide-vue-next';
import { toFa, formatMoney, uid } from '../lib/utils.js';
import SearchableSelect from '../components/SearchableSelect.vue';
import FaNumberInput from '../components/ui/FaNumberInput.vue';
import MoneyInput from '../components/ui/MoneyInput.vue';
import NumberSpinner from '../components/ui/NumberSpinner.vue';
import EmptyRow from '../components/ui/EmptyRow.vue';
import { inputCls } from '../components/ui/inputCls.js';
import { STORAGE_PLACES, FONT_OPTIONS, PERMISSIONS } from '../lib/seed.js';
import { convertQty, compatibleUnits, roundQty } from '../lib/units.js';
import { useAppStore } from '../stores/app.js';

const props = defineProps({
  showToast: { type: Function, required: true },
  userName: { type: String, default: '—' },
  initialTab: { type: String, default: null },
  showTabs: { type: Boolean, default: true },
});

const store = useAppStore();
const toast = (msg, type) => props.showToast(msg, type);

// دو زیربخش اصلی: «تعاریف» و «تنظیمات»
const GROUPS = [
  {
    id: 'definitions', label: 'تعاریف', icon: FolderTree,
    tabs: [
      { id: 'basicinfo', label: 'اطلاعات پایه', icon: Building2 },
      { id: 'customers', label: 'مشتریان', icon: Users },
      { id: 'dishes', label: 'عنوان غذا', icon: ChefHat },
      { id: 'ingredients', label: 'ماده غذایی', icon: Layers },
      { id: 'recipes', label: 'رسپی', icon: BookOpen },
      { id: 'supplies', label: 'اقلام جانبی', icon: Package2 },
    ],
  },
  {
    id: 'config', label: 'تنظیمات', icon: SettingsIcon,
    tabs: [
      { id: 'units', label: 'واحد اندازه‌گیری', icon: Ruler },
      { id: 'tax', label: 'نرخ مالیات', icon: Percent },
      { id: 'overheads', label: 'هزینه‌های سربار', icon: Receipt },
      { id: 'currency', label: 'واحد پول', icon: Coins },
      { id: 'fonts', label: 'فونت برنامه و گزارش', icon: Type },
      { id: 'users', label: 'تعریف کاربر', icon: UserCog },
      { id: 'roles', label: 'تعریف نقش', icon: UserCog },
    ],
  },
];

const ALL_TABS = GROUPS.flatMap((g) => g.tabs.map((t) => ({ ...t, group: g.id })));
const groupOf = (tabId) => (ALL_TABS.find((t) => t.id === tabId) || {}).group || 'definitions';

// مجوز مورد نیاز هر تب تنظیمات
const TAB_PERMS = {
  basicinfo: 'manage_settings',
  customers: 'manage_customers',
  dishes: 'manage_dishes',
  ingredients: 'manage_ingredients',
  recipes: 'manage_recipes',
  supplies: 'manage_supplies',
  units: 'manage_settings',
  tax: 'manage_settings',
  overheads: 'manage_settings',
  currency: 'manage_settings',
  fonts: 'manage_settings',
  users: 'edit_users',
  roles: 'manage_roles',
  printing: 'manage_settings',
};

const tab = ref(props.initialTab || 'customers');
const group = ref(groupOf(props.initialTab || 'customers'));
const isAdmin = computed(() => store.currentUser?.roles?.includes('admin') || store.currentUser?.role === 'admin');
const currency = computed(() => store.settings?.currency || 'تومان');
// تأییدیه حذف: { type: 'customer'|'dish'|'ingredient'|'unit'|'supply', item }
const confirmDel = ref(null);

const CONFIRM_LABELS = {
  customer: (it) => `مشتری «${it.firstName} ${it.lastName}»`,
  dish: (it) => `غذای «${it.name}»`,
  ingredient: (it) => `ماده غذایی «${it.name}»`,
  unit: (it) => `واحد «${it.name}»`,
  supply: (it) => `قلم جانبی «${it.name}»`,
};

// ===== اقلام استفاده‌شده در فاکتورها (برای جلوگیری از حذف) =====
const usedDishIds = computed(() => {
  const s = new Set();
  (store.invoices || []).forEach((inv) => inv.items.forEach((it) => s.add(it.dishId)));
  return s;
});

const usedIngredientIds = computed(() => {
  const usedDishes = new Set();
  (store.invoices || []).forEach((inv) => inv.items.forEach((it) => usedDishes.add(it.dishId)));
  const used = new Set();
  store.recipes.forEach((r) => {
    if (usedDishes.has(r.dishId)) r.items.forEach((it) => used.add(it.ingredientId));
  });
  return used;
});

const usedUnitNames = computed(() => {
  const s = new Set();
  store.ingredients.forEach((i) => { if (usedIngredientIds.value.has(i.id)) s.add(i.unit); });
  return s;
});

const usedSupplyIds = computed(() => {
  const s = new Set();
  (store.invoices || []).forEach((inv) => inv.items.forEach((it) => { if (it.kind === 'supply') s.add(it.dishId); }));
  return s;
});

const visibleGroups = computed(() =>
  GROUPS
    .map((g) => ({ ...g, tabs: g.tabs.filter((t) => store.can(TAB_PERMS[t.id])) }))
    .filter((g) => g.tabs.length > 0)
);

const currentGroupTabs = computed(() =>
  (GROUPS.find((g) => g.id === group.value) || GROUPS[0]).tabs.filter((t) => store.can(TAB_PERMS[t.id]))
);

// حذف با کنترل وابستگی — ابتدا مودال تأیید، سپس اجرا
const requestDelete = (type, item) => {
  // کنترل وابستگی به فاکتور قبل از نمایش تأیید
  if (type === 'customer' && (store.invoices || []).some((inv) => inv.customer.id === item.id)) {
    return toast(`حذف مشتری «${item.firstName} ${item.lastName}» ممکن نیست: این مشتری در یک یا چند فاکتور استفاده شده است`, 'error');
  }
  if (type === 'dish' && usedDishIds.value.has(item.id)) {
    return toast(`حذف «${item.name}» ممکن نیست: این غذا در یک یا چند فاکتور استفاده شده است`, 'error');
  }
  if (type === 'ingredient' && usedIngredientIds.value.has(item.id)) {
    return toast(`حذف «${item.name}» ممکن نیست: این ماده در رسپی غذاهایی است که در فاکتورها استفاده شده‌اند`, 'error');
  }
  if (type === 'unit' && usedUnitNames.value.has(item.name)) {
    return toast(`حذف واحد «${item.name}» ممکن نیست: این واحد برای ماده‌ای به‌کار می‌رود که در فاکتورها استفاده شده است`, 'error');
  }
  if (type === 'supply' && usedSupplyIds.value.has(item.id)) {
    return toast(`حذف «${item.name}» ممکن نیست: این قلم در یک یا چند فاکتور استفاده شده است`, 'error');
  }
  confirmDel.value = { type, item };
};

const executeDelete = () => {
  const { type, item } = confirmDel.value;
  if (type === 'customer') store.customers = store.customers.filter((x) => x.id !== item.id);
  if (type === 'dish') store.dishes = store.dishes.filter((x) => x.id !== item.id);
  if (type === 'ingredient') store.ingredients = store.ingredients.filter((x) => x.id !== item.id);
  if (type === 'unit') store.units = store.units.filter((x) => x.id !== item.id);
  if (type === 'supply') store.supplies = store.supplies.filter((x) => x.id !== item.id);
  confirmDel.value = null;
  toast(`${CONFIRM_LABELS[type](item)} حذف شد`);
};

/* ============ تب اطلاعات پایه ============ */
const bF = ref({
  kitchenName: store.settings.kitchenName || '',
  nationalId: store.settings.nationalId || '',
  economicCode: store.settings.economicCode || '',
  phone: store.settings.phone || '',
  address: store.settings.address || '',
  charityName: store.settings.charityName || '',
  currency: store.settings.currency || 'تومان',
});
const bSubmit = () => {
  store.settings = { ...store.settings, ...bF.value };
  toast('اطلاعات پایه ذخیره شد');
};

/* ============ تب مشتریان ============ */
const emptyCustomer = { firstName: '', lastName: '', customerType: 'real', nationalId: '', economicCode: '', mobile: '', address: '', discountPercent: '0', isTaxable: false };
const cF = ref({ ...emptyCustomer });
const cEditId = ref(null);

const cSubmit = () => {
  if (!(cF.value.firstName || '').trim() || !(cF.value.lastName || '').trim()) return toast('نام و نام خانوادگی الزامی است', 'error');
  const rec = {
    firstName: (cF.value.firstName || '').trim(),
    lastName: (cF.value.lastName || '').trim(),
    customerType: cF.value.customerType || 'real',
    nationalId: (cF.value.nationalId || '').trim(),
    economicCode: (cF.value.economicCode || '').trim(),
    mobile: (cF.value.mobile || '').trim(),
    address: (cF.value.address || '').trim(),
    discountPercent: Number(cF.value.discountPercent) || 0,
    isTaxable: !!cF.value.isTaxable,
  };
  if (cEditId.value) {
    store.customers = store.customers.map((c) => (c.id === cEditId.value ? { ...rec, id: cEditId.value } : c));
    toast('مشتری ویرایش شد');
    cEditId.value = null;
  } else {
    store.customers = [...store.customers, { ...rec, id: uid('c') }];
    toast('مشتری جدید ثبت شد');
  }
  cF.value = { ...emptyCustomer };
};
const cEdit = (c) => {
  cEditId.value = c.id;
  cF.value = { ...emptyCustomer, ...c, discountPercent: String(c.discountPercent ?? 0) };
};
const cCancel = () => { cEditId.value = null; cF.value = { ...emptyCustomer }; };

/* ============ تب عنوان غذا ============ */
const dF = ref({ name: '', price: '' });
const dEditId = ref(null);

const dSubmit = () => {
  if (!(dF.value.name || '').trim()) return toast('نام غذا الزامی است', 'error');
  if (!Number(dF.value.price)) return toast('قیمت هر پرس الزامی است', 'error');
  if (dEditId.value) {
    store.dishes = store.dishes.map((d) => (d.id === dEditId.value ? { ...d, name: dF.value.name.trim(), price: Number(dF.value.price) } : d));
    dEditId.value = null;
    toast('غذا ویرایش شد');
  } else {
    store.dishes = [...store.dishes, { id: uid('d'), name: dF.value.name.trim(), price: Number(dF.value.price) }];
    toast('غذای جدید ثبت شد');
  }
  dF.value = { name: '', price: '' };
};
const dEdit = (d) => {
  dEditId.value = d.id;
  dF.value = { name: d.name || '', price: String(d.price ?? '') };
};
const dCancel = () => { dEditId.value = null; dF.value = { name: '', price: '' }; };

/* ============ تب ماده غذایی ============ */
const iF = ref({ name: '', initialQty: '', unit: '', wastePercent: '0', minThreshold: '', storage: 'انبار خشک', price: '' });
const iEditId = ref(null);

const iSubmit = () => {
  if (!(iF.value.name || '').trim()) return toast('نام ماده غذایی الزامی است', 'error');
  if (!iF.value.unit) return toast('واحد اندازه‌گیری را انتخاب کنید', 'error');
  if (iEditId.value) {
    store.ingredients = store.ingredients.map((i) => (i.id === iEditId.value
      ? { ...i, name: iF.value.name.trim(), unit: iF.value.unit, wastePercent: Number(iF.value.wastePercent) || 0, minThreshold: Number(iF.value.minThreshold) || 0, storage: iF.value.storage, price: Number(iF.value.price) || i.price || 0 }
      : i));
    iEditId.value = null;
    toast('ماده غذایی ویرایش شد');
  } else {
    store.ingredients = [...store.ingredients, {
      id: uid('i'), name: iF.value.name.trim(), unit: iF.value.unit, qty: Number(iF.value.initialQty) || 0,
      wastePercent: Number(iF.value.wastePercent) || 0, minThreshold: Number(iF.value.minThreshold) || 0, storage: iF.value.storage,
      price: Number(iF.value.price) || 0,
    }];
    toast(`ماده غذایی ثبت شد (موجودی اولیه: ${toFa(Number(iF.value.initialQty) || 0)} ${iF.value.unit})`);
  }
  iF.value = { name: '', initialQty: '', unit: '', wastePercent: '0', minThreshold: '', storage: 'انبار خشک', price: '' };
};
const iEdit = (i) => {
  iEditId.value = i.id;
  iF.value = { name: i.name || '', unit: i.unit || 'کیلوگرم', wastePercent: String(i.wastePercent ?? 0), minThreshold: String(i.minThreshold ?? ''), storage: i.storage || 'انبار خشک', initialQty: String(i.qty ?? ''), price: String(i.price ?? '') };
};
const iCancel = () => {
  iEditId.value = null;
  iF.value = { name: '', initialQty: '', unit: '', wastePercent: '0', minThreshold: '', storage: 'انبار خشک' };
};

/* ============ تب اقلام جانبی ============ */
const emptySupply = { name: '', price: '' };
const sF = ref({ ...emptySupply });
const sEditId = ref(null);

const sSubmit = () => {
  if (!(sF.value.name || '').trim()) return toast('نام قلم الزامی است', 'error');
  if (!Number(sF.value.price) || Number(sF.value.price) < 0) return toast('قیمت قلم الزامی است', 'error');
  if (sEditId.value) {
    store.supplies = store.supplies.map((s) => (s.id === sEditId.value ? { ...s, name: sF.value.name.trim(), price: Number(sF.value.price) } : s));
    sEditId.value = null;
    toast('قلم جانبی ویرایش شد');
  } else {
    store.supplies = [...store.supplies, { id: uid('sup'), name: sF.value.name.trim(), price: Number(sF.value.price) }];
    toast('قلم جانبی جدید ثبت شد');
  }
  sF.value = { ...emptySupply };
};
const sEdit = (s) => {
  sEditId.value = s.id;
  sF.value = { name: s.name || '', price: String(s.price ?? '') };
};
const sCancel = () => { sEditId.value = null; sF.value = { ...emptySupply }; };

/* ============ تب رسپی ============ */
const rDishId = ref('');
const rItems = ref([]);
const rIngId = ref('');
const rQty = ref('');
const rEditId = ref(null);

const rIng = computed(() => store.ingredients.find((i) => i.id === rIngId.value) || null);

// واحد مصرف در رسپی: پیش‌فرض واحد ماده؛ قابل تغییر به واحدهای هم‌خانواده (کیلوگرم ← گرم)
const rUnitOptions = computed(() => (rIng.value ? compatibleUnits(store.units, rIng.value.unit).map((n) => ({ value: n, label: n, searchText: n })) : []));
const rUnit = ref(''); // '' = واحد خود ماده
const rEffUnit = computed(() => rUnit.value || rIng.value?.unit || '');
const rConvPreview = computed(() => {
  if (!rIng.value || rEffUnit.value === rIng.value.unit) return '';
  const c = convertQty(store.units, Number(rQty.value) || 0, rEffUnit.value, rIng.value.unit);
  if (c === null) return 'تبدیل تعریف نشده';
  return `${toFa(Number(rQty.value) || 0)} ${rEffUnit.value} = ${toFa(roundQty(c))} ${rIng.value.unit}`;
});

const rAddItem = () => {
  if (!rIngId.value) return toast('انتخاب ماده غذایی الزامی است', 'error');
  const q = Number(rQty.value);
  if (!q || q <= 0) return toast('مقدار باید بیشتر از صفر باشد', 'error');
  const ing = rIng.value;
  // تبدیل مقدار به واحد انبار ماده
  let stockQty = q;
  const useUnit = rEffUnit.value;
  if (useUnit !== ing.unit) {
    const c = convertQty(store.units, q, useUnit, ing.unit);
    if (c === null) return toast(`تبدیل «${useUnit}» به «${ing.unit}» تعریف نشده است — ابتدا در تنظیمات، تبدیل واحد را تعریف کنید`, 'error');
    stockQty = roundQty(c);
  }
  const ex = rItems.value.findIndex((it) => it.ingredientId === ing.id);
  if (ex > -1) {
    const upd = [...rItems.value];
    upd[ex] = { ...upd[ex], qty: roundQty(upd[ex].qty + stockQty) };
    rItems.value = upd;
  } else {
    rItems.value = [...rItems.value, { ingredientId: ing.id, name: ing.name, qty: stockQty, unit: ing.unit }];
  }
  rIngId.value = '';
  rQty.value = '';
  rUnit.value = '';
};

const rSubmit = () => {
  if (!rDishId.value) return toast('انتخاب غذا الزامی است', 'error');
  if (rItems.value.length === 0) return toast('حداقل یک ردیف ماده غذایی لازم است', 'error');
  const dish = store.dishes.find((d) => d.id === rDishId.value);
  const rec = { id: rEditId.value || uid('r'), dishId: rDishId.value, dishName: dish.name, items: [...rItems.value] };
  if (rEditId.value) {
    store.recipes = store.recipes.map((r) => (r.id === rEditId.value ? rec : r));
    toast('رسپی ویرایش شد');
    rEditId.value = null;
  } else {
    store.recipes = [...store.recipes, rec];
    toast(`رسپی «${dish.name}» ثبت شد`);
  }
  rDishId.value = '';
  rItems.value = [];
};
const rEdit = (r) => {
  rEditId.value = r.id;
  rDishId.value = r.dishId || '';
  rItems.value = (r.items || []).map((it) => ({ ...it }));
};
const rRemoveItem = (idx) => { rItems.value = rItems.value.filter((_, i) => i !== idx); };
const rReset = () => { rEditId.value = null; rDishId.value = ''; rItems.value = []; };
const rDelete = (r) => {
  store.recipes = store.recipes.filter((x) => x.id !== r.id);
  toast('رسپی حذف شد');
};

/* ============ تب واحد اندازه‌گیری ============ */
const unitName = ref('');
const addUnit = () => {
  const n = unitName.value.trim();
  if (!n) return toast('نام واحد را وارد کنید', 'error');
  if (store.units.some((u) => u.name === n)) return toast('این واحد قبلاً ثبت شده است (ورود نام تکراری مجاز نیست)', 'error');
  store.units = [...store.units, { id: uid('u'), name: n }];
  unitName.value = '';
  toast(`واحد «${n}» ثبت شد`);
};

/* ===== تبدیل واحد (ضریب نسبت به واحد مبنا) ===== */
// ویرایش ردیف فعال: مقدارهای محلی (تا «انصراف» تغییری در استور نگذارد)
const convEdit = ref(null);
const convEditFactor = ref('');
const convEditBase = ref('');
const startConv = (u) => {
  convEdit.value = u.id;
  convEditFactor.value = u.factor ? String(u.factor) : '';
  convEditBase.value = u.baseUnit || '';
};
const cancelConv = () => { convEdit.value = null; convEditFactor.value = ''; convEditBase.value = ''; };
const saveConv = (u) => {
  const f = Number(String(convEditFactor.value).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  const base = convEditBase.value;
  if (base && (!f || f <= 0)) return toast('ضریب باید عددی بزرگ‌تر از صفر باشد', 'error');
  if (!base && convEditFactor.value.trim() !== '' && (!f || f <= 0)) return toast('ضریب باید عددی بزرگ‌تر از صفر باشد', 'error');
  if (base === u.name) return toast('واحد مبنا نمی‌تواند خود واحد باشد', 'error');
  // جلوگیری از حلقه: واحد مبنا نباید به این واحد برسد
  if (base) {
    let cur = base;
    let guard = 0;
    while (guard++ < 10) {
      const x = store.units.find((y) => y.name === cur);
      if (!x || !x.baseUnit) break;
      if (x.baseUnit === u.name) return toast('این انتخاب حلقه تبدیل ایجاد می‌کند', 'error');
      cur = x.baseUnit;
    }
  }
  store.units = store.units.map((x) => (x.id === u.id ? { ...x, baseUnit: base, factor: base ? f : undefined } : x));
  toast(base ? `تبدیل «${u.name}» به «${base}» با ضریب ${toFa(f)} ذخیره شد` : `تبدیل واحد «${u.name}» حذف شد`);
  cancelConv();
};
const removeConv = (u) => {
  store.units = store.units.map((x) => (x.id === u.id ? { ...x, baseUnit: '', factor: undefined } : x));
  toast(`تبدیل واحد «${u.name}» حذف شد`);
};
const convChainText = (u) => {
  if (!u.baseUnit) return '—';
  const parts = [`1 ${u.name} = ${toFa(u.factor)} ${u.baseUnit}`];
  let cur = u.baseUnit;
  let guard = 0;
  while (guard++ < 10) {
    const x = store.units.find((y) => y.name === cur);
    if (!x || !x.baseUnit) break;
    parts.push(`1 ${x.name} = ${toFa(x.factor)} ${x.baseUnit}`);
    cur = x.baseUnit;
  }
  return parts.join(' ← ');
};

/* ============ تب نرخ مالیات ============ */
const setTaxRate = (v) => {
  store.settings = { ...store.settings, taxRate: Math.max(0, Math.min(100, Number(v) || 0)) };
};

/* ============ تب واحد پول ============ */
const sampleNumber = new Intl.NumberFormat('en-US').format(1250000).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
const pickCurrency = (c) => {
  store.settings = { ...store.settings, currency: c };
  toast(`واحد پول برنامه به «${c}» تغییر یافت`);
};

/* ============ تب هزینه‌های سربار ============ */
const oF = ref({ name: '', amount: '' });
const oEditId = ref(null);
const ohTotal = computed(() => store.overheads.reduce((s, o) => s + (o.amount || 0), 0));

const oSubmit = () => {
  if (!(oF.value.name || '').trim()) return toast('عنوان هزینه الزامی است', 'error');
  if (!Number(oF.value.amount) || Number(oF.value.amount) <= 0) return toast('مبلغ هزینه الزامی است', 'error');
  if (oEditId.value) {
    store.overheads = store.overheads.map((o) => (o.id === oEditId.value ? { ...o, name: oF.value.name.trim(), amount: Number(oF.value.amount) } : o));
    oEditId.value = null;
    toast('هزینه سربار ویرایش شد');
  } else {
    store.overheads = [...store.overheads, { id: uid('oh'), name: oF.value.name.trim(), amount: Number(oF.value.amount) }];
    toast('هزینه سربار جدید ثبت شد');
  }
  oF.value = { name: '', amount: '' };
};
const oEdit = (o) => {
  oEditId.value = o.id;
  oF.value = { name: o.name || '', amount: String(o.amount ?? '') };
};
const oCancel = () => { oEditId.value = null; oF.value = { name: '', amount: '' }; };
const oDelete = (o) => {
  store.overheads = store.overheads.filter((x) => x.id !== o.id);
  toast(`هزینه «${o.name}» حذف شد`);
};

/* ============ تب فونت برنامه و گزارش ============ */
const appFont = computed(() => store.settings?.appFont || 'Vazirmatn');
const reportFont = computed(() => store.settings?.reportFont || 'Vazirmatn');
const fontLabel = (id) => (FONT_OPTIONS.find((f) => f.id === id) || {}).label || id;

const setAppFont = (id) => {
  store.settings = { ...store.settings, appFont: id };
  toast(`فونت برنامه به «${fontLabel(id)}» تغییر یافت`);
};
const setReportFont = (id) => {
  store.settings = { ...store.settings, reportFont: id };
  toast(`فونت گزارش‌ها به «${fontLabel(id)}» تغییر یافت`);
};

/* ============ تب تعریف کاربر ============ */
const emptyUser = { firstName: '', lastName: '', username: '', password: '', personnelCode: '', mobile: '', roles: ['user'] };
const uF = ref({ ...emptyUser });
const uEditId = ref(null);
const roleOptions = computed(() => (store.roles.length ? store.roles : [{ id: 'user', name: 'کاربر معمولی' }, { id: 'admin', name: 'ادمین' }]));
const roleOf = (rid) => roleOptions.value.find((r) => r.id === rid);

const uSubmit = () => {
  if (!(uF.value.firstName || '').trim() || !(uF.value.lastName || '').trim() || !(uF.value.personnelCode || '').trim() || !uF.value.password) return toast('نام، نام خانوادگی، شماره پرسنلی و رمز عبور الزامی است', 'error');
  if (store.users.some((u) => u.username === (uF.value.personnelCode || '').trim() && u.id !== uEditId.value)) return toast('این شماره پرسنلی قبلاً استفاده شده است', 'error');
  const rec = {
    id: uEditId.value || uid('usr'),
    firstName: (uF.value.firstName || '').trim(),
    lastName: (uF.value.lastName || '').trim(),
    fullName: `${(uF.value.firstName || '').trim()} ${(uF.value.lastName || '').trim()}`.trim(),
    username: (uF.value.personnelCode || '').trim(), // شماره پرسنلی به‌عنوان نام کاربری برای ورود
    password: uF.value.password,
    personnelCode: (uF.value.personnelCode || '').trim(),
    mobile: (uF.value.mobile || '').trim(),
    roles: uF.value.roles || ['user'],
  };
  if (uEditId.value) {
    store.users = store.users.map((u) => (u.id === uEditId.value ? rec : u));
    toast('کاربر ویرایش شد');
    uEditId.value = null;
  } else {
    store.users = [...store.users, rec];
    toast(`کاربر «${rec.fullName}» ثبت شد`);
  }
  uF.value = { ...emptyUser, roles: ['user'] };
};
const uEdit = (u) => {
  uEditId.value = u.id;
  uF.value = {
    firstName: u.firstName || u.fullName.split(' ')[0] || '',
    lastName: u.lastName || u.fullName.split(' ').slice(1).join(' ') || '',
    password: u.password,
    personnelCode: u.personnelCode || u.username,
    mobile: u.mobile || '',
    roles: u.roles || [u.role || 'user'],
  };
};
const uCancel = () => { uEditId.value = null; uF.value = { ...emptyUser, roles: ['user'] }; };
const uToggleRole = (rid, checked) => {
  uF.value = { ...uF.value, roles: checked ? [...(uF.value.roles || []), rid] : (uF.value.roles || []).filter((id) => id !== rid) };
};
const uDelete = (u) => {
  if (u.id === store.currentUser?.id) return toast('کاربر جاری قابل حذف نیست', 'error');
  if ((u.roles || [u.role]).includes('admin') && store.users.filter((x) => (x.roles || [x.role]).includes('admin')).length <= 1) return toast('حداقل یک ادمین باید باقی بماند', 'error');
  store.users = store.users.filter((x) => x.id !== u.id);
  toast('کاربر حذف شد');
};

/* ============ تب تعریف نقش و مجوزها ============ */
const roleEditId = ref(null);
const roleF = ref(null); // { id, name, system, permissions: {key: bool} }

const startNewRole = () => {
  roleEditId.value = null;
  roleF.value = { id: null, name: '', system: false, permissions: Object.fromEntries(PERMISSIONS.map((p) => [p.key, false])) };
};
const startEditRole = (r) => {
  roleEditId.value = r.id;
  roleF.value = { id: r.id, name: r.name, system: !!r.system, permissions: { ...Object.fromEntries(PERMISSIONS.map((p) => [p.key, !!r.permissions?.[p.key]])) } };
};
const resetRole = () => { roleEditId.value = null; roleF.value = null; };
const togglePerm = (key) => {
  roleF.value = { ...roleF.value, permissions: { ...roleF.value.permissions, [key]: !roleF.value.permissions[key] } };
};

const roleSubmit = () => {
  if (!(roleF.value.name || '').trim()) return toast('نام نقش الزامی است', 'error');
  if (store.roles.some((r) => r.name === (roleF.value.name || '').trim() && r.id !== roleEditId.value)) return toast('نقشی با این نام وجود دارد', 'error');
  if (roleEditId.value) {
    store.roles = store.roles.map((r) => (r.id === roleEditId.value ? { ...r, name: (roleF.value.name || '').trim(), permissions: roleF.value.permissions } : r));
    toast('نقش ویرایش شد');
  } else {
    const id = `role_${Date.now()}`;
    store.roles = [...store.roles, { id, name: (roleF.value.name || '').trim(), system: false, permissions: roleF.value.permissions }];
    toast(`نقش «${(roleF.value.name || '').trim()}» ثبت شد`);
  }
  resetRole();
};

const roleRequestDelete = (r) => {
  if (r.system) return toast('نقش سیستمی قابل حذف نیست', 'error');
  if (store.users.some((u) => (u.roles || [u.role]).includes(r.id))) return toast(`نقش «${r.name}» به کاربری اختصاص دارد؛ ابتدا نقش کاربران را تغییر دهید`, 'error');
  store.roles = store.roles.filter((x) => x.id !== r.id);
  toast('نقش حذف شد');
};

const permCount = (r) => PERMISSIONS.filter((p) => r.permissions?.[p.key]).length;
const permGroups = [...new Set(PERMISSIONS.map((p) => p.group))];
const editingRoleName = computed(() => (store.roles.find((r) => r.id === roleEditId.value) || {}).name);
</script>

<template>
  <div class="space-y-6">
    <div class="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
      <div class="p-3 bg-slate-100 text-slate-700 rounded-2xl">
        <Sliders class="w-6 h-6" />
      </div>
      <div>
        <h2 class="text-base font-black text-slate-900">تنظیمات و تعاریف پایه</h2>
        <p class="text-[11px] text-slate-500">تعاریف (مشتری، غذا، ماده، رسپی، اقلام جانبی) و تنظیمات (واحد، مالیات، فونت، کاربران، چاپ)</p>
      </div>
    </div>

    <!-- زیربخش‌های اصلی — در حالت تک‌زیربخش پنهان -->
    <div v-if="showTabs" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button
        v-for="g in visibleGroups"
        :key="g.id"
        :class="`flex items-center gap-3 p-4 rounded-2xl border text-right transition ${group === g.id
          ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/30'
          : 'border-slate-200 bg-white hover:bg-slate-50'
        }`"
        @click="group = g.id"
      >
        <div :class="`p-2.5 rounded-xl ${group === g.id ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`">
          <component :is="g.icon" class="w-5 h-5" />
        </div>
        <div>
          <div class="text-sm font-black text-slate-800">{{ g.label }}</div>
          <div class="text-[10px] text-slate-500">{{ g.tabs.map((t) => t.label).join(' · ') }}</div>
        </div>
      </button>
    </div>

    <!-- تب‌های زیربخش فعال — در حالت تک‌زیربخش پنهان -->
    <div v-if="showTabs" class="bg-white rounded-2xl border border-slate-200 p-2 flex gap-1.5 overflow-x-auto">
      <button
        v-for="t in currentGroupTabs"
        :key="t.id"
        :class="`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition ${tab === t.id ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
        }`"
        @click="tab = t.id"
      >
        <component :is="t.icon" class="w-4 h-4" /> {{ t.label }}
      </button>
    </div>

    <!-- ============ تب اطلاعات پایه ============ -->
    <form v-if="tab === 'basicinfo'" class="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 max-w-3xl" @submit.prevent="bSubmit">
      <h3 class="font-black text-sm text-slate-800">اطلاعات پایه آشپزخانه</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1.5">نام آشپزخانه:</label>
          <input v-model="bF.kitchenName" :class="inputCls" />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1.5">شناسه ملی:</label>
          <input v-model="bF.nationalId" dir="ltr" :class="inputCls" />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1.5">کد اقتصادی:</label>
          <input v-model="bF.economicCode" dir="ltr" :class="inputCls" />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1.5">تلفن:</label>
          <input v-model="bF.phone" dir="ltr" placeholder="021-xxxxxxx" :class="inputCls" />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1.5">آدرس:</label>
          <input v-model="bF.address" :class="inputCls" />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1.5">وابسته به (خیریه/سازمان):</label>
          <input v-model="bF.charityName" :class="inputCls" />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1.5">واحد پول:</label>
          <select v-model="bF.currency" :class="`${inputCls} font-bold`">
            <option value="تومان">تومان</option>
            <option value="ریال">ریال</option>
          </select>
          <p class="text-[10px] text-slate-500 mt-1">در همه صفحات (فاکتور، انبار، گزارش‌ها و چاپ‌ها) اعمال می‌شود.</p>
        </div>
      </div>
      <button type="submit" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition">ذخیره</button>
    </form>

    <!-- ============ تب مشتریان ============ -->
    <div v-else-if="tab === 'customers'" class="space-y-6">
      <form class="bg-white border border-slate-200 rounded-2xl p-5 space-y-4" @submit.prevent="cSubmit">
        <h3 class="font-black text-sm text-slate-800">{{ cEditId ? 'ویرایش مشتری' : 'ثبت مشتری جدید' }}</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">نام: <span class="text-rose-500">*</span></label>
            <input v-model="cF.firstName" required :class="inputCls" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">نام خانوادگی: <span class="text-rose-500">*</span></label>
            <input v-model="cF.lastName" required :class="inputCls" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">نوع مشتری:</label>
            <div class="flex bg-slate-100 border border-slate-300 rounded-xl p-1 gap-1">
              <button
                type="button"
                :class="`flex-1 py-2 rounded-lg text-xs font-black transition ${cF.customerType === 'real' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`"
                @click="cF.customerType = 'real'"
              >
                حقیقی
              </button>
              <button
                type="button"
                :class="`flex-1 py-2 rounded-lg text-xs font-black transition ${cF.customerType === 'legal' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`"
                @click="cF.customerType = 'legal'"
              >
                حقوقی
              </button>
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">شماره ملی:</label>
            <input v-model="cF.nationalId" dir="ltr" placeholder="**********" :class="inputCls" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">کد اقتصادی:</label>
            <input v-model="cF.economicCode" dir="ltr" placeholder="************" :class="inputCls" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">شماره موبایل:</label>
            <input v-model="cF.mobile" dir="ltr" placeholder="09xxxxxxxxx" :class="inputCls" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">درصد تخفیف:</label>
            <FaNumberInput v-model="cF.discountPercent" :class="`${inputCls} text-center`" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">مشمول مالیات:</label>
            <select v-model="cF.isTaxable" :class="`${inputCls} font-bold`">
              <option :value="false">خیر</option>
              <option :value="true">بلی</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">آدرس:</label>
            <input v-model="cF.address" :class="inputCls" />
          </div>
        </div>
        <div class="flex gap-2">
          <button type="submit" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition">
            {{ cEditId ? 'ذخیره ویرایش' : 'ثبت مشتری' }}
          </button>
          <button v-if="cEditId" type="button" class="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition" @click="cCancel">
            انصراف
          </button>
        </div>
      </form>

      <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table class="w-full text-right text-xs">
          <thead class="bg-slate-50 font-black text-slate-700 border-b border-slate-200">
            <tr>
              <th class="p-3">#</th>
              <th class="p-3">نام و نام‌خانوادگی</th>
              <th class="p-3">موبایل</th>
              <th class="p-3">آدرس</th>
              <th class="p-3 text-center">تخفیف</th>
              <th class="p-3 text-center">مالیات</th>
              <th class="p-3 text-center w-24">عملیات</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <EmptyRow v-if="store.customers.length === 0" :col-span="7" text="مشتری ثبت نشده" />
            <template v-else>
              <tr v-for="(c, i) in store.customers" :key="c.id" class="hover:bg-slate-50">
                <td class="p-3 text-slate-500">{{ toFa(i + 1) }}</td>
                <td class="p-3 font-black text-slate-800">{{ c.firstName }} {{ c.lastName }}</td>
                <td class="p-3 text-slate-600" dir="ltr">{{ toFa(c.mobile || '-') }}</td>
                <td class="p-3 text-slate-600 max-w-[200px] truncate">{{ c.address || '—' }}</td>
                <td class="p-3 text-center font-bold text-sky-700">{{ c.discountPercent ? `${toFa(c.discountPercent)}٪` : '—' }}</td>
                <td class="p-3 text-center">
                  <span :class="`px-2 py-0.5 rounded-full text-[10px] font-black ${c.isTaxable ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`">
                    {{ c.isTaxable ? 'بلی' : 'خیر' }}
                  </span>
                </td>
                <td class="p-3 text-center">
                  <div class="flex items-center justify-center gap-1">
                    <button class="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" @click="cEdit(c)"><Edit3 class="w-4 h-4" /></button>
                    <button title="حذف" class="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" @click="requestDelete('customer', c)"><Trash2 class="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ============ تب عنوان غذا ============ -->
    <div v-else-if="tab === 'dishes'" class="space-y-6">
      <div class="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-[11px] font-bold text-amber-900 flex items-center gap-2">
        <AlertTriangle class="w-4 h-4 shrink-0" />
        غذاهایی که در یک یا چند فاکتور استفاده شده‌اند قابل حذف نیستند.
      </div>

      <form class="bg-white border border-slate-200 rounded-2xl p-5 space-y-4" @submit.prevent="dSubmit">
        <h3 class="font-black text-sm text-slate-800">{{ dEditId ? 'ویرایش عنوان غذا' : 'ثبت عنوان غذای جدید' }}</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">نام غذا: <span class="text-rose-500">*</span></label>
            <input v-model="dF.name" required :class="inputCls" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">قیمت هر پرس (تومان): <span class="text-rose-500">*</span></label>
            <FaNumberInput v-model="dF.price" required :class="`${inputCls} text-center font-black`" />
          </div>
        </div>
        <div class="flex gap-2">
          <button type="submit" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition">
            {{ dEditId ? 'ذخیره ویرایش' : 'ثبت غذا' }}
          </button>
          <button v-if="dEditId" type="button" class="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition" @click="dCancel">انصراف</button>
        </div>
      </form>

      <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table class="w-full text-right text-xs">
          <thead class="bg-slate-50 font-black text-slate-700 border-b border-slate-200">
            <tr>
              <th class="p-3">#</th>
              <th class="p-3">نام غذا</th>
              <th class="p-3">قیمت پرس</th>
              <th class="p-3 text-center">وضعیت</th>
              <th class="p-3 text-center w-24">عملیات</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <EmptyRow v-if="store.dishes.length === 0" :col-span="5" text="غذایی ثبت نشده" />
            <template v-else>
              <tr v-for="(d, i) in store.dishes" :key="d.id" class="hover:bg-slate-50">
                <td class="p-3 text-slate-500">{{ toFa(i + 1) }}</td>
                <td class="p-3 font-black text-slate-800">{{ d.name }}</td>
                <td class="p-3 font-black text-emerald-700">{{ formatMoney(d.price) }} تومان</td>
                <td class="p-3 text-center">
                  <span
                    v-if="usedDishIds.has(d.id)"
                    title="این قلم در یک یا چند فاکتور استفاده شده و قابل حذف نیست"
                    class="inline-flex items-center gap-1 text-[9px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full"
                  >
                    <AlertTriangle class="w-3 h-3" /> استفاده‌شده در فاکتور
                  </span>
                </td>
                <td class="p-3 text-center">
                  <div class="flex items-center justify-center gap-1">
                    <button class="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" @click="dEdit(d)"><Edit3 class="w-4 h-4" /></button>
                    <button
                      :title="usedDishIds.has(d.id) ? 'در فاکتور استفاده شده — حذف ممکن نیست' : 'حذف'"
                      :class="`p-1.5 rounded-lg transition ${usedDishIds.has(d.id) ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'}`"
                      @click="requestDelete('dish', d)"
                    ><Trash2 class="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ============ تب ماده غذایی ============ -->
    <div v-else-if="tab === 'ingredients'" class="space-y-6">
      <div class="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-[11px] font-bold text-amber-900 flex items-center gap-2">
        <AlertTriangle class="w-4 h-4 shrink-0" />
        موادی که از طریق رسپی در غذاهای فاکتورشده استفاده شده‌اند قابل حذف نیستند.
      </div>

      <form class="bg-white border border-slate-200 rounded-2xl p-5 space-y-4" @submit.prevent="iSubmit">
        <h3 class="font-black text-sm text-slate-800">{{ iEditId ? 'ویرایش ماده غذایی' : 'ثبت ماده غذایی جدید' }}</h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">نام ماده غذایی: <span class="text-rose-500">*</span></label>
            <input v-model="iF.name" required :class="inputCls" />
          </div>
          <div v-if="!iEditId">
            <label class="block text-xs font-bold text-slate-700 mb-1.5">مقدار اولیه: <span class="text-rose-500">*</span></label>
            <FaNumberInput v-model="iF.initialQty" required :class="`${inputCls} text-center`" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">واحد اندازه‌گیری: <span class="text-rose-500">*</span></label>
            <SearchableSelect
              v-model="iF.unit"
              placeholder="-- از جدول واحدها --"
              search-placeholder="جستجوی نام واحد..."
              :options="store.units.map((u) => ({ value: u.name, label: u.name, searchText: u.name }))"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">درصد پرتی:</label>
            <FaNumberInput v-model="iF.wastePercent" :class="`${inputCls} text-center`" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">آستانه هشدار موجودی:</label>
            <FaNumberInput v-model="iF.minThreshold" :class="`${inputCls} text-center`" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">محل نگهداری:</label>
            <select v-model="iF.storage" :class="`${inputCls} font-bold`">
              <option v-for="s in STORAGE_PLACES" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">قیمت خرید واحد (تومان):</label>
            <FaNumberInput v-model="iF.price" :class="`${inputCls} text-center font-black`" placeholder="از فاکتور خرید" />
            <p class="text-[10px] text-slate-500 mt-1">با ثبت ورود کالا همراه قیمت، این فیلد خودکار به‌روز می‌شود.</p>
          </div>
        </div>
        <div class="flex gap-2">
          <button type="submit" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition">
            {{ iEditId ? 'ذخیره ویرایش' : 'ثبت ماده غذایی' }}
          </button>
          <button v-if="iEditId" type="button" class="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition" @click="iCancel">انصراف</button>
        </div>
      </form>

      <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table class="w-full text-right text-xs">
          <thead class="bg-slate-50 font-black text-slate-700 border-b border-slate-200">
            <tr>
              <th class="p-3">#</th>
              <th class="p-3">نام ماده</th>
              <th class="p-3">واحد</th>
              <th class="p-3">محل نگهداری</th>
              <th class="p-3">موجودی</th>
              <th class="p-3">پرتی</th>
              <th class="p-3">آستانه</th>
              <th class="p-3 text-center">وضعیت</th>
              <th class="p-3 text-center w-24">عملیات</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <EmptyRow v-if="store.ingredients.length === 0" :col-span="9" text="ماده‌ای ثبت نشده" />
            <template v-else>
              <tr v-for="(ing, idx) in store.ingredients" :key="ing.id" class="hover:bg-slate-50">
                <td class="p-3 text-slate-500">{{ toFa(idx + 1) }}</td>
                <td class="p-3 font-black text-slate-800">{{ ing.name }}</td>
                <td class="p-3 text-slate-600">{{ ing.unit }}</td>
                <td class="p-3 text-slate-600">{{ ing.storage || '—' }}</td>
                <td class="p-3 font-black text-slate-900">{{ toFa(ing.qty) }}</td>
                <td class="p-3 text-slate-600">{{ toFa(ing.wastePercent) }}٪</td>
                <td class="p-3 text-slate-600">{{ toFa(ing.minThreshold) }}</td>
                <td class="p-3 text-center">
                  <span
                    v-if="usedIngredientIds.has(ing.id)"
                    title="این قلم در یک یا چند فاکتور استفاده شده و قابل حذف نیست"
                    class="inline-flex items-center gap-1 text-[9px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full"
                  >
                    <AlertTriangle class="w-3 h-3" /> استفاده‌شده در فاکتور
                  </span>
                </td>
                <td class="p-3 text-center">
                  <div class="flex items-center justify-center gap-1">
                    <button class="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" @click="iEdit(ing)"><Edit3 class="w-4 h-4" /></button>
                    <button
                      :title="usedIngredientIds.has(ing.id) ? 'در فاکتور استفاده شده — حذف ممکن نیست' : 'حذف'"
                      :class="`p-1.5 rounded-lg transition ${usedIngredientIds.has(ing.id) ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'}`"
                      @click="requestDelete('ingredient', ing)"
                    ><Trash2 class="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ============ تب رسپی ============ -->
    <div v-else-if="tab === 'recipes'" class="space-y-6">
      <form v-if="isAdmin" class="bg-white border border-slate-200 rounded-2xl p-5 space-y-5" @submit.prevent="rSubmit">
        <h3 class="font-black text-sm text-slate-800">{{ rEditId ? 'ویرایش رسپی' : 'ثبت رسپی جدید' }}</h3>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">انتخاب نام غذا: <span class="text-rose-500">*</span></label>
            <SearchableSelect
              v-model="rDishId"
              placeholder="-- انتخاب غذا --"
              search-placeholder="جستجوی نام غذا..."
              :options="store.dishes.map((d) => ({ value: d.id, label: d.name, searchText: d.name }))"
            />
          </div>
        </div>

        <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <div class="text-xs font-black text-slate-700">افزودن ردیف ماده غذایی به رسپی:</div>
          <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div class="sm:col-span-6">
              <label class="block text-[11px] font-bold text-slate-600 mb-1">ماده غذایی (از جدول مواد):</label>
              <SearchableSelect
                v-model="rIngId"
                placeholder="-- انتخاب ماده --"
                search-placeholder="جستجوی نام ماده، واحد..."
                :options="store.ingredients.map((i) => ({
                  value: i.id,
                  label: `${i.name} (${i.unit})`,
                  searchText: `${i.name} ${i.unit} ${i.storage || ''}`,
                }))"
              />
            </div>
            <div class="sm:col-span-2">
              <label class="block text-[11px] font-bold text-slate-600 mb-1">مقدار مصرفی هر پرس:</label>
              <FaNumberInput v-model="rQty" :class="`${inputCls} bg-white text-center text-xs`" />
            </div>
            <div class="sm:col-span-2">
              <label class="block text-[11px] font-bold text-slate-600 mb-1">واحد مصرف:</label>
              <select v-if="rUnitOptions.length > 1" v-model="rUnit" :class="`${inputCls} bg-white text-xs`">
                <option v-for="o in rUnitOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
              <div v-else :class="`${inputCls} bg-slate-50 text-center text-xs text-slate-500`">{{ rIng ? rIng.unit : 'واحد' }}</div>
              <p v-if="rConvPreview" class="text-[9px] font-bold mt-1" :class="rConvPreview === 'تبدیل تعریف نشده' ? 'text-rose-500' : 'text-slate-500'">{{ rConvPreview }}</p>
            </div>
            <div class="sm:col-span-3">
              <button type="button" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5" @click="rAddItem">
                <Plus class="w-4 h-4" /> افزودن ردیف
              </button>
            </div>
          </div>
        </div>

        <div v-if="rItems.length > 0" class="overflow-x-auto border border-slate-200 rounded-2xl">
          <table class="w-full text-right text-xs">
            <thead class="bg-slate-100 font-black text-slate-700 border-b border-slate-200">
              <tr>
                <th class="p-3 w-12 text-center">ردیف</th>
                <th class="p-3">ماده غذایی</th>
                <th class="p-3 text-center">مقدار مصرفی / پرس</th>
                <th class="p-3 text-center w-16">حذف</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(it, idx) in rItems" :key="it.ingredientId" class="hover:bg-slate-50">
                <td class="p-3 text-center text-slate-500">{{ toFa(idx + 1) }}</td>
                <td class="p-3 font-bold text-slate-800">{{ it.name }}</td>
                <td class="p-3 text-center font-black text-emerald-700">{{ toFa(it.qty) }} {{ it.unit }}</td>
                <td class="p-3 text-center">
                  <button class="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 rounded-lg transition" @click="rRemoveItem(idx)"><Trash2 class="w-4 h-4" /></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex gap-2">
          <button type="submit" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition">
            {{ rEditId ? 'ذخیره ویرایش' : 'ثبت رسپی' }}
          </button>
          <button
            v-if="rEditId || rItems.length > 0 || rDishId"
            type="button"
            class="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            @click="rReset"
          >انصراف</button>
        </div>
      </form>
      <div v-else class="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
        <Lock class="w-5 h-5 text-amber-600 shrink-0" />
        <p class="text-xs font-bold text-amber-800">
          مشاهده رسپی‌ها برای همه کاربران فعال است؛ ثبت، ویرایش و حذف رسپی فقط توسط <strong>کاربر ادمین</strong> مجاز است.
        </p>
      </div>

      <!-- جدول رسپی‌ها — هر رسپی یک ردیف با ردیف‌های داخلی مواد -->
      <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div class="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 class="text-sm font-black text-slate-800">جدول رسپی غذاها</h3>
          <span class="text-[11px] text-slate-500">{{ toFa(store.recipes.length) }} رسپی ثبت‌شده</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-right text-xs">
            <thead class="bg-slate-50 font-black text-slate-700 border-b border-slate-200">
              <tr>
                <th class="p-3 w-14 text-center">ردیف</th>
                <th class="p-3">نام غذا</th>
                <th class="p-3">مواد غذایی و مقدار مصرفی (هر پرس)</th>
                <th class="p-3 text-center w-20">تعداد مواد</th>
                <th v-if="isAdmin" class="p-3 text-center w-24">عملیات</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <EmptyRow v-if="store.recipes.length === 0" :col-span="isAdmin ? 5 : 4" text="رسپی ثبت نشده است" />
              <template v-else>
                <tr v-for="(r, ri) in store.recipes" :key="r.id" :class="rEditId === r.id ? 'bg-amber-50/60' : 'hover:bg-slate-50'">
                  <td class="p-3 text-center font-bold text-slate-500 align-top">{{ toFa(ri + 1) }}</td>
                  <td class="p-3 font-black text-slate-800 align-top whitespace-nowrap">{{ r.dishName }}</td>
                  <td class="p-3">
                    <table class="w-full text-[11px] border border-slate-100 rounded-xl overflow-hidden">
                      <tbody class="divide-y divide-slate-100">
                        <tr v-for="(it, ii) in r.items" :key="it.ingredientId">
                          <td class="px-3 py-2 font-bold text-slate-600 w-8 text-center">{{ toFa(ii + 1) }}</td>
                          <td class="px-3 py-2 font-bold text-slate-700">{{ it.name }}</td>
                          <td class="px-3 py-2 font-black text-emerald-700 whitespace-nowrap">{{ toFa(it.qty) }} {{ it.unit }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                  <td class="p-3 text-center font-black text-slate-700 align-top">{{ toFa(r.items.length) }}</td>
                  <td v-if="isAdmin" class="p-3 align-top">
                    <div class="flex items-center justify-center gap-1">
                      <button
                        class="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                        title="ویرایش رسپی"
                        @click="rEdit(r)"
                      ><Edit3 class="w-4 h-4" /></button>
                      <button
                        class="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="حذف رسپی"
                        @click="rDelete(r)"
                      ><Trash2 class="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ============ تب اقلام جانبی ============ -->
    <div v-else-if="tab === 'supplies'" class="space-y-6">
      <div class="bg-sky-50 border border-sky-200 rounded-2xl p-3.5 text-[11px] font-bold text-sky-900">
        این اقلام (ظرف یکبار مصرف، قاشق و چنگال و ...) با قیمت ثبت‌شده در فاکتور فروش و گزارش‌ها قابل انتخاب هستند.
        اقلامی که در فاکتور استفاده شده‌اند قابل حذف نیستند.
      </div>

      <form class="bg-white border border-slate-200 rounded-2xl p-5 space-y-4" @submit.prevent="sSubmit">
        <h3 class="font-black text-sm text-slate-800">{{ sEditId ? 'ویرایش قلم جانبی' : 'ثبت قلم جانبی جدید' }}</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">نام قلم: <span class="text-rose-500">*</span></label>
            <input v-model="sF.name" required placeholder="مثلاً ظرف یکبار مصرف" :class="inputCls" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">قیمت واحد (تومان): <span class="text-rose-500">*</span></label>
            <FaNumberInput v-model="sF.price" required :class="`${inputCls} text-center font-black`" />
          </div>
        </div>
        <div class="flex gap-2">
          <button type="submit" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition">
            {{ sEditId ? 'ذخیره ویرایش' : 'ثبت قلم' }}
          </button>
          <button v-if="sEditId" type="button" class="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition" @click="sCancel">انصراف</button>
        </div>
      </form>

      <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table class="w-full text-right text-xs">
          <thead class="bg-slate-50 font-black text-slate-700 border-b border-slate-200">
            <tr>
              <th class="p-3">#</th>
              <th class="p-3">نام قلم</th>
              <th class="p-3">قیمت واحد</th>
              <th class="p-3 text-center">وضعیت</th>
              <th class="p-3 text-center w-24">عملیات</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <EmptyRow v-if="store.supplies.length === 0" :col-span="5" text="قلمی ثبت نشده" />
            <template v-else>
              <tr v-for="(s, i) in store.supplies" :key="s.id" class="hover:bg-slate-50">
                <td class="p-3 text-slate-500">{{ toFa(i + 1) }}</td>
                <td class="p-3 font-black text-slate-800">{{ s.name }}</td>
                <td class="p-3 font-black text-emerald-700">{{ formatMoney(s.price) }} تومان</td>
                <td class="p-3 text-center">
                  <span
                    v-if="usedSupplyIds.has(s.id)"
                    title="این قلم در یک یا چند فاکتور استفاده شده و قابل حذف نیست"
                    class="inline-flex items-center gap-1 text-[9px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full"
                  >
                    <AlertTriangle class="w-3 h-3" /> استفاده‌شده در فاکتور
                  </span>
                </td>
                <td class="p-3 text-center">
                  <div class="flex items-center justify-center gap-1">
                    <button class="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" @click="sEdit(s)"><Edit3 class="w-4 h-4" /></button>
                    <button
                      :title="usedSupplyIds.has(s.id) ? 'در فاکتور استفاده شده — حذف ممکن نیست' : 'حذف'"
                      :class="`p-1.5 rounded-lg transition ${usedSupplyIds.has(s.id) ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'}`"
                      @click="requestDelete('supply', s)"
                    ><Trash2 class="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ============ تب واحد اندازه‌گیری ============ -->
    <div v-else-if="tab === 'units'" class="max-w-3xl space-y-4">
      <form class="bg-white border border-slate-200 rounded-2xl p-5 space-y-4" @submit.prevent="addUnit">
        <h3 class="font-black text-sm text-slate-800">تعریف واحد اندازه‌گیری</h3>
        <div class="flex gap-2">
          <input v-model="unitName" placeholder="مثلاً جعبه، کارتن، بند..." :class="`${inputCls} flex-1`" />
          <button type="submit" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5">
            <Plus class="w-4 h-4" /> افزودن
          </button>
        </div>
        <p class="text-[10px] text-slate-500">واحدهای وارد‌شده در قالب جدول زیر نمایش داده می‌شوند و ورود نام تکراری مسدود است.</p>
      </form>

      <div class="bg-sky-50 border border-sky-200 rounded-2xl p-3.5 text-[11px] font-bold text-sky-900 leading-relaxed">
        تبدیل واحد: برای هر واحد می‌توانید «واحد مبنا» و «ضریب» تعیین کنید (مثلاً 1 گرم = 0.001 کیلوگرم یا 1 کارتن تخم‌مرغ = 30 عدد).
        پس از تعریف تبدیل، در ورود کالا به انبار و رسپی می‌توانید مقدار را با واحد دلخواه وارد کنید — برنامه خودکار به واحد اصلی ماده تبدیل می‌کند.
      </div>

      <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table class="w-full text-right text-xs">
          <thead class="bg-slate-50 font-black text-slate-700 border-b border-slate-200">
            <tr>
              <th class="p-3 w-16 text-center">ردیف</th>
              <th class="p-3">نام واحد اندازه‌گیری</th>
              <th class="p-3">تبدیل به واحد مبنا</th>
              <th class="p-3 text-center w-24">ویرایش</th>
              <th class="p-3 text-center w-20">حذف</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <EmptyRow v-if="store.units.length === 0" :col-span="5" text="واحدی تعریف نشده" />
            <template v-else>
              <tr v-for="u in store.units" :key="u.id" class="hover:bg-slate-50">
                <td class="p-3 text-center text-slate-500">{{ toFa(store.units.indexOf(u) + 1) }}</td>
                <td class="p-3 font-black text-slate-800">{{ u.name }}</td>
                <td class="p-3 text-slate-600">
                  <template v-if="convEdit === u.id">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="font-black whitespace-nowrap">1 {{ u.name }} =</span>
                      <input
                        v-model="convEditFactor"
                        dir="ltr"
                        inputmode="decimal"
                        class="w-24 border border-emerald-300 rounded-lg px-2 py-1 text-center font-black text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="ضریب"
                      />
                      <select v-model="convEditBase" :class="`${inputCls} w-40 text-xs py-1.5`">
                        <option value="">— بدون تبدیل —</option>
                        <option v-for="o in store.units.filter((x) => x.name !== u.name)" :key="o.id" :value="o.name">{{ o.name }}</option>
                      </select>
                      <button class="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black" @click="saveConv(u)">ذخیره</button>
                      <button class="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black" @click="cancelConv">لغو</button>
                    </div>
                  </template>
                  <template v-else>
                    <span :class="u.baseUnit ? 'font-black text-emerald-700' : 'text-slate-400'">{{ convChainText(u) }}</span>
                  </template>
                </td>
                <td class="p-3 text-center">
                  <button v-if="convEdit !== u.id" title="تعریف/ویرایش تبدیل" class="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition inline-block" @click="startConv(u)"><Edit3 class="w-4 h-4" /></button>
                </td>
                <td class="p-3 text-center">
                  <button v-if="u.baseUnit" title="حذف تبدیل" class="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition inline-block" @click="removeConv(u)"><Trash2 class="w-4 h-4" /></button>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ============ تب نرخ مالیات ============ -->
    <div v-else-if="tab === 'tax'" class="max-w-xl space-y-4">
      <div class="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <h3 class="font-black text-sm text-slate-800">تعریف نرخ مالیات بر ارزش افزوده</h3>
        <div class="flex items-center gap-3 max-w-xs">
          <NumberSpinner
            :model-value="String(store.taxRate)"
            :min="0"
            :max="100"
            :step="1"
            @update:model-value="setTaxRate"
          />
          <span class="text-sm font-black text-slate-700 shrink-0">درصد (٪)</span>
        </div>
        <p class="text-[11px] text-slate-500 leading-relaxed">
          مقدار را می‌توانید هم با صفحه‌کلید تایپ و هم با دکمه‌های + و − تنظیم کنید. (پیش‌فرض: ۱٪)
        </p>
        <div class="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-[11px] text-amber-900 space-y-1">
          <div class="font-black">نرخ فعال فعلی: {{ toFa(store.taxRate) }}٪</div>
          <div>نرخ صفر = فاکتور بدون مالیات</div>
        </div>
      </div>
    </div>

    <!-- ============ تب واحد پول ============ -->
    <div v-else-if="tab === 'currency'" class="max-w-xl space-y-4">
      <div class="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <h3 class="font-black text-sm text-slate-800">انتخاب واحد پول</h3>
        <p class="text-[11px] text-slate-500 leading-relaxed">
          واحد انتخابی در همه صفحات (فاکتور، انبار، سربار، گزارش‌ها و چاپ‌ها) جایگزین می‌شود.
        </p>
        <div class="grid grid-cols-2 gap-3">
          <button
            v-for="c in ['تومان', 'ریال']"
            :key="c"
            type="button"
            :class="`px-4 py-4 rounded-2xl border text-center transition ${currency === c
              ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/30'
              : 'border-slate-200 bg-white hover:bg-slate-50'
            }`"
            @click="pickCurrency(c)"
          >
            <div class="text-sm font-black text-slate-800">{{ c }}</div>
            <div v-if="currency === c" class="text-[10px] font-black text-emerald-700 mt-1">✓ انتخاب فعلی</div>
          </button>
        </div>
        <div class="bg-sky-50 border border-sky-200 rounded-2xl p-3.5 text-[11px] font-bold text-sky-900">
          نمونه نمایش: {{ sampleNumber }} {{ currency }}
        </div>
      </div>
    </div>

    <!-- ============ تب هزینه‌های سربار ============ -->
    <div v-else-if="tab === 'overheads'" class="space-y-6">
      <div class="bg-teal-50 border border-teal-200 rounded-2xl p-3.5 text-[11px] font-bold text-teal-900 leading-relaxed">
        هزینه‌های سربار ماهانه آشپزخانه (حقوق، بیمه، آب/برق/گاز و ...) برای محاسبه «قیمت تمام شده» غذاها استفاده می‌شوند:
        مجموع سربار تقسیم بر تعداد کل پرس‌های فاکتورشده ماه جاری، به‌عنوان سربار هر پرس لحاظ می‌شود. مبالغ به {{ currency }} است.
      </div>

      <form class="bg-white border border-slate-200 rounded-2xl p-5 space-y-4" @submit.prevent="oSubmit">
        <h3 class="font-black text-sm text-slate-800">{{ oEditId ? 'ویرایش هزینه سربار' : 'ثبت هزینه سربار جدید' }}</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">عنوان هزینه: <span class="text-rose-500">*</span></label>
            <input
              v-model="oF.name"
              required
              placeholder="مثلاً حقوق پرسنلی، بیمه، آب و برق و گاز..."
              :class="inputCls"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">مبلغ ماهانه: <span class="text-rose-500">*</span></label>
            <div class="flex items-center gap-2">
              <MoneyInput v-model="oF.amount" required :class="`${inputCls} text-center font-black`" />
              <span class="text-sm font-black text-slate-700 shrink-0">{{ currency }}</span>
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <button type="submit" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition">
            {{ oEditId ? 'ذخیره ویرایش' : 'ثبت هزینه' }}
          </button>
          <button v-if="oEditId" type="button" class="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition" @click="oCancel">انصراف</button>
        </div>
      </form>

      <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div class="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <h3 class="text-sm font-black text-slate-800">فهرست هزینه‌های سربار ماهانه</h3>
          <span class="text-xs font-black text-teal-800 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-xl">
            جمع کل ماهانه: {{ formatMoney(ohTotal) }} {{ currency }}
          </span>
        </div>
        <table class="w-full text-right text-xs">
          <thead class="bg-slate-50 font-black text-slate-700 border-b border-slate-200">
            <tr>
              <th class="p-3">#</th>
              <th class="p-3">عنوان هزینه</th>
              <th class="p-3 text-left">مبلغ ماهانه ({{ currency }})</th>
              <th class="p-3 text-center w-24">عملیات</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <EmptyRow v-if="store.overheads.length === 0" :col-span="4" text="هزینه‌ای ثبت نشده" />
            <template v-else>
              <tr v-for="(o, i) in store.overheads" :key="o.id" class="hover:bg-slate-50">
                <td class="p-3 text-slate-500">{{ toFa(i + 1) }}</td>
                <td class="p-3 font-black text-slate-800">{{ o.name }}</td>
                <td class="p-3 text-left font-black text-teal-700">{{ formatMoney(o.amount) }} {{ currency }}</td>
                <td class="p-3 text-center">
                  <div class="flex items-center justify-center gap-1">
                    <button class="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" @click="oEdit(o)"><Edit3 class="w-4 h-4" /></button>
                    <button title="حذف" class="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" @click="oDelete(o)"><Trash2 class="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ============ تب فونت برنامه و گزارش ============ -->
    <div v-else-if="tab === 'fonts'" class="space-y-6">
      <div class="bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="font-black text-sm text-slate-800">انتخاب فونت نرم‌افزار و گزارش‌ها</h3>
            <p class="text-[11px] text-slate-500 mt-1">
              فونت برنامه روی همه صفحات اعمال می‌شود؛ فونت گزارش‌ها هنگام چاپ فاکتور و گزارش‌ها استفاده می‌شود. انتخاب‌ها ذخیره می‌شوند و پس از رفرش باقی می‌مانند.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- فونت برنامه -->
          <div class="space-y-3">
            <label class="block text-xs font-black text-slate-700">فونت نرم‌افزار (تمام صفحات):</label>
            <div class="space-y-2">
              <button
                v-for="f in FONT_OPTIONS"
                :key="f.id"
                type="button"
                :class="`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-right transition ${appFont === f.id
                  ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/30'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
                }`"
                @click="setAppFont(f.id)"
              >
                <span class="flex items-center gap-2.5">
                  <span :class="`w-4 h-4 rounded-full border-2 flex items-center justify-center ${appFont === f.id ? 'border-emerald-600' : 'border-slate-300'}`">
                    <span v-if="appFont === f.id" class="w-2 h-2 rounded-full bg-emerald-600" />
                  </span>
                  <span class="text-xs font-bold text-slate-700">{{ f.label }}</span>
                </span>
                <span :style="{ fontFamily: `'${f.id}', Vazirmatn, sans-serif` }" class="text-xs text-slate-500">نمونه متن ۱۲۳</span>
              </button>
            </div>
          </div>

          <!-- فونت گزارش‌ها -->
          <div class="space-y-3">
            <label class="block text-xs font-black text-slate-700">فونت گزارش‌ها و فاکتور چاپی:</label>
            <div class="space-y-2">
              <button
                v-for="f in FONT_OPTIONS"
                :key="f.id"
                type="button"
                :print-font="f.id"
                :class="`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-right transition ${reportFont === f.id
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/30'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
                }`"
                @click="setReportFont(f.id)"
              >
                <span class="flex items-center gap-2.5">
                  <span :class="`w-4 h-4 rounded-full border-2 flex items-center justify-center ${reportFont === f.id ? 'border-blue-600' : 'border-slate-300'}`">
                    <span v-if="reportFont === f.id" class="w-2 h-2 rounded-full bg-blue-600" />
                  </span>
                  <span class="text-xs font-bold text-slate-700">{{ f.label }}</span>
                </span>
                <span :style="{ fontFamily: `'${f.id}', Vazirmatn, sans-serif` }" class="text-xs text-slate-500">نمونه متن ۱۲۳</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ============ تب تعریف کاربر ============ -->
    <div v-else-if="tab === 'users' && isAdmin" class="space-y-6">
      <form class="bg-white border border-slate-200 rounded-2xl p-5 space-y-4" @submit.prevent="uSubmit">
        <h3 class="font-black text-sm text-slate-800">{{ uEditId ? 'ویرایش کاربر' : 'تعریف کاربر جدید' }}</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">نام: <span class="text-rose-500">*</span></label>
            <input v-model="uF.firstName" required :class="inputCls" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">نام خانوادگی: <span class="text-rose-500">*</span></label>
            <input v-model="uF.lastName" required :class="inputCls" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">شماره موبایل:</label>
            <input v-model="uF.mobile" dir="ltr" placeholder="09xxxxxxxxx" :class="inputCls" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">شماره پرسنلی (نام کاربری ورود): <span class="text-rose-500">*</span></label>
            <input v-model="uF.personnelCode" required dir="ltr" placeholder="مثلاً 105" :class="`${inputCls} font-bold`" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">رمز عبور: <span class="text-rose-500">*</span></label>
            <input v-model="uF.password" required dir="ltr" type="password" :class="`${inputCls} font-bold`" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">نقش‌های کاربر:</label>
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 max-h-40 overflow-y-auto">
              <label v-for="r in roleOptions" :key="r.id" class="flex items-center gap-2 p-2 rounded-xl hover:bg-white cursor-pointer">
                <input
                  type="checkbox"
                  :checked="uF.roles?.includes(r.id)"
                  class="w-4 h-4 accent-emerald-600"
                  @change="uToggleRole(r.id, $event.target.checked)"
                />
                <span class="text-[11px] font-bold text-slate-700">{{ r.name }}</span>
              </label>
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <button type="submit" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition">
            {{ uEditId ? 'ذخیره ویرایش' : 'ثبت کاربر' }}
          </button>
          <button v-if="uEditId" type="button" class="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition" @click="uCancel">انصراف</button>
        </div>
      </form>

      <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table class="w-full text-right text-xs">
          <thead class="bg-slate-50 font-black text-slate-700 border-b border-slate-200">
            <tr>
              <th class="p-3">#</th>
              <th class="p-3">نام و نام‌خانوادگی</th>
              <th class="p-3">شماره پرسنلی (نام کاربری)</th>
              <th class="p-3">موبایل</th>
              <th class="p-3 text-center">سطح دسترسی</th>
              <th class="p-3 text-center w-24">عملیات</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <EmptyRow v-if="store.users.length === 0" :col-span="6" text="کاربر تعریف نشده" />
            <template v-else>
              <tr v-for="(u, i) in store.users" :key="u.id" class="hover:bg-slate-50">
                <td class="p-3 text-slate-500">{{ toFa(i + 1) }}</td>
                <td class="p-3 font-black text-slate-800">{{ u.firstName ? `${u.firstName} ${u.lastName}` : u.fullName }}</td>
                <td class="p-3 text-slate-600 font-mono" dir="ltr">{{ toFa(u.personnelCode || u.username) }}</td>
                <td class="p-3 text-slate-600" dir="ltr">{{ toFa(u.mobile || '-') }}</td>
                <td class="p-3 text-center">
                  <div class="flex items-center justify-center gap-1 flex-wrap">
                    <span
                      v-for="rid in (u.roles || [u.role || 'user'])"
                      :key="rid"
                      :class="`px-2 py-0.5 rounded-full text-[10px] font-black ${rid === 'admin' ? 'bg-purple-100 text-purple-800'
                        : rid === 'manager' ? 'bg-blue-100 text-blue-800'
                        : rid === 'chef' ? 'bg-orange-100 text-orange-800'
                        : rid === 'storekeeper' ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-700'
                      }`"
                    >
                      {{ (roleOf(rid) || {}).name || rid }}
                    </span>
                  </div>
                </td>
                <td class="p-3 text-center">
                  <div class="flex items-center justify-center gap-1">
                    <button class="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" @click="uEdit(u)"><Edit3 class="w-4 h-4" /></button>
                    <button class="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" @click="uDelete(u)"><Trash2 class="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
    <div v-else-if="tab === 'users'" class="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-center gap-3">
      <Lock class="w-5 h-5 text-amber-600 shrink-0" />
      <p class="text-xs font-bold text-amber-800">
        مشاهده و تعریف کاربران فقط توسط <strong>کاربر ادمین</strong> مجاز است.
      </p>
    </div>

    <!-- ============ تب تعریف نقش و مجوزها ============ -->
    <div v-else-if="tab === 'roles' && isAdmin" class="space-y-6">
      <!-- فرم تعریف/ویرایش نقش -->
      <form class="bg-white border border-slate-200 rounded-2xl p-5 space-y-4" @submit.prevent="roleSubmit">
        <div class="flex items-center justify-between">
          <h3 class="font-black text-sm text-slate-800">{{ roleEditId ? `ویرایش نقش «${editingRoleName}»` : 'تعریف نقش جدید' }}</h3>
          <button
            v-if="!roleF"
            type="button"
            class="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition"
            @click="startNewRole"
          >
            <Plus class="w-4 h-4" /> نقش جدید
          </button>
        </div>

        <template v-if="roleF">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5">نام نقش: <span class="text-rose-500">*</span></label>
              <input v-model="roleF.name" placeholder="مثلاً: انباردار" :class="inputCls" />
            </div>
          </div>

          <!-- ماتریس مجوزها -->
          <div class="space-y-3">
            <div class="text-xs font-black text-slate-700">مجوزهای نقش:</div>
            <div v-for="g in permGroups" :key="g" class="border border-slate-200 rounded-2xl p-3.5 space-y-2">
              <div class="text-[10px] font-black text-slate-500 uppercase">{{ g }}</div>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <label v-for="p in PERMISSIONS.filter((p) => p.group === g)" :key="p.key" class="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" :checked="!!roleF.permissions[p.key]" class="w-4 h-4 accent-emerald-600" @change="togglePerm(p.key)" />
                  <span class="text-[11px] font-bold text-slate-700">{{ p.label }}</span>
                </label>
              </div>
            </div>
          </div>

          <div class="flex gap-2">
            <button type="submit" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition">
              {{ roleEditId ? 'ذخیره ویرایش' : 'ثبت نقش' }}
            </button>
            <button type="button" class="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition" @click="resetRole">انصراف</button>
          </div>
        </template>
      </form>

      <!-- جدول نقش‌ها -->
      <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table class="w-full text-right text-xs">
          <thead class="bg-slate-50 font-black text-slate-700 border-b border-slate-200">
            <tr>
              <th class="p-3">#</th>
              <th class="p-3">نام نقش</th>
              <th class="p-3 text-center">تعداد مجوز</th>
              <th class="p-3 text-center">کاربران دارای این نقش</th>
              <th class="p-3 text-center w-24">عملیات</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="(r, i) in store.roles" :key="r.id" class="hover:bg-slate-50">
              <td class="p-3 text-slate-500">{{ toFa(i + 1) }}</td>
              <td class="p-3 font-black text-slate-800">
                {{ r.name }}
                <span v-if="r.system" class="mr-2 px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-100 text-purple-700">سیستمی</span>
              </td>
              <td class="p-3 text-center">
                <span class="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-black">{{ toFa(permCount(r)) }} از {{ toFa(PERMISSIONS.length) }}</span>
              </td>
              <td class="p-3 text-center text-slate-600">{{ toFa(store.users.filter((u) => (u.roles || [u.role]).includes(r.id)).length) }} کاربر</td>
              <td class="p-3 text-center">
                <div class="flex items-center justify-center gap-1">
                  <button class="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" @click="startEditRole(r)"><Edit3 class="w-4 h-4" /></button>
                  <button class="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" @click="roleRequestDelete(r)"><Trash2 class="w-4 h-4" /></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div v-else-if="tab === 'roles'" class="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-center gap-3">
      <Lock class="w-5 h-5 text-amber-600 shrink-0" />
      <p class="text-xs font-bold text-amber-800">
        تعریف و ویرایش نقش‌ها فقط توسط <strong>کاربر ادمین</strong> مجاز است.
      </p>
    </div>

    <!-- مودال تأیید حذف -->
    <div v-if="confirmDel" class="fixed inset-0 z-[96] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 no-print">
      <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-rose-100">
        <div class="flex items-center gap-3 mb-4">
          <div class="p-3 bg-rose-100 text-rose-600 rounded-2xl">
            <AlertTriangle class="w-6 h-6" />
          </div>
          <h3 class="font-black text-slate-900 text-sm">تأیید حذف</h3>
        </div>
        <p class="text-xs text-slate-700 leading-relaxed mb-5">
          آیا از حذف <strong>{{ CONFIRM_LABELS[confirmDel.type](confirmDel.item) }}</strong> مطمئن هستید؟ این عملیات بازگشت‌پذیر نیست.
        </p>
        <div class="flex items-center gap-2">
          <button class="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition" @click="executeDelete">
            بله، حذف کن
          </button>
          <button class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition" @click="confirmDel = null">
            انصراف
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
