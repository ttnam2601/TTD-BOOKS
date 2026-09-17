<!-- ============================================================================
     APP ROOT COMPONENT
     Version: v2026.09.17.02
     2026-09-17 (Anh chốt): Giao diện Admin chuyên nghiệp với Phân quyền RBAC (Vận Đơn & Xếp Lớp),
     Quản lý phiên đăng nhập JWT, Anti-AI-Slop 100% SVG Icons.
     ============================================================================ -->
<template>
  <div v-if="!currentUser">
    <LoginView @login-success="handleLoginSuccess" />
  </div>

  <el-container v-else class="app-layout">
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
        <!-- 2026-09-17 (Anh chốt): Tag hiển thị vai trò người dùng -->
        <el-tag
          :type="currentUser.role === 'COORDINATOR' ? 'primary' : 'success'"
          effect="dark"
          class="role-badge"
        >
          <el-icon><User /></el-icon>
          <span>{{ currentUser.role === 'COORDINATOR' ? 'Xếp Lớp' : 'Vận Đơn' }}</span>
        </el-tag>

        <span class="user-name">{{ currentUser.fullName }}</span>

        <el-tag effect="plain" type="info" class="version-badge">
          v2026.09.17.02
        </el-tag>

        <el-button type="danger" plain size="small" @click="handleLogout">
          <el-icon><SwitchButton /></el-icon>
          <span>Đăng xuất</span>
        </el-button>
      </div>
    </el-header>

    <el-main class="app-main">
      <el-tabs v-model="activeTab" class="nav-tabs" type="border-card">
        <!-- Tab 1: Hàng Đợi Xuất Kho (Cả 2 role đều truy cập) -->
        <el-tab-pane name="queue">
          <template #label>
            <span class="tab-label">
              <el-icon><List /></el-icon>
              <span>Hàng Đợi Xuất Kho</span>
            </span>
          </template>
          <ShippingQueueView :user-role="currentUser.role" :user-name="currentUser.fullName" />
        </el-tab-pane>

        <!-- Tab 2: Cấu Hình Sách (Chỉ hiển thị với Vận Đơn hoặc Admin) -->
        <el-tab-pane v-if="currentUser.role !== 'COORDINATOR'" name="settings">
          <template #label>
            <span class="tab-label">
              <el-icon><Setting /></el-icon>
              <span>Cấu Hình Sách (Book Catalog)</span>
            </span>
          </template>
          <BookSettingsView />
        </el-tab-pane>

        <!-- Tab 3: Lịch Sử & Audit Logs (Cả 2 role đều theo dõi đối soát) -->
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
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import LoginView from './views/LoginView.vue';
import ShippingQueueView from './views/ShippingQueueView.vue';
import BookSettingsView from './views/BookSettingsView.vue';
import AuditLogsView from './views/AuditLogsView.vue';
import api from './api/client';

const activeTab = ref('queue');
const currentUser = ref<any>(null);

const checkCurrentSession = async () => {
  const token = localStorage.getItem('token');
  const savedUser = localStorage.getItem('user');

  if (!token) {
    currentUser.value = null;
    return;
  }

  if (savedUser) {
    try {
      currentUser.value = JSON.parse(savedUser);
    } catch (e) {
      currentUser.value = null;
    }
  }

  try {
    const res = await api.get('/auth/me');
    if (res.data.success) {
      currentUser.value = res.data.user;
    }
  } catch (err) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser.value = null;
  }
};

const handleLoginSuccess = (user: any) => {
  currentUser.value = user;
  activeTab.value = 'queue';
};

const handleLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  currentUser.value = null;
  ElMessage.info('Đã đăng xuất tài khoản');
};

onMounted(() => {
  checkCurrentSession();
});
</script>

<style scoped>
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.role-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  padding: 6px 12px;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
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