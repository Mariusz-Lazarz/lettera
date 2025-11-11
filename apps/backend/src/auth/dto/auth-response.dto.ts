import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for user data in authentication responses
 * Excludes sensitive fields like passwordHash
 */
export class AuthUserDto {
  @ApiProperty({
    description: 'User unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: String,
  })
  id: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
    type: String,
  })
  email: string;

  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2025-10-29T12:00:00.000Z',
    type: Date,
  })
  createdAt: Date;
}

/**
 * DTO for registration response
 * Contains user data (token is sent via httpOnly cookie)
 */
export class RegisterResponseDto {
  @ApiProperty({
    description: 'Registered user data',
    type: AuthUserDto,
  })
  user: AuthUserDto;
}
