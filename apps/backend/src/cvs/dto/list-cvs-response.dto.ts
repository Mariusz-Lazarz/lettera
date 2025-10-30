import { ApiProperty } from '@nestjs/swagger';
import { ListCvItemDto } from './list-cv-item.dto';

/**
 * Response DTO for listing CVs
 * Contains array of CV items without sensitive data
 */
export class ListCvsResponseDto {
  @ApiProperty({
    description: 'Array of CV items',
    type: [ListCvItemDto],
    example: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        filename: 'John_Doe_CV_2025.pdf',
        created_at: '2025-10-30T12:34:56.789Z',
      },
    ],
  })
  items: ListCvItemDto[];
}
