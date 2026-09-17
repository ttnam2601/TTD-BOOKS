// ============================================================================
// STUDENTS CONTROLLER
// Version: v2026.09.17.01
// 2026-09-17 (Anh chốt): API quản lý học sinh và upload file Excel danh bạ
// ============================================================================

import {
  Controller,
  Get,
  Post,
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
  async getStudents() {
    try {
      const data = await this.studentsService.getAllStudents();
      return { success: true, data };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
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
