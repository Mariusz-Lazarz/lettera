import { Module } from '@nestjs/common';
import { LettersController } from './letters.controller';
import { LettersService } from './letters.service';
import { LetterPdfService } from './letter-pdf.service';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../storage/storage.service';
import { AiProviderModule } from '../integrations/ai/ai-provider.module';
import { PdfExtractorModule } from '../integrations/pdf/pdf-extractor.module';

/**
 * Letters module
 * Handles cover letter generation and management
 */
@Module({
  imports: [AiProviderModule, PdfExtractorModule],
  controllers: [LettersController],
  providers: [LettersService, LetterPdfService, PrismaService, StorageService],
  exports: [LettersService, LetterPdfService],
})
export class LettersModule {}
