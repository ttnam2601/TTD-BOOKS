// ============================================================================
// FRONTEND ENTRYPOINT
// Version: v2026.09.17.01
// 2026-09-17 (Anh chốt): Khởi tạo Vue 3 với Element Plus và đăng ký trọn bộ SVG Icons
// ============================================================================

import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import App from './App.vue';

const app = createApp(App);

// 2026-09-17 (Anh chốt): Đăng ký toàn bộ Element Plus SVG Icons để tuân thủ triệt để Anti-AI-Slop (KHÔNG dùng emoji)
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.use(ElementPlus);
app.mount('#app');
