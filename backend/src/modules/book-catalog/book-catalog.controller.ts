// ============================================================================
// BOOK CATALOG CONTROLLER
// Version: v2026.09.17.01
// 2026-09-17 (Anh chốt): Cung cấp RESTful API cho Ops quản trị danh mục sách và cấu hình ma trận
// ============================================================================

import { Controller, Get, Post, Delete, Body, Param, Query, HttpStatus, HttpException } from '@nestjs/common';
import { BookCatalogService } from './book-catalog.service';

@Controller('api/book-catalog')
export class BookCatalogController {
  constructor(private readonly bookCatalogService: BookCatalogService) {}

  @Get()
  async getCatalog() {
    try {
      const data = await this.bookCatalogService.getAllCatalog();
      return { success: true, data };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  async saveConfig(
    @Body() body: { level: string; months: number[]; book_code: string; book_name: string; notes?: string },
  ) {
    try {
      if (!body.level || !body.months || body.months.length === 0 || !body.book_code || !body.book_name) {
        throw new HttpException('Vui lòng nhập đầy đủ thông tin bắt buộc', HttpStatus.BAD_REQUEST);
      }
      const result = await this.bookCatalogService.saveConfig(body);
      return { success: true, result };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message },
        error.getStatus ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  async deleteConfig(@Param('id') id: string) {
    try {
      await this.bookCatalogService.deleteConfig(parseInt(id, 10));
      return { success: true, message: 'Đã xóa cấu hình thành công' };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('missing-check')
  async checkMissing(@Query('month') month?: string) {
    try {
      const currentMonth = month ? parseInt(month, 10) : new Date().getMonth() + 1;
      const result = await this.bookCatalogService.getMissingConfigs(currentMonth);
      return { success: true, result };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
