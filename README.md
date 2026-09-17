# Hệ Thống Tự Động Hóa Vận Đơn & Xuất Kho Sách (Automated Book Shipping System)
**Phiên bản**: `v2026.09.17.01` | **Mô hình**: Monorepo NestJS + Prisma + Vue 3 (Element Plus) + Docker Compose

Dự án được xây dựng và chuẩn hóa theo **Quy trình Phối hợp Đa Agent (9-Agent Pipeline System)** chuẩn Enterprise, đáp ứng trọn vẹn nghiệp vụ tự động hóa xuất kho và quản trị vận đơn sách học viên.

---

## 1. Điểm Nhấn Kiến Trúc & Nghiệp Vụ

1. **CSDL PostgreSQL 15+ với Audit Trigger mức DB**:
   - `students_master`: Lưu bản sao Master DB từ Google Sheets kèm thông tin SĐT & Địa chỉ giao hàng.
   - `book_catalog`: Bảng ánh xạ ma trận `(Trình độ, Tháng 1..12) -> Mã sách, Tên sách`.
   - `shipping_queue`: Hàng đợi lệnh chờ xuất kho. Chống sinh trùng lặp đơn qua constraint `(student_uid, book_code, status)`.
   - `shipping_history`: Lịch sử lưu vết phục vụ tính chu kỳ 60 ngày cho Worker 2.
   - `action_logs`: Nhật ký kiểm toán JSONB tự động sinh bởi PostgreSQL Trigger `AFTER UPDATE` khi học sinh đổi trạng thái/lớp/trình độ.
2. **Hàm Cốt Lõi `Get_Book_Set(level, currentMonth)`**:
   - Ánh xạ tự động Trình độ và Tháng hiện tại để xác định đúng cuốn sách cần ship.
   - Nếu thiếu cấu hình: Tự động ghi nhận log `WARNING_NO_BOOK_CONFIG` vào `Action_Logs`, hiển thị cảnh báo trên Admin Dashboard và không tạo đơn rác.
3. **Hai Worker Xử Lý Tự Động**:
   - **Worker 1 (Hourly Sync & State-Machine - Phút 20 mỗi giờ)**: Đồng bộ Google Sheets (`Class.Student.Total`), kích hoạt DB Trigger, cấp sách cho học sinh mới vào lớp (`FIRST_TIME`) và học sinh thăng Trình độ (`LEVEL_UPGRADED`).
   - **Worker 2 (Daily Catch-up - 00:00 mỗi ngày)**: Quét học sinh `ACTIVE`, so sánh `CURRENT_DATE - Last_Shipped_Date >= 60 ngày`, kiểm tra pending queue và dedup để sinh đơn bù chu kỳ.
4. **Phòng Vệ Red-Team & Vận Hành An Toàn**:
   - Khóa **PostgreSQL Advisory Lock** (`pg_try_advisory_lock(1001)`) chống Race Condition khi vừa chạy Cron vừa bấm nút Đồng bộ thủ công (`POST /api/sync/manual`).
   - Giao dịch **Prisma Transaction** khi xác nhận xuất kho chống Double-shipping.
   - Cơ chế **Import Excel SĐT & Địa chỉ** bù đắp dữ liệu giao hàng trực tiếp trên UI.
5. **Tiêu Chuẩn Anti-AI-Slop & UX**:
   - 100% SVG Element Plus Icons (không dùng Emoji nguyên bản).
   - Kích thước chạm tối thiểu 44px, hiển thị badge phiên bản `v2026.09.17.01` và cache busting.

---

## 2. Cấu Trúc Thư Mục Monorepo

```
automated-book-shipping/
├── .agents/
│   └── skills/
│       └── nine-agent-pipeline/
│           └── SKILL.md             # Skill cứng 9-Agent Pipeline System
├── AGENTS.md                        # Workspace rule bắt buộc
├── GEMINI.md                        # Workspace rule bắt buộc
├── docker/
│   ├── init-db.sql                  # DDL Schema 5 bảng + Trigger PostgreSQL
│   └── backup.sh                    # Script cron pg_dump + rclone đẩy lên Cloud
├── backend/
│   ├── prisma/
│   │   └── schema.prisma            # Mô hình dữ liệu Prisma
│   ├── src/
│   │   ├── modules/
│   │   │   ├── book-catalog/        # Logic Get_Book_Set & CRUD Sách
│   │   │   ├── google-sheets/       # Google Sheets API v4 Service Account
│   │   │   ├── students/            # Quản lý học sinh & Import Excel SĐT/Địa chỉ
│   │   │   ├── shipping/            # Shipping Queue, History & Transaction Confirm
│   │   │   ├── workers/             # Worker 1 (Hourly) & Worker 2 (Daily 60 days)
│   │   │   └── sync/                # Manual Sync API với PostgreSQL Advisory Lock
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/                     # Axios Client tập trung
│   │   ├── views/
│   │   │   ├── ShippingQueueView.vue# Màn hình Hàng đợi & Xác nhận xuất kho
│   │   │   ├── BookSettingsView.vue # Màn hình Khai báo cấu hình sách (Matrix 12 tháng)
│   │   │   └── AuditLogsView.vue    # Màn hình Lịch sử & Action Logs JSONB
│   │   ├── App.vue
│   │   └── main.ts
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 3. Hướng Dẫn Cài Đặt & Khởi Chạy

### Cách 1: Triển khai 1-click qua Docker Compose (Khuyên dùng trên Server Linux)
```bash
# 1. Clone repository
cd automated-book-shipping

# 2. Tạo file cấu hình môi trường
cp .env.example .env

# 3. Đặt file Google Service Account (nếu có) vào thư mục backend
cp /path/to/your/service-account.json ./backend/credentials.json

# 4. Khởi chạy toàn bộ hệ thống
docker compose up -d --build

# 5. Kiểm tra trạng thái containers
docker compose ps
```
- Frontend Admin truy cập tại: `http://<IP_SERVER>:80`
- Backend API truy cập tại: `http://<IP_SERVER>:3000`

---

### Cách 2: Chạy Môi trường Phát triển (Local Development)

#### Bước 1: Khởi động Database PostgreSQL
```bash
docker run -d --name pg-local -p 5432:5432 -e POSTGRES_DB=book_shipping -e POSTGRES_PASSWORD=postgres123 postgres:15-alpine
# Import schema và trigger
docker exec -i pg-local psql -U postgres -d book_shipping < docker/init-db.sql
```

#### Bước 2: Khởi động Backend (NestJS)
```bash
cd backend
npm install
npx prisma generate
npm run start:dev
```

#### Bước 3: Khởi động Frontend (Vue 3)
```bash
cd frontend
npm install
npm run dev
```

---

## 4. Cấu Hình Cron Sao Lưu Hàng Ngày (Database Backup)

Trên server Linux, thiết lập crontab chạy lúc 02:00 AM mỗi ngày:
```bash
# Cấp quyền thực thi cho script backup
chmod +x /opt/automated-book-shipping/docker/backup.sh

# Mở crontab
crontab -e

# Thêm dòng sau:
0 2 * * * /opt/automated-book-shipping/docker/backup.sh >> /var/log/pg_backup.log 2>&1
```
