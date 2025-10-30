# Setup Guide: CV Upload Feature

## Prerequisites
- PostgreSQL database running
- AWS S3 bucket created
- AWS IAM credentials with S3 permissions

## Step 1: Environment Variables

**IMPORTANT:** Create a `.env` file in `apps/backend/` directory with ALL required variables.

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/lettera?schema=public"

# JWT Configuration
JWT_SECRET="your-secret-key-change-in-production"
JWT_EXPIRES_IN="7d"

# Bcrypt
BCRYPT_ROUNDS="12"

# AWS S3 Configuration (REQUIRED - App will not start without these!)
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your-aws-access-key-id"
AWS_SECRET_ACCESS_KEY="your-aws-secret-access-key"
AWS_S3_BUCKET_NAME="your-bucket-name"

# Server
PORT="3000"
NODE_ENV="development"
```

⚠️ **Note:** The application will fail to start if AWS credentials are not configured. If you don't have AWS S3 yet, see Step 2 for setup instructions.

## Step 2: AWS S3 Bucket Setup

1. **Create S3 Bucket:**
   - Go to AWS Console → S3
   - Create a new bucket (e.g., `lettera-cvs-dev`)
   - **Block all public access** (recommended for security)
   - Enable versioning (optional)
   - Enable server-side encryption (AES-256 or KMS)

2. **Create IAM User/Role:**
   - Go to IAM → Users → Create user
   - Grant programmatic access
   - Attach policy with S3 permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::your-bucket-name"
    }
  ]
}
```

3. **Get Credentials:**
   - Save the Access Key ID and Secret Access Key
   - Add them to your `.env` file

## Step 3: Database Migration

The `cvs` table should already exist from your initial Prisma migration. If not:

```bash
cd apps/backend
pnpm prisma:migrate
```

Verify the `cvs` table exists:
```bash
pnpm prisma:studio
```

## Step 4: Install Dependencies

Dependencies are already installed if you've run:
```bash
pnpm install
```

New packages added:
- `@aws-sdk/client-s3`
- `@aws-sdk/s3-request-presigner`
- `@types/multer` (dev)

## Step 5: Build & Run

```bash
# From project root
pnpm dev

# Or from backend directory
cd apps/backend
pnpm start:dev
```

## Step 6: Test the Endpoint

1. **Register a user:**
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "SecurePass123"}'
```

Save the `accessToken` from the response.

2. **Upload a CV:**
```bash
curl -X POST http://localhost:3000/cvs \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "cv=@/path/to/your/cv.pdf" \
  -F "filename=My_CV_2025.pdf"
```

3. **Verify in S3:**
   - Check your S3 bucket
   - Look for: `user/{userId}/cvs/{cvId}.pdf`

4. **Verify in Database:**
```bash
pnpm prisma:studio
```
Check the `cvs` table for your upload.

## Troubleshooting

### Error: "AWS_S3_BUCKET_NAME is required for StorageService"
**Application fails to start with this error**

**Solution:**
1. Create `.env` file in `apps/backend/` directory if it doesn't exist
2. Add the following variables:
   ```bash
   AWS_S3_BUCKET_NAME="your-bucket-name"
   AWS_ACCESS_KEY_ID="your-access-key"
   AWS_SECRET_ACCESS_KEY="your-secret-key"
   AWS_REGION="us-east-1"
   ```
3. Replace placeholder values with your actual AWS credentials
4. Restart the backend server

### Error: "Empty value provided for input HTTP label: Bucket"
**Same cause as above** - bucket name is empty or not loaded.

**Solution:**
1. Verify `.env` file exists in `apps/backend/` directory (not in project root)
2. Check that variables don't have quotes issues: `AWS_S3_BUCKET_NAME="my-bucket"` (not `AWS_S3_BUCKET_NAME='my-bucket'` or `AWS_S3_BUCKET_NAME=my-bucket with spaces`)
3. Restart the dev server completely (stop and start, not just reload)

### Error: "AWS credentials not configured"
- Verify `.env` file has AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
- Verify environment variables are loaded (restart dev server)

### Error: "Failed to upload file to storage"
- Check S3 bucket name is correct
- Verify IAM user has PutObject permission
- Check AWS region matches your bucket region

### Error: "Maximum number of CVs reached (5)"
- User has uploaded 5 CVs already
- Delete old CVs from database/S3 or test with new user

### Error: "File must be a PDF (application/pdf)"
- Ensure file is actually a PDF
- Check file magic bytes are correct (%PDF-)
- Verify file is not corrupted

### TypeScript Errors
```bash
pnpm typecheck
```
Should pass without errors.

### Linting Errors
```bash
pnpm lint
```
Should pass without errors.

## Monitoring & Logs

Watch backend logs for:
- `File uploaded successfully to S3: {key}`
- `CV record created successfully: {id} for user {userId}`
- Error messages with details

## API Documentation

Access Swagger UI at:
```
http://localhost:3000/api
```

Look for the `cvs` section to see:
- Request/response schemas
- Example payloads
- Error responses
- Try out the endpoint directly

## Security Notes

1. **Never commit `.env` file** - already in `.gitignore`
2. **Use strong JWT_SECRET** in production
3. **Rotate AWS credentials** periodically
4. **Monitor S3 costs** - uploaded files incur storage costs
5. **Set up CloudWatch alarms** for unusual activity
6. **Enable S3 bucket logging** for audit trail

## Next Steps

Consider implementing:
- [ ] CV download endpoint (GET /cvs/:id)
- [ ] CV deletion endpoint (DELETE /cvs/:id)
- [ ] CV list endpoint (GET /cvs)
- [ ] Virus scanning integration
- [ ] OCR/text extraction for search
- [ ] Thumbnail generation
- [ ] S3 lifecycle policies for old files

