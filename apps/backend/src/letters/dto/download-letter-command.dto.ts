/**
 * Command for downloading a letter as PDF
 * Internal service interface for letter download operation
 */
export interface DownloadLetterCommand {
  letterId: string;
  userId: string;
  inline?: boolean;
}

/**
 * Result of PDF generation
 * Contains either a buffer (for direct streaming) or S3 key (for cached PDF)
 */
export interface PdfGenerationResult {
  buffer?: Buffer;
  s3Key?: string;
  sizeBytes: number;
}
