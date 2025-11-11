/**
 * Typy dla widoku Dashboard / Profile
 */

/**
 * ViewModel dla CV użytkownika
 */
export interface CvViewModel {
  id: string;
  filename: string;
  createdAt: string; // ISO8601
}

/**
 * ViewModel dla wygenerowanego listu motywacyjnego
 */
export interface LetterViewModel {
  id: string;
  html: string;
  pdfS3Key?: string;
  createdAt: string; // ISO8601
  updatedAt: string; // ISO8601
}

/**
 * Odpowiedź z listy CV
 */
export interface CvListResponseDto {
  items: Array<{
    id: string;
    filename: string;
    created_at?: string | Date;
  }>;
}

/**
 * Odpowiedź z listy listów
 */
export interface LetterListResponseDto {
  items: Array<{
    id: string;
    html: string;
    pdf_s3_key?: string;
    created_at?: string | Date;
    updated_at?: string | Date;
  }>;
}

