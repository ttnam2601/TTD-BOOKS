<!-- ============================================================================
     LOGIN VIEW COMPONENT
     Version: v2026.09.17.02
     2026-09-17 (Anh chốt): Màn hình đăng nhập phong cách Enterprise, bảo mật JWT,
     Anti-AI-Slop: 100% SVG Element Plus Icons, KHÔNG dùng Emoji.
     ============================================================================ -->
<template>
  <div class="login-wrapper">
    <div class="login-box">
      <div class="login-header">
        <div class="login-icon">
          <el-icon :size="32" color="#ffffff"><Box /></el-icon>
        </div>
        <h2 class="login-title">Hệ Thống Vận Đơn Sách Tự Động</h2>
        <p class="login-subtitle">Đăng nhập phân quyền Vận Đơn & Xếp Lớp</p>
      </div>

      <el-form :model="form" class="login-form" @submit.prevent="handleLogin">
        <el-form-item>
          <el-input
            v-model="form.username"
            placeholder="Tên đăng nhập (vandon / xeplop)"
            size="large"
            clearable
          >
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item>
          <el-input
            v-model="form.password"
            type="password"
            placeholder="Mật khẩu"
            size="large"
            show-password
            @keyup.enter="handleLogin"
          >
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-button
          type="primary"
          size="large"
          class="submit-btn"
          :loading="loading"
          @click="handleLogin"
        >
          <el-icon v-if="!loading"><Right /></el-icon>
          <span>Đăng Nhập Hệ Thống</span>
        </el-button>

        <div class="login-hints">
          <div class="hint-title">Tài khoản mặc định:</div>
          <div class="hint-item">
            <el-tag size="small" type="primary">Xếp Lớp</el-tag> xeplop / xeplop@123
          </div>
          <div class="hint-item">
            <el-tag size="small" type="success">Vận Đơn</el-tag> vandon / vandon@123
          </div>
        </div>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../api/client';

const emit = defineEmits(['login-success']);

const form = ref({
  username: '',
  password: '',
});

const loading = ref(false);

const handleLogin = async () => {
  if (!form.value.username || !form.value.password) {
    ElMessage.warning('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu');
    return;
  }

  loading.value = true;
  try {
    const res = await api.post('/auth/login', form.value);
    if (res.data.success) {
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      ElMessage.success(Xin chào, !);
      emit('login-success', res.data.user);
    }
  } catch (err: any) {
    ElMessage.error(err.response?.data?.message || 'Đăng nhập thất bại, vui lòng kiểm tra lại');
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-wrapper {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  padding: 20px;
}

.login-box {
  width: 100%;
  max-width: 420px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
  padding: 36px 32px;
}

.login-header {
  text-align: center;
  margin-bottom: 28px;
}

.login-icon {
  width: 56px;
  height: 56px;
  background-color: #2563eb;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.login-title {
  margin: 0 0 6px 0;
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}

.login-subtitle {
  margin: 0;
  font-size: 13px;
  color: #64748b;
}

.submit-btn {
  width: 100%;
  margin-top: 10px;
  height: 44px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.login-hints {
  margin-top: 24px;
  padding: 12px 14px;
  background-color: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  font-size: 12px;
  color: #475569;
}

.hint-title {
  font-weight: 600;
  margin-bottom: 6px;
  color: #334155;
}

.hint-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
</style>