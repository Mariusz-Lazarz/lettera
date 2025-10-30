import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma.service';

/**
 * JWT payload extracted from token
 */
export interface JwtPayload {
  sub: string; // userId
  email: string;
}

/**
 * JWT authentication strategy
 * Validates JWT tokens and attaches user to request
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_SECRET || 'development-secret-change-in-production',
    });
  }

  /**
   * Validate JWT payload and return user object
   * This method is called automatically by Passport after token verification
   * @param payload - Decoded JWT payload
   * @returns User object that will be attached to request.user
   */
  async validate(payload: JwtPayload) {
    // Verify user still exists in database
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Return user object (will be attached to request.user)
    return {
      userId: user.id,
      email: user.email,
    };
  }
}
