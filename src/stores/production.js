/**
 * استور تولید (فاز ۴) — plans, recipes, dishes
 */
import { defineStore } from 'pinia';
import { safeStorage } from '../lib/utils.js';
import { INITIAL_DISHES, INITIAL_RECIPES } from '../lib/seed.js';
import { api } from '../api/index.js';

export const useProductionStore = defineStore('production', {
  state: () => ({
    plans: safeStorage.get('kitchen_plans', []),
    recipes: safeStorage.get('kitchen_recipes', INITIAL_RECIPES),
    dishes: safeStorage.get('kitchen_dishes', INITIAL_DISHES),
  }),
  getters: {
    recipeOf: (s) => (dishId) => s.recipes.find((r) => r.dishId === dishId) || null,
    activePlans: (s) => s.plans.filter((p) => !['cancelled', 'rejected'].includes(p.status)),
  },
  actions: {
    async persistAll() {
      await api.replaceAll('plans', this.plans);
      await api.replaceAll('recipes', this.recipes);
      await api.replaceAll('dishes', this.dishes);
    },
  },
});
