<script setup>
/**
 * درخواست خرید کالا — معادل PurchaseRequestPage.jsx
 * فرم ثبت (ماده غذایی / قلم جانبی + مقدار) و لیست درخواست‌های قبلی
 */
import { ref, computed } from 'vue';
import { ShoppingCart, Plus, Trash2, Save, XCircle } from 'lucide-vue-next';
import { toFa, jalaliTodayString, nowTime } from '../lib/utils.js';
import { useAppStore } from '../stores/app.js';
import FaNumberInput from '../components/ui/FaNumberInput.vue';
import SearchableSelect from '../components/SearchableSelect.vue';
import { inputCls } from '../components/ui/inputCls.js';

const props = defineProps({
  showToast: { type: Function, required: true },
  userName: { type: String, default: '—' },
});

const store = useAppStore();

const lines = ref([]);
const ingId = ref('');
const supId = ref('');
const qty = ref('');
const note = ref('');

const allItems = computed(() => [
  ...store.ingredients.map((i) => ({ value: 'ing_' + i.id, label: `${i.name} (موجودی: ${toFa(i.qty)} ${i.unit})`, raw: i, kind: 'ing' })),
  ...store.supplies.map((s) => ({ value: 'sup_' + s.id, label: `${s.name} (موجودی: ${toFa(s.qty)})`, raw: s, kind: 'sup' })),
]);

const addItem = () => {
  const opt = allItems.value.find((o) => o.value === ingId.value || o.value === supId.value);
  if (!opt) return props.showToast('انتخاب کالا الزامی است', 'error');
  const n = Math.max(0.001, Number(qty.value) || 0);
  if (n <= 0) return props.showToast('مقدار را وارد کنید', 'error');
  if (lines.value.some((l) => l.key === opt.value)) return props.showToast('این کالا قبلاً اضافه شده', 'error');
  lines.value = [...lines.value, {
    key: opt.value, kind: opt.kind,
    ingredientId: opt.kind === 'ing' ? opt.raw.id : null,
    supplyId: opt.kind === 'sup' ? opt.raw.id : null,
    name: opt.raw.name, unit: opt.raw.unit || 'عدد', qty: n,
  }];
  ingId.value = ''; supId.value = ''; qty.value = '';
};

const removeLine = (key) => { lines.value = lines.value.filter((l) => l.key !== key); };

const submit = () => {
  if (lines.value.length === 0) return props.showToast('حداقل یک قلم لازم است', 'error');
  const req = {
    id: `PR-${Date.now()}`,
    date: jalaliTodayString(), time: toFa(nowTime()),
    requester: props.userName || '—',
    items: lines.value.map(({ key, ...rest }) => ({ ...rest, received: false, receivedQty: 0 })),
    note: note.value.trim(), status: 'temp',
  };
  store.purchaseRequests = [req, ...(store.purchaseRequests || [])];
  props.showToast(`درخواست خرید ثبت و به کارتابل ارسال شد (${toFa(lines.value.length)} قلم)`);
  lines.value = []; note.value = '';
};

const statusBadge = (s) =>
  s === 'temp' ? 'bg-amber-100 text-amber-700' :
  s === 'delivered' ? 'bg-sky-100 text-sky-700' :
  s === 'stocked' ? 'bg-emerald-100 text-emerald-700' :
  s === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700';

const statusLabel = (s) =>
  s === 'temp' ? 'موقت — در کارتابل' :
  s === 'delivered' ? 'دریافت شد — awaiting انبار' :
  s === 'stocked' ? 'تحویل انبار شد' :
  s === 'completed' ? 'تایید شد' : 'رد شد';
</script>

<template>
  <div class="space-y-6">
    <div class="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
      <div class="p-3 bg-amber-50 text-amber-700 rounded-2xl"><ShoppingCart class="w-6 h-6" /></div>
      <div>
        <h2 class="text-base font-black text-slate-900">درخواست خرید کالا</h2>
        <p class="text-[11px] text-slate-500">نیازهای مواد غذایی و اقلام را ثبت کنید — درخواست به‌صورت موقت به کارتابل می‌رود</p>
      </div>
    </div>

    <div class="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5">
      <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
        <div class="sm:col-span-5">
          <label class="block text-xs font-bold text-slate-700 mb-1.5">ماده غذایی:</label>
          <SearchableSelect v-model="ingId" :options="allItems.filter((o) => o.kind === 'ing')" placeholder="-- انتخاب ماده --" @update:model-value="supId = ''" />
        </div>
        <div class="sm:col-span-2">
          <label class="block text-xs font-bold text-slate-700 mb-1.5">مقدار:</label>
          <FaNumberInput v-model="qty" placeholder="مثلاً 20" />
        </div>
        <div class="sm:col-span-2">
          <button class="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition" @click="addItem">
            <Plus class="w-4 h-4" /> افزودن
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
        <div class="sm:col-span-5">
          <label class="block text-xs font-bold text-slate-700 mb-1.5">یا قلم جانبی:</label>
          <SearchableSelect v-model="supId" :options="allItems.filter((o) => o.kind === 'sup')" placeholder="-- انتخاب قلم --" @update:model-value="ingId = ''" />
        </div>
      </div>

      <div v-if="lines.length > 0" class="border border-slate-200 rounded-2xl overflow-hidden">
        <table class="w-full text-right text-xs">
          <thead class="bg-slate-50 font-black text-slate-700 border-b border-slate-200">
            <tr>
              <th class="p-2.5">#</th>
              <th class="p-2.5">کالا</th>
              <th class="p-2.5 text-center">مقدار</th>
              <th class="p-2.5">واحد</th>
              <th class="p-2.5 text-center w-12"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="(l, i) in lines" :key="l.key" class="hover:bg-slate-50">
              <td class="p-2.5 text-slate-400">{{ toFa(i + 1) }}</td>
              <td class="p-2.5 font-bold text-slate-800">{{ l.name }}</td>
              <td class="p-2.5 text-center font-black">{{ toFa(l.qty) }}</td>
              <td class="p-2.5 text-slate-500">{{ l.unit }}</td>
              <td class="p-2.5 text-center">
                <button class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" @click="removeLine(l.key)">
                  <Trash2 class="w-4 h-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div>
        <label class="block text-xs font-bold text-slate-700 mb-1.5">توضیحات:</label>
        <textarea v-model="note" rows="2" class="resize-none" :class="inputCls" />
      </div>

      <div class="flex gap-2">
        <button class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition" @click="submit">
          <Save class="w-4 h-4" /> ثبت درخواست و ارسال به کارتابل
        </button>
        <button class="px-5 py-2.5 bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition" @click="lines = []; note = ''">
          <XCircle class="w-4 h-4" /> پاک کردن
        </button>
      </div>
    </div>

    <!-- درخواست‌های قبلی -->
    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div class="p-4 border-b border-slate-100"><h3 class="text-sm font-black text-slate-800">درخواست‌های ثبت‌شده</h3></div>
      <table class="w-full text-right text-xs">
        <thead class="bg-slate-50 font-black text-slate-700 border-b border-slate-200">
          <tr><th class="p-3">شماره</th><th class="p-3">تاریخ</th><th class="p-3">اقلام</th><th class="p-3 text-center">وضعیت</th></tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="!(store.purchaseRequests || []).length">
            <td colspan="4" class="p-6 text-center text-slate-400 font-bold">درخواستی ثبت نشده است</td>
          </tr>
          <tr v-for="r in (store.purchaseRequests || [])" :key="r.id" class="hover:bg-slate-50">
            <td class="p-3 font-mono text-slate-600" dir="ltr">{{ r.id.slice(0, 11) }}</td>
            <td class="p-3">{{ toFa(r.date) }}</td>
            <td class="p-3 text-slate-600">{{ r.items.map((it) => `${it.name} (${toFa(it.qty)} ${it.unit})`).join('، ') }}</td>
            <td class="p-3 text-center">
              <span class="px-2 py-1 rounded-full text-[10px] font-black" :class="statusBadge(r.status)">
                {{ statusLabel(r.status) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
