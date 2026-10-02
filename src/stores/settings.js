/**
 * استور تنظیمات و دسترسی (فاز ۴) — settings, roles, units, rejectionReasons, overheads
 */
import { defineStore } from 'pinia';
import { safeStorage } from '../lib/utils.js';
import { INITIAL_SETTINGS, INITIAL_ROLES, INITIAL_UNITS, INITIAL_REJECTION_REASONS, INITIAL_OVERHEADS } from '../lib/seed.js';
import { api } from '../api/index.js';

function mergeRoles(stored) {
  return stored.map((r) => {
    const fresh = INITIAL_ROLES.find((x) => x.id === r.id);
    if (!fresh) return r;
    return { ...fresh, ...r, permissions: { ...fresh.permissions, ...(r.permissions || {}) } };
  });
}

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    settings: safeStorage.get('kitchen_settings', INITIAL_SETTINGS),
    roles: mergeRoles(safeStorage.get('kitchen_roles', INITIAL_ROLES)),
    units: safeStorage.get('kitchen_units', INITIAL_UNITS),
    rejectionReasons: safeStorage.get('kitchen_rejection_reasons', INITIAL_REJECTION_REASONS),
    overheads: safeStorage.get('kitchen_overheads', INITIAL_OVERHEADS),
  }),
  getters: {
    taxRate: (s) => s.settings.taxRate,
    currency: (s) => s.settings.currency || 'تومان',
  },
  actions: {
    async persistAll() {
      await api.setSingle('settings', this.settings);
      await api.replaceAll('roles', this.roles);
      await api.replaceAll('units', this.units);
      await api.replaceAll('rejectionReasons', this.rejectionReasons);
      await api.replaceAll('overheads', this.overheads);
    },
  },
});
