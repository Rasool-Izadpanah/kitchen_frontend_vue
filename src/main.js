import { createApp } from 'vue';
import { createPinia, getActivePinia } from 'pinia';
import { useAppStore, setupPersistence } from './stores/app.js';
import App from './App.vue';
import './index.css';

const pinia = createPinia();
const app = createApp(App).use(pinia);
// مهم: مهاجرت + mirror استورها باید قبل از رندر اولیه اجرا شود
setupPersistence(useAppStore(pinia));
app.mount('#app');
