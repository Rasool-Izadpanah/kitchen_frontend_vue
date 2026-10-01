<script setup>
import { ref } from 'vue';
import { ChefHat, LogIn, User, Lock } from 'lucide-vue-next';

const props = defineProps({
  users: { type: Array, required: true },
});
const emit = defineEmits(['login']);

const username = ref('');
const password = ref('');
const error = ref('');

const submit = () => {
  const id = username.value.trim();
  const u = props.users.find((x) => (x.username === id || x.personnelCode === id) && x.password === password.value);
  if (u) {
    emit('login', u);
  } else {
    error.value = 'نام کاربری یا رمز عبور اشتباه است';
  }
};
</script>

<template>
  <div dir="rtl" class="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-800 to-emerald-950 flex items-center justify-center p-4" style="font-family: Vazirmatn, sans-serif">
    <div class="bg-white/95 backdrop-blur rounded-3xl shadow-2xl w-full max-w-md p-8 space-y-6">
      <div class="text-center space-y-3">
        <div class="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
          <ChefHat class="w-11 h-11" />
        </div>
        <h1 class="text-xl font-black text-slate-900 leading-relaxed">
          مدیریت آشپزخانه نسیم
        </h1>
        <p class="text-xs text-slate-500 font-medium">وابسته به بنیاد خیریه سیدالشهدا (ع)</p>
      </div>

      <form class="space-y-4" @submit.prevent="submit">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1.5">نام کاربری یا شماره پرسنلی</label>
          <div class="relative">
            <User class="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              v-model="username"
              dir="ltr"
              class="w-full bg-slate-50 border border-slate-300 rounded-xl py-3 pr-10 pl-4 text-sm font-bold tracking-wider focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              @input="error = ''"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1.5">رمز عبور</label>
          <div class="relative">
            <Lock class="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              v-model="password"
              dir="ltr"
              type="password"
              class="w-full bg-slate-50 border border-slate-300 rounded-xl py-3 pr-10 pl-4 text-sm font-bold tracking-wider focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              @input="error = ''"
            />
          </div>
        </div>

        <div v-if="error" class="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl p-3 text-center">
          {{ error }}
        </div>

        <button
          type="submit"
          class="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black py-3.5 rounded-xl text-sm transition shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2"
        >
          <LogIn class="w-4 h-4" />
          ورود به سامانه
        </button>
      </form>
    </div>
  </div>
</template>
