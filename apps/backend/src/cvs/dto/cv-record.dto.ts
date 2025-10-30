import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for CV record response
 * Returned after successful CV upload
 */
export class CvRecordDto {
  @ApiProperty({
    description: 'Unique identifier for the CV',
    type: String,
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'User ID who owns this CV',
    type: String,
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  userId: string;

  @ApiProperty({
    description: 'Filename of the CV',
    type: String,
    example: 'John_Doe_CV_2025.pdf',
  })
  filename: string;

  @ApiProperty({
    description: 'S3 storage key for the CV file',
    type: String,
    example:
      'user/123e4567-e89b-12d3-a456-426614174001/cvs/123e4567-e89b-12d3-a456-426614174000.pdf',
  })
  s3Key: string;

  @ApiProperty({
    description: 'Creation timestamp',
    type: String,
    format: 'date-time',
    example: '2025-10-30T12:34:56.000Z',
  })
  createdAt: string;
}
