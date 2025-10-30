import {
  Injectable,
  Logger,
  UnprocessableEntityException,
  BadRequestException,
} from '@nestjs/common';

/**
 * PDF Extractor Service
 * Extracts text from PDF files using OpenRouter AI with native PDF support
 */
@Injectable()
export class PdfExtractorService {
  private readonly logger = new Logger(PdfExtractorService.name);
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly model: string;
  private readonly timeout: number = 60000; // 60 seconds for PDF processing

  constructor() {
    // Load OpenRouter API key from environment
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    // Use GPT-4o mini for PDF text extraction
    this.model = 'openai/gpt-4o-mini';

    if (!this.apiKey) {
      this.logger.warn(
        'OPENROUTER_API_KEY not configured - PDF extraction will fail in production',
      );
    }
  }

  /**
   * Extract text from a PDF file using OpenRouter AI
   * @param pdfBuffer - PDF file content as Buffer
   * @returns Extracted text from the PDF
   * @throws BadRequestException if PDF is scanned/image-based
   * @throws UnprocessableEntityException if extraction fails
   */
  async extractText(pdfBuffer: Buffer): Promise<string> {
    try {
      this.logger.log(
        `Starting PDF text extraction with OpenRouter (buffer size: ${pdfBuffer.length} bytes)`,
      );

      // Convert PDF buffer to base64 for OpenRouter
      const base64Pdf = pdfBuffer.toString('base64');
      const dataUrl = `data:application/pdf;base64,${base64Pdf}`;

      // Call OpenRouter API with PDF file support
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:5173',
          'X-Title': 'Lettera - AI Cover Letter Generator',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract all text content from this PDF CV/resume. Return ONLY the raw extracted text without any additional comments, formatting, explanations, or markdown. Include all sections: personal information, work experience, education, skills, etc.',
                },
                {
                  type: 'file',
                  file: {
                    filename: 'cv.pdf',
                    file_data: dataUrl,
                  },
                },
              ],
            },
          ],
          temperature: 0.1, // Low temperature for consistent extraction
          max_tokens: 4000,
          // Use Mistral OCR engine for better PDF processing
          plugins: [
            {
              id: 'file-parser',
              pdf: {
                engine: 'mistral-ocr',
              },
            },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        this.logger.error(
          `OpenRouter API error (${response.status}): ${errorText.substring(0, 200)}`,
        );
        throw new UnprocessableEntityException(
          'AI service returned an error during PDF extraction',
        );
      }

      const data = await response.json();

      // Extract text from response
      const extractedText = this.extractTextFromResponse(data);

      // Validate extracted text
      if (!extractedText || extractedText.length < 50) {
        this.logger.error(
          `PDF extraction resulted in insufficient text (${extractedText?.length || 0} chars). PDF may be scanned or image-based.`,
        );
        throw new BadRequestException(
          'Failed to extract sufficient text from PDF. Please ensure your CV contains readable text and is not a scanned image.',
        );
      }

      this.logger.log(
        `Successfully extracted ${extractedText.length} characters from PDF`,
      );

      return extractedText;
    } catch (error) {
      // Handle timeout errors
      if (error.name === 'AbortError') {
        this.logger.error('PDF extraction timeout');
        throw new UnprocessableEntityException(
          'PDF extraction timeout. Please try again.',
        );
      }

      // Re-throw already formatted exceptions
      if (
        error instanceof BadRequestException ||
        error instanceof UnprocessableEntityException
      ) {
        throw error;
      }

      // Handle other errors
      this.logger.error('PDF extraction error:', error);
      throw new UnprocessableEntityException(
        'Failed to extract text from PDF. Please try again later.',
      );
    }
  }

  /**
   * Extract text content from OpenRouter API response
   */
  private extractTextFromResponse(data: any): string {
    try {
      // OpenRouter/OpenAI format
      if (data.choices && data.choices[0]?.message?.content) {
        return data.choices[0].message.content.trim();
      }

      throw new Error('Unexpected AI response format');
    } catch (error) {
      this.logger.error('Failed to extract text from AI response:', error);
      throw new UnprocessableEntityException(
        'Failed to parse AI response during PDF extraction',
      );
    }
  }
}
