import type { LoginRequestDto, RegisterRequestDto } from '../validation/authSchemas';

/**
 * Typy dla odpowiedzi z backendu
 */
export interface AuthUser {
  id: string;
  email: string;
  createdAt?: string;
}

export interface RegisterResponseDto {
  user: AuthUser;
}

export interface LoginResponseDto {
  user: AuthUser;
}

/**
 * Klasa błędu API
 */
export class ApiError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Bazowy URL API - w produkcji należy użyć zmiennej środowiskowej
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
 * Rejestracja nowego użytkownika
 *
 * @param payload - dane rejestracyjne (email, password)
 * @returns Odpowiedź z danymi użytkownika i opcjonalnie tokenem
 * @throws ApiError - 409 (email już istnieje), 400 (błędy walidacji), 500 (błąd serwera)
 */
export async function register(
  payload: RegisterRequestDto
): Promise<RegisterResponseDto> {
  return fetchJson<RegisterResponseDto>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Logowanie użytkownika
 *
 * @param payload - dane logowania (email, password)
 * @returns Odpowiedź z danymi użytkownika i opcjonalnie tokenem
 * @throws ApiError - 401 (nieprawidłowe dane), 400 (błędy walidacji), 500 (błąd serwera)
 */
export async function login(
  payload: LoginRequestDto
): Promise<LoginResponseDto> {
  return fetchJson<LoginResponseDto>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Wylogowanie użytkownika
 * Usuwa sesję po stronie serwera (jeśli backend obsługuje)
 */
export async function logout(): Promise<void> {
  return fetchJson<void>('/auth/logout', {
    method: 'POST',
  });
}

/**
 * Pobieranie danych aktualnie zalogowanego użytkownika
 * Wykorzystuje httpOnly cookie do autoryzacji
 *
 * @returns Dane użytkownika lub null jeśli niezalogowany
 * @throws ApiError - 401 (brak autoryzacji)
 */
export async function getMe(): Promise<AuthUser | null> {
  try {
    return await fetchJson<AuthUser>('/users/me', {
      method: 'GET',
    });
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) {
      return null;
    }
    throw error;
  }
}

