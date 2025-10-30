import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../storage/storage.service';
import { CvRecordDto, ListCvItemDto } from './dto';
import {
  isPdfFile,
  generateSafeFilename,
} from '../common/utils/file-validation.util';
import { randomUUID } from 'crypto';

/**
 * Service for CV management
 * Handles CV upload, validation, storage, and database operations
 */
@Injectable()
export class CvsService {
  private readonly logger = new Logger(CvsService.name);
  private readonly MAX_CVS_PER_USER = 5;
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Upload a CV file for a user
   * @param userId - ID of the user uploading the CV
   * @param file - Uploaded file from multer
   * @param customFilename - Optional custom filename
   * @returns CV record with metadata
   * @throws BadRequestException for invalid file
   * @throws ForbiddenException if user has reached CV limit
   * @throws UnprocessableEntityException if file validation fails
   * @throws InternalServerErrorException for unexpected errors
   */
  async uploadCv(
    userId: string,
    file: Express.Multer.File,
    customFilename?: string,
  ): Promise<CvRecordDto> {
    // Step 1: Validate file presence
    if (!file) {
      this.logger.warn(`Upload attempt without file by user ${userId}`);
      throw new BadRequestException('No file provided');
    }

    // Step 2: Validate file size
    if (file.size > this.MAX_FILE_SIZE) {
      this.logger.warn(`File too large: ${file.size} bytes by user ${userId}`);
      throw new BadRequestException(
        `File size exceeds maximum limit of ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`,
      );
    }

    // Step 3: Validate content type
    if (file.mimetype !== 'application/pdf') {
      this.logger.warn(
        `Invalid content type: ${file.mimetype} by user ${userId}`,
      );
      throw new BadRequestException('File must be a PDF (application/pdf)');
    }

    // Step 4: Validate PDF magic bytes
    if (!isPdfFile(file.buffer)) {
      this.logger.warn(`Invalid PDF magic bytes by user ${userId}`);
      throw new BadRequestException(
        'File is not a valid PDF (magic bytes check failed)',
      );
    }

    // Step 5: Generate safe filename
    const filename = customFilename
      ? generateSafeFilename(customFilename)
      : generateSafeFilename(file.originalname);

    // Validate filename length after sanitization
    if (filename.length > 255) {
      throw new BadRequestException('Filename too long (max 255 characters)');
    }

    // Step 6: Check CV count limit in transaction
    try {
      const cvCount = await this.prisma.cv.count({
        where: { userId },
      });

      if (cvCount >= this.MAX_CVS_PER_USER) {
        this.logger.warn(
          `User ${userId} has reached CV limit (${cvCount}/${this.MAX_CVS_PER_USER})`,
        );
        throw new ForbiddenException(
          `Maximum number of CVs reached (${this.MAX_CVS_PER_USER})`,
        );
      }
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`Failed to check CV count for user ${userId}`, error);
      throw new InternalServerErrorException('Failed to check CV limit');
    }

    // Step 7: Generate S3 key
    const cvId = randomUUID();
    const s3Key = `user/${userId}/cvs/${cvId}.pdf`;

    // Step 8: Upload to S3
    try {
      await this.storage.uploadFile(s3Key, file.buffer, 'application/pdf');
      this.logger.log(`File uploaded to S3: ${s3Key} by user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to upload file to S3: ${s3Key}`, error);
      throw new InternalServerErrorException(
        'Failed to upload file to storage',
      );
    }

    // Step 9: Create database record in transaction
    // If this fails, we need to clean up S3
    try {
      const cv = await this.prisma.cv.create({
        data: {
          id: cvId,
          userId,
          s3Key,
          filename,
        },
      });

      this.logger.log(
        `CV record created successfully: ${cv.id} for user ${userId}`,
      );

      // Step 10: Return CV record DTO
      return this.mapToDto(cv);
    } catch (error) {
      // Compensation: Delete file from S3 if DB insert failed
      this.logger.error(
        `Failed to create CV record in database for ${s3Key}, attempting cleanup`,
        error,
      );

      try {
        await this.storage.deleteFile(s3Key, false); // Best-effort cleanup
        this.logger.log(`Cleanup successful: deleted ${s3Key} from S3`);
      } catch (cleanupError) {
        this.logger.error(
          `Cleanup failed: could not delete ${s3Key} from S3`,
          cleanupError,
        );
      }

      throw new InternalServerErrorException('Failed to save CV record');
    }
  }

  /**
   * List all CVs for a user
   * Returns only public fields (id, filename, created_at)
   * Does NOT return sensitive data (s3Key, userId)
   * @param userId - ID of the user
   * @returns Array of CV items sorted by creation date (newest first)
   * @throws InternalServerErrorException for unexpected database errors
   */
  async listForUser(userId: string): Promise<ListCvItemDto[]> {
    try {
      // Query database with select to minimize data transfer
      // Order by createdAt DESC to show newest first
      const cvs = await this.prisma.cv.findMany({
        where: { userId },
        select: {
          id: true,
          filename: true,
          createdAt: true,
          // Explicitly NOT selecting: s3Key, userId
        },
        orderBy: { createdAt: 'desc' },
      });

      // Map to DTO with created_at (snake_case for API consistency)
      return cvs.map((cv) => ({
        id: cv.id,
        filename: cv.filename,
        created_at: cv.createdAt.toISOString(),
      }));
    } catch (error) {
      this.logger.error(
        `Failed to list CVs for user ${userId}`,
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException('Failed to retrieve CVs');
    }
  }

  /**
   * Delete a CV record and its associated S3 object
   * Only the owner can delete their CV
   * S3 deletion is performed synchronously before DB deletion
   * If S3 deletion fails, the DB record is NOT deleted and 500 is returned
   *
   * @param cvId - UUID of the CV to delete
   * @param userId - UUID of the user requesting deletion (from JWT token)
   * @returns Promise that resolves when deletion is complete
   * @throws NotFoundException if CV doesn't exist
   * @throws ForbiddenException if user is not the owner
   * @throws InternalServerErrorException if S3 deletion fails
   */
  async deleteCv(cvId: string, userId: string): Promise<void> {
    // Step 1: Fetch CV record from database
    let cv: {
      id: string;
      userId: string;
      s3Key: string;
      filename: string;
    } | null;
    try {
      cv = await this.prisma.cv.findUnique({
        where: { id: cvId },
        select: {
          id: true,
          userId: true,
          s3Key: true,
          filename: true,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to fetch CV ${cvId} for deletion`,
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException('Failed to fetch CV record');
    }

    // Step 2: Verify CV exists
    if (!cv) {
      this.logger.warn(`CV not found for deletion: ${cvId}`);
      throw new NotFoundException('CV not found');
    }

    // Step 3: Verify ownership
    if (cv.userId !== userId) {
      this.logger.warn(
        `User ${userId} attempted to delete CV ${cvId} owned by ${cv.userId}`,
      );
      throw new ForbiddenException(
        'You do not have permission to delete this CV',
      );
    }

    // Step 4: Delete from S3 (synchronous, must succeed)
    // If this throws, we don't proceed to DB deletion
    try {
      await this.storage.deleteFile(cv.s3Key, true); // throwOnError = true
      this.logger.log(
        `S3 object deleted successfully: ${cv.s3Key} by user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete S3 object ${cv.s3Key} for CV ${cvId}`,
        error instanceof Error ? error.stack : error,
      );

      // TODO: Queue retry task for S3 deletion
      // For now, we just throw 500
      // In production, add to BullMQ queue or pending_deletions table

      throw new InternalServerErrorException(
        'Failed to delete file from storage. Please try again later.',
      );
    }

    // Step 5: Delete from database in transaction
    // At this point S3 deletion succeeded, so we proceed with DB deletion
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.cv.delete({
          where: { id: cvId },
        });
      });

      this.logger.log(
        `CV record deleted successfully: ${cvId} (filename: ${cv.filename}) by user ${userId}`,
      );
    } catch (error) {
      // This is a critical error - S3 is deleted but DB record remains
      // This should trigger an alert for manual intervention
      this.logger.error(
        `CRITICAL: S3 object deleted but DB deletion failed for CV ${cvId}. Manual intervention required.`,
        error instanceof Error ? error.stack : error,
      );

      throw new InternalServerErrorException(
        'Failed to complete deletion. Please contact support.',
      );
    }
  }

  /**
   * Map Prisma CV model to DTO
   * @param cv - Prisma CV model
   * @returns CV record DTO
   */
  private mapToDto(cv: {
    id: string;
    userId: string;
    filename: string;
    s3Key: string;
    createdAt: Date;
  }): CvRecordDto {
    return {
      id: cv.id,
      userId: cv.userId,
      filename: cv.filename,
      s3Key: cv.s3Key,
      createdAt: cv.createdAt.toISOString(),
    };
  }
}
