// ============================================================================
// HOURLY SYNC WORKER (WORKER 1)
// Version: v2026.09.17.01
// 2026-09-17 (Anh chốt): Chạy tự động phút thứ 20 mỗi giờ: Kéo Google Sheets, Upsert Students_Master,
// kích hoạt Trigger DB ghi audit, và cấp sách cho học sinh mới lần đầu hoặc đổi Trình độ.
// ============================================================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleSheetsService } from '../google-sheets/google-sheets.service';
import { BookCatalogService } from '../book-catalog/book-catalog.service';

@Injectable()
export class HourlySyncWorker {
  private readonly logger = new Logger(HourlySyncWorker.name);
  private readonly ACTIVE_STATUSES = ['Chờ khai giảng', 'Đang học', 'Lớp nháp'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleSheetsService: GoogleSheetsService,
    private readonly bookCatalogService: BookCatalogService,
  ) {}

  // 2026-09-17 (Anh chốt): Chạy tự động mỗi giờ phút 20: "0 20 * * * *"
  @Cron('0 20 * * * *')
  async handleCron() {
    this.logger.log('--- Bắt đầu Worker 1: Hourly Sync & State-Machine Processing ---');
    await this.executeSync('CRON_WORKER_1');
  }

  async executeSync(triggeredBy: string = 'MANUAL') {
    const startTime = Date.now();
    let syncedCount = 0;
    let newQueuedCount = 0;

    try {
      const externalStudents = await this.googleSheetsService.fetchMasterStudents();
      const currentMonth = new Date().getMonth() + 1;

      for (const row of externalStudents) {
        // 1. Upsert vào Students_Master (Trigger AFTER UPDATE trên PostgreSQL sẽ tự bắt nếu đổi trạng thái/lớp/level)
        const student = await this.prisma.studentsMaster.upsert({
          where: { student_uid: row.student_uid },
          update: {
            sid: row.sid,
            full_name: row.full_name,
            cid: row.cid,
            class_code: row.class_code,
            class_name: row.class_name,
            level: row.level,
            status: row.status,
            join_date: row.join_date,
            teacher_type: row.teacher_type,
            class_type: row.class_type,
            subject: row.subject,
            student_carer: row.student_carer,
            lesson_learn: row.lesson_learn,
            total_less: row.total_less,
            remaining_sessions: row.remaining_sessions,
            last_synced_at: new Date(),
          },
          create: {
            student_uid: row.student_uid,
            sid: row.sid,
            full_name: row.full_name,
            cid: row.cid,
            class_code: row.class_code,
            class_name: row.class_name,
            level: row.level,
            status: row.status,
            join_date: row.join_date,
            teacher_type: row.teacher_type,
            class_type: row.class_type,
            subject: row.subject,
            student_carer: row.student_carer,
            lesson_learn: row.lesson_learn,
            total_less: row.total_less,
            remaining_sessions: row.remaining_sessions,
          },
        });
        syncedCount++;

        // 2. Chỉ xét nhóm [ACTIVE] để phát sinh lệnh sách
        if (!this.ACTIVE_STATUSES.includes(student.status)) {
          continue;
        }

        // Lấy lịch sử gửi sách gần nhất
        const lastShipped = await this.prisma.shippingHistory.findFirst({
          where: { student_uid: student.student_uid },
          orderBy: { shipped_at: 'desc' },
        });

        // 2026-09-17 (Anh chốt): Kịch bản 1 - Học sinh mới ACTIVE lần đầu chưa từng có trong Shipping_History
        if (!lastShipped) {
          const hasPendingQueue = await this.prisma.shippingQueue.findFirst({
            where: { student_uid: student.student_uid, status: 'PENDING' },
          });

          if (!hasPendingQueue) {
            const book = await this.bookCatalogService.Get_Book_Set(student.level, currentMonth);
            if (book) {
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
                  trigger_reason: 'FIRST_TIME',
                  status: 'PENDING',
                },
              });
              newQueuedCount++;
              this.logger.log(`Sinh lệnh xuất kho mới lần đầu cho HS: ${student.student_uid} - Sách: ${book.book_code}`);
            }
          }
        } 
        // 2026-09-17 (Anh chốt): Kịch bản 2 - Học sinh đổi Trình độ (Level mới chưa từng nhận)
        else if (lastShipped.level !== student.level) {
          const book = await this.bookCatalogService.Get_Book_Set(student.level, currentMonth);
          if (book) {
            // Kiểm tra xem đã từng nhận cuốn sách của Level mới này chưa
            const alreadyReceived = await this.prisma.shippingHistory.findFirst({
              where: {
                student_uid: student.student_uid,
                book_code: book.book_code,
              },
            });

            const hasPending = await this.prisma.shippingQueue.findFirst({
              where: { student_uid: student.student_uid, status: 'PENDING' },
            });

            if (!alreadyReceived && !hasPending) {
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
                  trigger_reason: 'LEVEL_UPGRADED',
                  status: 'PENDING',
                },
              });
              newQueuedCount++;
              this.logger.log(`Sinh lệnh xuất kho đổi Trình độ cho HS: ${student.student_uid} - Trình độ mới: ${student.level}`);
            }
          }
        }
      }

      const durationMs = Date.now() - startTime;
      this.logger.log(`Worker 1 hoàn thành trong ${durationMs}ms: Đồng bộ ${syncedCount} HS, sinh ${newQueuedCount} lệnh chờ.`);

      return {
        success: true,
        synced_students: syncedCount,
        new_queued_orders: newQueuedCount,
        duration_ms: durationMs,
        triggered_by: triggeredBy,
      };
    } catch (error) {
      this.logger.error(`Lỗi thực thi Worker 1: ${error.message}`);
      throw error;
    }
  }
}
