import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';
import {
  RegisterRequestDto,
  RegisterResponseDto,
  AuthUserDto,
  LoginRequestDto,
  LoginResponseDto,
} from './dto';
import { Prisma } from '@prisma/client';

/**
 * Authentication service handling user registration and JWT generation
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly bcryptRounds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {
    // Get bcrypt rounds from environment or use default 12
    this.bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
  }

  /**
   * Registers a new user with email and password
   * @param dto - Registration request data
   * @returns User data and JWT access token
   * @throws ConflictException if email already exists
   * @throws InternalServerErrorException for unexpected errors
   */
  async register(dto: RegisterRequestDto): Promise<RegisterResponseDto> {
    try {
      // Normalize email (trim and lowercase)
      const email = dto.email.trim().toLowerCase();

      // Hash password with bcrypt
      const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);

      // Create user in database
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
        },
      });

      // Generate JWT token
      const token = this.jwtService.sign({
        sub: user.id,
        email: user.email,
      });

      // Log successful registration (without sensitive data)
      this.logger.log(
        `User registered successfully: ${JSON.stringify({
          userId: user.id,
          email: user.email,
          timestamp: new Date().toISOString(),
        })}`,
      );

      // Map to response DTO (exclude passwordHash)
      const userResponse: AuthUserDto = {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      };

      return {
        user: userResponse,
        token,
      };
    } catch (error) {
      // Handle Prisma unique constraint violation (duplicate email)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.warn(
          `Registration failed - email already exists: ${JSON.stringify({
            email: dto.email,
            timestamp: new Date().toISOString(),
          })}`,
        );
        throw new ConflictException('Email already exists');
      }

      // Log unexpected errors with full details
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Registration failed with unexpected error: ${JSON.stringify({
          email: dto.email,
          error: errorMessage,
          stack: errorStack,
          timestamp: new Date().toISOString(),
        })}`,
      );

      // Throw generic error to client
      throw new InternalServerErrorException(
        'An error occurred during registration',
      );
    }
  }

  /**
   * Authenticates a user with email and password
   * @param dto - Login request data
   * @returns User data and JWT access token
   * @throws UnauthorizedException if credentials are invalid
   * @throws InternalServerErrorException for unexpected errors
   */
  async login(dto: LoginRequestDto): Promise<LoginResponseDto> {
    try {
      // Normalize email (trim and lowercase)
      const email = dto.email.trim().toLowerCase();

      // Fetch user from database
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      // Check if user exists
      if (!user) {
        this.logger.warn(
          `Login failed - user not found: ${JSON.stringify({
            email,
            timestamp: new Date().toISOString(),
          })}`,
        );
        throw new UnauthorizedException('Invalid credentials');
      }

      // Verify password using bcrypt
      const isPasswordValid = await bcrypt.compare(
        dto.password,
        user.passwordHash,
      );

      if (!isPasswordValid) {
        this.logger.warn(
          `Login failed - invalid password: ${JSON.stringify({
            userId: user.id,
            email: user.email,
            timestamp: new Date().toISOString(),
          })}`,
        );
        throw new UnauthorizedException('Invalid credentials');
      }

      // Generate JWT token with user payload
      const token = this.jwtService.sign({
        sub: user.id,
        email: user.email,
      });

      // Log successful login (without sensitive data)
      this.logger.log(
        `User logged in successfully: ${JSON.stringify({
          userId: user.id,
          email: user.email,
          timestamp: new Date().toISOString(),
        })}`,
      );

      // Return response with minimal user data
      return {
        user: {
          id: user.id,
          email: user.email,
        },
        token,
      };
    } catch (error) {
      // Re-throw UnauthorizedException (expected error for invalid credentials)
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // Log unexpected errors with full details
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Login failed with unexpected error: ${JSON.stringify({
          email: dto.email,
          error: errorMessage,
          stack: errorStack,
          timestamp: new Date().toISOString(),
        })}`,
      );

      // Throw generic error to client
      throw new InternalServerErrorException('An error occurred during login');
    }
  }
}
