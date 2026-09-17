// ============================================================================
// SHIPPING SERVICE - QUEUE & HISTORY MANAGEMENT
// Version: v2026.09.17.01
// 2026-09-17 (Anh chốt): Quản lý hàng đợi xuất kho và xử lý xác nhận gửi đơn (Single & Batch Confirm)
// ============================================================================

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ConfirmShipmentDto {
  queue_ids: string[];
  tracking_code?: string;
  carrier?: string;
  confirmed_by?: string;
}

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy danh sách lệnh chờ xuất kho kèm tìm kiếm và phân trang
   */
  async getQueue(query: { status?: string; search?: string; level?: string }) {
    const where: any = {};

    if (query.status) {
      where.status = query.status;
    } else {
      where.status = 'PENDING';
    }

    if (query.level) {
      where.level = query.level;
    }

    if (query.search) {
      where.OR = [
        { student_uid: { contains: query.search, mode: 'insensitive' } },
        { full_name: { contains: query.search, mode: 'insensitive' } },
        { class_name: { contains: query.search, mode: 'insensitive' } },
        { book_code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.shippingQueue.findMany({
      where,
      orderBy: { queued_at: 'desc' },
    });
  }

  /**
   * Lấy lịch sử đã xuất kho
   */
  async getHistory(query: { search?: string; limit?: number }) {
    const where: any = {};

    if (query.search) {
      where.OR = [
        { student_uid: { contains: query.search, mode: 'insensitive' } },
        { full_name: { contains: query.search, mode: 'insensitive' } },
        { book_code: { contains: query.search, mode: 'insensitive' } },
        { tracking_code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.shippingHistory.findMany({
      where,
      orderBy: { shipped_at: 'desc' },
      take: query.limit ? Number(query.limit) : 100,
    });
  }

  /**
   * 2026-09-17 (Anh chốt): Gói trọn luồng xác nhận gửi sách trong Prisma Transaction để đảm bảo tính nguyên tử (Atomicity),
   * chống Double-shipping theo phản biện của Red-Team và lưu vết Action_Logs.
   */
  async confirmShipment(dto: ConfirmShipmentDto) {
    const { queue_ids, tracking_code, carrier, confirmed_by = 'OPERATOR' } = dto;

    if (!queue_ids || queue_ids.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất một lệnh xuất kho để xác nhận.');
    }

    return this.prisma.$transaction(async (tx) => {
      const pendingItems = await tx.shippingQueue.findMany({
        where: {
          id: { in: queue_ids },
          status: 'PENDING',
        },
      });

      if (pendingItems.length === 0) {
        throw new BadRequestException('Các lệnh xuất kho được chọn không tồn tại hoặc đã được xử lý.');
      }

      const shippedIds: string[] = [];

      for (const item of pendingItems) {
        // 1. Tạo bản ghi trong Shipping_History
        await tx.shippingHistory.create({
          data: {
            student_uid: item.student_uid,
            full_name: item.full_name,
            level: item.level,
            class_name: item.class_name,
            book_code: item.book_code,
            book_name: item.book_name,
            shipped_at: new Date(),
            tracking_code: tracking_code || null,
            carrier: carrier || 'GHTK/ViettelPost',
            confirmed_by,
          },
        });

        // 2. Ghi vết Action_Logs cho sự kiện nhân sự xác nhận gửi sách
        await tx.actionLogs.create({
          data: {
            entity_type: 'SHIPPING',
            entity_id: item.student_uid,
            action_type: 'BOOK_SHIPPED',
            old_data: {
              queue_id: item.id,
              status: item.status,
              trigger_reason: item.trigger_reason,
            },
            new_data: {
              book_code: item.book_code,
              book_name: item.book_name,
              tracking_code: tracking_code || null,
              carrier: carrier || 'Tự vận chuyển',
              confirmed_at: new Date(),
            },
            performed_by: confirmed_by,
          },
        });

        // 3. Xóa dòng khỏi Shipping_Queue để giải phóng hàng đợi
        await tx.shippingQueue.delete({
          where: { id: item.id },
        });

        shippedIds.push(item.id);
      }

      this.logger.log(`Đã xuất kho thành công ${shippedIds.length} đơn sách.`);
      return {
        success: true,
        shipped_count: shippedIds.length,
        shipped_ids: shippedIds,
      };
    });
  }

  /**
   * Lấy nhật ký audit logs
   */
  async getAuditLogs(limit: number = 100) {
    return this.prisma.actionLogs.findMany({
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }
}
