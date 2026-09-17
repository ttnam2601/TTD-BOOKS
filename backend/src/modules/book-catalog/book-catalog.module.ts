import { Module } from '@nestjs/common';
import { BookCatalogService } from './book-catalog.service';
import { BookCatalogController } from './book-catalog.controller';

@Module({
  controllers: [BookCatalogController],
  providers: [BookCatalogService],
  exports: [BookCatalogService],
})
export class BookCatalogModule {}
