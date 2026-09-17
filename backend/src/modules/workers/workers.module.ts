import { Module } from '@nestjs/common';
import { HourlySyncWorker } from './hourly-sync.worker';
import { DailyCatchupWorker } from './daily-catchup.worker';
import { GoogleSheetsModule } from '../google-sheets/google-sheets.module';
import { BookCatalogModule } from '../book-catalog/book-catalog.module';

@Module({
  imports: [GoogleSheetsModule, BookCatalogModule],
  providers: [HourlySyncWorker, DailyCatchupWorker],
  exports: [HourlySyncWorker, DailyCatchupWorker],
})
export class WorkersModule {}
