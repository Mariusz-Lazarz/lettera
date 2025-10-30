# @lettera/shared-types

Shared TypeScript types for the Lettera monorepo. This package provides type-safe access to database entities and API types across frontend and backend.

## Installation

This package is automatically linked via pnpm workspace. To use it in your workspace:

```bash
# In apps/frontend or apps/backend
pnpm add @lettera/shared-types --workspace
```

## Usage

### Basic Entity Types

```typescript
import { User, Cv, Letter } from "@lettera/shared-types";

// Use in your components
function UserProfile({ user }: { user: User }) {
  return <div>{user.email}</div>;
}
```

### Safe Types (without sensitive fields)

```typescript
import { SafeUser } from "@lettera/shared-types";

// User without password_hash - safe for frontend
function displayUser(user: SafeUser) {
  console.log(user.email); // ✅
  // console.log(user.passwordHash); // ❌ TypeScript error
}
```

### Types with Relations

```typescript
import { CvWithUser, LetterWithUser } from "@lettera/shared-types";

// CV with optional user relation
const cv: CvWithUser = {
  id: "...",
  userId: "...",
  s3Key: "...",
  filename: "resume.pdf",
  createdAt: new Date(),
  user: {
    id: "...",
    email: "user@example.com",
    createdAt: new Date(),
  },
};
```

### Create/Update DTOs

```typescript
import { CreateCvData, UpdateLetterData } from "@lettera/shared-types";

// Data for creating new CV
const createData: CreateCvData = {
  s3Key: "uploads/cv-123.pdf",
  filename: "my-resume.pdf",
};

// Data for updating letter
const updateData: UpdateLetterData = {
  html: "<h1>Updated content</h1>",
  pdfS3Key: "uploads/letter-456.pdf",
};
```

### API Response Types

```typescript
import { ApiResponse, PaginatedResponse } from "@lettera/shared-types";

// Wrap your API responses
type GetUserResponse = ApiResponse<SafeUser>;

// Success response
const success: GetUserResponse = {
  success: true,
  data: {
    id: "...",
    email: "user@example.com",
    createdAt: new Date(),
  },
};

// Error response
const error: GetUserResponse = {
  success: false,
  error: {
    message: "User not found",
    code: "USER_NOT_FOUND",
  },
};

// Paginated list
const cvList: PaginatedResponse<Cv> = {
  items: [...],
  total: 25,
  page: 1,
  pageSize: 10,
  hasMore: true,
};
```

### Query/Filter Types

```typescript
import { CvFilters, PaginationParams } from "@lettera/shared-types";

// Use in API calls
async function fetchCvs(filters: CvFilters) {
  const params = new URLSearchParams({
    page: String(filters.page ?? 1),
    pageSize: String(filters.pageSize ?? 10),
    sortBy: filters.sortBy ?? "createdAt",
    sortOrder: filters.sortOrder ?? "desc",
  });

  return fetch(`/api/cvs?${params}`);
}
```

## Available Types

### Core Entities
- `User` - User account entity
- `Cv` - CV/resume entity
- `Letter` - Cover letter entity

### Safe Types
- `SafeUser` - User without password_hash
- `SafeUserWithRelations` - User with relations, without password_hash

### Relations
- `CvWithUser` - CV with optional user
- `LetterWithUser` - Letter with optional user
- `UserWithRelations` - User with cvs and letters

### DTOs
- `CreateUserData` - Create user payload
- `UpdateUserData` - Update user payload
- `CreateCvData` - Create CV payload
- `UpdateCvData` - Update CV payload
- `CreateLetterData` - Create letter payload
- `UpdateLetterData` - Update letter payload

### API Types
- `ApiResponse<T>` - Standard API response wrapper
- `PaginatedResponse<T>` - Paginated list response
- `PaginationParams` - Pagination parameters
- `SortParams` - Sorting parameters
- `CvFilters` - CV list filters
- `LetterFilters` - Letter list filters

## Type Safety

This package ensures type safety across your monorepo:

1. **Single Source of Truth**: Types are generated from Prisma schema
2. **No Duplication**: Frontend and backend share the same types
3. **Compile-time Validation**: TypeScript catches type mismatches
4. **Safe Defaults**: Sensitive fields (like password_hash) are removed from frontend types

## Development

```bash
# Type check
pnpm typecheck
```

## Notes

- This package re-exports types from `@prisma/client`, so Prisma Client must be installed
- Types are imported directly from source (`src/index.ts`) for faster builds
- Use `SafeUser` instead of `User` in frontend to avoid exposing sensitive fields
- All entity IDs are UUIDs (strings)
- All dates are `Date` objects (serialized as ISO strings in API)

