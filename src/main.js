import { createApp } from 'vue';
import { createPinia, getActivePinia } from 'pinia';
import { useAppStore, setupPersistence } from './stores/app.js';
import App from './App.vue';
import './index.css';

const pinia = createPinia();
createApp(App).use(pinia).mount('#app');
setupPersistence(useAppStore(pinia));
