// ============================================================================
// STUDENTS CONTROLLER
// Version: v2026.09.17.01
// 2026-09-17 (Anh chốt): API quản lý học sinh và upload file Excel danh bạ
// ============================================================================

import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  UseInterceptors,
  UploadedFile,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StudentsService } from './students.service';

@Controller('api/students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  async getStudents(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('level') level?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const data = await this.studentsService.getAllStudents({
        search,
        status,
        level,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 50,
      });
      return { success: true, ...data };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async getStudentDetail(@Param('id') id: string) {
    try {
      const data = await this.studentsService.getStudentDetail(id);
      if (!data) {
        throw new HttpException('Không tìm thấy học sinh', HttpStatus.NOT_FOUND);
      }
      return { success: true, data };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message },
        error.getStatus ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('import-contacts')
  @UseInterceptors(FileInterceptor('file'))
  async importContacts(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new HttpException('Vui lòng chọn file Excel để upload (.xlsx, .xls)', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.studentsService.importContactsFromExcel(file.buffer);
      return result;
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
