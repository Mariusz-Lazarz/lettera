import {
  Injectable,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';

/**
 * Input for AI letter generation
 */
export interface GenerateLetterInput {
  cvText: string;
  jobTitle: string;
  jobDescription: string;
}

/**
 * AI Provider Service
 * Handles communication with AI service (OpenRouter or other providers)
 * for generating cover letters
 */
@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly model: string;
  private readonly timeout: number = 30000; // 30 seconds

  constructor() {
    // Load OpenRouter API key from environment
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    // Hardcoded model: GPT-4o mini with thinking for CV generation
    this.model = 'openai/gpt-4o-mini';

    if (!this.apiKey) {
      this.logger.warn(
        'OPENROUTER_API_KEY not configured - AI generation will fail in production',
      );
    }
  }

  /**
   * Generate a cover letter using AI
   * @param input - CV text, job title and description
   * @returns Generated HTML cover letter
   * @throws UnprocessableEntityException if AI generation fails
   */
  async generateLetter(input: GenerateLetterInput): Promise<string> {
    const { cvText, jobTitle, jobDescription } = input;

    // Build the prompt for AI
    const prompt = this.buildPrompt(cvText, jobTitle, jobDescription);

    try {
      this.logger.log(
        `Generating letter for job: ${jobTitle.substring(0, 50)}...`,
      );

      // Call AI API with timeout
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
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        this.logger.error(
          `AI API error (${response.status}): ${errorText.substring(0, 200)}`,
        );
        throw new UnprocessableEntityException(
          'AI service returned an error. Please try again.',
        );
      }

      const data = await response.json();

      // Extract the generated HTML from response
      const html = this.extractHtmlFromResponse(data);

      if (!html || html.length < 100) {
        this.logger.error('AI generated invalid or too short response');
        throw new UnprocessableEntityException(
          'AI generated invalid response. Please try again.',
        );
      }

      // Validate HTML size (max 200,000 chars as per DB constraint)
      if (html.length > 200000) {
        this.logger.error(
          `AI generated HTML too long: ${html.length} characters`,
        );
        throw new UnprocessableEntityException(
          'Generated letter is too long. Please try with a shorter job description.',
        );
      }

      this.logger.log(
        `Successfully generated letter (${html.length} characters)`,
      );
      return html;
    } catch (error) {
      // Handle timeout errors
      if (error.name === 'AbortError') {
        this.logger.error('AI request timeout');
        throw new UnprocessableEntityException(
          'AI service timeout. Please try again.',
        );
      }

      // Re-throw already formatted exceptions
      if (error instanceof UnprocessableEntityException) {
        throw error;
      }

      // Handle other errors
      this.logger.error('AI generation error:', error);
      throw new UnprocessableEntityException(
        'Failed to generate letter. Please try again later.',
      );
    }
  }

  /**
   * Build the prompt for AI letter generation
   * Sanitizes input to remove control characters
   */
  private buildPrompt(
    cvText: string,
    jobTitle: string,
    jobDescription: string,
  ): string {
    // Sanitize inputs - remove control characters
    const sanitize = (text: string): string => {
      return text.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    };

    const cleanCvText = sanitize(cvText);
    const cleanJobTitle = sanitize(jobTitle);
    const cleanJobDescription = sanitize(jobDescription);

    return `You are an expert cover letter writer. Generate a professional, compelling cover letter in HTML format based on the following information:

**Job Title:** ${cleanJobTitle}

**Job Description:**
${cleanJobDescription}

**Candidate's CV:**
${cleanCvText}

Requirements:
1. Generate a complete, professional cover letter that matches the candidate's experience with the job requirements
2. Highlight relevant skills and experiences from the CV that align with the job description
3. Use professional tone and structure
4. Return ONLY valid HTML (no markdown, no code blocks)
5. Use semantic HTML tags like <h1>, <p>, <ul>, <li>, etc.
6. Keep the letter concise (typically 3-4 paragraphs)
7. Do not include placeholder text like [Your Name] - use real information from the CV
8. Structure: opening paragraph (interest + brief intro), 1-2 body paragraphs (relevant experience/skills), closing paragraph (call to action)

Return the HTML directly, without any surrounding text or code blocks.`;
  }

  /**
   * Extract HTML content from AI API response
   * Handles different response formats
   */
  private extractHtmlFromResponse(data: any): string {
    try {
      // OpenRouter/OpenAI format
      if (data.choices && data.choices[0]?.message?.content) {
        let content = data.choices[0].message.content;

        // Remove markdown code blocks if present
        content = content.replace(/```html\n?/g, '').replace(/```\n?/g, '');

        return content.trim();
      }

      throw new Error('Unexpected AI response format');
    } catch (error) {
      this.logger.error('Failed to extract HTML from AI response:', error);
      throw new UnprocessableEntityException(
        'Failed to parse AI response. Please try again.',
      );
    }
  }
}
