import { Module } from '@nestjs/common';
import { PdfExtractorService } from './pdf-extractor.service';

/**
 * PDF Extractor Module
 * Provides PDF text extraction services
 */
@Module({
  providers: [PdfExtractorService],
  exports: [PdfExtractorService],
})
export class PdfExtractorModule {}
