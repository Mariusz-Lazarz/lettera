import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/**
 * DTO for validating path parameter in delete letter endpoint
 * Ensures the letter ID is a valid UUID
 */
export class DeleteLetterParamsDto {
  @ApiProperty({
    description: 'Letter ID (UUID)',
    type: String,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'Letter ID must be a valid UUID' })
  id: string;
}
