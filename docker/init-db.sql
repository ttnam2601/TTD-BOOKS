-- ============================================================================
-- AUTOMATED BOOK SHIPPING SYSTEM - POSTGRESQL 15+ DATABASE SCHEMA
-- Version: v2026.09.17.01
-- 2026-09-17 (Anh chốt): Chuẩn hóa hệ cơ sở dữ liệu quan hệ 5 bảng kèm Audit Trigger tự động ghi JSONB Action_Logs
-- ============================================================================

-- 2026-09-17 (Anh chốt): Sử dụng UUID cho Primary Key của Queue, History và Logs để đảm bảo không trùng lặp và an toàn phân tán.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. BẢNG STUDENTS_MASTER (Bản sao Google Sheets + Thông tin Giao hàng)
-- 2026-09-17 (Anh chốt): Chuẩn hóa 100% khớp các cột từ Google Sheet Class.Student.Total:
-- student (SID), studentName, contactCode (CID), classCode (Mã lớp), studentStatus, joinDate, teacherType,
-- classType, level (Trình độ), subject, studentCarer, lessonLearn, totalLess, remainingLess, UID
-- ============================================================================
CREATE TABLE IF NOT EXISTS students_master (
    student_uid VARCHAR(100) PRIMARY KEY, -- UID (Cột O) hoặc fallback SID
    sid VARCHAR(100),                     -- student (Cột A - SID)
    full_name VARCHAR(255) NOT NULL,      -- studentName (Cột B)
    cid VARCHAR(100),                     -- contactCode (Cột C - CID)
    class_code VARCHAR(150),              -- classCode (Cột D - Mã lớp)
    class_name VARCHAR(150) NOT NULL,     -- Tên lớp (hoặc lấy từ classCode)
    status VARCHAR(100) NOT NULL,         -- studentStatus (Cột E)
    join_date VARCHAR(50),                -- joinDate (Cột F)
    teacher_type VARCHAR(100),            -- teacherType (Cột G)
    class_type VARCHAR(100),              -- classType (Cột H)
    level VARCHAR(100) NOT NULL,          -- level / Trình độ (Cột I)
    subject VARCHAR(100),                 -- subject (Cột J)
    student_carer VARCHAR(150),           -- studentCarer (Cột K)
    lesson_learn INT DEFAULT 0,           -- lessonLearn (Cột L)
    total_less INT DEFAULT 0,             -- totalLess (Cột M)
    remaining_sessions INT DEFAULT 0,     -- remainingLess (Cột N)
    phone VARCHAR(50),                    -- Import bổ sung ngoài
    shipping_address TEXT,                -- Import bổ sung ngoài
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_master_status ON students_master(status);
CREATE INDEX IF NOT EXISTS idx_students_master_level ON students_master(level);
CREATE INDEX IF NOT EXISTS idx_students_master_sid ON students_master(sid);
CREATE INDEX IF NOT EXISTS idx_students_master_cid ON students_master(cid);
CREATE INDEX IF NOT EXISTS idx_students_master_class_code ON students_master(class_code);

-- ============================================================================
-- 2. BẢNG BOOK_CATALOG (Cấu hình ánh xạ Sách theo Trình độ + Tháng 1-12)
-- 2026-09-17 (Anh chốt): Dùng cặp Unique (level, apply_month) để ngăn chặn cấu hình xung đột cùng 1 tháng có 2 cuốn khác nhau.
-- ============================================================================
CREATE TABLE IF NOT EXISTS book_catalog (
    id SERIAL PRIMARY KEY,
    level VARCHAR(100) NOT NULL,
    apply_month INT NOT NULL CHECK (apply_month BETWEEN 1 AND 12),
    book_code VARCHAR(100) NOT NULL,
    book_name VARCHAR(255) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_level_month UNIQUE (level, apply_month)
);

CREATE INDEX IF NOT EXISTS idx_book_catalog_lookup ON book_catalog(level, apply_month);

-- ============================================================================
-- 3. BẢNG SHIPPING_QUEUE (Hàng đợi lệnh chờ xuất kho)
-- 2026-09-17 (Anh chốt): Unique constraint (student_uid, book_code, status) chống sinh đơn trùng lặp khi status = 'PENDING'.
-- ============================================================================
CREATE TABLE IF NOT EXISTS shipping_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_uid VARCHAR(100) NOT NULL REFERENCES students_master(student_uid) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    level VARCHAR(100) NOT NULL,
    class_name VARCHAR(150) NOT NULL,
    book_code VARCHAR(100) NOT NULL,
    book_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    shipping_address TEXT,
    trigger_reason VARCHAR(100) NOT NULL, -- 'FIRST_TIME', '60_DAYS_INTERVAL', 'LEVEL_UPGRADED', 'MANUAL'
    status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'CANCELLED'
    queued_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_student_pending_book UNIQUE (student_uid, book_code, status)
);

CREATE INDEX IF NOT EXISTS idx_shipping_queue_status ON shipping_queue(status);
CREATE INDEX IF NOT EXISTS idx_shipping_queue_student ON shipping_queue(student_uid);

-- ============================================================================
-- 4. BẢNG SHIPPING_HISTORY (Lịch sử đã xuất kho)
-- 2026-09-17 (Anh chốt): Lưu vết vĩnh viễn mốc thời gian đã gửi sách làm căn cứ tính chu kỳ 60 ngày cho Worker 2.
-- ============================================================================
CREATE TABLE IF NOT EXISTS shipping_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_uid VARCHAR(100) NOT NULL REFERENCES students_master(student_uid) ON DELETE RESTRICT,
    full_name VARCHAR(255) NOT NULL,
    level VARCHAR(100) NOT NULL,
    class_name VARCHAR(150) NOT NULL,
    book_code VARCHAR(100) NOT NULL,
    book_name VARCHAR(255) NOT NULL,
    shipped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tracking_code VARCHAR(150),
    carrier VARCHAR(100),
    confirmed_by VARCHAR(150) DEFAULT 'OPERATOR',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipping_history_student ON shipping_history(student_uid, shipped_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipping_history_book ON shipping_history(student_uid, book_code);

-- ============================================================================
-- 5. BẢNG ACTION_LOGS (Audit Trail JSONB)
-- 2026-09-17 (Anh chốt): Định dạng JSONB linh hoạt để lưu snapshot cũ/mới và phân tích lịch sử biến động dữ liệu.
-- ============================================================================
CREATE TABLE IF NOT EXISTS action_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    performed_by VARCHAR(150) NOT NULL DEFAULT 'SYSTEM',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_logs_entity ON action_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_action ON action_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_action_logs_created ON action_logs(created_at DESC);

-- ============================================================================
-- 6. TRIGGER TỰ ĐỘNG GHI AUDIT LOG KHI HỌC SINH ĐỔI LỚP / TRẠNG THÁI / TRÌNH ĐỘ
-- 2026-09-17 (Anh chốt): Đặt trigger mức DB để đảm bảo độ tin cậy tuyệt đối kể cả khi chạy batch upsert từ Google Sheets.
-- ============================================================================
CREATE OR REPLACE FUNCTION trg_fn_audit_students_master()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) OR 
       (OLD.class_name IS DISTINCT FROM NEW.class_name) OR 
       (OLD.level IS DISTINCT FROM NEW.level) THEN
       
        INSERT INTO action_logs (
            entity_type,
            entity_id,
            action_type,
            old_data,
            new_data,
            performed_by,
            created_at
        ) VALUES (
            'STUDENT',
            NEW.student_uid,
            'STUDENT_UPDATED',
            jsonb_build_object(
                'status', OLD.status,
                'class_code', OLD.class_code,
                'class_name', OLD.class_name,
                'level', OLD.level,
                'remaining_sessions', OLD.remaining_sessions
            ),
            jsonb_build_object(
                'status', NEW.status,
                'class_code', NEW.class_code,
                'class_name', NEW.class_name,
                'level', NEW.level,
                'remaining_sessions', NEW.remaining_sessions
            ),
            'TRIGGER_STUDENTS_MASTER',
            NOW()
        );
    END IF;
    
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_students_master ON students_master;
CREATE TRIGGER trg_audit_students_master
AFTER UPDATE ON students_master
FOR EACH ROW
EXECUTE FUNCTION trg_fn_audit_students_master();

-- ============================================================================
-- 7. BẢNG USERS (Quản trị Phân quyền: Vận Đơn & Xếp Lớp)
-- 2026-09-17 (Anh chốt): Role COORDINATOR (Xếp lớp) và DISPATCHER (Vận đơn)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('COORDINATOR', 'DISPATCHER', 'ADMIN')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed tài khoản mặc định:
-- vandon / vandon@123 (DISPATCHER) -> SHA256: 74d812d3b45fe3108c4e09f584e0c4e70e9471f0dd854746f3458c973a9ebcf5
-- xeplop / xeplop@123 (COORDINATOR) -> SHA256: d8d745428a2a466ec555a6d59bb767851e3cbdbd1cf6a524adbc1cf99486c9ff
INSERT INTO users (username, password_hash, full_name, role)
VALUES 
    ('vandon', '74d812d3b45fe3108c4e09f584e0c4e70e9471f0dd854746f3458c973a9ebcf5', 'Bộ Phận Vận Đơn', 'DISPATCHER'),
    ('xeplop', 'd8d745428a2a466ec555a6d59bb767851e3cbdbd1cf6a524adbc1cf99486c9ff', 'Bộ Phận Xếp Lớp', 'COORDINATOR')
ON CONFLICT (username) DO NOTHING;

