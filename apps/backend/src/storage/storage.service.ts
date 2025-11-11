import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Storage service for S3 operations
 * Handles file upload, deletion, and signed URL generation
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor() {
    // Validate required environment variables
    this.bucketName = process.env.AWS_S3_BUCKET_NAME || '';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '';

    if (!this.bucketName) {
      this.logger.error(
        'AWS_S3_BUCKET_NAME environment variable is not configured',
      );
      throw new Error('AWS_S3_BUCKET_NAME is required for StorageService');
    }

    if (!accessKeyId || !secretAccessKey) {
      this.logger.error(
        'AWS credentials (ACCESS_KEY_ID/SECRET_ACCESS_KEY) are not configured',
      );
      throw new Error('AWS credentials are required for StorageService');
    }

    // Initialize S3 client with credentials from environment
    const s3Config: S3ClientConfig = {
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    };

    // Support for MinIO or other S3-compatible services
    if (process.env.AWS_ENDPOINT) {
      s3Config.endpoint = process.env.AWS_ENDPOINT;
      s3Config.forcePathStyle = true; // Required for MinIO
      this.logger.log(`Using custom S3 endpoint: ${process.env.AWS_ENDPOINT}`);
    }

    this.s3Client = new S3Client(s3Config);

    this.logger.log(
      `StorageService initialized with bucket: ${this.bucketName}`,
    );
  }

  /**
   * Upload a file to S3
   * @param key - S3 object key (path)
   * @param fileBuffer - File content as Buffer
   * @param contentType - MIME type of the file
   * @returns Promise that resolves when upload is complete
   */
  async uploadFile(
    key: string,
    fileBuffer: Buffer,
    contentType: string,
  ): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        // Private ACL - files are not publicly accessible
        ServerSideEncryption: 'AES256',
      });

      await this.s3Client.send(command);

      this.logger.log(`File uploaded successfully to S3: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to upload file to S3: ${key}`, error);
      throw new InternalServerErrorException(
        'Failed to upload file to storage',
      );
    }
  }

  /**
   * Delete a file from S3
   * @param key - S3 object key (path)
   * @param throwOnError - If true, throws on failure; if false, logs only (for cleanup)
   * @returns Promise that resolves when deletion is complete
   * @throws InternalServerErrorException if throwOnError is true and deletion fails
   */
  async deleteFile(key: string, throwOnError: boolean = true): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);

      this.logger.log(`File deleted successfully from S3: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file from S3: ${key}`, error);

      if (throwOnError) {
        throw new InternalServerErrorException(
          'Failed to delete file from storage',
        );
      }
      // Best-effort delete for cleanup/compensation - don't throw, just log
    }
  }

  /**
   * Generate a presigned URL for file download
   * @param key - S3 object key (path)
   * @param expiresIn - URL expiration time in seconds (default: 1 hour)
   * @returns Promise that resolves with the presigned URL
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      return signedUrl;
    } catch (error) {
      this.logger.error(`Failed to generate signed URL for: ${key}`, error);
      throw new InternalServerErrorException('Failed to generate download URL');
    }
  }

  /**
   * Download a file from S3 as a Buffer
   * @param key - S3 object key (path)
   * @returns Promise that resolves with the file content as Buffer
   * @throws InternalServerErrorException if download fails
   */
  async downloadFile(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      // Convert stream to buffer
      if (!response.Body) {
        throw new InternalServerErrorException('No data received from S3');
      }

      const stream = response.Body as AsyncIterable<Uint8Array>;
      const chunks: Buffer[] = [];

      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }

      const buffer = Buffer.concat(chunks);
      this.logger.log(`File downloaded successfully from S3: ${key}`);

      return buffer;
    } catch (error) {
      this.logger.error(`Failed to download file from S3: ${key}`, error);
      throw new InternalServerErrorException(
        'Failed to download file from storage',
      );
    }
  }
}
