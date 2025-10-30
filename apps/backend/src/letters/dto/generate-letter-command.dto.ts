/**
 * Internal command object for letter generation
 * Used to pass validated data from controller to service
 */
export interface GenerateLetterCommand {
  userId: string;
  cvId: string;
  jobTitle: string;
  jobDescription: string;
}

/**
 * Result object returned by letter generation service
 * Contains the generated letter data
 */
export interface GenerateLetterResult {
  id: string;
  userId: string;
  html: string;
  pdfS3Key?: string;
  createdAt: Date;
  updatedAt: Date;
}
