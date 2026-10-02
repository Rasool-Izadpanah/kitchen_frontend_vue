/**
 * استور خرید (فاز ۴) — suppliers, purchaseRequests, stockRequests,
 * purchaseOrders, goodsReceipts, purchaseInvoices
 */
import { defineStore } from 'pinia';
import { safeStorage } from '../lib/utils.js';
import { INITIAL_SUPPLIERS } from '../lib/seed.js';
import { api } from '../api/index.js';

export const usePurchasingStore = defineStore('purchasing', {
  state: () => ({
    suppliers: safeStorage.get('kitchen_suppliers', INITIAL_SUPPLIERS),
    purchaseRequests: safeStorage.get('kitchen_purchase_requests', []),
    stockRequests: safeStorage.get('kitchen_stock_requests', []),
    purchaseOrders: safeStorage.get('kitchen_purchase_orders', []),
    goodsReceipts: safeStorage.get('kitchen_goods_receipts', []),
    purchaseInvoices: safeStorage.get('kitchen_purchase_invoices', []),
  }),
  getters: {
    // موجودی در راه (On-Order) per ingredient
    onOrderOf: (s) => (ingredientId) => {
      let total = 0;
      s.purchaseOrders.forEach((po) => {
        if (['sent', 'partially_received'].includes(po.status)) {
          po.items.forEach((it) => {
            if (it.ingredientId === ingredientId) total += Math.max(0, (it.qty || 0) - (it.receivedQty || 0));
          });
        }
      });
      return Math.round(total * 1e6) / 1e6;
    },
    supplierById: (s) => (id) => s.suppliers.find((x) => x.id === id) || null,
  },
  actions: {
    async persistAll() {
      await api.replaceAll('suppliers', this.suppliers);
      await api.replaceAll('purchaseRequests', this.purchaseRequests);
      await api.replaceAll('stockRequests', this.stockRequests);
      await api.replaceAll('purchaseOrders', this.purchaseOrders);
      await api.replaceAll('goodsReceipts', this.goodsReceipts);
      await api.replaceAll('purchaseInvoices', this.purchaseInvoices);
    },
  },
});
