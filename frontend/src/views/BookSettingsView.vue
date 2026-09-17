<!-- ============================================================================
     BOOK SETTINGS VIEW COMPONENT (BOOK CATALOG)
     Version: v2026.09.17.01
     2026-09-17 (Anh chốt): Màn hình Khai báo cấu hình sách cho Ops team. Cho phép CRUD
     tổ hợp Trình độ + Tháng = Sách gì, hỗ trợ chọn nhiều tháng cho chu kỳ 2 tháng/bộ,
     và hiển thị cảnh báo cấu hình còn thiếu. Tuân thủ 100% SVG Icons (Anti-AI-Slop).
     ============================================================================ -->
<template>
  <div class="book-settings-container">
    <!-- Cảnh báo thiếu cấu hình cho tháng hiện tại nếu có -->
    <el-alert
      v-if="missingInfo.missing_levels && missingInfo.missing_levels.length > 0"
      title="Cảnh báo thiếu cấu hình sách tháng hiện tại!"
      type="warning"
      :closable="false"
      show-icon
      class="warning-banner"
    >
      <div>
        Tháng {{ missingInfo.current_month }} đang có học sinh học nhưng <strong>chưa được khai báo sách</strong> cho các trình độ:
        <el-tag
          v-for="lvl in missingInfo.missing_levels"
          :key="lvl"
          type="danger"
          size="small"
          style="margin-left: 6px;"
        >
          {{ lvl }}
        </el-tag>
      </div>
    </el-alert>

    <!-- Thanh công cụ -->
    <div class="toolbar-header">
      <div class="header-left">
        <h3 class="section-title">Danh Mục & Cấu Hình Ánh Xạ Sách Theo Tháng</h3>
        <span class="section-desc">Khai báo trước Trình độ + Tháng nào sử dụng Mã sách và Tên sách tương ứng</span>
      </div>

      <div class="header-right">
        <el-button type="primary" @click="openAddDialog">
          <el-icon><Plus /></el-icon>
          <span>Thêm cấu hình sách</span>
        </el-button>
      </div>
    </div>

    <!-- Bảng danh sách cấu hình -->
    <el-card shadow="never" class="table-card">
      <el-table v-loading="loading" :data="catalogList" border stripe>
        <el-table-column prop="level" label="Trình độ" width="180" sortable>
          <template #default="{ row }">
            <el-tag type="primary" effect="light" size="default">{{ row.level }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="apply_month" label="Tháng áp dụng" width="150" align="center" sortable>
          <template #default="{ row }">
            <el-tag type="success" size="default">Tháng {{ row.apply_month }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="book_code" label="Mã bộ sách" width="180">
          <template #default="{ row }">
            <span class="code-badge">{{ row.book_code }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="book_name" label="Tên sách / Giáo trình" min-width="240" />

        <el-table-column prop="notes" label="Ghi chú" min-width="180">
          <template #default="{ row }">
            <span class="text-muted">{{ row.notes || '—' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="Hành động" width="100" align="center">
          <template #default="{ row }">
            <el-popconfirm
              title="Bạn có chắc chắn muốn xóa cấu hình này?"
              confirm-button-text="Xóa"
              cancel-button-text="Hủy"
              @confirm="handleDelete(row.id)"
            >
              <template #reference>
                <el-button size="small" type="danger" plain>
                  <el-icon><Delete /></el-icon>
                </el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Dialog Thêm / Cập nhật cấu hình sách -->
    <el-dialog
      v-model="showDialog"
      title="Khai Báo Cấu Hình Sách Theo Trình Độ & Tháng"
      width="560px"
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item label="Trình độ học sinh" required>
          <el-input v-model="form.level" placeholder="Ví dụ: Trình độ A, Trình độ B, Starters, Movers..." />
        </el-form-item>

        <!-- 2026-09-17 (Anh chốt): Cho phép tích chọn nhiều tháng cùng lúc để phục vụ chu kỳ 2 tháng/bộ -->
        <el-form-item label="Các tháng áp dụng trong năm (Chọn nhiều tháng)" required>
          <el-checkbox-group v-model="form.months" class="month-checkbox-grid">
            <el-checkbox v-for="m in 12" :key="m" :label="m" border>
              Tháng {{ m }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <el-form-item label="Mã bộ sách (Book Code)" required>
          <el-input v-model="form.book_code" placeholder="Ví dụ: BOOK-A-SEP-OCT" />
        </el-form-item>

        <el-form-item label="Tên bộ sách / Giáo trình" required>
          <el-input v-model="form.book_name" placeholder="Ví dụ: Giáo trình Family & Friends Tập 1" />
        </el-form-item>

        <el-form-item label="Ghi chú thêm">
          <el-input v-model="form.notes" type="textarea" :rows="2" placeholder="Ghi chú nội bộ cho Ops..." />
        </el-form-item>
      </el-form>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showDialog = false">Hủy</el-button>
          <el-button type="primary" :loading="saving" @click="submitConfig">
            <el-icon><Check /></el-icon>
            <span>Lưu cấu hình</span>
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
const saving = ref(false);
const catalogList = ref<any[]>([]);
const missingInfo = ref<{ current_month?: number; missing_levels?: string[] }>({});

const showDialog = ref(false);
const form = ref({
  level: '',
  months: [] as number[],
  book_code: '',
  book_name: '',
  notes: '',
});

const fetchCatalog = async () => {
  loading.value = true;
  try {
    const [catRes, missRes] = await Promise.all([
      api.get('/book-catalog'),
      api.get('/book-catalog/missing-check'),
    ]);

    if (catRes.data.success) {
      catalogList.value = catRes.data.data;
    }
    if (missRes.data.success) {
      missingInfo.value = missRes.data.result;
    }
  } catch (err: any) {
    ElMessage.error(err.response?.data?.message || 'Lỗi tải danh mục sách');
  } finally {
    loading.value = false;
  }
};

const openAddDialog = () => {
  form.value = {
    level: '',
    months: [],
    book_code: '',
    book_name: '',
    notes: '',
  };
  showDialog.value = true;
};

const submitConfig = async () => {
  if (!form.value.level || form.value.months.length === 0 || !form.value.book_code || !form.value.book_name) {
    ElMessage.warning('Vui lòng điền đầy đủ Trình độ, Các tháng áp dụng, Mã sách và Tên sách');
    return;
  }

  saving.value = true;
  try {
    const res = await api.post('/book-catalog', form.value);
    if (res.data.success) {
      ElMessage.success('Lưu cấu hình sách thành công!');
      showDialog.value = false;
      await fetchCatalog();
    }
  } catch (err: any) {
    ElMessage.error(err.response?.data?.message || 'Lỗi khi lưu cấu hình sách');
  } finally {
    saving.value = false;
  }
};

const handleDelete = async (id: number) => {
  try {
    const res = await api.delete(`/book-catalog/${id}`);
    if (res.data.success) {
      ElMessage.success('Đã xóa cấu hình');
      await fetchCatalog();
    }
  } catch (err: any) {
    ElMessage.error(err.response?.data?.message || 'Lỗi khi xóa cấu hình');
  }
};

onMounted(() => {
  fetchCatalog();
});
</script>

<style scoped>
.book-settings-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.warning-banner {
  border-radius: 8px;
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

.section-title {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

.section-desc {
  font-size: 13px;
  color: #64748b;
}

.table-card {
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.code-badge {
  font-family: monospace;
  font-weight: 600;
  color: #2563eb;
  background: #eff6ff;
  padding: 3px 8px;
  border-radius: 4px;
}

.text-muted {
  color: #94a3b8;
  font-size: 13px;
}

.month-checkbox-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  width: 100%;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
