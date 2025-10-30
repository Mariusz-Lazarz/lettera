# CV Upload API - Implementation Documentation

## Overview
This document describes the implementation of the CV upload endpoint (`POST /cvs`) that allows authenticated users to upload PDF CVs with validation, S3 storage, and database persistence.

## Endpoint Details

### POST /cvs
Upload a PDF CV file (max 5 CVs per user, max file size: 10MB)

**Authentication:** Required (JWT Bearer token)

**Content-Type:** `multipart/form-data`

**Request Body:**
- `cv` (required): PDF file
- `filename` (optional): Custom filename (max 255 characters)

**Response (201 Created):**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "filename": "cv.pdf",
  "s3Key": "user/{userId}/cvs/{uuid}.pdf",
  "createdAt": "2025-10-30T12:34:56.000Z"
}
```

**Error Responses:**
- `400 Bad Request` - No file, invalid type, file too large, filename too long
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - User has reached CV limit (5)
- `422 Unprocessable Entity` - File validation failed
- `500 Internal Server Error` - Unexpected server error

## Implementation Structure

### Files Created

1. **DTOs** (`src/cvs/dto/`)
   - `upload-cv-request.dto.ts` - Request validation DTO
   - `cv-record.dto.ts` - Response DTO
   - `index.ts` - Barrel export

2. **Storage Service** (`src/storage/`)
   - `storage.service.ts` - S3 operations (upload, delete, getSignedUrl)

3. **File Validation** (`src/common/utils/`)
   - `file-validation.util.ts` - PDF magic bytes check, filename sanitization

4. **Auth Infrastructure** (`src/auth/`)
   - `jwt.strategy.ts` - JWT validation strategy
   - `jwt-auth.guard.ts` - Route protection guard

5. **Decorators** (`src/common/decorators/`)
   - `current-user.decorator.ts` - Extract current user from request

6. **CVs Module** (`src/cvs/`)
   - `cvs.controller.ts` - HTTP endpoint handler
   - `cvs.service.ts` - Business logic
   - `cvs.module.ts` - Module configuration

## Environment Variables Required

Add these to your `.env` file:

```bash
# AWS S3 Configuration
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your-aws-access-key-id"
AWS_SECRET_ACCESS_KEY="your-aws-secret-access-key"
AWS_S3_BUCKET_NAME="your-bucket-name"

# JWT Configuration (already configured in auth module)
JWT_SECRET="your-secret-key-change-in-production"
JWT_EXPIRES_IN="7d"

# Database (already configured)
DATABASE_URL="postgresql://user:password@localhost:5432/lettera?schema=public"
```

## Validation & Security Features

### File Validation
1. **Size Limit:** Max 10MB
2. **Content-Type:** Must be `application/pdf`
3. **Magic Bytes:** Validates PDF header (%PDF-)
4. **Filename Sanitization:** Removes path traversal, null bytes, dangerous characters

### User Limits
- Maximum 5 CVs per user (enforced via database count check)

### S3 Security
- Files stored in private bucket
- Server-side encryption (AES256)
- Key pattern: `user/{userId}/cvs/{uuid}.pdf`
- Signed URLs for downloads (not implemented yet, but service ready)

### Authentication
- JWT Bearer token required
- User validated against database
- User ID extracted from token payload

## Business Logic Flow

1. **Request Validation**
   - JWT authentication
   - File presence check
   - File size validation
   - Content-type validation

2. **File Validation**
   - PDF magic bytes check
   - Filename sanitization
   - Filename length validation

3. **Business Rules**
   - Check user CV count (must be < 5)
   - Throw 403 if limit reached

4. **Storage & Persistence**
   - Generate unique S3 key: `user/{userId}/cvs/{uuid}.pdf`
   - Upload to S3 with encryption
   - Create database record

5. **Error Compensation**
   - If DB insert fails after S3 upload
   - Attempt to delete file from S3 (best-effort cleanup)
   - Log cleanup failures for manual review

## Database Schema

The endpoint uses the `cvs` table (Prisma model: `Cv`):

```prisma
model Cv {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  s3Key     String   @map("s3_key")
  filename  String
  createdAt DateTime @default(now()) @map("created_at")
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("cvs")
}
```

## Testing the Endpoint

### Using cURL

1. **Register/Login to get JWT token:**
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "SecurePass123"}'
```

2. **Upload CV:**
```bash
curl -X POST http://localhost:3000/cvs \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "cv=@/path/to/cv.pdf" \
  -F "filename=John_Doe_CV_2025.pdf"
```

### Using Postman/Thunder Client

1. Set method to `POST`
2. URL: `http://localhost:3000/cvs`
3. Headers: Add `Authorization: Bearer YOUR_JWT_TOKEN`
4. Body: Select `form-data`
   - Key: `cv`, Type: File, Value: Select PDF file
   - Key: `filename`, Type: Text, Value: Optional custom filename

## Dependencies Added

- `@aws-sdk/client-s3` - AWS S3 client
- `@aws-sdk/s3-request-presigner` - Signed URL generation
- `@types/multer` - TypeScript definitions for file uploads

## Swagger/OpenAPI Documentation

The endpoint is fully documented with Swagger decorators. Access the API documentation at:
```
http://localhost:3000/api
```

## Logging & Monitoring

The service logs the following events:
- `CV_upload_attempt` - User attempts upload
- `CV_upload_success` - Upload completed successfully
- `CV_upload_failed` - Upload failed (with reason)
- `CV_validation_failed` - File validation failed
- `CV_compensation_delete_failed` - Cleanup failed after DB error

All logs include:
- Timestamp (automatic)
- User ID
- S3 key (where applicable)
- Error details (for failures)

## Future Enhancements

1. **Asynchronous Validation**
   - Move AV scan and OCR to background worker
   - Add `validation_status` field to CV model
   - Return 202 Accepted immediately

2. **Virus Scanning**
   - Integrate ClamAV or third-party AV service
   - Reject files that fail AV scan with 422

3. **OCR/Text Extraction**
   - Extract text from PDF for search/analysis
   - Store extracted text in separate field

4. **File Download Endpoint**
   - `GET /cvs/:id` - Generate and return signed URL
   - Implement time-limited access (1 hour default)

5. **File Deletion Endpoint**
   - `DELETE /cvs/:id` - Delete CV from S3 and database
   - Verify user owns the CV before deletion

