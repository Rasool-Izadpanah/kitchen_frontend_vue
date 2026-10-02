// استور اصلی برنامه (فاز ۴) — ناوبری، احراز هویت، Toast
// داده‌های دامنه (انبار/خرید/تولید/تنظیمات) به استورهای تخصصی منتقل شده‌اند:
//   stores/inventory.js  → ingredients, supplies, moves
//   stores/purchasing.js → suppliers, purchaseRequests, stockRequests, purchaseOrders, goodsReceipts, purchaseInvoices
//   stores/production.js → plans, recipes, dishes
//   stores/settings.js   → settings, roles, units, rejectionReasons, overheads
//
// سازگاری: app.js همچنان همان کلیدهای state دامنه را expose می‌کند (شیشه‌ای/تجمیعی)
// تا ۸ صفحه و lib/* بدون تغییر کار کنند. زیر استورها با subscribe دوطرفه همگام می‌مانند.
// کاربران/مشتریان/فاکتورها/پیام‌ها (داده‌های عملیاتی عمومی) در همین استور می‌مانند.
import { defineStore } from 'pinia';
import { safeStorage } from '../lib/utils.js';
import {
  INITIAL_USERS, INITIAL_CUSTOMERS, INITIAL_INVOICES,
} from '../lib/seed.js';
import { api } from '../api/index.js';
import { migrateData } from './migrate.js';
import { useInventoryStore } from './inventory.js';
import { usePurchasingStore } from './purchasing.js';
import { useProductionStore } from './production.js';
import { useSettingsStore } from './settings.js';

export { migrateData };

export const useAppStore = defineStore('app', {
  state: () => ({
    // احراز هویت
    currentUser: safeStorage.get('kitchen_currentUser', null),
    users: safeStorage.get('kitchen_users', INITIAL_USERS),

    // داده‌های عملیاتی عمومی
    customers: safeStorage.get('kitchen_customers', INITIAL_CUSTOMERS),
    invoices: safeStorage.get('kitchen_invoices', INITIAL_INVOICES),
    preinvoices: safeStorage.get('kitchen_preinvoices', []),
    messages: safeStorage.get('kitchen_messages', []),

    // ناوبری
    page: 'dashboard',
    settingsTab: null,
    reportsTab: null,
    invoiceTab: null,
    dailycookTab: null,
    warehouseTab: null,
    sidebarOpen: true,

    // وضعیت چاپ سراسری
    paperSize: 'A4',
    copies: 1,

    // توست
    toast: null,
    _toastTimer: null,
  }),

  getters: {
    // ===== سازگاری: getterهای دامنه از localStorage (استور تنظیمات منبع حقیقت) =====
    taxRate() { return Number(safeStorage.get('kitchen_settings', {}).taxRate) || 0; },
    currency() { return safeStorage.get('kitchen_settings', {}).currency || 'تومان'; },
    // printState: settings از استور تنظیمات خوانده می‌شود
    printState(state) {
      const cfg = safeStorage.get('kitchen_settings', {});
      return {
        paperSize: state.paperSize,
        setPaperSize: (v) => { state.paperSize = v; },
        copies: state.copies,
        setCopies: (v) => { state.copies = v; },
        fontFamily: cfg.reportFont || 'Vazirmatn',
      };
    },

    // ===== کنترل دسترسی بر اساس نقش‌های کاربر (پشتیبانی از چند نقش) =====
    userRoles(state) {
      const cur = state.currentUser;
      if (!cur) return [];
      const ids = (cur.roles || [cur.role]).filter(Boolean);
      const roles = safeStorage.get('kitchen_roles', []);
      return roles.filter((r) => ids.includes(r.id));
    },
    roleNames() { return this.userRoles.map((r) => r.name).join('، '); },
  },

  actions: {
    can(perm) {
      const cur = this.currentUser;
      if (!cur) return false;
      if (cur.roles?.includes('admin') || cur.role === 'admin') return true;
      return this.userRoles.some((r) => r.permissions?.[perm]);
    },

    navigate(target, tab = undefined) {
      this.page = target;
      if (!tab) {
        this.settingsTab = null; this.warehouseTab = null; this.reportsTab = null;
        this.invoiceTab = null; this.dailycookTab = null;
      }
      if (target === 'settings' && tab) this.settingsTab = tab;
      if (target === 'warehouse' && tab) this.warehouseTab = tab;
      if (target === 'reports' && tab) this.reportsTab = tab;
      if (target === 'dailycook' && tab) this.dailycookTab = tab;
      if (target === 'invoice' && tab) this.invoiceTab = tab;
      window.scrollTo({ top: 0 });
    },
    goHome() {
      this.page = 'dashboard';
      this.settingsTab = null; this.reportsTab = null; this.invoiceTab = null;
      this.dailycookTab = null; this.warehouseTab = null;
    },

    showToast(message, type = 'success') {
      if (this._toastTimer) clearTimeout(this._toastTimer);
      this.toast = { message, type };
      this._toastTimer = setTimeout(() => { this.toast = null; }, 3200);
    },

    login(user) {
      this.currentUser = user;
      this.showToast(`خوش آمدید ${user.fullName}`);
    },
    logout() {
      this.currentUser = null;
      this.showToast('خارج شدید');
    },
  },
});

// ===== ذخیره‌سازی و اتصال استورها =====
// PERSIST_STATE: stateهای خود app (عمومی)
const PERSIST_APP = [
  'users', 'customers', 'invoices', 'preinvoices', 'messages',
];
const KEY_MAP = {
  users: 'kitchen_users', customers: 'kitchen_customers',
  invoices: 'kitchen_invoices', preinvoices: 'kitchen_preinvoices',
  messages: 'kitchen_messages',
};

/**
 * اتصال استورهای دامنه + سازگاری دوطرفه.
 * هر استور تخصصی منبع حقیقت داده خودش است؛ app.js آن‌ها را به‌صورت computed-like
 * روی خودش mirror می‌کند تا کد موجود (store.ingredients و ...) بدون تغییر کار کند.
 */
export function setupPersistence(store) {
  const pinia = store.$pinia;
  const inv = useInventoryStore(pinia);
  const pur = usePurchasingStore(pinia);
  const prod = useProductionStore(pinia);
  const cfg = useSettingsStore(pinia);

  // --- مهاجرت داده‌های موجود (یک‌بار در شروع) ---
  const migrated = migrateData({
    ingredients: inv.ingredients,
    supplies: inv.supplies,
    moves: inv.moves,
    plans: prod.plans,
    purchaseRequests: pur.purchaseRequests,
    stockRequests: pur.stockRequests,
    settings: cfg.settings,
  });
  inv.ingredients = migrated.ingredients;
  inv.supplies = migrated.supplies;
  inv.moves = migrated.moves;
  prod.plans = migrated.plans;
  pur.purchaseRequests = migrated.purchaseRequests;
  pur.stockRequests = migrated.stockRequests;
  cfg.settings = migrated.settings;

  // --- Mirror: app.js همان کلیدهای دامنه را از استورهای تخصصی expose می‌کند ---
  // با $subscribe روی استورهای دامنه، مقادیر داخل app state کپی می‌شوند (یک‌راه، دامنه → app).
  // نوشتن از صفحات روی store.ingredients = [...] ابتدا app state را تغییر می‌دهد؛
  // subscribe پایین همان تغییر را به استور تخصصی برمی‌گرداند (دو‌طرفه، بدون حلقه).
  const mirror = {
    ingredients: () => inv, supplies: () => inv, moves: () => inv,
    suppliers: () => pur, purchaseRequests: () => pur, stockRequests: () => pur,
    purchaseOrders: () => pur, goodsReceipts: () => pur, purchaseInvoices: () => pur,
    plans: () => prod, recipes: () => prod, dishes: () => prod,
    settings: () => cfg, roles: () => cfg, units: () => cfg,
    rejectionReasons: () => cfg, overheads: () => cfg,
  };
  Object.keys(mirror).forEach((key) => {
    // مقدار اولیه از استور تخصصی → app (برای رندر اولیه)
    store[key] = mirror[key]()[key];
  });

  // نوشتن روی app → استور تخصصی + ذخیره
  store.$subscribe(async (_mutation, state) => {
    // عمومی
    PERSIST_APP.forEach((key) => safeStorage.set(KEY_MAP[key], state[key]));
    if (state.currentUser) safeStorage.set('kitchen_currentUser', state.currentUser);
    else safeStorage.remove('kitchen_currentUser');

    // دامنه: اگر مقدار app با استور تخصصی فرق دارد → انتقال به استور تخصصی
    for (const [key, ownerFn] of Object.entries(mirror)) {
      const owner = ownerFn();
      if (state[key] !== owner[key]) owner[key] = state[key];
    }
    // ذخیره‌سازی دامنه (localStorage — همان کلیدهای قبلی)
    inv.persistIngredients(); inv.persistSupplies(); inv.persistMoves();
    pur.persistAll();
    prod.persistAll();
    cfg.persistAll();
  }, { flush: 'sync' });

  // --- کنترل انقضای رزروها: در شروع و هر ۶۰ ثانیه ---
  const runTimeoutCheck = () => {
    import('../lib/inventory.js').then(({ checkExpiredReservations }) => {
      const n = checkExpiredReservations(store);
      if (n > 0) store.showToast(`${n} رزرو منقضی شده خودکار آزاد شد`, 'info');
    });
  };
  runTimeoutCheck();
  setInterval(runTimeoutCheck, 60_000);
}
