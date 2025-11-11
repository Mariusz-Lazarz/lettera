import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MeResponseDto } from './dto';

/**
 * Service handling user-related operations
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves minimal user profile information by user ID
   * Used for authenticated endpoints like GET /users/me
   * @param userId - User UUID
   * @returns MeResponseDto with id, email, and created_at
   * @throws NotFoundException if user not found
   * @throws InternalServerErrorException for database errors
   */
  async getByIdMinimal(userId: string): Promise<MeResponseDto> {
    try {
      // Query user with minimal field selection to avoid exposing passwordHash
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
      });

      // Handle user not found case
      if (!user) {
        this.logger.warn(
          `User not found: ${JSON.stringify({
            userId,
            timestamp: new Date().toISOString(),
          })}`,
        );
        throw new NotFoundException('User not found');
      }

      // Map database fields to response DTO
      // createdAt (Date) -> created_at (ISO8601 string)
      const response: MeResponseDto = {
        id: user.id,
        email: user.email,
        created_at: user.createdAt.toISOString(),
      };

      return response;
    } catch (error) {
      // Re-throw NotFoundException (expected error)
      if (error instanceof NotFoundException) {
        throw error;
      }

      // Log unexpected database errors
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Failed to fetch user profile: ${JSON.stringify({
          userId,
          error: errorMessage,
          stack: errorStack,
          timestamp: new Date().toISOString(),
        })}`,
      );

      // Throw generic error to client
      throw new InternalServerErrorException(
        'An error occurred while fetching user profile',
      );
    }
  }
}

