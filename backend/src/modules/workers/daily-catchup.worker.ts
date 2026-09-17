// ============================================================================
// DAILY CATCH-UP WORKER (WORKER 2)
// Version: v2026.09.17.01
// 2026-09-17 (Anh chốt): Chạy 1 lần/ngày lúc 00:00. Lọc HS nhóm ACTIVE, đối chiếu Last_Shipped_Date >= 60 ngày,
// kiểm tra pending queue và dedup mã sách trước khi sinh lệnh bù xuất kho.
// ============================================================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { BookCatalogService } from '../book-catalog/book-catalog.service';

@Injectable()
export class DailyCatchupWorker {
  private readonly logger = new Logger(DailyCatchupWorker.name);
  private readonly ACTIVE_STATUSES = ['Chờ khai giảng', 'Đang học', 'Lớp nháp'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookCatalogService: BookCatalogService,
  ) {}

  // 2026-09-17 (Anh chốt): Chạy 00:00 hàng ngày: "0 0 0 * * *"
  @Cron('0 0 0 * * *')
  async handleCron() {
    this.logger.log('--- Bắt đầu Worker 2: Daily Catch-up (Quét mốc 60 ngày) ---');
    await this.executeCatchup();
  }

  async executeCatchup() {
    const startTime = Date.now();
    let processedCount = 0;
    let queuedCount = 0;

    try {
      const currentMonth = new Date().getMonth() + 1;
      const now = new Date();
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      // 1. Lọc tất cả học sinh thuộc nhóm [ACTIVE]
      const activeStudents = await this.prisma.studentsMaster.findMany({
        where: {
          status: { in: this.ACTIVE_STATUSES },
        },
      });

      this.logger.log(`Tìm thấy ${activeStudents.length} học sinh đang ở trạng thái ACTIVE để đối soát.`);

      for (const student of activeStudents) {
        processedCount++;

        // 2. Đối chiếu Last_Shipped_Date trong Shipping_History
        const lastShipped = await this.prisma.shippingHistory.findFirst({
          where: { student_uid: student.student_uid },
          orderBy: { shipped_at: 'desc' },
        });

        // Nếu học sinh chưa từng nhận sách, Worker 1 sẽ lo hoặc chưa đến lượt
        if (!lastShipped) {
          continue;
        }

        // 2026-09-17 (Anh chốt): Điều kiện: [Current_Date] - [Last_Shipped_Date] >= 60 ngày
        const isEligibleInterval = lastShipped.shipped_at <= sixtyDaysAgo;

        if (isEligibleInterval) {
          // 3. Kiểm tra xem đã có đơn PENDING nào trong Shipping_Queue chưa (Chống trùng lặp)
          const pendingOrder = await this.prisma.shippingQueue.findFirst({
            where: {
              student_uid: student.student_uid,
              status: 'PENDING',
            },
          });

          if (pendingOrder) {
            // Đã có đơn trong hàng đợi, không tạo thêm
            continue;
          }

          // 4. Gọi hàm Get_Book_Set lấy sách cho tháng hiện tại
          const book = await this.bookCatalogService.Get_Book_Set(student.level, currentMonth);
          if (!book) {
            // Sách chưa được cấu hình, Get_Book_Set đã tự ghi Warning Log vào Action_Logs
            continue;
          }

          // 2026-09-17 (Anh chốt): Chống cấp trùng chính cuốn sách vừa nhận gần nhất nếu học sinh học lặp chu kỳ
          if (lastShipped.book_code === book.book_code) {
            this.logger.debug(`Bỏ qua HS ${student.student_uid}: Bộ sách ${book.book_code} trùng với sách đã nhận gần nhất.`);
            continue;
          }

          // 5. Sinh đơn xuất kho bù vào Shipping_Queue
          await this.prisma.shippingQueue.create({
            data: {
              student_uid: student.student_uid,
              full_name: student.full_name,
              level: student.level,
              class_name: student.class_name,
              book_code: book.book_code,
              book_name: book.book_name,
              phone: student.phone,
              shipping_address: student.shipping_address,
              trigger_reason: '60_DAYS_INTERVAL',
              status: 'PENDING',
            },
          });

          queuedCount++;
          this.logger.log(`Worker 2 sinh đơn bù chu kỳ 60 ngày cho HS: ${student.student_uid} (${student.full_name}) - Sách: ${book.book_code}`);
        }
      }

      const durationMs = Date.now() - startTime;
      this.logger.log(`Worker 2 hoàn thành: Quét ${processedCount} HS, sinh ${queuedCount} đơn bù chu kỳ trong ${durationMs}ms.`);

      return {
        success: true,
        processed_students: processedCount,
        new_queued_orders: queuedCount,
        duration_ms: durationMs,
      };
    } catch (error) {
      this.logger.error(`Lỗi thực thi Worker 2: ${error.message}`);
      throw error;
    }
  }
}
