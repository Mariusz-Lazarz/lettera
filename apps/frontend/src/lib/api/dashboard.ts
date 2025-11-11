import { ApiError } from './auth';
import type { CvViewModel, LetterViewModel, CvListResponseDto, LetterListResponseDto } from '@/types/dashboard';

/**
 * Bazowy URL API
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Helper dla wywołań fetch z obsługą błędów
 */
async function fetchJson<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      credentials: 'include', // Wysyłaj cookies (httpOnly session)
    });

    // Parsowanie odpowiedzi JSON
    let data: unknown;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    }

    // Obsługa błędów HTTP
    if (!response.ok) {
      const errorMessage =
        typeof data === 'object' && data !== null && 'message' in data
          ? String(data.message)
          : `Request failed with status ${response.status}`;

      throw new ApiError(response.status, errorMessage, data);
    }

    return data as T;
  } catch (error) {
    // Jeśli to już ApiError, przepuść dalej
    if (error instanceof ApiError) {
      throw error;
    }

    // Obsługa błędów sieciowych
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError(
        0,
        'Błąd połączenia z serwerem. Sprawdź połączenie internetowe.',
        error
      );
    }

    // Inne nieoczekiwane błędy
    throw new ApiError(
      500,
      error instanceof Error ? error.message : 'Nieznany błąd',
      error
    );
  }
}

/**
 * Helper dla wywołań fetch zwracających pliki binarne
 */
async function fetchBlob(
  endpoint: string,
  options?: RequestInit
): Promise<Blob> {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
    });

    if (!response.ok) {
      // Próbuj sparsować JSON error jeśli dostępny
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        const errorMessage =
          typeof data === 'object' && data !== null && 'message' in data
            ? String(data.message)
            : `Request failed with status ${response.status}`;
        throw new ApiError(response.status, errorMessage, data);
      }

      throw new ApiError(response.status, `Request failed with status ${response.status}`);
    }

    return await response.blob();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError(
        0,
        'Błąd połączenia z serwerem. Sprawdź połączenie internetowe.',
        error
      );
    }

    throw new ApiError(
      500,
      error instanceof Error ? error.message : 'Nieznany błąd',
      error
    );
  }
}

/**
 * Mapuje odpowiedź API (snake_case) na ViewModel (camelCase)
 */
function mapCvToViewModel(cv: { id: string; filename: string; created_at?: string | Date }): CvViewModel {
  let createdAt: string;
  
  if (!cv.created_at) {
    // Fallback jeśli backend nie zwraca daty
    createdAt = new Date().toISOString();
  } else if (typeof cv.created_at === 'string') {
    createdAt = cv.created_at;
  } else {
    createdAt = cv.created_at.toISOString();
  }
  
  return {
    id: cv.id,
    filename: cv.filename,
    createdAt,
  };
}

/**
 * Mapuje odpowiedź API dla listu na ViewModel
 */
function mapLetterToViewModel(letter: {
  id: string;
  html: string;
  pdf_s3_key?: string;
  created_at?: string | Date;
  updated_at?: string | Date;
}): LetterViewModel {
  const now = new Date().toISOString();
  
  let createdAt: string;
  if (!letter.created_at) {
    createdAt = now;
  } else if (typeof letter.created_at === 'string') {
    createdAt = letter.created_at;
  } else {
    createdAt = letter.created_at.toISOString();
  }
  
  let updatedAt: string;
  if (!letter.updated_at) {
    updatedAt = now;
  } else if (typeof letter.updated_at === 'string') {
    updatedAt = letter.updated_at;
  } else {
    updatedAt = letter.updated_at.toISOString();
  }
  
  return {
    id: letter.id,
    html: letter.html,
    pdfS3Key: letter.pdf_s3_key,
    createdAt,
    updatedAt,
  };
}

/**
 * Pobiera listę CV użytkownika
 *
 * @returns Lista CV
 * @throws ApiError - 401 (brak autoryzacji), 500 (błąd serwera)
 */
export async function getCvs(): Promise<CvViewModel[]> {
  const response = await fetchJson<CvListResponseDto>('/cvs', {
    method: 'GET',
  });

  return response.items.map(mapCvToViewModel);
}

/**
 * Usuwa CV użytkownika
 *
 * @param id - ID CV do usunięcia
 * @throws ApiError - 403 (brak uprawnień), 404 (nie znaleziono), 500 (błąd serwera)
 */
export async function deleteCv(id: string): Promise<void> {
  await fetchJson<void>(`/cvs/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Pobiera CV użytkownika (plik PDF)
 *
 * @param id - ID CV do pobrania
 * @returns Blob z plikiem PDF
 * @throws ApiError - 403 (brak uprawnień), 404 (nie znaleziono), 500 (błąd serwera)
 */
export async function downloadCv(id: string): Promise<Blob> {
  return fetchBlob(`/cvs/${id}/download`, {
    method: 'GET',
  });
}

/**
 * Przesyła nowe CV użytkownika
 *
 * @param file - Plik PDF z CV
 * @returns Nowo utworzone CV
 * @throws ApiError - 400 (błędny format), 413 (plik za duży), 500 (błąd serwera)
 */
export async function uploadCv(file: File, filename?: string): Promise<CvViewModel> {
  const formData = new FormData();
  formData.append('cv', file);
  if (filename) {
    formData.append('filename', filename);
  }

  const url = `${API_BASE_URL}/cvs`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    let data: unknown;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    }

    if (!response.ok) {
      const errorMessage =
        typeof data === 'object' && data !== null && 'message' in data
          ? String(data.message)
          : `Request failed with status ${response.status}`;

      throw new ApiError(response.status, errorMessage, data);
    }

    // Mapuj odpowiedź
    const cvData = data as { id: string; filename: string; created_at?: string | Date };
    return mapCvToViewModel(cvData);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError(
        0,
        'Błąd połączenia z serwerem. Sprawdź połączenie internetowe.',
        error
      );
    }

    throw new ApiError(
      500,
      error instanceof Error ? error.message : 'Nieznany błąd',
      error
    );
  }
}

/**
 * Pobiera listę wygenerowanych listów motywacyjnych
 *
 * @returns Lista listów
 * @throws ApiError - 401 (brak autoryzacji), 500 (błąd serwera)
 */
export async function getLetters(): Promise<LetterViewModel[]> {
  const response = await fetchJson<LetterListResponseDto>('/letters', {
    method: 'GET',
  });

  return response.items.map(mapLetterToViewModel);
}

/**
 * Pobiera PDF listu motywacyjnego
 *
 * @param id - ID listu do pobrania
 * @returns Blob z plikiem PDF
 * @throws ApiError - 403 (brak uprawnień), 404 (nie znaleziono), 500 (błąd serwera)
 */
export async function downloadLetter(id: string): Promise<Blob> {
  return fetchBlob(`/letters/${id}/download`, {
    method: 'GET',
  });
}

/**
 * Usuwa list motywacyjny (jeśli wspierane przez backend)
 *
 * @param id - ID listu do usunięcia
 * @throws ApiError - 403 (brak uprawnień), 404 (nie znaleziono), 500 (błąd serwera)
 */
export async function deleteLetter(id: string): Promise<void> {
  await fetchJson<void>(`/letters/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Tworzy nowy list motywacyjny (generuje na podstawie CV i opisu stanowiska)
 *
 * @param cvId - ID CV użytkownika
 * @param jobTitle - Tytuł stanowiska
 * @param jobDescription - Opis stanowiska (1000-10000 znaków)
 * @returns Wygenerowany list motywacyjny
 * @throws ApiError - 400 (błędne dane, CV nie istnieje), 403 (limit listów), 422 (błąd AI)
 */
export async function createLetter(
  cvId: string,
  jobTitle: string,
  jobDescription: string
): Promise<LetterViewModel> {
  const response = await fetchJson<{
    id: string;
    user_id: string;
    html: string;
    pdf_s3_key?: string;
    status?: string;
    created_at?: string | Date;
    updated_at?: string | Date;
  }>(`/letters`, {
    method: 'POST',
    body: JSON.stringify({
      cv_id: cvId,
      job_title: jobTitle,
      job_description: jobDescription,
    }),
  });

  return mapLetterToViewModel(response);
}

