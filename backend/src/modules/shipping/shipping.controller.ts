// ============================================================================
// SHIPPING CONTROLLER
// Version: v2026.09.17.01
// 2026-09-17 (Anh chốt): REST API quản lý hàng đợi xuất kho, lịch sử và xác nhận xuất kho
// ============================================================================

import { Controller, Get, Post, Body, Query, HttpStatus, HttpException } from '@nestjs/common';
import { ShippingService, ConfirmShipmentDto } from './shipping.service';

@Controller('api/shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get('queue')
  async getQueue(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('level') level?: string,
  ) {
    try {
      const data = await this.shippingService.getQueue({ status, search, level });
      return { success: true, data };
    } catch (error) {
      throw new HttpException({ success: false, message: error.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('history')
  async getHistory(@Query('search') search?: string, @Query('limit') limit?: string) {
    try {
      const data = await this.shippingService.getHistory({
        search,
        limit: limit ? parseInt(limit, 10) : 100,
      });
      return { success: true, data };
    } catch (error) {
      throw new HttpException({ success: false, message: error.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('confirm')
  async confirmShipment(@Body() dto: ConfirmShipmentDto) {
    try {
      const result = await this.shippingService.confirmShipment(dto);
      return result;
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message },
        error.getStatus ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('logs')
  async getAuditLogs(@Query('limit') limit?: string) {
    try {
      const data = await this.shippingService.getAuditLogs(limit ? parseInt(limit, 10) : 100);
      return { success: true, data };
    } catch (error) {
      throw new HttpException({ success: false, message: error.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
