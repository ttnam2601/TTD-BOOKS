// ============================================================================
// MANUAL SYNC SERVICE & CONTROLLER
// Version: v2026.09.17.01
// 2026-09-17 (Anh chốt): Dùng PostgreSQL Advisory Lock để triệt tiêu Race Condition giữa Cron Worker và Manual Sync API
// ============================================================================

import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HourlySyncWorker } from '../workers/hourly-sync.worker';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly SYNC_LOCK_ID = 1001;

  constructor(
    private readonly prisma: PrismaService,
    private readonly hourlySyncWorker: HourlySyncWorker,
  ) {}

  async triggerManualSync() {
    // 2026-09-17 (Anh chốt): Khóa Advisory Lock mức DB để ngăn chặn 2 người cùng bấm nút hoặc trùng lúc Cron đang chạy
    const lockResult: any = await this.prisma.$queryRawUnsafe(
      `SELECT pg_try_advisory_lock(${this.SYNC_LOCK_ID}) as locked;`
    );

    const isLocked = lockResult[0]?.locked;

    if (!isLocked) {
      throw new ConflictException('Tiến trình đồng bộ đang chạy ngầm, vui lòng đợi trong giây lát và thử lại.');
    }

    try {
      this.logger.log('Đã giữ Advisory Lock thành công. Tiến hành đồng bộ thủ công...');
      const result = await this.hourlySyncWorker.executeSync('MANUAL_API_TRIGGER');

      // Ghi Action_Logs cho thao tác kích hoạt thủ công
      await this.prisma.actionLogs.create({
        data: {
          entity_type: 'SYSTEM',
          entity_id: 'MANUAL_SYNC',
          action_type: 'MANUAL_SYNC_TRIGGERED',
          old_data: null,
          new_data: result,
          performed_by: 'OPERATOR_UI',
        },
      });

      return result;
    } finally {
      // 2026-09-17 (Anh chốt): Luôn giải phóng lock trong khối finally dù thành công hay thất bại
      await this.prisma.$queryRawUnsafe(`SELECT pg_advisory_unlock(${this.SYNC_LOCK_ID});`);
      this.logger.log('Đã giải phóng Advisory Lock.');
    }
  }
}
