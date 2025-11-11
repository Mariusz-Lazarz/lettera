import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * User object attached to request by JWT strategy
 */
export interface CurrentUserType {
  userId: string;
  email: string;
}

/**
 * Custom decorator to extract current user from request
 * Usage: @CurrentUser() user: CurrentUserType
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUserType => {
    const request = ctx.switchToHttp().getRequest<{ user: CurrentUserType }>();
    return request.user;
  },
);
