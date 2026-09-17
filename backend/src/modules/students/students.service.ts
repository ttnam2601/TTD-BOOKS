// ============================================================================
// STUDENTS SERVICE & EXCEL IMPORT
// Version: v2026.09.17.01
// 2026-09-17 (Anh chốt): Xử lý import Excel bổ sung SĐT và Địa chỉ giao hàng liên kết theo student_uid
// ============================================================================

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as XLSX from 'xlsx';

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAllStudents(params?: {
    search?: string;
    status?: string;
    level?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params?.page || 1;
    const limit = params?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params?.status) {
      where.status = params.status;
    }
    if (params?.level) {
      where.level = params.level;
    }
    if (params?.search) {
      const q = params.search.trim();
      where.OR = [
        { student_uid: { contains: q, mode: 'insensitive' } },
        { sid: { contains: q, mode: 'insensitive' } },
        { cid: { contains: q, mode: 'insensitive' } },
        { full_name: { contains: q, mode: 'insensitive' } },
        { class_name: { contains: q, mode: 'insensitive' } },
        { class_code: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, students, stats] = await Promise.all([
      this.prisma.studentsMaster.count({ where }),
      this.prisma.studentsMaster.findMany({
        where,
        orderBy: { student_uid: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.studentsMaster.aggregate({
        _count: {
          _all: true,
          phone: true,
        },
      }),
    ]);

    // Lấy danh sách levels duy nhất cho filter
    const levels = await this.prisma.studentsMaster.findMany({
      select: { level: true },
      distinct: ['level'],
    });

    return {
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
      available_levels: levels.map((l) => l.level).filter(Boolean),
      students,
    };
  }

  /**
   * 2026-09-17 (Anh chốt): Lấy hồ sơ chi tiết học sinh, lịch sử nhận sách và nhật ký biến động (Audit Trail theo UID/SID)
   */
  async getStudentDetail(studentUid: string) {
    const student = await this.prisma.studentsMaster.findUnique({
      where: { student_uid: studentUid },
    });

    if (!student) {
      return null;
    }

    const [shippingHistory, actionLogs] = await Promise.all([
      this.prisma.shippingHistory.findMany({
        where: { student_uid: studentUid },
        orderBy: { shipped_at: 'desc' },
      }),
      this.prisma.actionLogs.findMany({
        where: { entity_id: studentUid },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return {
      student,
      shipping_history: shippingHistory,
      action_logs: actionLogs,
    };
  }

  /**
   * 2026-09-17 (Anh chốt): Phân tích file Excel để cập nhật số điện thoại và địa chỉ giao hàng vào bảng students_master,
   * đồng thời cập nhật tức thời vào các đơn đang chờ PENDING ở shipping_queue.
   */
  async importContactsFromExcel(fileBuffer: Buffer) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<any>(worksheet);

    let updatedCount = 0;
    const errors: Array<{ row: number; reason: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Tìm các cột: UID/Mã HS, SĐT/Điện thoại, Địa chỉ/Địa chỉ nhận hàng
      const uid = (row['UID'] || row['student_uid'] || row['Mã học sinh'] || row['Mã HS'])?.toString().trim();
      const phone = (row['SĐT'] || row['Phone'] || row['Số điện thoại'] || row['Điện thoại'])?.toString().trim();
      const address = (row['Địa chỉ'] || row['Address'] || row['Địa chỉ giao hàng'] || row['Địa chỉ nhận hàng'])?.toString().trim();

      if (!uid) {
        errors.push({ row: i + 2, reason: 'Không tìm thấy cột UID / Mã học sinh' });
        continue;
      }

      try {
        const student = await this.prisma.studentsMaster.findUnique({
          where: { student_uid: uid },
        });

        if (student) {
          await this.prisma.studentsMaster.update({
            where: { student_uid: uid },
            data: {
              phone: phone || student.phone,
              shipping_address: address || student.shipping_address,
              updated_at: new Date(),
            },
          });

          // 2026-09-17 (Anh chốt): Đồng bộ ngay vào đơn chờ xuất kho đang PENDING nếu có
          await this.prisma.shippingQueue.updateMany({
            where: {
              student_uid: uid,
              status: 'PENDING',
            },
            data: {
              phone: phone || student.phone,
              shipping_address: address || student.shipping_address,
            },
          });

          updatedCount++;
        } else {
          errors.push({ row: i + 2, reason: `Không tìm thấy học sinh có UID: ${uid} trong hệ thống` });
        }
      } catch (err) {
        errors.push({ row: i + 2, reason: err.message });
      }
    }

    this.logger.log(`Import danh bạ hoàn tất: Đã cập nhật ${updatedCount} học sinh. Lỗi: ${errors.length}`);
    return {
      success: true,
      updated_count: updatedCount,
      errors,
    };
  }
}
