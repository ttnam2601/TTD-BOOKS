<!-- ============================================================================
     AUDIT LOGS & SHIPPING HISTORY VIEW COMPONENT
     Version: v2026.09.17.01
     2026-09-17 (Anh chốt): Hiển thị Lịch sử xuất kho và Nhật ký Audit Trail (JSONB) sinh từ Trigger CSDL
     ============================================================================ -->
<template>
  <div class="audit-view-container">
    <el-radio-group v-model="subTab" style="margin-bottom: 16px;">
      <el-radio-button label="history">Lịch Sử Đã Xuất Kho</el-radio-button>
      <el-radio-button label="logs">Nhật Ký Biến Động (Audit Trail Trigger)</el-radio-button>
    </el-radio-group>

    <!-- Bảng Lịch sử đã xuất kho -->
    <el-card v-if="subTab === 'history'" shadow="never" class="table-card">
      <div class="card-header">
        <span class="header-title">Hồ sơ đã gửi sách thành công (Lưu vết 60 ngày)</span>
        <el-button type="primary" plain size="small" @click="fetchHistory">
          <el-icon><Refresh /></el-icon>
          <span>Tải lại</span>
        </el-button>
      </div>

      <el-table v-loading="loadingHistory" :data="historyList" border stripe>
        <el-table-column prop="student_uid" label="Mã HS (UID)" width="120" />
        <el-table-column prop="full_name" label="Họ và Tên" min-width="160" />
        <el-table-column prop="level" label="Trình độ" width="130" />
        <el-table-column prop="class_name" label="Lớp học" width="130" />
        <el-table-column prop="book_name" label="Tên sách" min-width="200" />
        <el-table-column prop="book_code" label="Mã bộ sách" width="150" />
        <el-table-column prop="carrier" label="Đơn vị VC" width="140" />
        <el-table-column prop="tracking_code" label="Mã vận đơn" width="160">
          <template #default="{ row }">
            <el-tag v-if="row.tracking_code" size="small" type="info">{{ row.tracking_code }}</el-tag>
            <span v-else class="text-muted">Không có</span>
          </template>
        </el-table-column>
        <el-table-column prop="shipped_at" label="Ngày xuất kho" width="170">
          <template #default="{ row }">
            {{ formatDate(row.shipped_at) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Bảng Action_Logs (Audit Trail Trigger) -->
    <el-card v-if="subTab === 'logs'" shadow="never" class="table-card">
      <div class="card-header">
        <span class="header-title">Nhật ký Audit Trail tự động (Trigger PostgreSQL & Worker)</span>
        <el-button type="primary" plain size="small" @click="fetchLogs">
          <el-icon><Refresh /></el-icon>
          <span>Tải lại</span>
        </el-button>
      </div>

      <el-table v-loading="loadingLogs" :data="logsList" border stripe>
        <el-table-column prop="entity_type" label="Đối tượng" width="140">
          <template #default="{ row }">
            <el-tag size="small" type="primary">{{ row.entity_type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="entity_id" label="Mã định danh" width="160" />
        <el-table-column prop="action_type" label="Loại biến động" width="200">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="row.action_type.includes('WARNING') ? 'warning' : 'success'"
            >
              {{ row.action_type }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Dữ liệu cũ (Old Snapshot)" min-width="220">
          <template #default="{ row }">
            <pre v-if="row.old_data" class="json-code">{{ JSON.stringify(row.old_data, null, 2) }}</pre>
            <span v-else class="text-muted">Không có</span>
          </template>
        </el-table-column>
        <el-table-column label="Dữ liệu mới (New Snapshot)" min-width="240">
          <template #default="{ row }">
            <pre v-if="row.new_data" class="json-code">{{ JSON.stringify(row.new_data, null, 2) }}</pre>
            <span v-else class="text-muted">Không có</span>
          </template>
        </el-table-column>
        <el-table-column prop="performed_by" label="Tác nhân" width="160" />
        <el-table-column prop="created_at" label="Thời gian ghi log" width="170">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '../api/client';

const subTab = ref('history');
const loadingHistory = ref(false);
const loadingLogs = ref(false);

const historyList = ref<any[]>([]);
const logsList = ref<any[]>([]);

const fetchHistory = async () => {
  loadingHistory.value = true;
  try {
    const res = await api.get('/shipping/history');
    if (res.data.success) {
      historyList.value = res.data.data;
    }
  } finally {
    loadingHistory.value = false;
  }
};

const fetchLogs = async () => {
  loadingLogs.value = true;
  try {
    const res = await api.get('/shipping/logs');
    if (res.data.success) {
      logsList.value = res.data.data;
    }
  } finally {
    loadingLogs.value = false;
  }
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

onMounted(() => {
  fetchHistory();
  fetchLogs();
});
</script>

<style scoped>
.audit-view-container {
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.header-title {
  font-weight: 600;
  color: #1e293b;
}

.json-code {
  background: #f1f5f9;
  padding: 8px;
  border-radius: 4px;
  font-size: 11px;
  max-height: 120px;
  overflow-y: auto;
  margin: 0;
  color: #334155;
}

.text-muted {
  color: #94a3b8;
  font-size: 13px;
}
</style>
