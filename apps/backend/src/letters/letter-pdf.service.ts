import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import puppeteer, { Browser, Page } from 'puppeteer';
import { StorageService } from '../storage/storage.service';
import { LettersService } from './letters.service';
import {
  DownloadLetterCommand,
  PdfGenerationResult,
} from './dto/download-letter-command.dto';
import { PrismaService } from '../prisma.service';

/**
 * Letter PDF Service
 * Handles PDF generation from HTML using Puppeteer
 * Manages caching to S3 and streaming PDFs to clients
 */
@Injectable()
export class LetterPdfService {
  private readonly logger = new Logger(LetterPdfService.name);
  private readonly PDF_GENERATION_TIMEOUT = 60000; // 60 seconds
  private readonly MAX_HTML_LENGTH = 200000; // 200k chars (DB constraint)
  private browser: Browser | null = null;

  constructor(
    private readonly storage: StorageService,
    private readonly lettersService: LettersService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Initialize Puppeteer browser instance
   * Uses headless mode with security settings
   */
  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    this.logger.log('Initializing Puppeteer browser');

    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-web-security', // Needed for local HTML rendering
          '--disable-features=IsolateOrigins,site-per-process',
        ],
        timeout: 30000,
      });

      this.logger.log('Puppeteer browser initialized successfully');
      return this.browser;
    } catch (error) {
      this.logger.error('Failed to initialize Puppeteer browser', error);
      throw new InternalServerErrorException(
        'Failed to initialize PDF renderer',
      );
    }
  }

  /**
   * Generate PDF from HTML content
   * @param html - HTML content to convert to PDF
   * @returns PDF as Buffer
   * @throws InternalServerErrorException if generation fails
   */
  async generatePdfFromHtml(html: string): Promise<Buffer> {
    // Validate HTML length
    if (html.length > this.MAX_HTML_LENGTH) {
      this.logger.error(`HTML too long: ${html.length} characters`);
      throw new InternalServerErrorException(
        'HTML content exceeds maximum allowed size',
      );
    }

    let page: Page | null = null;

    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();

      // Set timeout for the page
      page.setDefaultTimeout(this.PDF_GENERATION_TIMEOUT);

      // Block external resources for security
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        // Allow only document and fonts, block everything else (images, scripts, etc.)
        if (['document', 'font'].includes(resourceType)) {
          void request.continue();
        } else {
          void request.abort();
        }
      });

      this.logger.log('Setting page content for PDF generation');

      // Set HTML content with a wrapper for better styling
      const wrappedHtml = this.wrapHtmlForPdf(html);
      await page.setContent(wrappedHtml, {
        waitUntil: 'networkidle0',
        timeout: this.PDF_GENERATION_TIMEOUT,
      });

      this.logger.log('Generating PDF from HTML');

      // Generate PDF with professional settings
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm',
        },
        preferCSSPageSize: false,
      });

      this.logger.log(`PDF generated successfully (${pdfBuffer.length} bytes)`);

      // Convert Uint8Array to Buffer
      return Buffer.from(pdfBuffer);
    } catch (error) {
      this.logger.error('Failed to generate PDF from HTML', error);
      throw new InternalServerErrorException(
        'Failed to generate PDF. Please try again.',
      );
    } finally {
      // Clean up page
      if (page) {
        await page.close().catch((err) => {
          this.logger.warn('Failed to close Puppeteer page', err);
        });
      }
    }
  }

  /**
   * Wrap HTML content with proper structure and basic styling for PDF
   * @param html - Raw HTML content
   * @returns Wrapped HTML with proper document structure
   */
  private wrapHtmlForPdf(html: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cover Letter</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #000;
      background: #fff;
      padding: 0;
      margin: 0;
    }
    h1 {
      font-size: 18pt;
      margin-bottom: 12pt;
      font-weight: 600;
    }
    h2 {
      font-size: 14pt;
      margin-top: 12pt;
      margin-bottom: 8pt;
      font-weight: 600;
    }
    p {
      margin-bottom: 12pt;
      text-align: justify;
    }
    ul, ol {
      margin-left: 20pt;
      margin-bottom: 12pt;
    }
    li {
      margin-bottom: 6pt;
    }
    strong {
      font-weight: 600;
    }
    @page {
      size: A4;
      margin: 0;
    }
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
    }
  </style>
</head>
<body>
${html}
</body>
</html>
    `.trim();
  }

  /**
   * Upload PDF buffer to S3 storage
   * @param buffer - PDF content as Buffer
   * @param key - S3 key (path) for the file
   * @returns S3 key of uploaded file
   */
  async uploadPdfToS3(buffer: Buffer, key: string): Promise<string> {
    try {
      this.logger.log(`Uploading PDF to S3: ${key}`);
      await this.storage.uploadFile(key, buffer, 'application/pdf');
      this.logger.log(`PDF uploaded successfully: ${key}`);
      return key;
    } catch (error) {
      this.logger.error(`Failed to upload PDF to S3: ${key}`, error);
      throw new InternalServerErrorException('Failed to upload PDF to storage');
    }
  }

  /**
   * Download a letter as PDF
   * Orchestrates the entire process: fetch letter, check cache, generate PDF, upload
   * @param command - Download command with letterId, userId, inline flag
   * @returns PDF generation result with buffer and metadata
   * @throws NotFoundException if letter not found or user not authorized
   * @throws InternalServerErrorException for generation/storage errors
   */
  async downloadLetter(
    command: DownloadLetterCommand,
  ): Promise<PdfGenerationResult> {
    const { letterId, userId } = command;

    this.logger.log(`Processing PDF download for letter ${letterId}`);

    // Step 1: Fetch letter and verify ownership
    const letter = await this.lettersService.getLetterByIdForUser(
      letterId,
      userId,
    );

    // Step 2: Check if PDF is already cached in S3
    if (letter.pdfS3Key) {
      this.logger.log(
        `PDF cache found for letter ${letterId}: ${letter.pdfS3Key}`,
      );

      try {
        const buffer = await this.storage.downloadFile(letter.pdfS3Key);
        this.logger.log(
          `PDF retrieved from cache (${buffer.length} bytes) for letter ${letterId}`,
        );

        return {
          buffer,
          s3Key: letter.pdfS3Key,
          sizeBytes: buffer.length,
        };
      } catch (error) {
        // Cache miss or S3 error - regenerate PDF
        this.logger.warn(
          `Failed to retrieve cached PDF for letter ${letterId}, will regenerate`,
          error,
        );
      }
    }

    // Step 3: Generate PDF from HTML
    this.logger.log(`Generating new PDF for letter ${letterId}`);
    const pdfBuffer = await this.generatePdfFromHtml(letter.html);

    // Step 4: Upload to S3 for caching
    const s3Key = `pdfs/${userId}/${letterId}.pdf`;

    try {
      await this.uploadPdfToS3(pdfBuffer, s3Key);

      // Step 5: Update letter record with pdfS3Key
      await this.prisma.letter.update({
        where: { id: letterId },
        data: { pdfS3Key: s3Key },
      });

      this.logger.log(
        `Letter ${letterId} updated with PDF cache key: ${s3Key}`,
      );
    } catch (error) {
      // Upload failed - log but still return generated PDF
      this.logger.error(
        `Failed to cache PDF for letter ${letterId}, returning generated PDF anyway`,
        error,
      );
    }

    return {
      buffer: pdfBuffer,
      s3Key: s3Key,
      sizeBytes: pdfBuffer.length,
    };
  }

  /**
   * Cleanup: close browser on module destroy
   */
  async onModuleDestroy() {
    if (this.browser) {
      this.logger.log('Closing Puppeteer browser');
      await this.browser.close().catch((err) => {
        this.logger.error('Failed to close Puppeteer browser', err);
      });
      this.browser = null;
    }
  }
}
