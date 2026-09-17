<!-- ============================================================================
     SHIPPING QUEUE VIEW COMPONENT
     Version: v2026.09.17.01
     2026-09-17 (Anh chốt): Giao diện Hàng đợi xuất kho với nút Đồng bộ Master DB khẩn cấp,
     Import Excel danh bạ SĐT/Địa chỉ, Xác nhận gửi đơn lẻ và hàng loạt (Batch Confirm).
     Tuân thủ nghiêm ngặt chuẩn Anti-AI-Slop: 100% SVG Icons, KHÔNG dùng Emoji.
     ============================================================================ -->
<template>
  <div class="shipping-queue-container">
    <!-- Thanh công cụ điều khiển -->
    <div class="toolbar-header">
      <div class="filter-group">
        <el-input
          v-model="searchQuery"
          placeholder="Tìm kiếm UID, tên học sinh, lớp, sách..."
          clearable
          style="width: 320px;"
          @clear="fetchQueue"
          @keyup.enter="fetchQueue"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>

        <el-button type="primary" plain @click="fetchQueue">
          <el-icon><Search /></el-icon>
          <span>Tìm kiếm</span>
        </el-button>
      </div>

      <div class="action-group">
        <!-- Nút Import Excel SĐT & Địa chỉ -->
        <el-button type="info" plain @click="showImportDialog = true">
          <el-icon><Upload /></el-icon>
          <span>Import SĐT & Địa chỉ (Excel)</span>
        </el-button>

        <!-- 2026-09-17 (Anh chốt): Nút Đồng bộ Master DB khẩn cấp với spinner loading và toast thông báo -->
        <el-button
          type="warning"
          :loading="syncing"
          @click="handleManualSync"
        >
          <el-icon v-if="!syncing"><Refresh /></el-icon>
          <span>Đồng bộ Master DB khẩn cấp</span>
        </el-button>

        <!-- Nút Xác nhận gửi hàng loạt -->
        <el-button
          type="success"
          :disabled="selectedRows.length === 0"
          @click="openConfirmDialog(selectedRows)"
        >
          <el-icon><Check /></el-icon>
          <span>Xác nhận gửi ({{ selectedRows.length }})</span>
        </el-button>
      </div>
    </div>

    <!-- Bảng danh sách hàng đợi xuất kho -->
    <el-card shadow="never" class="table-card">
      <el-table
        v-loading="loading"
        :data="queueList"
        row-key="id"
        border
        stripe
        empty-text="Không có lệnh xuất kho nào đang chờ xử lý"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="50" align="center" />
        
        <el-table-column prop="student_uid" label="Mã HS (UID)" width="120" sortable>
          <template #default="{ row }">
            <el-tag size="small" type="info" effect="plain">{{ row.student_uid }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="full_name" label="Họ và Tên" min-width="160" />

        <el-table-column prop="level" label="Trình độ" width="130">
          <template #default="{ row }">
            <el-tag size="small" type="primary">{{ row.level }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="class_name" label="Lớp học" width="130" />

        <el-table-column label="Sách cần xuất" min-width="200">
          <template #default="{ row }">
            <div class="book-cell">
              <span class="book-name">{{ row.book_name }}</span>
              <el-tag size="small" type="warning" effect="light">{{ row.book_code }}</el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="Thông tin nhận hàng" min-width="220">
          <template #default="{ row }">
            <div v-if="row.phone || row.shipping_address" class="contact-info">
              <div v-if="row.phone" class="contact-phone">
                <el-icon><Phone /></el-icon>
                <span>{{ row.phone }}</span>
              </div>
              <div v-if="row.shipping_address" class="contact-address">
                <el-icon><Location /></el-icon>
                <span>{{ row.shipping_address }}</span>
              </div>
            </div>
            <el-tag v-else size="small" type="danger" effect="plain">Chưa có SĐT / Địa chỉ</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="trigger_reason" label="Lý do sinh lệnh" width="150">
          <template #default="{ row }">
            <el-tag v-if="row.trigger_reason === 'FIRST_TIME'" size="small" type="success">
              Mới vào lớp
            </el-tag>
            <el-tag v-else-if="row.trigger_reason === 'LEVEL_UPGRADED'" size="small" type="primary">
              Lên Trình độ
            </el-tag>
            <el-tag v-else-if="row.trigger_reason === '60_DAYS_INTERVAL'" size="small" type="warning">
              Chu kỳ 60 ngày
            </el-tag>
            <el-tag v-else size="small" type="info">Thủ công</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="queued_at" label="Thời gian tạo" width="160">
          <template #default="{ row }">
            {{ formatDate(row.queued_at) }}
          </template>
        </el-table-column>

        <el-table-column label="Hành động" width="140" align="center" fixed="right">
          <template #default="{ row }">
            <!-- Nút Xác nhận gửi đơn lẻ -->
            <el-button
              size="small"
              type="primary"
              plain
              @click="openConfirmDialog([row])"
            >
              <el-icon><Van /></el-icon>
              <span>Gửi sách</span>
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Dialog Xác nhận xuất kho (Đơn lẻ & Hàng loạt) -->
    <el-dialog
      v-model="showConfirmDialog"
      title="Xác Nhận Xuất Kho & Vận Đơn Sách"
      width="540px"
      destroy-on-close
    >
      <div class="dialog-content">
        <el-alert
          :title="`Đang xử lý ${targetItems.length} lệnh xuất kho được chọn.`"
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 16px;"
        />

        <el-form label-position="top">
          <el-form-item label="Đơn vị vận chuyển (Tùy chọn)">
            <el-select v-model="shippingForm.carrier" placeholder="Chọn hoặc nhập đơn vị vận chuyển" filterable allow-create style="width: 100%;">
              <el-option label="Giao Hàng Tiết Kiệm (GHTK)" value="GHTK" />
              <el-option label="Viettel Post" value="Viettel Post" />
              <el-option label="Giao Hàng Nhanh (GHN)" value="GHN" />
              <el-option label="Tự giao / Bàn giao tại lớp" value="Tự giao tại lớp" />
            </el-select>
          </el-form-item>

          <el-form-item label="Mã vận đơn / Tracking Code (Tùy chọn)">
            <el-input
              v-model="shippingForm.tracking_code"
              placeholder="Nhập mã vận đơn bưu cục nếu có"
            />
          </el-form-item>

          <el-form-item label="Người xác nhận">
            <el-input v-model="shippingForm.confirmed_by" placeholder="Tên nhân viên kho / Ops" />
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showConfirmDialog = false">Hủy</el-button>
          <el-button type="primary" :loading="confirming" @click="submitConfirmShipment">
            <el-icon><Check /></el-icon>
            <span>Hoàn tất xuất kho</span>
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Dialog Import Excel SĐT & Địa chỉ -->
    <el-dialog
      v-model="showImportDialog"
      title="Import Danh Bạ SĐT & Địa Chỉ Nhận Hàng (Excel)"
      width="500px"
      destroy-on-close
    >
      <div class="import-dialog-body">
        <el-alert
          title="File Excel cần chứa các cột: UID (hoặc Mã học sinh), SĐT (hoặc Số điện thoại), Địa chỉ nhận hàng."
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 16px;"
        />

        <el-upload
          drag
          action="#"
          :auto-upload="false"
          :limit="1"
          :on-change="handleFileChange"
          accept=".xlsx, .xls"
        >
          <el-icon :size="48" color="#94a3b8"><UploadFilled /></el-icon>
          <div class="el-upload__text">
            Kéo thả file Excel vào đây hoặc <em>bấm để chọn file</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">Hỗ trợ định dạng .xlsx, .xls tối đa 10MB</div>
          </template>
        </el-upload>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showImportDialog = false">Đóng</el-button>
          <el-button type="primary" :loading="importing" :disabled="!selectedFile" @click="submitImportExcel">
            <el-icon><Upload /></el-icon>
            <span>Bắt đầu Import</span>
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../api/client';

const loading = ref(false);
const syncing = ref(false);
const confirming = ref(false);
const importing = ref(false);

const queueList = ref<any[]>([]);
const selectedRows = ref<any[]>([]);
const searchQuery = ref('');

const showConfirmDialog = ref(false);
const targetItems = ref<any[]>([]);
const shippingForm = ref({
  carrier: 'GHTK',
  tracking_code: '',
  confirmed_by: 'Nhân sự Kho',
});

const showImportDialog = ref(false);
const selectedFile = ref<File | null>(null);

// Lấy danh sách hàng đợi
const fetchQueue = async () => {
  loading.value = true;
  try {
    const res = await api.get('/shipping/queue', {
      params: { search: searchQuery.value },
    });
    if (res.data.success) {
      queueList.value = res.data.data;
    }
  } catch (err: any) {
    ElMessage.error(err.response?.data?.message || 'Lỗi tải danh sách hàng đợi xuất kho');
  } finally {
    loading.value = false;
  }
};

const handleSelectionChange = (rows: any[]) => {
  selectedRows.value = rows;
};

// 2026-09-17 (Anh chốt): Xử lý Đồng bộ Master DB khẩn cấp qua POST /api/sync/manual với Toast thông báo
const handleManualSync = async () => {
  syncing.value = true;
  try {
    const res = await api.post('/sync/manual');
    if (res.data.success) {
      ElMessage.success({
        message: `Đồng bộ hoàn tất! Đã cập nhật ${res.data.synced_students} học sinh và sinh ${res.data.new_queued_orders} lệnh chờ mới.`,
        duration: 4000,
      });
      await fetchQueue();
    }
  } catch (err: any) {
    ElMessage.error(err.response?.data?.message || 'Lỗi đồng bộ Master DB');
  } finally {
    syncing.value = false;
  }
};

const openConfirmDialog = (items: any[]) => {
  targetItems.value = items;
  shippingForm.value.tracking_code = '';
  showConfirmDialog.value = true;
};

// Xác nhận xuất kho
const submitConfirmShipment = async () => {
  confirming.value = true;
  try {
    const queue_ids = targetItems.value.map((i) => i.id);
    const res = await api.post('/shipping/confirm', {
      queue_ids,
      carrier: shippingForm.value.carrier,
      tracking_code: shippingForm.value.tracking_code,
      confirmed_by: shippingForm.value.confirmed_by,
    });

    if (res.data.success) {
      ElMessage.success(`Xuất kho thành công ${res.data.shipped_count} đơn sách!`);
      showConfirmDialog.value = false;
      await fetchQueue();
    }
  } catch (err: any) {
    ElMessage.error(err.response?.data?.message || 'Lỗi khi xác nhận xuất kho');
  } finally {
    confirming.value = false;
  }
};

const handleFileChange = (uploadFile: any) => {
  selectedFile.value = uploadFile.raw;
};

// Import Excel SĐT & Địa chỉ
const submitImportExcel = async () => {
  if (!selectedFile.value) return;
  importing.value = true;
  const formData = new FormData();
  formData.append('file', selectedFile.value);

  try {
    const res = await api.post('/students/import-contacts', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (res.data.success) {
      ElMessage.success(`Import danh bạ thành công! Đã cập nhật ${res.data.updated_count} học sinh.`);
      showImportDialog.value = false;
      selectedFile.value = null;
      await fetchQueue();
    }
  } catch (err: any) {
    ElMessage.error(err.response?.data?.message || 'Lỗi upload file danh bạ');
  } finally {
    importing.value = false;
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
  fetchQueue();
});
</script>

<style scoped>
/* 2026-09-17 (Anh chốt): Style giao diện chuẩn Enterprise, touch target >= 44px, không vỡ layout */
.shipping-queue-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  background: #ffffff;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.filter-group, .action-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.table-card {
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.book-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.book-name {
  font-weight: 600;
  color: #1e293b;
}

.contact-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: #475569;
}

.contact-phone, .contact-address {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
