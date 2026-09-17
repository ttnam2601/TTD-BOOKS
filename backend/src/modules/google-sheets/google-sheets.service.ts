// ============================================================================
// GOOGLE SHEETS SERVICE
// Version: v2026.09.17.01
// 2026-09-17 (Anh chốt): Đồng bộ dữ liệu học vụ từ Sheet Class.Student.Total (Spreadsheet ID: 1YndQ-dB3jDJMGDUFW6AlSU-14wvFY9dtpx-lrGlpEKk)
// ============================================================================

import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

export interface StudentMasterRow {
  student_uid: string;
  full_name: string;
  level: string;
  class_name: string;
  status: string;
  remaining_sessions: number;
}

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);
  private readonly defaultSpreadsheetId = '1YndQ-dB3jDJMGDUFW6AlSU-14wvFY9dtpx-lrGlpEKk';
  private readonly defaultSheetName = 'Class.Student.Total';

  /**
   * 2026-09-17 (Anh chốt): Lấy client Google Sheets với Service Account và cơ chế Exponential Backoff
   */
  private getSheetsClient() {
    const credsPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || path.join(process.cwd(), 'credentials.json');
    
    if (fs.existsSync(credsPath)) {
      const auth = new google.auth.GoogleAuth({
        keyFile: credsPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
      return google.sheets({ version: 'v4', auth });
    }

    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
      return google.sheets({ version: 'v4', auth });
    }

    this.logger.warn('Chưa cấu hình Google Service Account credentials. Sử dụng Mock dữ liệu cho môi trường Development.');
    return null;
  }

  /**
   * 2026-09-17 (Anh chốt): Kéo dữ liệu từ Google Sheets với retry tối đa 3 lần để phòng vệ lỗi Rate limit / 429
   */
  async fetchMasterStudents(): Promise<StudentMasterRow[]> {
    const sheets = this.getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || this.defaultSpreadsheetId;
    const range = `${this.defaultSheetName}!A2:Z`;

    if (!sheets) {
      // 2026-09-17 (Anh chốt): Fallback dữ liệu mẫu nếu chưa gắn credentials trên môi trường dev local
      return this.getMockStudents();
    }

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
          this.logger.warn('Google Sheet trả về dữ liệu rỗng.');
          return [];
        }

        // Map cột: UID Học sinh, Tên học sinh, Trình độ, Lớp đang học, Trạng thái, Buổi còn lại
        const students: StudentMasterRow[] = rows
          .filter((r) => r[0] && r[0].toString().trim() !== '')
          .map((r) => ({
            student_uid: r[0]?.toString().trim(),
            full_name: r[1]?.toString().trim() || 'Học sinh',
            level: r[2]?.toString().trim() || 'Chưa phân cấp',
            class_name: r[3]?.toString().trim() || 'Chưa xếp lớp',
            status: r[4]?.toString().trim() || 'Chờ xử lý',
            remaining_sessions: parseInt(r[5]?.toString() || '0', 10) || 0,
          }));

        this.logger.log(`Kéo thành công ${students.length} bản ghi học sinh từ Google Sheet.`);
        return students;
      } catch (error) {
        this.logger.error(`Lỗi fetch Google Sheet (Lần thử ${attempts}/${maxAttempts}): ${error.message}`);
        if (attempts >= maxAttempts) {
          throw error;
        }
        // Chờ exponential backoff: 1s, 2s, 4s
        await new Promise((res) => setTimeout(res, Math.pow(2, attempts) * 1000));
      }
    }

    return [];
  }

  /**
   * Mock dữ liệu học sinh phục vụ dev và test
   */
  private getMockStudents(): StudentMasterRow[] {
    return [
      {
        student_uid: 'HS001',
        full_name: 'Nguyễn Văn An',
        level: 'Trình độ A',
        class_name: 'Lớp A.01',
        status: 'Đang học',
        remaining_sessions: 16,
      },
      {
        student_uid: 'HS002',
        full_name: 'Trần Thị Bình',
        level: 'Trình độ B',
        class_name: 'Lớp B.02',
        status: 'Chờ khai giảng',
        remaining_sessions: 24,
      },
      {
        student_uid: 'HS003',
        full_name: 'Lê Hoàng Cúc',
        level: 'Trình độ A',
        class_name: 'Lớp A.03',
        status: 'Bảo lưu',
        remaining_sessions: 8,
      },
      {
        student_uid: 'HS004',
        full_name: 'Phạm Minh Đức',
        level: 'Trình độ C',
        class_name: 'Lớp C.01',
        status: 'Đang học',
        remaining_sessions: 20,
      },
    ];
  }
}
