import { Controller, Post, HttpStatus, HttpException } from '@nestjs/common';
import { SyncService } from './sync.service';

@Controller('api/sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('manual')
  async manualSync() {
    try {
      const result = await this.syncService.triggerManualSync();
      return result;
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message },
        error.getStatus ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
