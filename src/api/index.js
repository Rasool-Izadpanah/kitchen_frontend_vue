/**
 * لایه API (فاز ۴) — پوشش داده‌ای برای مهاجرت آینده به بک‌اند
 *
 * هر متد CRUD داده را فعلاً از localStorage می‌خواند/می‌نویسد.
 * برای اتصال به بک‌اند کافی است متدها به fetch/axios تغییر کنند —
 * امضای متدها (ورودی/خروجی) طوری طراحی شده که تغییر پیاده‌سازی،
 * فراخوان‌ها (استورها/کامپوننت‌ها) را نشکند.
 *
 * قرارداد:
 * - list(key) → آرایه
 * - get(key, id) → رکورد یا null
 * - create(key, record) → رکورد ذخیره‌شده (با id)
 * - update(key, id, patch) → رکورد به‌روزشده یا null
 * - remove(key, id) → true
 * - replaceAll(key, records) → آرایه (برای نوشتن‌های دسته‌ای استور)
 * - getSingle(key) / setSingle(key, obj) — برای settings
 *
 * کلیدها همان نام‌های state استور (inventory/purchasing/production/settings domains).
 */
import { safeStorage } from '../lib/utils.js';

// نگاشت کلید منطقی → کلید localStorage (سازگار با داده‌های موجود)
export const STORAGE_KEY = (key) => `kitchen_${key}`;

// بک‌اند آینده: API_BASE را اینجا تنظیم کنید و پیاده‌سازی متدها را با fetch عوض کنید
export const API_BASE = null; // مثال: 'http://localhost:3015'

const isRemote = () => API_BASE !== null;

// ===== پیاده‌سازی محلی (localStorage) =====
const localList = (key) => safeStorage.get(STORAGE_KEY(key), []);
const localGet = (key, id) => localList(key).find((r) => r.id === id) || null;
const localCreate = (key, record) => {
  const list = localList(key);
  list.unshift(record);
  safeStorage.set(STORAGE_KEY(key), list);
  return record;
};
const localUpdate = (key, id, patch) => {
  const list = localList(key);
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  safeStorage.set(STORAGE_KEY(key), list);
  return list[idx];
};
const localRemove = (key, id) => {
  const list = localList(key).filter((r) => r.id !== id);
  safeStorage.set(STORAGE_KEY(key), list);
  return true;
};
const localReplaceAll = (key, records) => {
  safeStorage.set(STORAGE_KEY(key), records);
  return records;
};

// ===== پیاده‌سازی ریموت (پیش‌نمایش مسیر بک‌اند — با /api/…) =====
const remote = async (path, options = {}) => {
  const res = await fetch(`${API_BASE}/api/${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json();
};

export const api = {
  list: async (key) => (isRemote() ? remote(key) : localList(key)),
  get: async (key, id) => (isRemote() ? remote(`${key}/${id}`) : localGet(key, id)),
  create: async (key, record) =>
    isRemote()
      ? remote(key, { method: 'POST', body: JSON.stringify(record) })
      : localCreate(key, record),
  update: async (key, id, patch) =>
    isRemote()
      ? remote(`${key}/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      : localUpdate(key, id, patch),
  remove: async (key, id) =>
    isRemote()
      ? remote(`${key}/${id}`, { method: 'DELETE' }).then(() => true)
      : localRemove(key, id),
  replaceAll: async (key, records) =>
    isRemote()
      ? remote(key, { method: 'PUT', body: JSON.stringify(records) })
      : localReplaceAll(key, records),
  getSingle: async (key) => (isRemote() ? remote(`single/${key}`) : safeStorage.get(STORAGE_KEY(key), null)),
  setSingle: async (key, obj) =>
    isRemote()
      ? remote(`single/${key}`, { method: 'PUT', body: JSON.stringify(obj) })
      : (safeStorage.set(STORAGE_KEY(key), obj), obj),
  // احراز هویت — در بک‌اند POST /auth/login
  login: async (credentials) =>
    isRemote()
      ? remote('auth/login', { method: 'POST', body: JSON.stringify(credentials) })
      : null, // نسخه محلی: استور خودش users را چک می‌کند
};
