// ============================================================================
// PRISMA SERVICE
// Version: v2026.09.17.01
// 2026-09-17 (Anh chốt): Khởi tạo kết nối CSDL và xử lý graceful shutdown cho NestJS
// ============================================================================

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
