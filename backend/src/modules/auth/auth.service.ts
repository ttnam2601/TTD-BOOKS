// ============================================================================
// AUTH SERVICE - USER AUTHENTICATION & RBAC
// Version: v2026.09.17.02
// 2026-09-17 (Anh chốt): Xác thực danh tính người dùng và phân quyền Role: COORDINATOR (Xếp lớp) & DISPATCHER (Vận đơn)
// ============================================================================

import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

export interface LoginDto {
  username: string;
  password: string;
}

export interface UserPayload {
  id: string;
  username: string;
  fullName: string;
  role: 'COORDINATOR' | 'DISPATCHER' | 'ADMIN';
}

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;

  constructor(private readonly prisma: PrismaService) {
    this.jwtSecret = process.env.JWT_SECRET || 'super-secret-jwt-token-key-2026';
  }

  /**
   * 2026-09-17 (Anh chốt): Mã hóa SHA-256 cho mật khẩu đảm bảo an toàn & nhẹ nhàng, tương thích 100% môi trường Alpine Docker
   */
  hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  /**
   * Tạo JWT Token thủ công bằng chuẩn HMAC-SHA256 (không phụ thuộc gói native)
   */
  private generateToken(payload: UserPayload): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 ngày
    const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(${header}.)
      .digest('base64url');
    return ${header}..;
  }

  /**
   * Giải mã và xác minh JWT Token
   */
  verifyToken(token: string): UserPayload {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new UnauthorizedException('Token không hợp lệ');
      }
      const [header, body, signature] = parts;
      const expectedSig = crypto
        .createHmac('sha256', this.jwtSecret)
        .update(${header}.)
        .digest('base64url');

      if (signature !== expectedSig) {
        throw new UnauthorizedException('Chữ ký Token không hợp lệ');
      }

      const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
      if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
        throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
      }

      return {
        id: decoded.id,
        username: decoded.username,
        fullName: decoded.fullName,
        role: decoded.role,
      };
    } catch (err) {
      throw new UnauthorizedException(err.message || 'Token không hợp lệ');
    }
  }

  /**
   * Đăng nhập hệ thống
   */
  async login(dto: LoginDto) {
    if (!dto.username || !dto.password) {
      throw new BadRequestException('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu');
    }

    const username = dto.username.trim().toLowerCase();
    const passwordHash = this.hashPassword(dto.password);

    // Tìm kiếm user trong DB
    let user = await this.prisma.user.findUnique({
      where: { username },
    });

    // 2026-09-17 (Anh chốt): Tự động nạp 2 tài khoản mặc định nếu DB chưa có bản ghi
    if (!user) {
      if (username === 'vandon' && dto.password === 'vandon@123') {
        user = await this.prisma.user.create({
          data: {
            username: 'vandon',
            passwordHash,
            fullName: 'Bộ Phận Vận Đơn',
            role: 'DISPATCHER',
          },
        });
      } else if (username === 'xeplop' && dto.password === 'xeplop@123') {
        user = await this.prisma.user.create({
          data: {
            username: 'xeplop',
            passwordHash,
            fullName: 'Bộ Phận Xếp Lớp',
            role: 'COORDINATOR',
          },
        });
      }
    }

    if (!user || user.passwordHash !== passwordHash) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không chính xác');
    }

    const payload: UserPayload = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role as any,
    };

    const token = this.generateToken(payload);

    return {
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }
}