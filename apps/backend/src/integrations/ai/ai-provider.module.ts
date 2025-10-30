import { Module } from '@nestjs/common';
import { AiProviderService } from './ai-provider.service';

/**
 * AI Provider Module
 * Provides AI services for letter generation
 */
@Module({
  providers: [AiProviderService],
  exports: [AiProviderService],
})
export class AiProviderModule {}
