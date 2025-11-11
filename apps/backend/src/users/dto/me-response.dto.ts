import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for GET /users/me endpoint
 * Contains minimal user profile information for authenticated user
 */
export class MeResponseDto {
  @ApiProperty({
    description: 'User unique identifier (UUID)',
    type: String,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'User email address',
    type: String,
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Account creation timestamp in ISO8601 format',
    type: String,
    example: '2025-10-30T12:34:56.789Z',
  })
  created_at: string;
}

