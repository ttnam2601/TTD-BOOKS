<!-- ============================================================================
     STUDENTS MASTER VIEW (WITH STUDENT DETAIL & AUDIT LOG POPUP MODAL)
     Version: v2026.09.17.03
     2026-09-17 (Anh chốt): Thêm Popup Dialog xem chi tiết học sinh theo SID/UID,
     hiển thị Lịch sử các sách đã từng nhận (ShippingHistory) và Nhật ký biến động (AuditLogs/Trigger).
     ============================================================================ -->
<template>
  <div class="students-view">
    <!-- Thẻ Thống Kê Nhanh -->
    <el-row :gutter="16" class="stat-cards">
      <el-col :xs="24" :sm="12" :md="8">
        <el-card shadow="never" class="stat-card">
          <div class="stat-content">
            <span class="stat-title">Tổng Học Sinh Master (Môn Toán)</span>
            <span class="stat-value text-blue">{{ totalStudents }}</span>
          </div>
          <el-icon class="stat-icon text-blue"><User /></el-icon>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="12" :md="8">
        <el-card shadow="never" class="stat-card">
          <div class="stat-content">
            <span class="stat-title">Trang Hiện Tại</span>
            <span class="stat-value text-green">{{ currentPage }} / {{ totalPages || 1 }}</span>
          </div>
          <el-icon class="stat-icon text-green"><DocumentChecked /></el-icon>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="12" :md="8">
        <el-card shadow="never" class="stat-card">
          <div class="stat-content">
            <span class="stat-title">Hiển Thị Mỗi Trang</span>
            <span class="stat-value text-purple">{{ pageSize }} học sinh</span>
          </div>
          <el-icon class="stat-icon text-purple"><List /></el-icon>
        </el-card>
      </el-col>
    </el-row>

    <!-- Bộ Lọc & Công Cụ -->
    <el-card shadow="never" class="table-card">
      <div class="toolbar">
        <div class="toolbar-left">
          <el-input
            v-model="searchQuery"
            placeholder="Tìm theo UID, SID, CID, Tên học sinh hoặc Lớp..."
            clearable
            class="search-input"
            @input="onSearchInput"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>

          <el-select v-model="filterStatus" placeholder="Lọc Trạng Thái" clearable class="filter-select" @change="fetchStudents">
            <el-option label="Tất cả trạng thái" value="" />
            <el-option label="Đang học" value="Đang học" />
            <el-option label="Chờ khai giảng" value="Chờ khai giảng" />
            <el-option label="Bảo lưu" value="Bảo lưu" />
            <el-option label="Thôi học" value="Thôi học" />
          </el-select>

          <el-select v-model="filterLevel" placeholder="Lọc Trình Độ" clearable class="filter-select" @change="fetchStudents">
            <el-option label="Tất cả trình độ" value="" />
            <el-option v-for="lvl in availableLevels" :key="lvl" :label="lvl" :value="lvl" />
          </el-select>
        </div>

        <div class="toolbar-right">
          <el-button type="primary" plain :loading="syncing" @click="handleManualSync">
            <el-icon><Refresh /></el-icon>
            <span>Đồng bộ từ Google Sheets</span>
          </el-button>
        </div>
      </div>

      <!-- Bảng Dữ Liệu Chi Tiết Học Sinh -->
      <el-table
        v-loading="loading"
        :data="students"
        stripe
        border
        style="width: 100%"
        class="student-table"
      >
        <el-table-column label="Mã Định Danh (UID / SID / CID)" width="220" fixed="left">
          <template #default="{ row }">
            <div class="id-group">
              <div class="id-item">
                <span class="id-label">UID:</span>
                <el-tag size="small" type="primary" effect="light">{{ row.student_uid || 'N/A' }}</el-tag>
              </div>
              <div v-if="row.sid" class="id-item">
                <span class="id-label">SID:</span>
                <span class="id-val">{{ row.sid }}</span>
              </div>
              <div v-if="row.cid" class="id-item">
                <span class="id-label">CID:</span>
                <span class="id-val text-muted">{{ row.cid }}</span>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="full_name" label="Họ và Tên Học Sinh" min-width="180">
          <template #default="{ row }">
            <span class="student-name">{{ row.full_name }}</span>
          </template>
        </el-table-column>

        <el-table-column label="Lớp & Mã Lớp" width="160">
          <template #default="{ row }">
            <div>
              <div class="class-name">{{ row.class_name || row.class_code }}</div>
              <div v-if="row.class_code && row.class_code !== row.class_name" class="class-code">
                {{ row.class_code }}
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="level" label="Trình Độ" width="160">
          <template #default="{ row }">
            <el-tag type="info" effect="plain">{{ row.level }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="status" label="Trạng Thái" width="140">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" effect="dark">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="Tiến Độ Học (Buổi)" width="160" align="center">
          <template #default="{ row }">
            <div class="sessions-info">
              <div class="sessions-text">
                Đã học: <strong>{{ row.lesson_learn || 0 }}</strong> / Tổng: {{ row.total_less || 0 }}
              </div>
              <div class="remaining-tag">
                Còn lại: <el-tag size="small" :type="row.remaining_sessions > 0 ? 'success' : 'danger'">{{ row.remaining_sessions }} buổi</el-tag>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="Thông Tin Giao Hàng" min-width="200">
          <template #default="{ row }">
            <div v-if="row.phone || row.shipping_address" class="contact-info">
              <div v-if="row.phone" class="phone-num">
                <el-icon><Phone /></el-icon>
                <span>{{ row.phone }}</span>
              </div>
              <div v-if="row.shipping_address" class="address-text">
                <el-icon><Location /></el-icon>
                <span>{{ row.shipping_address }}</span>
              </div>
            </div>
            <el-tag v-else type="warning" effect="plain" size="small">
              <el-icon><Warning /></el-icon>
              <span>Chưa bổ sung</span>
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="Thao Tác / Lịch Sử" width="140" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" plain @click="openDetailModal(row.student_uid)">
              <el-icon><View /></el-icon>
              <span>Chi tiết HS</span>
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- Phân Trang (Pagination) Server-Side -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[20, 50, 100, 200]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="totalStudents"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- POPUP DIALOG: CHI TIẾT HỌC SINH & LỊCH SỬ GỬI SÁCH (POPUP TAB THEO SID/UID) -->
    <el-dialog
      v-model="showDetailModal"
      title="Hồ Sơ Chi Tiết & Lịch Sử Gửi Sách Học Sinh"
      width="850px"
      destroy-on-close
    >
      <div v-loading="loadingDetail" class="detail-dialog-content">
        <template v-if="selectedStudent">
          <!-- Thông tin tổng quan học sinh -->
          <el-descriptions border :column="2" class="student-info-grid">
            <el-descriptions-item label="Họ và Tên">
              <strong>{{ selectedStudent.full_name }}</strong>
            </el-descriptions-item>
            <el-descriptions-item label="UID / SID">
              <el-tag size="small" type="primary">{{ selectedStudent.student_uid }}</el-tag>
              <span v-if="selectedStudent.sid" style="margin-left: 8px;">(SID: {{ selectedStudent.sid }})</span>
            </el-descriptions-item>
            <el-descriptions-item label="CID (Contact Code)">
              <span>{{ selectedStudent.cid || 'N/A' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="Lớp / Mã Lớp">
              <span>{{ selectedStudent.class_name || selectedStudent.class_code }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="Trình Độ">
              <el-tag type="info">{{ selectedStudent.level }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="Trạng Thái">
              <el-tag :type="getStatusType(selectedStudent.status)">{{ selectedStudent.status }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="Số Điện Thoại">
              <span>{{ selectedStudent.phone || 'Chưa có' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="Địa Chỉ Nhận Hàng">
              <span>{{ selectedStudent.shipping_address || 'Chưa có' }}</span>
            </el-descriptions-item>
          </el-descriptions>

          <!-- TAB SUB: LỊCH SỬ GỬI SÁCH VÀ AUDIT LOGS THEO SID/UID -->
          <el-tabs v-model="activeDetailTab" style="margin-top: 20px;">
            <!-- Tab 1: Các sách đã từng được gửi -->
            <el-tab-pane label="Sách Đã Từng Được Gửi" name="shipped_books">
              <div v-if="studentHistory.length === 0" class="empty-tab-data">
                <el-empty description="Học sinh này chưa từng được gửi sách trong hệ thống" :image-size="80" />
              </div>
              <el-table v-else :data="studentHistory" border stripe size="small" style="width: 100%">
                <el-table-column prop="book_name" label="Tên Sách" min-width="180" />
                <el-table-column prop="book_code" label="Mã Sách" width="130" />
                <el-table-column prop="level" label="Trình Độ Khi Gửi" width="140" />
                <el-table-column prop="carrier" label="Đơn Vị Vận Chuyển" width="140">
                  <template #default="{ row }">
                    {{ row.carrier || 'Bưu điện / Shipper' }}
                  </template>
                </el-table-column>
                <el-table-column prop="tracking_code" label="Mã Vận Đơn" width="140">
                  <template #default="{ row }">
                    <el-tag v-if="row.tracking_code" size="small" type="info">{{ row.tracking_code }}</el-tag>
                    <span v-else class="text-muted">Không có</span>
                  </template>
                </el-table-column>
                <el-table-column prop="shipped_at" label="Ngày Đã Gửi" width="160">
                  <template #default="{ row }">
                    {{ formatDate(row.shipped_at) }}
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <!-- Tab 2: Nhật ký biến động (Audit Logs Trigger theo SID/UID) -->
            <el-tab-pane label="Nhật Ký Biến Động (Audit Trail SID)" name="audit_trail">
              <div v-if="studentAuditLogs.length === 0" class="empty-tab-data">
                <el-empty description="Chưa ghi nhận biến động trạng thái cho học sinh này" :image-size="80" />
              </div>
              <el-table v-else :data="studentAuditLogs" border stripe size="small" style="width: 100%">
                <el-table-column prop="action_type" label="Loại Hành Động" width="180">
                  <template #default="{ row }">
                    <el-tag size="small" type="warning">{{ row.action_type }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="performed_by" label="Tác Vụ Bởi" width="160" />
                <el-table-column label="Dữ Liệu Biến Động (JSONB)" min-width="240">
                  <template #default="{ row }">
                    <pre class="json-preview">{{ JSON.stringify(row.new_data || row.old_data, null, 2) }}</pre>
                  </template>
                </el-table-column>
                <el-table-column prop="created_at" label="Thời Gian" width="160">
                  <template #default="{ row }">
                    {{ formatDate(row.created_at) }}
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </template>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showDetailModal = false">Đóng</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../api/client';

const students = ref<any[]>([]);
const totalStudents = ref(0);
const totalPages = ref(1);
const currentPage = ref(1);
const pageSize = ref(50);
const availableLevels = ref<string[]>([]);

const loading = ref(false);
const syncing = ref(false);
const searchQuery = ref('');
const filterStatus = ref('');
const filterLevel = ref('');

// State cho Popup Modal Chi Tiết Học Sinh & Lịch Sử Gửi Sách theo SID/UID
const showDetailModal = ref(false);
const loadingDetail = ref(false);
const selectedStudent = ref<any>(null);
const studentHistory = ref<any[]>([]);
const studentAuditLogs = ref<any[]>([]);
const activeDetailTab = ref('shipped_books');

let searchTimer: any = null;

const fetchStudents = async () => {
  loading.value = true;
  try {
    const res = await api.get('/students', {
      params: {
        page: currentPage.value,
        limit: pageSize.value,
        search: searchQuery.value || undefined,
        status: filterStatus.value || undefined,
        level: filterLevel.value || undefined,
      },
    });

    if (res.data.success) {
      students.value = res.data.students || [];
      totalStudents.value = res.data.total || 0;
      totalPages.value = res.data.total_pages || 1;
      if (res.data.available_levels) {
        availableLevels.value = res.data.available_levels;
      }
    }
  } catch (err: any) {
    ElMessage.error(err.response?.data?.message || 'Lỗi khi tải danh sách học sinh');
  } finally {
    loading.value = false;
  }
};

const openDetailModal = async (studentUid: string) => {
  showDetailModal.value = true;
  loadingDetail.value = true;
  selectedStudent.value = null;
  studentHistory.value = [];
  studentAuditLogs.value = [];
  activeDetailTab.value = 'shipped_books';

  try {
    const res = await api.get(`/students/${studentUid}`);
    if (res.data.success) {
      selectedStudent.value = res.data.data.student;
      studentHistory.value = res.data.data.shipping_history || [];
      studentAuditLogs.value = res.data.data.action_logs || [];
    }
  } catch (err: any) {
    ElMessage.error(err.response?.data?.message || 'Lỗi tải chi tiết học sinh');
  } finally {
    loadingDetail.value = false;
  }
};

const onSearchInput = () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    currentPage.value = 1;
    fetchStudents();
  }, 300);
};

const handleCurrentChange = (val: number) => {
  currentPage.value = val;
  fetchStudents();
};

const handleSizeChange = (val: number) => {
  pageSize.value = val;
  currentPage.value = 1;
  fetchStudents();
};

const handleManualSync = async () => {
  syncing.value = true;
  try {
    const res = await api.post('/sync/manual');
    if (res.data.success) {
      ElMessage.success(res.data.message || 'Đã kích hoạt đồng bộ từ Google Sheets');
      await fetchStudents();
    }
  } catch (err: any) {
    ElMessage.error(err.response?.data?.message || 'Lỗi khi đồng bộ từ Google Sheets');
  } finally {
    syncing.value = false;
  }
};

const getStatusType = (status: string) => {
  switch (status) {
    case 'Đang học':
      return 'success';
    case 'Chờ khai giảng':
      return 'warning';
    case 'Bảo lưu':
      return 'info';
    case 'Thôi học':
      return 'danger';
    default:
      return 'primary';
  }
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'Chưa có';
  return new Date(dateStr).toLocaleString('vi-VN');
};

onMounted(() => {
  fetchStudents();
});
</script>

<style scoped>
.students-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stat-card {
  border-radius: 8px;
  position: relative;
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-title {
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  margin-top: 4px;
}

.stat-icon {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 32px;
  opacity: 0.15;
}

.text-blue { color: #2563eb; }
.text-green { color: #16a34a; }
.text-purple { color: #9333ea; }

.table-card {
  border-radius: 8px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.toolbar-left {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  flex: 1;
}

.search-input {
  width: 340px;
}

.filter-select {
  width: 170px;
}

.id-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.id-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.id-label {
  color: #64748b;
  font-weight: 600;
  width: 32px;
}

.id-val {
  font-family: monospace;
  font-weight: 600;
}

.student-name {
  font-weight: 600;
  color: #0f172a;
}

.class-name {
  font-weight: 600;
  color: #334155;
}

.class-code {
  font-size: 11px;
  color: #64748b;
}

.contact-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

.phone-num, .address-text {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #334155;
}

.address-text {
  color: #64748b;
}

.sync-time {
  font-size: 12px;
  color: #64748b;
}

.sessions-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

.text-muted {
  color: #94a3b8;
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.student-info-grid {
  margin-bottom: 16px;
}

.json-preview {
  margin: 0;
  background: #f1f5f9;
  padding: 8px;
  border-radius: 4px;
  font-size: 11px;
  max-height: 120px;
  overflow-y: auto;
}

.empty-tab-data {
  padding: 24px 0;
}
</style>
