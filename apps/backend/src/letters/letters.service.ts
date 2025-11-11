import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../storage/storage.service';
import { AiProviderService } from '../integrations/ai/ai-provider.service';
import { PdfExtractorService } from '../integrations/pdf/pdf-extractor.service';
import {
  GenerateLetterCommand,
  GenerateLetterResult,
} from './dto/generate-letter-command.dto';
import { LetterListItemDto } from './dto/list-letters-response.dto';

/**
 * Letters service
 * Contains business logic for cover letter generation
 */
@Injectable()
export class LettersService {
  private readonly logger = new Logger(LettersService.name);
  private readonly MAX_LETTERS_PER_USER = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly aiProvider: AiProviderService,
    private readonly pdfExtractor: PdfExtractorService,
  ) {}

  /**
   * Generate a cover letter based on CV and job description
   * @param command - Generation command with userId, cvId, jobTitle, jobDescription
   * @returns Generated letter result with id, html, and metadata
   * @throws ForbiddenException if user has reached letter limit (5)
   * @throws NotFoundException if CV not found
   * @throws BadRequestException if CV extraction failed or missing
   * @throws UnprocessableEntityException if AI generation fails
   * @throws InternalServerErrorException for unexpected errors
   */
  async generateLetter(
    command: GenerateLetterCommand,
  ): Promise<GenerateLetterResult> {
    const { userId, cvId, jobTitle, jobDescription } = command;

    this.logger.log(
      `Starting letter generation for user ${userId} with CV ${cvId}`,
    );

    // Step 1: Check per-user letter limit (max 5)
    try {
      const letterCount = await this.prisma.letter.count({
        where: { userId },
      });

      if (letterCount >= this.MAX_LETTERS_PER_USER) {
        this.logger.warn(
          `User ${userId} has reached letter limit (${letterCount}/${this.MAX_LETTERS_PER_USER})`,
        );
        throw new ForbiddenException(
          `Maximum number of letters reached (${this.MAX_LETTERS_PER_USER}). Please delete an existing letter to generate a new one.`,
        );
      }

      this.logger.log(
        `User ${userId} has ${letterCount}/${this.MAX_LETTERS_PER_USER} letters`,
      );
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(
        `Failed to check letter count for user ${userId}`,
        error,
      );
      throw new InternalServerErrorException('Failed to check letter limit');
    }

    // Step 2: Fetch CV record and verify ownership
    let cv: { id: string; userId: string; s3Key: string; filename: string };

    try {
      const cvRecord = await this.prisma.cv.findUnique({
        where: { id: cvId },
        select: {
          id: true,
          userId: true,
          s3Key: true,
          filename: true,
        },
      });

      if (!cvRecord) {
        this.logger.warn(`CV not found: ${cvId} for user ${userId}`);
        throw new NotFoundException('CV not found');
      }

      // Verify CV ownership
      if (cvRecord.userId !== userId) {
        this.logger.warn(
          `User ${userId} attempted to use CV ${cvId} owned by ${cvRecord.userId}`,
        );
        throw new NotFoundException('CV not found');
      }

      cv = cvRecord;
      this.logger.log(`CV found: ${cv.filename} (${cv.s3Key})`);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      this.logger.error(`Failed to fetch CV ${cvId}`, error);
      throw new InternalServerErrorException('Failed to fetch CV');
    }

    // Step 3: Download CV from S3 and extract text
    let cvText: string;

    try {
      this.logger.log(`Downloading CV from S3: ${cv.s3Key}`);
      const pdfBuffer = await this.storage.downloadFile(cv.s3Key);

      this.logger.log(`Extracting text from PDF: ${cv.filename}`);
      cvText = await this.pdfExtractor.extractText(pdfBuffer);

      // Validate extracted text
      if (!cvText || cvText.trim().length < 50) {
        this.logger.error(
          `CV extraction resulted in insufficient text (${cvText?.length || 0} chars)`,
        );
        throw new BadRequestException(
          'Failed to extract sufficient text from CV. Please ensure your CV contains readable text and is not a scanned image.',
        );
      }

      this.logger.log(
        `Successfully extracted ${cvText.length} characters from CV`,
      );
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnprocessableEntityException
      ) {
        throw error;
      }
      this.logger.error(`Failed to extract text from CV ${cvId}`, error);
      throw new UnprocessableEntityException(
        'Failed to extract text from CV. Please try again.',
      );
    }

    // Step 4: Generate cover letter using AI
    let html: string;

    try {
      this.logger.log('Calling AI provider to generate letter');
      html = await this.aiProvider.generateLetter({
        cvText,
        jobTitle,
        jobDescription,
      });

      this.logger.log(
        `AI generated letter successfully (${html.length} characters)`,
      );
    } catch (error) {
      if (error instanceof UnprocessableEntityException) {
        throw error;
      }
      this.logger.error('AI letter generation failed', error);
      throw new UnprocessableEntityException(
        'Failed to generate letter. Please try again.',
      );
    }

    // Step 5: Save letter to database
    try {
      const letter = await this.prisma.letter.create({
        data: {
          userId,
          html,
          // pdfS3Key will be set when user downloads as PDF (future feature)
        },
      });

      this.logger.log(
        `Letter created successfully: ${letter.id} for user ${userId}`,
      );

      // Return result
      const result: GenerateLetterResult = {
        id: letter.id,
        userId: letter.userId,
        html: letter.html,
        pdfS3Key: letter.pdfS3Key || undefined,
        createdAt: letter.createdAt,
        updatedAt: letter.updatedAt,
      };

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to save letter to database for user ${userId}`,
        error,
      );
      throw new InternalServerErrorException('Failed to save generated letter');
    }
  }

  /**
   * List all letters for a specific user
   * @param userId - User ID to fetch letters for
   * @returns Array of letter items with API format (snake_case fields)
   * @throws InternalServerErrorException for database errors
   */
  async listByUser(userId: string): Promise<LetterListItemDto[]> {
    this.logger.log(`Fetching letters for user ${userId}`);

    try {
      // Fetch letters from database, sorted by creation date (newest first)
      const letters = await this.prisma.letter.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: this.MAX_LETTERS_PER_USER, // Safety limit
        select: {
          id: true,
          html: true,
          pdfS3Key: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      this.logger.log(`Found ${letters.length} letters for user ${userId}`);

      // Map database records to API response format
      const items: LetterListItemDto[] = letters.map((letter) =>
        this.mapLetterToApiFormat(letter),
      );

      return items;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to fetch letters for user ${userId}: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException('Failed to fetch letters');
    }
  }

  /**
   * Get a letter by ID and verify ownership
   * @param letterId - Letter ID to fetch
   * @param userId - User ID to verify ownership
   * @returns Letter record with id, userId, html, pdfS3Key, createdAt, updatedAt
   * @throws NotFoundException if letter not found or user is not the owner
   * @throws InternalServerErrorException for database errors
   */
  async getLetterByIdForUser(
    letterId: string,
    userId: string,
  ): Promise<{
    id: string;
    userId: string;
    html: string;
    pdfS3Key: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> {
    this.logger.log(`Fetching letter ${letterId} for user ${userId}`);

    try {
      const letter = await this.prisma.letter.findUnique({
        where: { id: letterId },
        select: {
          id: true,
          userId: true,
          html: true,
          pdfS3Key: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!letter) {
        this.logger.warn(`Letter not found: ${letterId}`);
        throw new NotFoundException('Letter not found');
      }

      // Verify ownership - return 404 instead of 403 to avoid leaking existence
      if (letter.userId !== userId) {
        this.logger.warn(
          `User ${userId} attempted to access letter ${letterId} owned by ${letter.userId}`,
        );
        throw new NotFoundException('Letter not found');
      }

      this.logger.log(`Letter ${letterId} retrieved successfully`);
      return letter;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to fetch letter ${letterId}`, error);
      throw new InternalServerErrorException('Failed to fetch letter');
    }
  }

  /**
   * Delete a letter by ID
   * - Verifies letter ownership
   * - Deletes associated PDF from S3 if exists
   * - Deletes letter record from database
   * - Frees up user's letter quota
   *
   * @param letterId - Letter ID to delete
   * @param userId - User ID to verify ownership
   * @throws NotFoundException if letter not found or user is not the owner
   * @throws InternalServerErrorException for database or S3 errors
   */
  async deleteLetter(letterId: string, userId: string): Promise<void> {
    this.logger.log(`Attempting to delete letter ${letterId} for user ${userId}`);

    try {
      // Step 1: Fetch letter and verify ownership
      const letter = await this.prisma.letter.findUnique({
        where: { id: letterId },
        select: {
          id: true,
          userId: true,
          pdfS3Key: true,
        },
      });

      // Check if letter exists
      if (!letter) {
        this.logger.warn(`Letter not found: ${letterId}`);
        throw new NotFoundException('Letter not found');
      }

      // Verify ownership - return 404 instead of 403 to avoid leaking existence
      if (letter.userId !== userId) {
        this.logger.warn(
          `User ${userId} attempted to delete letter ${letterId} owned by ${letter.userId}`,
        );
        throw new NotFoundException('Letter not found');
      }

      // Step 2: Delete PDF from S3 if it exists
      if (letter.pdfS3Key) {
        this.logger.log(`Deleting PDF from S3: ${letter.pdfS3Key}`);
        try {
          // Use throwOnError=false for best-effort cleanup
          // We don't want S3 failures to block database deletion
          await this.storage.deleteFile(letter.pdfS3Key, false);
          this.logger.log(`PDF deleted successfully from S3: ${letter.pdfS3Key}`);
        } catch (error) {
          // Log but continue - S3 deletion failure shouldn't block DB deletion
          this.logger.error(
            `Failed to delete PDF from S3: ${letter.pdfS3Key}, continuing with DB deletion`,
            error,
          );
        }
      }

      // Step 3: Delete letter from database
      await this.prisma.letter.delete({
        where: { id: letterId },
      });

      this.logger.log(
        `Letter ${letterId} deleted successfully for user ${userId}`,
        {
          event: 'letter_deleted',
          userId,
          letterId,
          timestamp: new Date().toISOString(),
        },
      );
    } catch (error) {
      // Re-throw known exceptions
      if (error instanceof NotFoundException) {
        throw error;
      }

      // Log and wrap unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to delete letter ${letterId} for user ${userId}: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException('Failed to delete letter');
    }
  }

  /**
   * Maps a database letter record to API response format
   * - Converts camelCase to snake_case for timestamps
   * - Converts dates to ISO 8601 strings
   *
   * @param letter - Letter record from database
   * @returns Formatted letter item for API response
   */
  private mapLetterToApiFormat(letter: {
    id: string;
    html: string;
    pdfS3Key: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): LetterListItemDto {
    return {
      id: letter.id,
      html: letter.html,
      created_at: letter.createdAt.toISOString(),
      updated_at: letter.updatedAt.toISOString(),
    };
  }
}
