import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
  Param,
  Query,
  Response,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import type { Response as ExpressResponse } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LettersService } from './letters.service';
import { LetterPdfService } from './letter-pdf.service';
import { GenerateLetterRequestDto } from './dto/generate-letter-request.dto';
import { LetterResponseDto } from '../generated-dtos';
import { ListLettersResponseDto } from './dto/list-letters-response.dto';
import { DownloadLetterParamsDto } from './dto/download-letter-params.dto';
import { DeleteLetterParamsDto } from './dto/delete-letter-params.dto';

/**
 * Letters controller
 * Handles HTTP endpoints for cover letter operations
 */
@ApiTags('letters')
@Controller('letters')
export class LettersController {
  constructor(
    private readonly lettersService: LettersService,
    private readonly letterPdfService: LetterPdfService,
  ) {}

  /**
   * List all letters for the authenticated user
   * GET /letters
   * Requires JWT authentication
   * @param req - Express request with user info from JWT
   * @returns List of letters (max 5 per user)
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List all letters',
    description:
      'Retrieve all cover letters for the authenticated user. Returns a maximum of 5 letters, sorted by creation date (newest first).',
  })
  @ApiResponse({
    status: 200,
    description: 'Letters retrieved successfully',
    type: ListLettersResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing JWT token',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async listLetters(@Request() req: any): Promise<ListLettersResponseDto> {
    // Extract userId from JWT token (set by JwtAuthGuard)
    const userId = req.user.userId;

    // Fetch letters from service
    const items = await this.lettersService.listByUser(userId);

    // Return response with items array
    return { items };
  }

  /**
   * Generate a new cover letter
   * POST /letters
   * Requires JWT authentication
   * @param req - Express request with user info from JWT
   * @param dto - Letter generation request body
   * @returns Generated letter with HTML content
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate a cover letter',
    description:
      'Generate a professional cover letter based on a CV and job description. Requires valid JWT token. Maximum 5 letters per user.',
  })
  @ApiResponse({
    status: 201,
    description: 'Letter generated successfully',
    type: LetterResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - invalid input, CV extraction failed, or validation error',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - user has reached maximum letter limit (5)',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - CV does not exist',
  })
  @ApiResponse({
    status: 422,
    description: 'Unprocessable entity - AI service error',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async generateLetter(
    @Request() req: any,
    @Body() dto: GenerateLetterRequestDto,
  ): Promise<LetterResponseDto> {
    // Extract userId from JWT token (set by JwtAuthGuard)
    const userId = req.user.userId;

    // Build command object
    const command = {
      userId,
      cvId: dto.cv_id,
      jobTitle: dto.job_title,
      jobDescription: dto.job_description,
    };

    // Call service to generate letter
    const result = await this.lettersService.generateLetter(command);

    // Map to response DTO
    const response: LetterResponseDto = {
      id: result.id,
      userId: result.userId,
      html: result.html,
      pdfS3Key: result.pdfS3Key,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };

    return response;
  }

  /**
   * Download a letter as PDF
   * GET /letters/:id/download
   * Requires JWT authentication
   * @param params - Path parameters with letter ID (validated as UUID)
   * @param inline - Query parameter to control Content-Disposition (inline vs attachment)
   * @param req - Express request with user info from JWT
   * @param res - Express response for streaming PDF
   * @returns PDF file stream
   */
  @Get(':id/download')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Download letter as PDF',
    description:
      'Download a cover letter as PDF file. The PDF is generated from the stored HTML content. Requires valid JWT token and letter ownership.',
  })
  @ApiParam({
    name: 'id',
    description: 'Letter ID (UUID)',
    type: String,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({
    name: 'inline',
    description:
      'If true, PDF is displayed inline in browser. If false or omitted, PDF is downloaded as attachment.',
    required: false,
    type: Boolean,
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: 'PDF file successfully generated and returned',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid UUID format',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - letter does not exist or user is not the owner',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - PDF generation failed',
  })
  async downloadLetter(
    @Param() params: DownloadLetterParamsDto,
    @Query('inline') inline?: string,
    @Request() req?: any,
    @Response({ passthrough: false }) res?: ExpressResponse,
  ): Promise<void> {
    if (!res) {
      throw new InternalServerErrorException('Response object not available');
    }

    // Extract userId from JWT token (set by JwtAuthGuard)
    const userId = req.user.userId;
    const letterId = params.id;

    // Convert inline query param to boolean (default: false for attachment)
    const isInline = inline === 'true' || inline === '1';

    // Build command
    const command = {
      letterId,
      userId,
      inline: isInline,
    };

    // Generate or retrieve PDF
    const result = await this.letterPdfService.downloadLetter(command);

    // Set response headers
    const filename = `letter-${letterId}.pdf`;
    const contentDisposition = isInline
      ? `inline; filename="${filename}"`
      : `attachment; filename="${filename}"`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', result.sizeBytes);
    res.setHeader('Content-Disposition', contentDisposition);

    // Cache headers - cache for 1 hour if PDF is stored in S3
    if (result.s3Key) {
      res.setHeader('Cache-Control', 'private, max-age=3600');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }

    // Stream PDF to client
    res.send(result.buffer);
  }

  /**
   * Delete a letter
   * DELETE /letters/:id
   * Requires JWT authentication
   * @param params - Path parameters with letter ID (validated as UUID)
   * @param req - Express request with user info from JWT
   * @returns 204 No Content on successful deletion
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete a letter',
    description:
      'Permanently delete a cover letter. This action cannot be undone. Deletes the letter record and associated PDF file from storage. Frees up space in the user\'s letter quota (max 5).',
  })
  @ApiParam({
    name: 'id',
    description: 'Letter ID (UUID)',
    type: String,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 204,
    description: 'Letter deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid UUID format',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - letter does not exist or user is not the owner',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - deletion failed',
  })
  async deleteLetter(
    @Param() params: DeleteLetterParamsDto,
    @Request() req: any,
  ): Promise<void> {
    // Extract userId from JWT token (set by JwtAuthGuard)
    const userId = req.user.userId;
    const letterId = params.id;

    // Call service to delete letter
    await this.lettersService.deleteLetter(letterId, userId);

    // Return 204 No Content (void return with @HttpCode decorator)
  }
}
