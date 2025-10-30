import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for user data in login response
 * Contains only public user information (id and email)
 */
export class LoginUserDto {
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
}

/**
 * DTO for login response
 * Contains user data and JWT access token
 */
export class LoginResponseDto {
  @ApiProperty({
    description: 'Authenticated user data',
    type: LoginUserDto,
  })
  user: LoginUserDto;

  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    type: String,
  })
  token: string;
}
