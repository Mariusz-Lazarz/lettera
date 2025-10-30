import { ApiProperty } from '@nestjs/swagger';

/**
 * Single letter item in list response
 */
export class LetterListItemDto {
  @ApiProperty({
    description: 'Unique letter identifier',
    type: String,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'HTML content of the letter',
    type: String,
  })
  html: string;

  @ApiProperty({
    description:
      'Status of the letter - completed if PDF has been generated, pending otherwise',
    enum: ['completed', 'pending'],
    example: 'completed',
  })
  status: 'completed' | 'pending';

  @ApiProperty({
    description: 'ISO 8601 timestamp of letter creation',
    type: String,
    example: '2025-10-30T12:00:00.000Z',
  })
  created_at: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp of last update',
    type: String,
    example: '2025-10-30T12:00:00.000Z',
  })
  updated_at: string;
}

/**
 * Response DTO for GET /letters
 * Returns list of all letters for authenticated user
 */
export class ListLettersResponseDto {
  @ApiProperty({
    description: 'Array of letter items (max 5 per user)',
    type: [LetterListItemDto],
  })
  items: LetterListItemDto[];
}
