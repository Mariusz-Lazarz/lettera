/**
 * Database types exported from Prisma Client
 * 
 * This file re-exports types from @prisma/client for use in the frontend.
 * It provides type-safe access to database entities without bundling
 * the entire Prisma Client.
 */

import type { User, Cv, Letter } from "@prisma/client";

// ============================================================================
// Core Entity Types
// ============================================================================

/**
 * User entity representing an authenticated user account
 */
export type { User };

/**
 * CV entity representing an uploaded resume/CV file stored in S3
 */
export type { Cv };

/**
 * Letter entity representing a generated cover letter
 */
export type { Letter };

// ============================================================================
// Utility Types
// ============================================================================

/**
 * User without sensitive password_hash field
 * Use this type for API responses and frontend state
 */
export type SafeUser = Omit<User, "passwordHash">;

/**
 * CV with optional user relation populated
 */
export type CvWithUser = Cv & {
  user?: SafeUser;
};

/**
 * Letter with optional user relation populated
 */
export type LetterWithUser = Letter & {
  user?: SafeUser;
};

/**
 * User with all relations populated
 */
export type UserWithRelations = User & {
  cvs?: Cv[];
  letters?: Letter[];
};

/**
 * Safe user with relations (without password hash)
 */
export type SafeUserWithRelations = Omit<UserWithRelations, "passwordHash">;

// ============================================================================
// Create/Update DTOs
// ============================================================================

/**
 * Data required to create a new user
 */
export type CreateUserData = Pick<User, "email"> & {
  password: string; // plain password, will be hashed by backend
};

/**
 * Data that can be updated on a user
 */
export type UpdateUserData = Partial<Pick<User, "email">> & {
  password?: string; // optional password change
};

/**
 * Data required to create a new CV
 */
export type CreateCvData = Pick<Cv, "s3Key" | "filename">;

/**
 * Data that can be updated on a CV
 */
export type UpdateCvData = Partial<Pick<Cv, "filename">>;

/**
 * Data required to create a new letter
 */
export type CreateLetterData = Pick<Letter, "html"> & {
  pdfS3Key?: string;
};

/**
 * Data that can be updated on a letter
 */
export type UpdateLetterData = Partial<Pick<Letter, "html" | "pdfS3Key">>;

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API response wrapper
 */
export type ApiResponse<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
};

/**
 * Paginated response
 */
export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

// ============================================================================
// Query/Filter Types
// ============================================================================

/**
 * Common pagination parameters
 */
export type PaginationParams = {
  page?: number;
  pageSize?: number;
};

/**
 * Common sorting parameters
 */
export type SortParams = {
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

/**
 * Date range filter
 */
export type DateRangeFilter = {
  from?: Date | string;
  to?: Date | string;
};

/**
 * CV list filters
 */
export type CvFilters = PaginationParams & SortParams & {
  search?: string;
  createdAt?: DateRangeFilter;
};

/**
 * Letter list filters
 */
export type LetterFilters = PaginationParams & SortParams & {
  search?: string;
  createdAt?: DateRangeFilter;
};

