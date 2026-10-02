<script setup>
/**
 * پوسته اصلی برنامه — معادل App.jsx
 * سایدبار: آکاردئونی، فیلتر بر اساس مجوز نقش، گروه‌بندی زیربخش‌ها
 * هدر: فریز (sticky)، راست = لوگو/نام آشپزخانه/بردکرامب، چپ = زنگ/تاریخ/ساعت/کاربر
 */
import { ref, computed, watch } from 'vue';
import {
  ChefHat, LogOut, AlertTriangle, Bell, ChevronDown, Clock3,
  UtensilsCrossed, LayoutDashboard, Calculator, Package, BarChart3, Tags, Sliders,
} from 'lucide-vue-next';
import { toFa, jalaliTodayString, faDatePretty, userDisplay } from './lib/utils.js';
import { useAppStore } from './stores/app.js';
import ToastVue from './components/ui/Toast.vue';
import SidebarSection from './components/SidebarSection.vue';
import LiveClock from './components/LiveClock.vue';
import Login from './pages/Login.vue';
import Dashboard from './pages/Dashboard.vue';
import InvoicePage from './pages/InvoicePage.vue';
import PreInvoicePage from './pages/PreInvoicePage.vue';
import CartablePage from './pages/CartablePage.vue';
import PurchaseRequestPage from './pages/PurchaseRequestPage.vue';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage.vue';
import WarehousePage from './pages/WarehousePage.vue';
import ReportsPage from './pages/ReportsPage.vue';
import SettingsPage from './pages/SettingsPage.vue';
import DailyCookingPage from './pages/DailyCookingPage.vue';

const store = useAppStore();

// ===== ساختار ساید‌بار (بر اساس مجوز نقش فیلتر می‌شود) =====
const SIDEBAR = [
  {
    id: 'cartable', label: 'کارتابل', icon: LayoutDashboard,
    children: [
      { id: 'dashboard', label: 'کارتابل جاری', page: 'cartable', perm: 'view_dashboard' },
    ],
  },
  {
    id: 'cookplan', label: 'برنامه پخت روزانه', icon: UtensilsCrossed,
    children: [
      { id: 'cook-register', label: 'ثبت برنامه پخت', page: 'dailycook', tab: 'register', perm: 'dailycook' },
    ],
  },
  {
    id: 'accounting', label: 'حسابداری', icon: Calculator,
    children: [
      { id: 'acc-preinvoice', label: 'صدور پیش‌فاکتور', page: 'preinvoice', tab: null, perm: 'create_invoice' },
      { id: 'acc-invoice', label: 'صدور فاکتور فروش', page: 'invoice', tab: 'sale', perm: 'create_invoice' },
      { id: 'acc-invoices', label: 'لیست فاکتورها', page: 'invoice', tab: 'list', perm: 'create_invoice' },
      { id: 'acc-pricing', label: 'فرم قیمت‌گذاری', page: 'reports', tab: 'cost', perm: 'view_reports' },
    ],
  },
  {
    id: 'warehouse', label: 'انبار', icon: Package,
    children: [
      { id: 'purchase-request', label: 'درخواست خرید کالا', page: 'purchasereq', perm: 'view_warehouse' },
      { id: 'purchase-orders', label: 'سفارش خرید و رسید (فاز ۲)', page: 'purchaseorders', perm: 'create_purchase_order' },
      { id: 'wh-out', label: 'خروج کالا از انبار', page: 'warehouse', tab: 'out', perm: 'view_warehouse' },
      { id: 'wh-balance', label: 'موجودی انبار', page: 'warehouse', tab: 'balance', perm: 'view_warehouse' },
      { id: 'wh-cardex', label: 'کاردکس کالا', page: 'warehouse', tab: 'cardex', perm: 'view_warehouse' },
    ],
  },
  {
    id: 'reports', label: 'گزارش‌ها', icon: BarChart3,
    children: [
      { id: 'rep-customer', label: 'صورتحساب مشتری', page: 'reports', tab: 'customer', perm: 'view_reports' },
      { id: 'rep-purchase', label: 'گزارش خرید', page: 'reports', tab: 'purchase', perm: 'view_reports' },
      { id: 'rep-sales', label: 'گزارش فروش', page: 'reports', tab: 'performance', perm: 'view_reports' },
      { id: 'rep-discounts', label: 'تخفیف‌های ارائه‌شده', page: 'reports', tab: 'discounts', perm: 'view_reports' },
      { id: 'rep-purchase-req', label: 'لیست درخواست‌های خرید', page: 'reports', tab: 'purchaseRequests', perm: 'view_reports' },
      { id: 'rep-purchase-mismatch', label: 'مغایرت‌های خرید', page: 'reports', tab: 'purchasemismatch', perm: 'view_reports' },
      { id: 'rep-threewaycost', label: 'بهای تمام‌شده سه‌لایه', page: 'reports', tab: 'threewaycost', perm: 'view_reports' },
      { id: 'rep-priceinflation', label: 'روند قیمت مواد', page: 'reports', tab: 'priceinflation', perm: 'view_reports' },
      { id: 'rep-costvariance', label: 'واریانس قیمت', page: 'reports', tab: 'costvariance', perm: 'view_reports' },
      { id: 'rep-inventoryvalue', label: 'ارزش انبار', page: 'reports', tab: 'inventoryvalue', perm: 'view_reports' },
      { id: 'rep-supplierdebt', label: 'بدهی تأمین‌کنندگان', page: 'reports', tab: 'supplierdebt', perm: 'view_reports' },
      { id: 'rep-variance', label: 'مصرف واقعی vs استاندارد', page: 'reports', tab: 'variance', perm: 'view_reports' },
      { id: 'rep-reservations', label: 'گزارش رزروها', page: 'reports', tab: 'reservations', perm: 'view_reports' },
      { id: 'rep-fifo', label: 'FIFO و انقضا', page: 'reports', tab: 'fifo', perm: 'view_reports' },
      { id: 'rep-suppliers', label: 'کارایی تأمین‌کنندگان', page: 'reports', tab: 'suppliers', perm: 'view_reports' },
      { id: 'rep-cookplans', label: 'گزارش برنامه‌های پخت', page: 'reports', tab: 'cookplans', perm: 'view_reports' },
    ],
  },
  {
    id: 'definitions', label: 'تعاریف', icon: Tags,
    children: [
      // ─── کلی ───
      { id: 'def-basic', label: 'تعاریف پایه', page: 'settings', tab: 'basicinfo', perm: 'manage_settings', group: 'کلی' },
      { id: 'def-overheads', label: 'هزینه‌های سربار', page: 'settings', tab: 'overheads', perm: 'manage_settings', group: 'کلی' },
      // ─── غذاها ───
      { id: 'def-ingredients', label: 'تعریف / ویرایش مواد غذایی', page: 'settings', tab: 'ingredients', perm: 'manage_ingredients', group: 'غذاها' },
      { id: 'def-supplies', label: 'تعریف / ویرایش اقلام', page: 'settings', tab: 'supplies', perm: 'manage_supplies', group: 'غذاها' },
      { id: 'def-dishes', label: 'تعریف / ویرایش انواع غذا', page: 'settings', tab: 'dishes', perm: 'manage_dishes', group: 'غذاها' },
      { id: 'def-recipes', label: 'تعریف / ویرایش رسپی', page: 'settings', tab: 'recipes', perm: 'manage_recipes', group: 'غذاها' },
      // ─── مشتریان و کاربران ───
      { id: 'def-customers', label: 'تعریف / ویرایش مشتریان', page: 'settings', tab: 'customers', perm: 'manage_customers', group: 'مشتریان و کاربران' },
      { id: 'def-users', label: 'تعریف / ویرایش کاربران', page: 'settings', tab: 'users', perm: 'edit_users', group: 'مشتریان و کاربران' },
      { id: 'def-roles', label: 'تعریف / ویرایش نقش‌ها', page: 'settings', tab: 'roles', perm: 'manage_roles', group: 'مشتریان و کاربران' },
    ],
  },
  {
    id: 'config', label: 'تنظیمات', icon: Sliders,
    children: [
      { id: 'cfg-units', label: 'واحد اندازه‌گیری و تبدیل', page: 'settings', tab: 'units', perm: 'manage_settings' },
      { id: 'cfg-tax', label: 'تنظیم نرخ مالیات', page: 'settings', tab: 'tax', perm: 'manage_settings' },
      { id: 'cfg-fonts', label: 'تنظیم فونت', page: 'settings', tab: 'fonts', perm: 'manage_settings' },
      { id: 'cfg-all', label: 'همه تنظیمات', page: 'settings', tab: null, perm: 'manage_settings' },
    ],
  },
];

// مجوز مورد نیاز هر صفحه از زیربخش‌های ساید‌بار استخراج می‌شود
const pagePerm = {};
SIDEBAR.forEach((s) => s.children.forEach((c) => { pagePerm[c.page] = c.perm; }));
const allowedPages = (pid) => pagePerm[pid] || 'view_dashboard';

// بخش‌های قابل نمایش بر اساس مجوز
const visibleSections = computed(() =>
  SIDEBAR
    .map((s) => ({ ...s, children: s.children.filter((c) => store.can(c.perm)) }))
    .filter((s) => s.children.length > 0)
);

// کلید زیربخش فعال (برای هایلایت دقیق)
const activeTabFor = computed(() => ({
  settings: store.settingsTab, reports: store.reportsTab,
  warehouse: store.warehouseTab, invoice: store.invoiceTab,
}));

const activeSidebarKey = computed(() => {
  for (const s of SIDEBAR) {
    for (const c of s.children) {
      if (c.page !== store.page) continue;
      const wantTab = activeTabFor.value[c.page];
      if (wantTab && c.tab && wantTab !== c.tab) continue;
      return c.id;
    }
  }
  return null;
});

const activeSectionLabel = computed(() => {
  for (const s of SIDEBAR) {
    for (const c of s.children) {
      if (c.id === activeSidebarKey.value) return `${s.label} ← ${c.label}`;
    }
  }
  return store.page === 'dashboard' ? 'کارتابل' : '';
});

const unreadCount = computed(() =>
  store.messages.filter((m) => m.to === store.currentUser?.fullName && !m.read).length
);

const today = jalaliTodayString();

// ===== آکاردئون ساید‌بار: فقط یک بخش باز؛ manualSection=null یعنی دنبال صفحه فعال برو =====
const manualSection = ref(null);
const activeSectionId = computed(() => {
  const found = visibleSections.value.find((s) => s.children.some((c) => c.page === store.page));
  return found?.id || null;
});
const expandedId = computed(() => (manualSection.value !== null ? manualSection.value : activeSectionId.value));
const toggleSection = (id) => { manualSection.value = manualSection.value === id ? null : id; };
</script>

<template>
  <!-- صفحه ورود -->
  <div
    v-if="!store.currentUser"
    dir="rtl"
    class="min-h-screen bg-slate-100"
    :style="{ fontFamily: `'${store.settings.appFont || 'Vazirmatn'}', 'Vazirmatn', ui-sans-serif, system-ui` }"
  >
    <Login :users="store.users" @login="store.login" />
    <ToastVue :toast="store.toast" />
  </div>

  <!-- پوسته اصلی -->
  <div
    v-else
    dir="rtl"
    class="h-screen bg-slate-100 text-slate-800 antialiased flex flex-col overflow-hidden"
    :style="{ fontFamily: `'${store.settings.appFont || 'Vazirmatn'}', 'Vazirmatn', ui-sans-serif, system-ui` }"
  >


    <ToastVue :toast="store.toast" />

    <!-- نوار عنوان: راست=نام آشپزخانه و وابسته به... | چپ=تاریخ/ساعت/کاربر جاری -->
    <header class="bg-white border-b border-slate-200 sticky top-0 z-40 no-print shadow-sm">
      <div class="flex items-center justify-between h-14 px-4 sm:px-6 gap-4">
        <div class="flex items-center gap-3 min-w-0">
          <button
            type="button"
            title="رفتن به داشبورد"
            class="flex items-center gap-2.5 min-w-0 group cursor-pointer bg-transparent border-0 p-0 text-right focus:outline-none"
            @click="store.goHome()"
          >
            <div class="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0 group-hover:scale-105 group-active:scale-95 transition">
              <ChefHat class="w-5 h-5" />
            </div>
            <div class="min-w-0 text-right">
              <h1 class="text-sm font-black text-slate-900 truncate group-hover:text-emerald-700 transition">{{ store.settings.kitchenName || 'آشپزخانه نسیم' }}</h1>
              <p v-if="store.settings.charityName" class="text-[10px] text-slate-500 font-medium truncate">وابسته به {{ store.settings.charityName }}</p>
            </div>
          </button>
          <span class="text-slate-300 font-bold">/</span>
          <span class="text-xs font-black text-emerald-700 truncate">{{ activeSectionLabel }}</span>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          <button
            title="پیام‌های سیستم / کارتابل"
            class="relative p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition"
            @click="store.navigate('cartable', null)"
          >
            <Bell class="w-4.5 h-4.5" />
            <span
              v-if="unreadCount > 0"
              class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center"
            >{{ toFa(unreadCount) }}</span>
          </button>
          <span class="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <Clock3 class="w-3.5 h-3.5 text-slate-400" />
            {{ faDatePretty(today) }} · <LiveClock />
          </span>
          <div class="hidden md:flex flex-col items-end leading-tight">
            <span class="text-[11px] font-bold text-slate-500">کاربر فعلی:</span>
            <span class="text-[11px] font-black text-slate-800">{{ userDisplay(store.currentUser) }}</span>
            <span class="text-[9px] font-bold text-slate-500">{{ store.roleNames || (store.currentUser.role === 'admin' ? 'ادمین' : 'کاربر') }}</span>
          </div>
        </div>
      </div>
    </header>

    <!-- محتوا -->
    <div class="flex flex-1 min-h-0">
      <!-- ساید‌بار سمت راست -->
      <aside
        v-if="store.sidebarOpen"
        class="w-60 shrink-0 bg-white border-l border-slate-200 flex flex-col no-print overflow-y-auto"
      >
        <nav class="flex-1 p-3 space-y-1">
          <div v-for="s in visibleSections" :key="s.id">
            <SidebarSection
              :section="s"
              :page="store.page"
              :active-key="activeSidebarKey"
              :expanded="expandedId === s.id"
              @toggle="toggleSection"
              @navigate="(p, t) => store.navigate(p, t)"
            />
          </div>
        </nav>

        <div class="p-3 border-t border-slate-100 space-y-2">
          <button
            class="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-black text-rose-600 hover:bg-rose-50 transition"
            @click="store.logout()"
          >
            <LogOut class="w-4 h-4" /> خروج از حساب
          </button>
          <div class="text-[10px] text-slate-400 font-bold text-center">
            سامانه مدیریت آشپزخانه نسیم
          </div>
        </div>
      </aside>

      <main class="flex-1 min-w-0 overflow-y-auto px-4 sm:px-6 py-6">
        <!-- عدم دسترسی -->
        <div v-if="!store.can(allowedPages(store.page))" class="bg-amber-50 border border-amber-200 rounded-3xl p-10 flex flex-col items-center gap-3 text-center">
          <AlertTriangle class="w-10 h-10 text-amber-500" />
          <h3 class="font-black text-amber-900 text-sm">دسترسی مجاز نیست</h3>
          <p class="text-xs text-amber-800 font-bold">
            نقش‌های شما ({{ store.roleNames || '—' }}) مجوز دسترسی به این بخش را ندارند.
            <br />
            از مدیر سیستم بخواهید مجوز مربوطه را در تنظیمات ← تعریف نقش فعال کند.
          </p>
          <button class="mt-2 px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition" @click="store.page = 'dashboard'">
            بازگشت به داشبورد
          </button>
        </div>

        <template v-else>
          <PurchaseRequestPage
            v-if="store.page === 'purchasereq'"
            :show-toast="store.showToast"
            :user-name="userDisplay(store.currentUser)"
          />
          <PurchaseOrdersPage
            v-if="store.page === 'purchaseorders'"
            :show-toast="store.showToast"
            :user-name="userDisplay(store.currentUser)"
          />
          <CartablePage v-if="store.page === 'cartable'" :show-toast="store.showToast" :user-name="userDisplay(store.currentUser)" />
          <Dashboard v-if="store.page === 'dashboard'" />
          <PreInvoicePage v-if="store.page === 'preinvoice'" :show-toast="store.showToast" :user-name="userDisplay(store.currentUser)" />
          <InvoicePage v-if="store.page === 'invoice'" :key="store.invoiceTab || 'all'" :show-toast="store.showToast" :user-name="userDisplay(store.currentUser)" :initial-tab="store.invoiceTab === 'list' ? 'list' : null" :list-only="store.invoiceTab === 'list'" />
          <WarehousePage v-if="store.page === 'warehouse'" :key="store.warehouseTab || 'all'" :show-toast="store.showToast" :user-name="userDisplay(store.currentUser)" :initial-tab="store.warehouseTab" :show-tabs="!store.warehouseTab" />
          <DailyCookingPage v-if="store.page === 'dailycook'" :key="store.dailycookTab || 'all'" :show-toast="store.showToast" :user-name="userDisplay(store.currentUser)" :initial-tab="store.dailycookTab" :show-tabs="!store.dailycookTab" />
          <ReportsPage v-if="store.page === 'reports'" :key="store.reportsTab || 'all'" :show-toast="store.showToast" :user-name="userDisplay(store.currentUser)" :initial-tab="store.reportsTab" :show-tabs="!store.reportsTab" />
          <SettingsPage v-if="store.page === 'settings'" :key="store.settingsTab || 'all'" :show-toast="store.showToast" :user-name="userDisplay(store.currentUser)" :initial-tab="store.settingsTab" :show-tabs="!store.settingsTab" />
        </template>
      </main>
    </div>
  </div>
</template>
