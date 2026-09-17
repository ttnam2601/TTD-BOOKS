// ============================================================================
// APP MODULE
// Version: v2026.09.17.01
// 2026-09-17 (Anh chốt): Gom toàn bộ các module nghiệp vụ và kích hoạt Task Scheduling (node-cron)
// ============================================================================

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { BookCatalogModule } from './modules/book-catalog/book-catalog.module';
import { GoogleSheetsModule } from './modules/google-sheets/google-sheets.module';
import { StudentsModule } from './modules/students/students.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { WorkersModule } from './modules/workers/workers.module';
import { SyncModule } from './modules/sync/sync.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    BookCatalogModule,
    GoogleSheetsModule,
    StudentsModule,
    ShippingModule,
    WorkersModule,
    SyncModule,
  ],
})
export class AppModule {}
