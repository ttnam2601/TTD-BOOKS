import { Module } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { ShippingController } from './shipping.controller';
import { BookCatalogModule } from '../book-catalog/book-catalog.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [BookCatalogModule, AuthModule],
  controllers: [ShippingController],
  providers: [ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
