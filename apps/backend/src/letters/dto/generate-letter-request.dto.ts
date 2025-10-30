import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Length } from 'class-validator';

/**
 * DTO for generating a cover letter
 * Validates incoming request body for POST /letters
 */
export class GenerateLetterRequestDto {
  @ApiProperty({
    description: 'UUID of the CV to use for letter generation',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @IsUUID('4', { message: 'cv_id must be a valid UUID' })
  cv_id: string;

  @ApiProperty({
    description: 'Job title for the position',
    example: 'Senior Backend Engineer',
    minLength: 1,
    maxLength: 200,
    type: String,
  })
  @IsString()
  @Length(1, 200, {
    message: 'job_title must be between 1 and 200 characters',
  })
  job_title: string;

  @ApiProperty({
    description: 'Full job description text',
    example:
      'We are looking for an experienced backend engineer to join our team...',
    minLength: 1000,
    maxLength: 10000,
    type: String,
  })
  @IsString()
  @Length(1000, 10000, {
    message: 'job_description must be between 1000 and 10000 characters',
  })
  job_description: string;
}
