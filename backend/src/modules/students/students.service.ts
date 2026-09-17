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

  async getAllStudents() {
    return this.prisma.studentsMaster.findMany({
      orderBy: { student_uid: 'asc' },
    });
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
