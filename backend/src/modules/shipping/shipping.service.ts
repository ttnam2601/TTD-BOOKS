// ============================================================================
// SHIPPING SERVICE - QUEUE & HISTORY MANAGEMENT
// Version: v2026.09.17.01
// 2026-09-17 (Anh chốt): Quản lý hàng đợi xuất kho và xử lý xác nhận gửi đơn (Single & Batch Confirm)
// ============================================================================

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BookCatalogService } from '../book-catalog/book-catalog.service';

export interface ConfirmShipmentDto {
  queue_ids: string[];
  tracking_code?: string;
  carrier?: string;
  confirmed_by?: string;
}

export interface CreateManualRequestDto {
  student_uid: string;
  full_name?: string;
  level: string;
  class_name: string;
  status: string; // 'Chờ xếp lớp' | 'Chờ chuyển lớp' | 'Chuyển phí'
  phone?: string;
  shipping_address?: string;
  notes?: string;
  created_by?: string;
}

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookCatalogService: BookCatalogService,
  ) {}

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

  /**
   * 2026-09-17 (Anh chốt): Bộ phận Xếp lớp điền tay học sinh cần ship sách sớm
   * Dành cho các trạng thái: Chờ xếp lớp, Chờ chuyển lớp, Chuyển phí (Check chéo trước khi hệ thống bắt tự động)
   */
  async createManualRequest(dto: CreateManualRequestDto) {
    const studentUid = dto.student_uid.trim();
    if (!studentUid) {
      throw new BadRequestException('Mã học sinh không được để trống');
    }

    // 1. Kiểm tra hoặc cập nhật thông tin học sinh trong students_master
    let student = await this.prisma.studentsMaster.findUnique({
      where: { student_uid: studentUid },
    });

    const fullName = dto.full_name?.trim() || student?.full_name || 'Học sinh mới';
    const level = dto.level?.trim() || student?.level || 'Chưa phân cấp';
    const className = dto.class_name?.trim() || student?.class_name || 'Chưa xếp lớp';
    const status = dto.status?.trim() || student?.status || 'Chờ xếp lớp';

    if (!student) {
      student = await this.prisma.studentsMaster.create({
        data: {
          student_uid: studentUid,
          full_name: fullName,
          level,
          class_name: className,
          status,
          phone: dto.phone?.trim() || null,
          shipping_address: dto.shipping_address?.trim() || null,
        },
      });
    } else {
      // Cập nhật SĐT/Địa chỉ/Trạng thái nếu có truyền vào
      await this.prisma.studentsMaster.update({
        where: { student_uid: studentUid },
        data: {
          status,
          phone: dto.phone?.trim() || student.phone,
          shipping_address: dto.shipping_address?.trim() || student.shipping_address,
          level: dto.level?.trim() || student.level,
          class_name: dto.class_name?.trim() || student.class_name,
        },
      });
    }

    // 2. Xác định cuốn sách cần ship theo tháng hiện tại
    const currentMonth = new Date().getMonth() + 1;
    const bookSet = await this.bookCatalogService.Get_Book_Set(level, currentMonth);

    const bookCode = bookSet?.book_code || `BOOK-${level}-M${currentMonth}`;
    const bookName = bookSet?.book_name || `Sách ${level} Tháng ${currentMonth}`;

    // 3. Đưa vào Hàng đợi ShippingQueue (chống duplicate nếu đã có pending)
    const existingQueue = await this.prisma.shippingQueue.findFirst({
      where: {
        student_uid: studentUid,
        book_code: bookCode,
        status: 'PENDING',
      },
    });

    if (existingQueue) {
      throw new BadRequestException(`Học sinh ${studentUid} đã có đơn chờ xuất cuốn sách [${bookCode}] trong hàng đợi`);
    }

    const queueItem = await this.prisma.shippingQueue.create({
      data: {
        student_uid: studentUid,
        full_name: fullName,
        level,
        class_name: className,
        book_code: bookCode,
        book_name: bookName,
        phone: dto.phone?.trim() || student.phone,
        shipping_address: dto.shipping_address?.trim() || student.shipping_address,
        trigger_reason: 'MANUAL_REQUEST',
        status: 'PENDING',
      },
    });

    // 4. Ghi vết Action_Logs cho kiểm toán và check chéo
    await this.prisma.actionLogs.create({
      data: {
        entity_type: 'SHIPPING_QUEUE',
        entity_id: queueItem.id,
        action_type: 'MANUAL_SHIPPING_REQUEST_CREATED',
        old_data: null,
        new_data: {
          student_uid: studentUid,
          level,
          class_name: className,
          status,
          book_code: bookCode,
          book_name: bookName,
          notes: dto.notes || 'Điền tay bởi bộ phận Xếp lớp',
          created_by: dto.created_by || 'COORDINATOR',
        },
        performed_by: dto.created_by || 'COORDINATOR',
      },
    });

    this.logger.log(`Bộ phận Xếp lớp (${dto.created_by || 'COORDINATOR'}) đã tạo yêu cầu ship tay cho học sinh ${studentUid}`);

    return {
      success: true,
      message: 'Tạo yêu cầu xuất sách thủ công thành công, đơn đã vào hàng đợi chờ Vận đơn xử lý.',
      data: queueItem,
    };
  }
}

