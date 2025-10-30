import { Module } from '@nestjs/common';
import { CvsController } from './cvs.controller';
import { CvsService } from './cvs.service';
import { StorageService } from '../storage/storage.service';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';

/**
 * CVs module
 * Handles CV upload, management, and storage operations
 */
@Module({
  imports: [AuthModule],
  controllers: [CvsController],
  providers: [CvsService, StorageService, PrismaService],
  exports: [CvsService],
})
export class CvsModule {}
