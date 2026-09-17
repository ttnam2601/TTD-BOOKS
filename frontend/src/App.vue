<!-- ============================================================================
     APP ROOT COMPONENT
     Version: v2026.09.17.01
     2026-09-17 (Anh chốt): Giao diện Admin chuyên nghiệp, thanh điều hướng tab và badge phiên bản
     ============================================================================ -->
<template>
  <el-container class="app-layout">
    <el-header class="app-header">
      <div class="header-brand">
        <div class="brand-icon">
          <el-icon :size="24" color="#ffffff"><Box /></el-icon>
        </div>
        <div class="brand-info">
          <h1 class="brand-title">Hệ Thống Vận Đơn Sách Tự Động</h1>
          <span class="brand-subtitle">Automated Book Shipping & Warehouse Dispatch</span>
        </div>
      </div>
      <div class="header-actions">
        <el-tag effect="dark" type="info" class="version-badge">
          v2026.09.17.01
        </el-tag>
      </div>
    </el-header>

    <el-main class="app-main">
      <el-tabs v-model="activeTab" class="nav-tabs" type="border-card">
        <el-tab-pane name="queue">
          <template #label>
            <span class="tab-label">
              <el-icon><List /></el-icon>
              <span>Hàng Đợi Xuất Kho</span>
            </span>
          </template>
          <ShippingQueueView />
        </el-tab-pane>

        <el-tab-pane name="settings">
          <template #label>
            <span class="tab-label">
              <el-icon><Setting /></el-icon>
              <span>Cấu Hình Sách (Book Catalog)</span>
            </span>
          </template>
          <BookSettingsView />
        </el-tab-pane>

        <el-tab-pane name="history">
          <template #label>
            <span class="tab-label">
              <el-icon><DocumentChecked /></el-icon>
              <span>Lịch Sử Xuất Kho & Audit Logs</span>
            </span>
          </template>
          <AuditLogsView />
        </el-tab-pane>
      </el-tabs>
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ShippingQueueView from './views/ShippingQueueView.vue';
import BookSettingsView from './views/BookSettingsView.vue';
import AuditLogsView from './views/AuditLogsView.vue';

const activeTab = ref('queue');
</script>

<style scoped>
/* 2026-09-17 (Anh chốt): Thiết kế layout Enterprise sạch sẽ, viền bo nhẹ, tương phản sắc nét */
.app-layout {
  min-height: 100vh;
  background-color: #f8fafc;
}

.app-header {
  height: 64px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.2;
}

.brand-subtitle {
  font-size: 12px;
  color: #64748b;
}

.version-badge {
  font-family: monospace;
  font-size: 12px;
  letter-spacing: 0.5px;
}

.app-main {
  padding: 24px;
  max-width: 1440px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.nav-tabs {
  border-radius: 8px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
  background: #ffffff;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  height: 44px; /* Touch target chuẩn >= 44px */
}
</style>
