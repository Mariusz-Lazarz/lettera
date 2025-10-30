/**
 * @lettera/shared-types
 * 
 * Shared TypeScript types for Lettera monorepo.
 * Contains database entity types, DTOs, and API response types.
 */

// Database types from Prisma
export * from "./database";

// Re-export commonly used types for convenience
export type {
  User,
  Cv,
  Letter,
  SafeUser,
  CvWithUser,
  LetterWithUser,
  UserWithRelations,
  SafeUserWithRelations,
  CreateUserData,
  UpdateUserData,
  CreateCvData,
  UpdateCvData,
  CreateLetterData,
  UpdateLetterData,
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
  SortParams,
  CvFilters,
  LetterFilters,
} from "./database";

