// ============================================================================
// BOOK CATALOG SERVICE - CORE BOOK MAPPING LOGIC
// Version: v2026.09.17.01
// 2026-09-17 (Anh chốt): Cung cấp hàm Get_Book_Set(level, currentMonth) và CRUD cấu hình sách cho Ops
// ============================================================================

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface BookSetResult {
  book_code: string;
  book_name: string;
}

@Injectable()
export class BookCatalogService {
  private readonly logger = new Logger(BookCatalogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 2026-09-17 (Anh chốt): Hàm cốt lõi ánh xạ Trình độ + Tháng hiện tại sang Mã sách và Tên sách.
   * Nếu không tìm thấy, tự động ghi log cảnh báo vào Action_Logs và trả về null để chống sinh đơn rác.
   */
  async Get_Book_Set(level: string, currentMonth: number): Promise<BookSetResult | null> {
    try {
      const normalizedLevel = level.trim();
      const catalogItem = await this.prisma.bookCatalog.findUnique({
        where: {
          uq_level_month: {
            level: normalizedLevel,
            apply_month: currentMonth,
          },
        },
      });

      if (catalogItem) {
        return {
          book_code: catalogItem.book_code,
          book_name: catalogItem.book_name,
        };
      }

      // 2026-09-17 (Anh chốt): Ghi log cảnh báo thiếu cấu hình sách theo quyết định Red-Team đã thống nhất
      this.logger.warn(`Chưa cấu hình sách cho Trình độ: "${normalizedLevel}" - Tháng: ${currentMonth}`);
      
      await this.prisma.actionLogs.create({
        data: {
          entity_type: 'BOOK_CATALOG',
          entity_id: `${normalizedLevel}_M${currentMonth}`,
          action_type: 'WARNING_NO_BOOK_CONFIG',
          old_data: null,
          new_data: {
            level: normalizedLevel,
            apply_month: currentMonth,
            message: `Thiếu cấu hình sách trong Book_Catalog cho trình độ ${normalizedLevel} tại tháng ${currentMonth}`,
          },
          performed_by: 'SYSTEM_BOOK_MAPPER',
        },
      });

      return null;
    } catch (error) {
      this.logger.error(`Lỗi khi truy vấn Get_Book_Set cho ${level} - tháng ${currentMonth}: ${error.message}`);
      return null;
    }
  }

  /**
   * Lấy toàn bộ danh sách cấu hình sách
   */
  async getAllCatalog() {
    return this.prisma.bookCatalog.findMany({
      orderBy: [{ level: 'asc' }, { apply_month: 'asc' }],
    });
  }

  /**
   * 2026-09-17 (Anh chốt): Hỗ trợ Ops cấu hình 1 bộ sách áp dụng cho nhiều tháng cùng lúc (ví dụ chu kỳ 2 tháng/bộ)
   */
  async saveConfig(data: {
    level: string;
    months: number[];
    book_code: string;
    book_name: string;
    notes?: string;
  }) {
    const { level, months, book_code, book_name, notes } = data;
    const normalizedLevel = level.trim();

    return this.prisma.$transaction(async (tx) => {
      for (const month of months) {
        await tx.bookCatalog.upsert({
          where: {
            uq_level_month: {
              level: normalizedLevel,
              apply_month: month,
            },
          },
          update: {
            book_code,
            book_name,
            notes,
            updated_at: new Date(),
          },
          create: {
            level: normalizedLevel,
            apply_month: month,
            book_code,
            book_name,
            notes,
          },
        });
      }
      return { success: true, count: months.length };
    });
  }

  /**
   * Xóa một cấu hình cụ thể
   */
  async deleteConfig(id: number) {
    return this.prisma.bookCatalog.delete({
      where: { id },
    });
  }

  /**
   * 2026-09-17 (Anh chốt): Quét các trình độ đang có học sinh học mà thiếu cấu hình sách cho tháng hiện tại
   */
  async getMissingConfigs(currentMonth: number) {
    // Lấy các level đang ACTIVE từ bảng students_master
    const activeLevels = await this.prisma.studentsMaster.findMany({
      where: {
        status: { in: ['Chờ khai giảng', 'Đang học', 'Lớp nháp'] },
      },
      select: { level: true },
      distinct: ['level'],
    });

    const configuredLevels = await this.prisma.bookCatalog.findMany({
      where: { apply_month: currentMonth },
      select: { level: true },
    });

    const configuredSet = new Set(configuredLevels.map((c) => c.level));
    const missing = activeLevels
      .map((a) => a.level)
      .filter((level) => !configuredSet.has(level));

    return {
      current_month: currentMonth,
      missing_levels: missing,
    };
  }
}
