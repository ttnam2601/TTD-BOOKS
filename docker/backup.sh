#!/bin/bash
# ============================================================================
# LINUX DATABASE BACKUP SCRIPT
# Version: v2026.09.17.01
# 2026-09-17 (Anh chốt): Tự động pg_dump PostgreSQL 15, nén .sql.gz, đẩy lên Cloud bằng rclone và dọn dẹp sau 30 ngày
# Cấu hình crontab trên Linux server:
# 0 2 * * * /opt/automated-book-shipping/docker/backup.sh >> /var/log/pg_backup.log 2>&1
# ============================================================================

set -e

# Cấu hình biến môi trường
BACKUP_DIR="/var/backups/book_shipping"
CONTAINER_NAME="book_shipping_postgres"
DB_NAME="book_shipping"
DB_USER="postgres"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_backup_${TIMESTAMP}.sql.gz"
RCLONE_REMOTE="gdrive:BookShippingBackups" # Tên remote cấu hình trong rclone
RETENTION_DAYS=30

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] --- Bắt đầu tiến trình sao lưu CSDL PostgreSQL ---"

# 1. Thực hiện pg_dump trực tiếp từ Docker container và nén gzip
docker exec -t "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_FILE}"
echo "[$(date)] Đã tạo file backup cục bộ: ${BACKUP_FILE} (Dung lượng: $(du -h "${BACKUP_FILE}" | cut -f1))"

# 2. Đẩy file backup lên Cloud Storage (Google Drive / S3 / MinIO) qua rclone nếu có cài đặt
if command -v rclone &> /dev/null; then
    echo "[$(date)] Đang đồng bộ file backup lên Cloud: ${RCLONE_REMOTE}..."
    rclone copy "${BACKUP_FILE}" "${RCLONE_REMOTE}/daily/"
    
    # Dọn dẹp các bản sao lưu cũ hơn 30 ngày trên Cloud
    echo "[$(date)] Dọn dẹp backup cũ quá ${RETENTION_DAYS} ngày trên Cloud..."
    rclone delete --min-age "${RETENTION_DAYS}d" "${RCLONE_REMOTE}/daily/" || true
else
    echo "[$(date)] Cảnh báo: rclone chưa được cài đặt. Bỏ qua bước đẩy lên Cloud."
fi

# 3. Dọn dẹp các bản backup cục bộ quá 30 ngày
echo "[$(date)] Dọn dẹp file backup cục bộ cũ quá ${RETENTION_DAYS} ngày..."
find "${BACKUP_DIR}" -name "${DB_NAME}_backup_*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete

echo "[$(date)] --- Hoàn tất tiến trình sao lưu thành công! ---"
