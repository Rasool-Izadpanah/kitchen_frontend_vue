# راهنمای پورت React → Vue — مدیریت آشپزخانه نسیم

## وضعیت زیرساخت (کامل و تست‌شده)

| React | Vue | نکته |
|---|---|---|
| `src/main.jsx` | `src/main.js` | `createApp(App).use(pinia)` + `setupPersistence` |
| stateهای `App.jsx` | `src/stores/app.js` (Pinia) | همه stateها + `can()` + `navigate()` + toast |
| ۱۷ useEffect persist | `setupPersistence` با `$subscribe {flush:'sync'}` | **flush:sync الزامی** — بدون آن نوشتن به localStorage انجام نمی‌شود |
| `components/ui.jsx` | `src/components/ui/*.vue` + `inputCls.js` | FaNumberInput/MoneyInput/NumberSpinner/Toast/Field/EmptyRow/Modal |
| `SearchableSelect.jsx` | `components/SearchableSelect.vue` | v-model |
| `JalaliDatePicker.jsx` | `components/JalaliDatePicker.vue` | v-model |
| `PrintModal.jsx` | `components/PrintModal.vue` | slot بجای renderContent؛ **@page داینامیک با style-element در head** |
| `DualThermalPrintModal` | `components/DualThermalPrintModal.vue` | scoped-slot: `<template #default="{target}">` |
| `ExportButtons` (exportUtils.jsx) | `components/ExportButtons.vue` | منطق CSV/Excel/PDF عیناً منتقل شده |
| سایدبار (تابع داخل App.jsx) | `components/SidebarSection.vue` + `App.vue` | آکاردئون: `manualSection` ref در App.vue |
| LiveClock | `components/LiveClock.vue` | |
| `lib/utils.js`، `lib/seed.js` | همان فایل‌ها کپی شده | بدون تغییر — کلیدهای localStorage هم یکی (`kitchen_*`) |

## نگاشت React → Vue (برای پورت صفحه‌ها)

| React | Vue 3 `<script setup>` |
|---|---|
| `useState(x)` | `ref(x)` → در script: `.value`، در template بدون `.value` |
| `useMemo(() => f, [deps])` | `computed(() => f)` |
| `useEffect(() => f, [d])` | `watch(() => d, f)` یا `watchEffect` |
| `props.x` + render prop | prop + `<slot>` / scoped slot |
| `onChange={setX}` | `v-model` |
| `key={...}` برای remount | `:key` روی کامپوننت در App.vue (همین کار را می‌کند) |
| `className` | `class` (آرایه/شیء شرطی: `:class="[...]"` یا `:class="{...}"`) |
| `style={{width: ...}}` | `:style="{ width: ... }"` |
| `{cond && <div/>}` | `<div v-if="cond">` |
| `{arr.map(x => <tr/>)} ` | `<tr v-for="x in arr" :key="x.id">` |
| `onClick={f}` | `@click="f"` |
| فرم submit | `<form @submit.prevent="submit">` |
| `{`...`}` در JSX متن | `{{ expr }}` |

## قواعد این پورت (الزامات)

1. **صفحه‌ها props نمیشه مستقیم بگیرن از App** — همه از `useAppStore()` می‌خونن. فقط `showToast`، `userName`، `initialTab`، `showTabs` به‌صورت prop میاد (same shape as React).
2. **mutate روی استور آزاد است** (مزیت Pinia): `store.ingredients.splice(...)` یا `store.purchaseRequests = [...]` — reactive و persist می‌شود.
3. **تگ `<style>` داخل template ممنوع** — Vue کامپایل نمی‌شود. CSS چاپ یا در `index.css` است یا با `document.createElement('style')` در `setup` تزریق می‌شود (نمونه: PrintModal.vue برای @page داینامیک).
4. **lucide-vue-next** بجای lucide-react — همان اسم آیکون‌ها.
5. بعد از هر صفحه: `npm run build` + تست مرورگر آن صفحه. dev server پورت **۵۱۹۹** (React نسخه ۵۱۷۳ است — تداخل ندارند، می‌توانند همزمان بالا باشند).
6. کامپوننت‌های UI از `../components/ui/X.vue` ایمپورت می‌شوند؛ `inputCls` از `../components/ui/inputCls.js`.

## تست‌شده E2E (تا این لحظه)

- build پاس ✅ — `npm run build`
- لاگین admin/admin123 ✅ + ریلود → نشست می‌ماند ✅
- داشبورد: هر سه کاشی با اعداد درست از seed ✅
- سایدبار آکاردئونی + بردکرامب + هایلایت ✅
- ثبت درخواست خرید → استور Pinia → localStorage → لیست ✅ + ریلود → ماند ✅
- توست top-center ✅

## صفحه‌های باقی‌مانده (placeholder — «در حال پورت‌سازی»)

`InvoicePage` (+`InvoiceDocument` به‌صورت کامپوننت)، `PreInvoicePage`، `CartablePage`، `WarehousePage`، `ReportsPage`، `SettingsPage`، `DailyCookingPage`

منبع: `/home/rasool/my_project/kitchen/kitchen_frontend/src/pages/*.jsx` — مقصد: `src/pages/*.vue`
الگوی کامل یک صفحه پورت‌شده: `src/pages/PurchaseRequestPage.vue`
