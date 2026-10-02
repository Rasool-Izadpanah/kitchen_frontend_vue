# راهنمای مهاجرت به بک‌اند (فاز ۴)

معماری فعلی طوری طراحی شده که اتصال بک‌اند NestJS فقط با تغییر **یک فایل** انجام شود.

## ساختار فعلی

```
src/
  api/index.js          ← لایه API (نقطه اتصال بک‌اند)
  stores/
    app.js              ← ناوبری، احراز هویت، toast + mirror داده‌های دامنه
    inventory.js        ← ingredients, supplies, moves
    purchasing.js       ← suppliers, purchaseRequests, stockRequests, PO, GRN, فاکتور خرید
    production.js       ← plans, recipes, dishes
    settings.js         ← settings, roles, units, rejectionReasons, overheads
    migrate.js          ← مهاجرت داده‌های قدیمی
  lib/                  ← منطق کسب‌وکار خالص (inventory, purchasing, analytics, units)
```

## مهاجرت به بک‌اند — ۳ قدم

### ۱. تنظیم API_BASE
در `src/api/index.js`:
```js
export const API_BASE = 'http://localhost:3015'; // بک‌اند NestJS
```
همه متدهای `api.*` خودکار به `fetch(API_BASE/api/...)` سوئیچ می‌شوند.

### ۲. Endpointهای موردنیاز بک‌اند (قرارداد REST)

| متد | HTTP | مسیر |
|-----|------|------|
| `list(key)` | GET | `/api/{key}` |
| `get(key, id)` | GET | `/api/{key}/{id}` |
| `create(key, rec)` | POST | `/api/{key}` |
| `update(key, id, patch)` | PATCH | `/api/{key}/{id}` |
| `remove(key, id)` | DELETE | `/api/{key}/{id}` |
| `replaceAll(key, recs)` | PUT | `/api/{key}` |
| `getSingle('settings')` | GET | `/api/single/settings` |
| `login(creds)` | POST | `/api/auth/login` |

مقدار `key` همان نام منبع است: `ingredients`, `supplies`, `moves`, `plans`,
`recipes`, `dishes`, `suppliers`, `purchaseRequests`, `stockRequests`,
`purchaseOrders`, `goodsReceipts`, `purchaseInvoices`, `roles`, `units`,
`rejectionReasons`, `overheads`, `customers`, `invoices`, `preinvoices`, `messages`.

### ۳. استقرار state آفلاین → سرور
اولین اجرا بعد از اتصال: داده‌های localStorage با یک اسکریپت one-shot به بک‌اند POST شوند:
```js
import { api } from './api/index.js';
const KEYS = ['ingredients', 'supplies', 'moves', ...];
for (const k of KEYS) await api.replaceAll(k, safeStorage.get('kitchen_' + k, []));
```

## قواعد پایدار
- **منطق کسب‌وکار** (رزرو، تطبیق سه‌طرفه، تبدیل واحد) در `lib/` می‌ماند — مستقل از منبع داده.
- **هیچ کامپوننتی** مستقیم به localStorage دسترسی ندارد — همه از storeها.
- **تغییر موجودی** فقط از طریق moves و توابع `lib/inventory.js`.
- کلیدهای localStorage با پیشوند `kitchen_` حفظ شده تا داده کاربر در طول مهاجرت سالم بماند.
