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
  student_uid: string; // Cột O (UID) hoặc Cột A (SID)
  sid?: string;        // Cột A: student
  full_name: string;   // Cột B: studentName
  cid?: string;        // Cột C: contactCode
  class_code?: string; // Cột D: classCode (Mã lớp)
  class_name: string;  // Tên lớp (lấy từ classCode hoặc level)
  status: string;      // Cột E: studentStatus
  join_date?: string;  // Cột F: joinDate
  teacher_type?: string;// Cột G: teacherType
  class_type?: string; // Cột H: classType
  level: string;       // Cột I: level (Tên trình độ)
  subject?: string;    // Cột J: subject
  student_carer?: string; // Cột K: studentCarer
  lesson_learn?: number;  // Cột L: lessonLearn
  total_less?: number;    // Cột M: totalLess
  remaining_sessions: number; // Cột N: remainingLess
}

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);
  private readonly defaultSpreadsheetId = '1YndQ-dB3jDJMGDUFW6AlSU-14wvFY9dtpx-lrGlpEKk';
  private readonly defaultSheetName = 'Class.Student.Total';

  /**
   * 2026-09-17 (Anh chốt): Lấy client Google Sheets với Service Account và cơ chế Exponential Backoff
   * Khắc phục triệt để lỗi EISDIR khi Docker mount nhầm directory nếu file chưa tồn tại
   */
  private getSheetsClient() {
    try {
      const credsPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || path.join(process.cwd(), 'credentials.json');
      
      // 2026-09-17 (Anh chốt): Bắt buộc kiểm tra fs.statSync(credsPath).isFile() để tránh lỗi EISDIR
      if (fs.existsSync(credsPath)) {
        const stat = fs.statSync(credsPath);
        if (stat.isFile()) {
          const auth = new google.auth.GoogleAuth({
            keyFile: credsPath,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
          });
          return google.sheets({ version: 'v4', auth });
        } else {
          this.logger.warn(`Đường dẫn ${credsPath} là một thư mục (do docker mount tự sinh), bỏ qua nạp file.`);
        }
      }

      if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        let jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON.trim();
        // Hỗ trợ Base64 encoded JSON nếu có
        if (!jsonStr.startsWith('{')) {
          try {
            jsonStr = Buffer.from(jsonStr, 'base64').toString('utf-8');
          } catch (e) {
            // Không phải base64, giữ nguyên
          }
        }
        const credentials = JSON.parse(jsonStr);
        const auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        return google.sheets({ version: 'v4', auth });
      }
    } catch (err) {
      this.logger.error(`Lỗi khởi tạo Google Auth: ${err.message}`);
    }

    this.logger.warn('Chưa cấu hình Google Service Account credentials hợp lệ. Sử dụng Mock dữ liệu cho môi trường Development.');
    return null;
  }

  /**
   * 2026-09-17 (Anh chốt): Kéo dữ liệu từ Google Sheets với retry tối đa 3 lần
   * Chuẩn hóa mapping 100% khớp các cột theo bảng tính Class.Student.Total:
   * Col A (0): student (SID)
   * Col B (1): studentName
   * Col C (2): contactCode (CID)
   * Col D (3): classCode (Mã lớp)
   * Col E (4): studentStatus
   * Col F (5): joinDate
   * Col G (6): teacherType
   * Col H (7): classType
   * Col I (8): level (Tên trình độ)
   * Col J (9): subject
   * Col K (10): studentCarer
   * Col L (11): lessonLearn
   * Col M (12): totalLess
   * Col N (13): remainingLess (Số buổi còn lại)
   * Col O (14): UID
   */
  async fetchMasterStudents(): Promise<StudentMasterRow[]> {
    const sheets = this.getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || this.defaultSpreadsheetId;
    const range = `${this.defaultSheetName}!A2:P`;

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

        const students: StudentMasterRow[] = rows
          .filter((r) => {
            const hasId = (r[14] && r[14].toString().trim() !== '') || (r[0] && r[0].toString().trim() !== '');
            const subjectVal = r[9]?.toString().trim() || '';
            // 2026-09-17 (Anh chốt): Chỉ lấy học sinh thuộc môn Toán
            const isMath = subjectVal === 'Toán' || subjectVal.toLowerCase().includes('toán');
            return hasId && isMath;
          })
          .map((r) => {
            const sid = r[0]?.toString().trim() || '';
            const fullName = r[1]?.toString().trim() || 'Học sinh';
            const cid = r[2]?.toString().trim() || '';
            const classCode = r[3]?.toString().trim() || '';
            const status = r[4]?.toString().trim() || 'Chờ xử lý';
            const joinDate = r[5]?.toString().trim() || '';
            const teacherType = r[6]?.toString().trim() || '';
            const classType = r[7]?.toString().trim() || '';
            const level = r[8]?.toString().trim() || 'Chưa phân cấp';
            const subject = r[9]?.toString().trim() || '';
            const studentCarer = r[10]?.toString().trim() || '';
            const lessonLearn = parseInt(r[11]?.toString() || '0', 10) || 0;
            const totalLess = parseInt(r[12]?.toString() || '0', 10) || 0;
            const remainingLess = parseInt(r[13]?.toString() || '0', 10) || 0;
            const uid = r[14]?.toString().trim() || sid;

            return {
              student_uid: uid,
              sid,
              full_name: fullName,
              cid,
              class_code: classCode,
              class_name: classCode || level,
              status,
              join_date: joinDate,
              teacher_type: teacherType,
              class_type: classType,
              level,
              subject,
              student_carer: studentCarer,
              lesson_learn: lessonLearn,
              total_less: totalLess,
              remaining_sessions: remainingLess,
            };
          });

        this.logger.log(`Kéo thành công ${students.length} bản ghi học sinh từ Google Sheet Class.Student.Total.`);
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
