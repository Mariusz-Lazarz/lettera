import {
  Controller,
  Get,
  UseGuards,
  Request,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { MeResponseDto } from './dto';

/**
 * Request object extended with user property from JWT authentication
 */
interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
  };
}

/**
 * Controller handling user-related endpoints
 */
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /users/me - Returns minimal profile of authenticated user
   * Requires valid JWT token in Authorization header
   * @param req - Express request object with authenticated user
   * @returns MeResponseDto with id, email, and created_at
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Returns minimal profile information for the authenticated user. Requires valid JWT token.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User profile retrieved successfully',
    type: MeResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid authentication token',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Unauthorized',
        },
        statusCode: {
          type: 'number',
          example: 401,
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'User not found in database (rare case)',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'User not found',
        },
        statusCode: {
          type: 'number',
          example: 404,
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'An error occurred while fetching user profile',
        },
        statusCode: {
          type: 'number',
          example: 500,
        },
      },
    },
  })
  async getMe(@Request() req: AuthenticatedRequest): Promise<MeResponseDto> {
    // Extract userId from JWT payload (attached by JwtAuthGuard via JwtStrategy)
    const userId = req.user.userId;

    // Delegate to service layer for business logic
    return this.usersService.getByIdMinimal(userId);
  }
}
