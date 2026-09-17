// ============================================================================
// AUTH CONTROLLER - LOGIN & PROFILE ENDPOINTS
// Version: v2026.09.17.02
// 2026-09-17 (Anh chốt): Cung cấp API đăng nhập và kiểm tra phân quyền người dùng
// ============================================================================

import { Controller, Post, Get, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { AuthService, LoginDto } from './auth.service';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  async me(@Headers('authorization') authHeader?: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Chưa đăng nhập');
    }
    const token = authHeader.substring(7);
    const user = this.authService.verifyToken(token);
    return {
      success: true,
      user,
    };
  }
}