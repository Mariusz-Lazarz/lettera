import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

/**
 * DTO for CV upload request
 * File is handled by multer FileInterceptor, this DTO validates the optional filename
 */
export class UploadCvRequestDto {
  @ApiPropertyOptional({
    description: 'Custom filename for the CV (max 255 characters)',
    type: String,
    maxLength: 255,
    example: 'John_Doe_CV_2025.pdf',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, {
    message: 'Filename must not exceed 255 characters',
  })
  filename?: string;
}
