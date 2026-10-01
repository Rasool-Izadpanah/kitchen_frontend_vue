// استور سراسری برنامه — معادل stateهای App.jsx در نسخه React
// همه داده‌ها در localStorage ذخیره می‌شوند (کلیدها با نسخه React یکی است
// تا داده‌های موجود کاربر از دست نرود).
import { defineStore } from 'pinia';
import { safeStorage } from '../lib/utils.js';
import {
  INITIAL_USERS, INITIAL_UNITS, INITIAL_CUSTOMERS, INITIAL_DISHES,
  INITIAL_INGREDIENTS, INITIAL_RECIPES, INITIAL_STOCK_MOVES, INITIAL_INVOICES,
  INITIAL_SETTINGS, INITIAL_SUPPLIES, INITIAL_OVERHEADS, INITIAL_ROLES,
} from '../lib/seed.js';

// نقش‌های ذخیره‌شده را با نسخه فعلی seed ادغام می‌کند تا کلیدهای مجوز
// تازه‌اضافه‌شده مقدار پیش‌فرض بگیرند (وگرنه can() بی‌صدا false برمی‌گرداند)
function mergeRoles(stored) {
  return stored.map((r) => {
    const fresh = INITIAL_ROLES.find((x) => x.id === r.id);
    if (!fresh) return r;
    return { ...fresh, ...r, permissions: { ...fresh.permissions, ...(r.permissions || {}) } };
  });
}

export const useAppStore = defineStore('app', {
  state: () => ({
    // احراز هویت
    currentUser: safeStorage.get('kitchen_currentUser', null),
    users: safeStorage.get('kitchen_users', INITIAL_USERS),
    roles: mergeRoles(safeStorage.get('kitchen_roles', INITIAL_ROLES)),

    // داده‌ها
    customers: safeStorage.get('kitchen_customers', INITIAL_CUSTOMERS),
    dishes: safeStorage.get('kitchen_dishes', INITIAL_DISHES),
    ingredients: safeStorage.get('kitchen_ingredients', INITIAL_INGREDIENTS),
    recipes: safeStorage.get('kitchen_recipes', INITIAL_RECIPES),
    units: safeStorage.get('kitchen_units', INITIAL_UNITS),
    invoices: safeStorage.get('kitchen_invoices', INITIAL_INVOICES),
    moves: safeStorage.get('kitchen_moves', INITIAL_STOCK_MOVES),
    settings: safeStorage.get('kitchen_settings', INITIAL_SETTINGS),
    supplies: safeStorage.get('kitchen_supplies', INITIAL_SUPPLIES),
    plans: safeStorage.get('kitchen_plans', []),
    overheads: safeStorage.get('kitchen_overheads', INITIAL_OVERHEADS),
    preinvoices: safeStorage.get('kitchen_preinvoices', []),
    purchaseRequests: safeStorage.get('kitchen_purchase_requests', []),
    stockRequests: safeStorage.get('kitchen_stock_requests', []),
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
    taxRate: (s) => s.settings.taxRate,
    currency: (s) => s.settings.currency || 'تومان',
    printState: (s) => ({
      paperSize: s.paperSize,
      setPaperSize: (v) => { s.paperSize = v; },
      copies: s.copies,
      setCopies: (v) => { s.copies = v; },
      fontFamily: s.settings.reportFont || 'Vazirmatn',
    }),

    // ===== کنترل دسترسی بر اساس نقش‌های کاربر (پشتیبانی از چند نقش) =====
    userRoles(state) {
      const cur = state.currentUser;
      if (!cur) return [];
      const ids = (cur.roles || [cur.role]).filter(Boolean);
      return state.roles.filter((r) => ids.includes(r.id));
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

// ===== ذخیره‌سازی خودکار: هر تغییر state در localStorage نوشته می‌شود =====
const PERSIST = [
  'users', 'roles', 'customers', 'dishes', 'ingredients', 'recipes', 'units',
  'invoices', 'moves', 'settings', 'supplies', 'plans', 'overheads',
  'preinvoices', 'purchaseRequests', 'stockRequests', 'messages',
];
const KEY_MAP = {
  users: 'kitchen_users', roles: 'kitchen_roles', customers: 'kitchen_customers',
  dishes: 'kitchen_dishes', ingredients: 'kitchen_ingredients', recipes: 'kitchen_recipes',
  units: 'kitchen_units', invoices: 'kitchen_invoices', moves: 'kitchen_moves',
  settings: 'kitchen_settings', supplies: 'kitchen_supplies', plans: 'kitchen_plans',
  overheads: 'kitchen_overheads', preinvoices: 'kitchen_preinvoices',
  purchaseRequests: 'kitchen_purchase_requests', stockRequests: 'kitchen_stock_requests',
  messages: 'kitchen_messages',
};

export function setupPersistence(store) {
  store.$subscribe(() => {
    PERSIST.forEach((key) => safeStorage.set(KEY_MAP[key], store[key]));
    if (store.currentUser) safeStorage.set('kitchen_currentUser', store.currentUser);
    else safeStorage.remove('kitchen_currentUser');
  }, { flush: 'sync' });
}
