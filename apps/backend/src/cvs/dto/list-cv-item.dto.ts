import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for a single CV item in the list response
 * Contains only public fields (excludes s3Key and userId for security)
 */
export class ListCvItemDto {
  @ApiProperty({
    description: 'Unique identifier for the CV',
    type: String,
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Filename of the CV',
    type: String,
    example: 'John_Doe_CV_2025.pdf',
  })
  filename: string;

  @ApiProperty({
    description: 'Creation timestamp in ISO 8601 format',
    type: String,
    format: 'date-time',
    example: '2025-10-30T12:34:56.789Z',
  })
  created_at: string;
}
