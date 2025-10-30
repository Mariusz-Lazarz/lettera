import {
  Controller,
  Post,
  Get,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiUnprocessableEntityResponse,
  ApiInternalServerErrorResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CvsService } from './cvs.service';
import { UploadCvRequestDto, CvRecordDto, ListCvsResponseDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { CurrentUserType } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/**
 * CVs controller
 * Handles CV upload and management endpoints
 */
@ApiTags('cvs')
@Controller('cvs')
export class CvsController {
  constructor(private readonly cvsService: CvsService) {}

  /**
   * Upload a CV file
   * @param user - Current authenticated user
   * @param file - Uploaded PDF file
   * @param dto - Optional custom filename
   * @returns Created CV record with metadata
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('cv'))
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a CV',
    description:
      'Upload a PDF CV file. Maximum 5 CVs per user. File must be PDF format and under 10MB.',
  })
  @ApiBody({
    description: 'CV file upload with optional custom filename',
    schema: {
      type: 'object',
      required: ['cv'],
      properties: {
        cv: {
          type: 'string',
          format: 'binary',
          description: 'PDF file to upload',
        },
        filename: {
          type: 'string',
          maxLength: 255,
          description: 'Optional custom filename (max 255 characters)',
          example: 'John_Doe_CV_2025.pdf',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'CV successfully uploaded',
    type: CvRecordDto,
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        filename: 'John_Doe_CV_2025.pdf',
        s3Key:
          'user/123e4567-e89b-12d3-a456-426614174001/cvs/123e4567-e89b-12d3-a456-426614174000.pdf',
        createdAt: '2025-10-30T12:34:56.000Z',
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Bad request - no file provided, invalid file type, file too large, or filename too long',
    schema: {
      example: {
        statusCode: 400,
        message: 'File must be a PDF (application/pdf)',
        error: 'Bad Request',
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - invalid or missing JWT token',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
        error: 'Unauthorized',
      },
    },
  })
  @ApiForbiddenResponse({
    description: 'Forbidden - user has reached maximum CV limit (5)',
    schema: {
      example: {
        statusCode: 403,
        message: 'Maximum number of CVs reached (5)',
        error: 'Forbidden',
      },
    },
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Unprocessable entity - file validation failed (corrupted file, virus detected, etc.)',
    schema: {
      example: {
        statusCode: 422,
        message: 'File validation failed',
        error: 'Unprocessable Entity',
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error - unexpected error during processing',
    schema: {
      example: {
        statusCode: 500,
        message: 'Failed to upload file to storage',
        error: 'Internal Server Error',
      },
    },
  })
  async uploadCv(
    @CurrentUser() user: CurrentUserType,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadCvRequestDto,
  ): Promise<CvRecordDto> {
    return this.cvsService.uploadCv(user.userId, file, dto.filename);
  }

  /**
   * List all CVs for the authenticated user
   * @param user - Current authenticated user
   * @returns List of CV items (without sensitive data)
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List all CVs',
    description:
      'Retrieve all CVs belonging to the authenticated user. Maximum 5 CVs per user. Returns only public metadata (id, filename, created_at).',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved CV list',
    type: ListCvsResponseDto,
    schema: {
      example: {
        items: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            filename: 'John_Doe_CV_2025.pdf',
            created_at: '2025-10-30T12:34:56.789Z',
          },
          {
            id: '223e4567-e89b-12d3-a456-426614174001',
            filename: 'Jane_Smith_Resume.pdf',
            created_at: '2025-10-29T10:20:30.456Z',
          },
        ],
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - invalid or missing JWT token',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
        error: 'Unauthorized',
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error - unexpected error during retrieval',
    schema: {
      example: {
        statusCode: 500,
        message: 'Failed to retrieve CVs',
        error: 'Internal Server Error',
      },
    },
  })
  async listCvs(
    @CurrentUser() user: CurrentUserType,
  ): Promise<ListCvsResponseDto> {
    const items = await this.cvsService.listForUser(user.userId);
    return { items };
  }

  /**
   * Delete a CV by ID
   * Only the owner can delete their CV
   * @param user - Current authenticated user
   * @param id - UUID of the CV to delete
   * @returns 204 No Content on success
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete a CV',
    description:
      'Delete a CV and its associated file from storage. Only the owner can delete their CV. ' +
      'The file is removed from S3 storage before the database record is deleted. ' +
      'If storage deletion fails, the operation returns 500 and the database record is preserved.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'UUID of the CV to delete',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 204,
    description: 'CV successfully deleted',
  })
  @ApiBadRequestResponse({
    description: 'Bad request - invalid UUID format',
    schema: {
      example: {
        statusCode: 400,
        message: 'Validation failed (uuid is expected)',
        error: 'Bad Request',
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - invalid or missing JWT token',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
        error: 'Unauthorized',
      },
    },
  })
  @ApiForbiddenResponse({
    description: 'Forbidden - user is not the owner of the CV',
    schema: {
      example: {
        statusCode: 403,
        message: 'You do not have permission to delete this CV',
        error: 'Forbidden',
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Not found - CV with the given ID does not exist',
    schema: {
      example: {
        statusCode: 404,
        message: 'CV not found',
        error: 'Not Found',
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description:
      'Internal server error - failed to delete file from storage or database error',
    schema: {
      example: {
        statusCode: 500,
        message: 'Failed to delete file from storage. Please try again later.',
        error: 'Internal Server Error',
      },
    },
  })
  async deleteCv(
    @CurrentUser() user: CurrentUserType,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.cvsService.deleteCv(id, user.userId);
  }
}
