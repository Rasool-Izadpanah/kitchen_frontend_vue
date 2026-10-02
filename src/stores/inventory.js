/**
 * استور انبار (فاز ۴) — ingredients, supplies, moves
 * داده از localStorage بارگذاری می‌شود؛ همه نوشتن‌ها از طریق api.replaceAll
 * انجام می‌شود تا مسیر مهاجرت به بک‌اند باز باشد.
 * منطق کسب‌وکار رزرو در lib/inventory.js باقی می‌ماند و به این استور دسترسی دارد.
 */
import { defineStore } from 'pinia';
import { safeStorage } from '../lib/utils.js';
import { INITIAL_INGREDIENTS, INITIAL_SUPPLIES, INITIAL_STOCK_MOVES } from '../lib/seed.js';
import { api } from '../api/index.js';

export const useInventoryStore = defineStore('inventory', {
  state: () => ({
    ingredients: safeStorage.get('kitchen_ingredients', INITIAL_INGREDIENTS),
    supplies: safeStorage.get('kitchen_supplies', INITIAL_SUPPLIES),
    moves: safeStorage.get('kitchen_moves', INITIAL_STOCK_MOVES),
  }),
  getters: {
    // موجودی قابل استفاده = qty - reserved
    availableOf: (s) => (id) => {
      const ing = s.ingredients.find((i) => i.id === id);
      if (!ing) return 0;
      return Math.max(0, (Number(ing.qty) || 0) - (Number(ing.reserved) || 0));
    },
    lowItems: (s) => s.ingredients.filter((i) => i.minThreshold && i.qty <= i.minThreshold),
  },
  actions: {
    // نوشتن‌های دسته‌ای — مسیر مهاجرت به API
    async persistIngredients() { await api.replaceAll('ingredients', this.ingredients); },
    async persistSupplies() { await api.replaceAll('supplies', this.supplies); },
    async persistMoves() { await api.replaceAll('moves', this.moves); },
  },
});
