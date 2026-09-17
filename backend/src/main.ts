// ============================================================================
// MAIN APPLICATION ENTRYPOINT
// Version: v2026.09.17.01
// 2026-09-17 (Anh chốt): Khởi chạy NestJS API Server với CORS mở cho Frontend Vue 3 và graceful shutdown
// ============================================================================

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // 2026-09-17 (Anh chốt): Mở CORS cho Frontend Admin giao tiếp
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Hệ thống Backend Vận đơn Sách khởi chạy thành công tại port: ${port} (Version: v2026.09.17.01)`);
}
bootstrap();
