# Plan Testów: Lettera AI Cover Letter Generator

## 1. Wprowadzenie

Niniejszy dokument przedstawia kompleksowy plan testów dla aplikacji Lettera, inteligentnego generatora listów motywacyjnych. Celem planu jest zapewnienie wysokiej jakości, stabilności, bezpieczeństwa i wydajności aplikacji poprzez systematyczne testowanie wszystkich jej kluczowych komponentów, od interfejsu użytkownika po integracje z zewnętrznymi usługami AI i storage.

## 2. Cele Testowania

*   **Weryfikacja funkcjonalności:** Upewnienie się, że wszystkie funkcje aplikacji działają zgodnie z wymaganiami i specyfikacją.
*   **Zapewnienie jakości danych:** Potwierdzenie spójności i integralności danych w bazie danych oraz w zewnętrznych systemach przechowywania.
*   **Potwierdzenie bezpieczeństwa:** Identyfikacja i eliminacja podatności w systemach autoryzacji, zarządzania plikami i integracjach zewnętrznych.
*   **Ocena wydajności:** Pomiar czasu odpowiedzi i przepustowości kluczowych operacji (upload, generacja AI, generacja PDF).
*   **Zapewnienie użyteczności (UI/UX):** Sprawdzenie, czy interfejs użytkownika jest intuicyjny i responsywny.
*   **Zgodność:** Weryfikacja działania aplikacji w różnych środowiskach i przeglądarkach.
*   **Identyfikacja defektów:** Wyszukiwanie błędów i niezgodności przed wdrożeniem produkcyjnym.

## 3. Zakres Testów

Testy będą obejmować wszystkie główne komponenty aplikacji, zarówno frontendowe, backendowe, jak i integracje z usługami zewnętrznymi.

### 3.1. Obszary Funkcjonalne

*   **Moduł Autoryzacji:**
    *   Rejestracja użytkownika (email, hasło).
    *   Logowanie użytkownika.
    *   Wylogowanie użytkownika.
    *   Pobieranie profilu użytkownika (`/users/me`).
    *   Zarządzanie tokenami JWT (cookie `httpOnly`, wygaśnięcie).
*   **Moduł Zarządzania CV:**
    *   Upload pliku PDF CV (`POST /cvs`):
        *   Walidacja pliku (typ `application/pdf`, magic bytes, rozmiar max 10MB).
        *   Limit 5 CV na użytkownika.
        *   Zapis do S3 (z szyfrowaniem, unikalny klucz).
        *   Zapis metadanych do PostgreSQL.
        *   Obsługa niestandardowej nazwy pliku.
        *   Mechanizm kompensacji (usunięcie z S3 w przypadku błędu DB).
    *   Lista CV użytkownika (`GET /cvs`):
        *   Wyświetlanie metadanych (ID, nazwa pliku, data utworzenia).
        *   Sortowanie.
    *   Usunięcie CV (`DELETE /cvs/:id`):
        *   Weryfikacja własności.
        *   Usunięcie z S3.
        *   Usunięcie z PostgreSQL.
        *   Obsługa błędów (np. nieudane usunięcie z S3).
*   **Moduł Generowania Listów Motywacyjnych:**
    *   Generowanie listu (`POST /letters`):
        *   Wybór istniejącego CV użytkownika.
        *   Walidacja tytułu i opisu stanowiska (długość, zawartość).
        *   Pobranie CV z S3.
        *   Ekstrakcja tekstu z PDF za pomocą AI (OpenRouter.ai).
        *   Generacja treści listu w HTML za pomocą AI (OpenRouter.ai).
        *   Limit 5 listów na użytkownika.
        *   Zapis HTML listu do PostgreSQL.
    *   Lista listów użytkownika (`GET /letters`):
        *   Wyświetlanie metadanych (ID, podgląd HTML, data utworzenia/aktualizacji).
        *   Sortowanie.
    *   Pobranie listu jako PDF (`GET /letters/:id/download`):
        *   Generacja PDF z HTML za pomocą Puppeteer.
        *   Opcjonalne buforowanie PDF w S3.
        *   Streaming PDF do klienta.
        *   Parametr `inline` dla `Content-Disposition`.
    *   Usunięcie listu (`DELETE /letters/:id`):
        *   Weryfikacja własności.
        *   Usunięcie PDF z S3 (jeśli istnieje).
        *   Usunięcie z PostgreSQL.

### 3.2. Integracje

*   **PostgreSQL / Prisma:** Poprawność migracji, transakcje, zapytania, RLS (Row Level Security).
*   **S3-compatible storage (DigitalOcean Spaces / AWS S3):** Działanie operacji Put, Get, Delete, poprawność kluczy, uprawnienia.
*   **OpenRouter.ai (AI/OCR):** Stabilność połączenia, poprawność zapytań, parsowanie odpowiedzi, obsługa limitów i błędów AI, jakość wyodrębnionego tekstu i wygenerowanej treści.
*   **Puppeteer:** Poprawność renderowania HTML do PDF, obsługa stylów, czcionek, marginesów, błędów podczas generacji.

### 3.3. Interfejs Użytkownika (Frontend)

*   **Formularze:** Rejestracja, logowanie, upload CV, generowanie listu (walidacja po stronie klienta i serwera, stany ładowania, komunikaty błędów).
*   **Listy danych:** Wyświetlanie CV i listów, akcje (pobierz, usuń).
*   **Modale:** Upload CV, generowanie listu, potwierdzenia (zamknięcie, anulowanie, stany ładowania).
*   **Nawigacja:** Poprawność przekierowań (ProtectedRoute, PublicRoute).
*   **Responsywność:** Działanie na różnych rozmiarach ekranu (desktop, tablet, mobile).
*   **Dostępność (Accessibility):** Podstawowe testy (tab order, etykiety ARIA dla kluczowych elementów).

### 3.4. Bezpieczeństwo

*   **Autoryzacja i uwierzytelnianie:** Testy siły hasła, CSRF, XSS (poprzez sanityzację danych wejściowych), session hijacking (cookie `httpOnly`).
*   **Kontrola dostępu (RLS, własność zasobów):** Użytkownik może operować tylko na swoich danych.
*   **Upload plików:** File type bypass, oversized files, filename path traversal.
*   **Wyciek danych:** Brak eksponowania wrażliwych danych (np. `passwordHash`).
*   **Zmienne środowiskowe:** Weryfikacja, czy klucze API i sekrety nie są twardo zakodowane.

### 3.5. Wydajność

*   **API:** Czas odpowiedzi dla `POST /cvs`, `POST /letters`, `GET /letters/:id/download` przy różnych obciążeniach.
*   **Frontend:** Czas ładowania stron, responsywność interfejsu przy dużych listach danych (choć limit 5 jest niski, warto sprawdzić).

## 4. Typy Testów

*   **Testy Jednostkowe (Unit Tests):**
    *   **Cel:** Izolowane testowanie małych, niezależnych fragmentów kodu (funkcje, metody, klasy).
    *   **Backend:** Testy usług (services), kontrolerów, walidatorów, DTO. Mockowanie zależności zewnętrznych (Prisma, S3, AI). Istniejące testy (`app.controller.spec.ts`).
    *   **Frontend:** Testowanie poszczególnych komponentów React w izolacji (np. `AuthForm`, `UploadCVModal`).
    *   **Narzędzia:** Jest (backend), Vitest/Jest (frontend).
*   **Testy Integracyjne (Integration Tests):**
    *   **Cel:** Weryfikacja współdziałania komponentów w ramach modułu lub między modułami.
    *   **Backend:**
        *   Moduły (np. `AuthModule` z `PrismaService`, `CvsModule` z `StorageService` i `PrismaService`).
        *   Integracje z bazą danych (Prisma + PostgreSQL).
        *   Integracje z S3 (upload, delete, download).
        *   Integracje z OpenRouter.ai (ekstrakcja tekstu, generacja listu).
        *   Integracje z Puppeteer (generacja PDF).
        *   Middleware (JwtAuthGuard, FileInterceptor) z kontrolerami.
    *   **Narzędzia:** Jest (backend), Supertest (dla testowania HTTP API), testy oparte na prawdziwych (lub testowych) instancjach S3/DB.
*   **Testy E2E (End-to-End Tests):**
    *   **Cel:** Symulowanie rzeczywistych scenariuszy użytkownika w pełnym stosie technologicznym.
    *   **Scenariusze:**
        *   Pełny flow: Rejestracja -> Logowanie -> Upload CV -> Generowanie listu -> Pobieranie PDF -> Wylogowanie.
        *   Testy limitów: Upload 5 CV, próba uploadu 6.
        *   Testy uprawnień: Użytkownik A próbuje operować na zasobach użytkownika B.
    *   **Narzędzia:** Jest (z `supertest` dla API), Cypress / Playwright (dla frontendu, jeśli zdecydujemy się na testy UI E2E). Obecnie jest tylko `app.e2e-spec.ts`.
*   **Testy API (Functional / Contract Tests):**
    *   **Cel:** Weryfikacja, czy endpointy API działają zgodnie ze specyfikacją (Swagger/OpenAPI).
    *   **Scenariusze:**
        *   Pozytywne: Poprawne dane, oczekiwane odpowiedzi (200, 201, 204).
        *   Negatywne: Niepoprawne dane, brak autoryzacji, przekroczenie limitów, duże pliki, niepoprawne typy plików, zbyt długie nazwy (oczekiwane 4xx).
        *   Schema validation: Zgodność odpowiedzi z DTO.
    *   **Narzędzia:** Postman/Thunder Client (manualne), Supertest (automatyczne), curl (manualne z dokumentacji).
*   **Testy Bezpieczeństwa (Security Tests):**
    *   **Cel:** Identyfikacja luk w zabezpieczeniach.
    *   **Scenariusze:**
        *   SQL Injection (za pomocą Przymy zmniejszone ryzyko, ale warto sprawdzić).
        *   Cross-Site Scripting (XSS) (przez pola tekstowe, np. `filename`).
        *   Broken Access Control (testy RLS i weryfikacji własności zasobów).
        *   Insecure Direct Object References (IDOR) (np. dostęp do `cv/:id` innego użytkownika).
        *   Sensitive Data Exposure (np. próba pobrania `passwordHash`).
        *   Denial of Service (DoS) (np. przez zbyt duże pliki, intensywne generowanie AI bez limitów).
    *   **Narzędzia:** Manualne testy, narzędzia do skanowania bezpieczeństwa (np. OWASP ZAP, Burp Suite), Cypress/Playwright do symulacji ataków.
*   **Testy Wydajnościowe (Performance Tests):**
    *   **Cel:** Pomiar czasu odpowiedzi i przepustowości pod obciążeniem.
    *   **Scenariusze:**
        *   Obciążenie endpointów `POST /cvs`, `POST /letters`, `GET /letters/:id/download`.
        *   Symulacja wielu równoczesnych użytkowników.
    *   **Narzędzia:** JMeter, k6, Artillery.
*   **Testy Dostępności (Accessibility Tests):**
    *   **Cel:** Zapewnienie, że aplikacja jest używalna dla osób z niepełnosprawnościami.
    *   **Scenariusze:** Podstawowe testy z użyciem narzędzi deweloperskich (Lighthouse) oraz manualne (tab-order, czytniki ekranu).
    *   **Narzędzia:** Lighthouse (wbudowany w Chrome DevTools), axe DevTools.
*   **Testy Kompatybilności (Compatibility Tests):**
    *   **Cel:** Sprawdzenie działania aplikacji w różnych przeglądarkach i na różnych urządzeniach.
    *   **Frontend:** Chrome, Firefox, Safari (desktop i mobile).
    *   **Backend:** Kompatybilność z Docker, DigitalOcean.

## 5. Scenariusze Testowe dla Kluczowych Funkcjonalności

Poniżej przedstawiono przykładowe scenariusze testowe dla wybranych, krytycznych funkcjonalności.

### 5.1. Rejestracja i Logowanie Użytkownika

| ID Testu | Opis Scenariusza                                     | Kroki Testowe                                                                               | Oczekiwany Rezultat                                                                                                                                                                                                                                                                              |
| :------- | :--------------------------------------------------- | :------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-001 | Rejestracja z poprawnymi danymi                      | 1. Przejdź na stronę rejestracji. 2. Wypełnij pola email, hasło, potwierdź hasło (zgodnie z `RegisterRequestDto`). 3. Kliknij "Zarejestruj się". | Użytkownik zostaje zarejestrowany. Przekierowanie na stronę logowania lub dashboard (zgodnie z finalną logiką). W DB nowy rekord `User`. W odpowiedzi nie ma tokenu, jest `user` object. Cookie `auth_token` ustawione. |
| AUTH-002 | Rejestracja z istniejącym emailem                    | 1. Zarejestruj użytkownika A. 2. Spróbuj zarejestrować użytkownika B z tym samym emailem co A. | Błąd 409 Conflict: "Email already exists".                                                                                                                                                                                                                                                       |
| AUTH-003 | Logowanie z poprawnymi danymi                        | 1. Zarejestruj użytkownika. 2. Wyloguj się/przejdź na stronę logowania. 3. Wprowadź poprawny email i hasło. 4. Kliknij "Zaloguj się". | Użytkownik zostaje zalogowany. Przekierowanie na dashboard. Cookie `auth_token` ustawione.                                                                                                                                                                                                        |
| AUTH-004 | Logowanie z niepoprawnym hasłem                      | 1. Zarejestruj użytkownika. 2. Spróbuj zalogować się z poprawnym emailem i niepoprawnym hasłem. | Błąd 401 Unauthorized: "Invalid credentials".                                                                                                                                                                                                                                                    |
| AUTH-005 | Logowanie z nieistniejącym emailem                   | 1. Spróbuj zalogować się z nieistniejącym emailem.                                          | Błąd 401 Unauthorized: "Invalid credentials".                                                                                                                                                                                                                                                    |
| AUTH-006 | Wylogowanie                                          | 1. Zaloguj się. 2. Kliknij "Wyloguj".                                                       | Użytkownik zostaje wylogowany. Przekierowanie na stronę logowania. Cookie `auth_token` usunięte.                                                                                                                                                                                                 |
| AUTH-007 | Dostęp do chronionej trasy bez autoryzacji           | 1. Spróbuj wejść na `/dashboard` lub `/profile` bez zalogowania.                            | Przekierowanie na `/login`.                                                                                                                                                                                                                                                      |
| AUTH-008 | Dostęp do publicznej trasy po autoryzacji            | 1. Zaloguj się. 2. Spróbuj wejść na `/login` lub `/register`.                               | Przekierowanie na `/`.                                                                                                                                                                                                                                                           |

### 5.2. Upload CV (`POST /cvs`)

| ID Testu | Opis Scenariusza                                     | Kroki Testowe                                                                               | Oczekiwany Rezultat                                                                                                                                       |
| :------- | :--------------------------------------------------- | :------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CV-UPL-001 | Upload poprawnego pliku PDF z domyślną nazwą         | 1. Zaloguj się. 2. Otwórz modal uploadu CV. 3. Wybierz poprawny plik PDF (np. `sample.pdf`, <10MB). 4. Kliknij "Prześlij CV". | Sukces (201 Created). Plik widoczny na liście CV. Plik w S3 (`user/{userId}/cvs/{uuid}.pdf`). Rekord w DB. |
| CV-UPL-002 | Upload poprawnego pliku PDF z własną nazwą          | 1. Zaloguj się. 2. Otwórz modal uploadu CV. 3. Wybierz poprawny plik PDF. 4. Wpisz "Moje_CV_2024" jako własną nazwę. 5. Kliknij "Prześlij CV". | Sukces. Plik widoczny na liście CV z nazwą "Moje_CV_2024.pdf". Plik w S3 z nową nazwą. Rekord w DB. |
| CV-UPL-003 | Upload pliku niebędącego PDF                         | 1. Zaloguj się. 2. Otwórz modal uploadu CV. 3. Wybierz plik `.jpg` lub `.docx`. 4. Kliknij "Prześlij CV". | Błąd 400 Bad Request: "File must be a PDF (application/pdf)". Plik nie został przesłany. |
| CV-UPL-004 | Upload pustego pliku PDF                             | 1. Zaloguj się. 2. Otwórz modal uploadu CV. 3. Wybierz pusty plik PDF. 4. Kliknij "Prześlij CV". | Błąd 400 Bad Request: "File is not a valid PDF (magic bytes check failed)" lub podobny. |
| CV-UPL-005 | Upload pliku PDF o rozmiarze > 10MB                   | 1. Zaloguj się. 2. Otwórz modal uploadu CV. 3. Wybierz plik PDF > 10MB. 4. Kliknij "Prześlij CV". | Błąd 400 Bad Request: "File size exceeds maximum limit of 10MB". |
| CV-UPL-006 | Przekroczenie limitu 5 CV                             | 1. Zaloguj się. 2. Prześlij 5 poprawnych plików PDF. 3. Spróbuj przesłać 6. plik PDF. | Błąd 403 Forbidden: "Maximum number of CVs reached (5)". |
| CV-UPL-007 | Filename path traversal (Backend)                    | 1. Zaloguj się. 2. Spróbuj przesłać CV z filename: `../../../../etc/passwd.pdf`. | Nazwa pliku powinna zostać zsanityzowana (np. `_etc_passwd.pdf`). Brak błędu 500. |
| CV-UPL-008 | Brak pliku w żądaniu (`multipart/form-data`)         | 1. Zaloguj się. 2. Wyślij POST `/cvs` bez pola `cv` w `multipart/form-data`. | Błąd 400 Bad Request: "No file provided". |
| CV-UPL-009 | Błąd zapisu do DB po udanym S3 (kompensacja)         | 1. (Manualnie) Zmodyfikuj kod, aby `prisma.cv.create` zawsze rzucało błąd. 2. Zaloguj się. 3. Prześlij plik PDF. | Błąd 500 Internal Server Error. Plik **nie** powinien być w S3 (powinien zostać usunięty przez mechanizm kompensacji). |
| CV-UPL-010 | Upload z niewłaściwym tokenem JWT                    | 1. Spróbuj uploadu z nieważnym/brakującym tokenem.                                          | Błąd 401 Unauthorized.                                                                    |

### 5.3. Generowanie Listu Motywacyjnego (`POST /letters`)

| ID Testu | Opis Scenariusza                                     | Kroki Testowe                                                                               | Oczekiwany Rezultat                                                                                                                                                                             |
| :------- | :--------------------------------------------------- | :------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LET-GEN-001 | Generacja z poprawnymi danymi                        | 1. Zaloguj się. 2. Upload CV. 3. Otwórz modal generowania listu. 4. Wybierz CV. 5. Wprowadź tytuł i opis stanowiska (min 1000 znaków). 6. Kliknij "Generuj list". | Sukces (201 Created). List widoczny na liście listów. Rekord w DB z HTML. `pdfS3Key` jest null. |
| LET-GEN-002 | Generacja bez wybranego CV                           | 1. Zaloguj się. 2. Otwórz modal generowania listu. 3. Pozostaw puste pole CV. 4. Wprowadź poprawne dane. 5. Kliknij "Generuj list". | Błąd walidacji po stronie klienta: "Wybierz CV". Po stronie serwera: 400 Bad Request. |
| LET-GEN-003 | Generacja z CV należącym do innego użytkownika       | 1. Zaloguj się jako Użytkownik A. 2. Zaloguj się jako Użytkownik B. 3. Spróbuj wygenerować list, podając `cvId` Użytkownika A. | Błąd 404 Not Found: "CV not found".                                                                                                                                                             |
| LET-GEN-004 | Generacja z opisem stanowiska < 1000 znaków          | 1. Zaloguj się. 2. Upload CV. 3. Otwórz modal. 4. Wybierz CV, tytuł. 5. Wprowadź opis < 1000 znaków. | Błąd walidacji: "job_description must be between 1000 and 10000 characters". |
| LET-GEN-005 | Generacja z opisem stanowiska > 10000 znaków         | 1. Zaloguj się. 2. Upload CV. 3. Otwórz modal. 4. Wybierz CV, tytuł. 5. Wprowadź opis > 10000 znaków. | Błąd walidacji: "job_description must be between 1000 and 10000 characters". |
| LET-GEN-006 | Przekroczenie limitu 5 listów na użytkownika         | 1. Zaloguj się. 2. Wygeneruj 5 listów. 3. Spróbuj wygenerować 6. list. | Błąd 403 Forbidden: "Maximum number of letters reached (5)". |
| LET-GEN-007 | Błąd ekstrakcji tekstu z CV (np. skan)              | 1. Zaloguj się. 2. Upload "zeskanowanego" pliku PDF (tylko obraz, bez tekstu). 3. Spróbuj wygenerować list. | Błąd 422 Unprocessable Entity: "Failed to extract sufficient text from CV..." |
| LET-GEN-008 | Błąd generacji listu przez AI (OpenRouter)         | 1. (Manualnie) Zmodyfikuj kod `AiProviderService`, aby `generateLetter` rzucało błąd. 2. Zaloguj się. 3. Spróbuj wygenerować list. | Błąd 422 Unprocessable Entity: "AI service returned an error..." |

### 5.4. Pobieranie listu jako PDF (`GET /letters/:id/download`)

| ID Testu | Opis Scenariusza                                     | Kroki Testowe                                                                               | Oczekiwany Rezultat                                                                                                    |
| :------- | :--------------------------------------------------- | :------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------- |
| LET-DL-001 | Pobranie istniejącego listu jako PDF (attachment)    | 1. Zaloguj się. 2. Wygeneruj list. 3. Kliknij "Pobierz" dla tego listu. (`inline=false`). | Plik PDF zostaje pobrany (`Content-Disposition: attachment`). Nagłówki `Content-Type: application/pdf`. |
| LET-DL-002 | Pobranie istniejącego listu jako PDF (inline)        | 1. Zaloguj się. 2. Wygeneruj list. 3. Wywołaj endpoint API z `?inline=true`. | Przeglądarka wyświetla PDF w nowej zakładce (`Content-Disposition: inline`). Nagłówki `Content-Type: application/pdf`. |
| LET-DL-003 | Pobranie listu nieistniejącego                       | 1. Zaloguj się. 2. Spróbuj pobrać PDF dla losowego, nieistniejącego ID.                     | Błąd 404 Not Found: "Letter not found".                                                                                |
| LET-DL-004 | Pobranie listu należącego do innego użytkownika      | 1. Zaloguj się jako Użytkownik A. 2. Wygeneruj list. 3. Zaloguj się jako Użytkownik B. 4. Spróbuj pobrać list Użytkownika A. | Błąd 404 Not Found: "Letter not found".                                                                                |
| LET-DL-005 | Ponowne pobranie PDF (weryfikacja cache S3)         | 1. Zaloguj się. 2. Wygeneruj list. 3. Pobierz go jako PDF. (Sprawdzamy, czy `pdfS3Key` został ustawiony w DB). 4. Pobierz ponownie. | Drugie pobranie powinno być szybsze (z S3, jeśli cachowanie zadziałało).                                              |
| LET-DL-006 | Błąd generacji PDF przez Puppeteer                   | 1. (Manualnie) Zmodyfikuj kod `LetterPdfService`, aby `generatePdfFromHtml` rzucało błąd. 2. Zaloguj się. 3. Spróbuj pobrać list. | Błąd 500 Internal Server Error: "Failed to generate PDF. Please try again."                                         |

## 6. Środowisko Testowe

*   **Lokalne środowisko deweloperskie:**
    *   Docker: `docker-compose` do uruchamiania PostgreSQL, MinIO (jako lokalne S3) dla backendu.
    *   Backend: Node.js, pnpm, uruchamiany w trybie deweloperskim.
    *   Frontend: Node.js, pnpm, Vite, uruchamiany w trybie deweloperskim.
    *   Narzędzia: VS Code, Postman/Thunder Client, przeglądarki Chrome/Firefox.
*   **Środowisko CI/CD (GitHub Actions):**
    *   Automatyczne uruchamianie testów jednostkowych i integracyjnych po każdym pushu.
    *   Wydzielona baza danych i mockowane usługi zewnętrzne.
*   **Środowisko Staging/Produkcyjne (DigitalOcean):**
    *   Instancja aplikacji wdrożona na DigitalOcean.
    *   Prawdziwa baza danych PostgreSQL.
    *   DigitalOcean Spaces (kompatybilne z S3) dla storage.
    *   Dostęp do OpenRouter.ai z prawdziwymi kluczami API.
    *   Testy akceptacyjne, wydajnościowe i penetracyjne.

## 7. Narzędzia do Testowania

*   **Zarządzanie testami:** JIRA/Confluence (lub inny system do zarządzania projektem).
*   **Testy jednostkowe / Integracyjne (Backend):** Jest, Supertest.
*   **Testy jednostkowe / Komponentowe (Frontend):** Vitest / Jest, React Testing Library.
*   **Testy E2E (UI):** Cypress / Playwright (opcjonalnie, do rozważenia w przyszłości).
*   **Testy API (manualne):** Postman, Thunder Client, `curl`.
*   **Analiza pokrycia kodu:** Jest (coverage reports).
*   **Analiza statyczna kodu:** ESLint, TypeScript compiler (`tsc --noEmit`).
*   **Testy wydajnościowe:** JMeter, k6 (do obciążania API).
*   **Testy bezpieczeństwa:** Manualne testy, OWASP ZAP (do skanowania aplikacji webowych).
*   **Testy dostępności:** Lighthouse (Chrome DevTools), axe DevTools.
*   **Zarządzanie zależnościami:** pnpm.

## 8. Harmonogram Testów

Harmonogram zostanie zintegrowany z cyklem rozwoju projektu (Agile/Scrum).

*   **Faza 1: Rozwój i testy jednostkowe/integracyjne (ciągłe):**
    *   Programiści piszą testy jednostkowe i integracyjne równolegle z kodem.
    *   Uruchamianie testów automatycznych na CI/CD po każdym commitcie/pull request.
*   **Faza 2: Testy funkcjonalne i API (po zakończeniu feature'a):**
    *   QA przeprowadza testy funkcjonalne, regresyjne i API dla każdej nowej funkcji.
    *   Testy manualne i automatyczne.
*   **Faza 3: Testy bezpieczeństwa i wydajności (przed wdrożeniem na Staging/Produkcję):**
    *   Przeprowadzenie testów penetracyjnych i wydajnościowych.
    *   Automatyczne skany bezpieczeństwa.
*   **Faza 4: Testy akceptacyjne użytkownika (UAT) (na Stagingu):**
    *   Docelowi użytkownicy testują aplikację w realistycznym środowisku.
*   **Faza 5: Testy poudrożeniowe (Post-deployment testing) (na Produkcji):**
    *   Szybkie testy funkcjonalne po każdym wdrożeniu na środowisko produkcyjne, aby zweryfikować podstawowe działanie.

## 9. Kryteria Akceptacji Testów

*   **Pokrycie kodu:**
    *   Testy jednostkowe: >80% pokrycia dla kodu backendu i logiki biznesowej.
    *   Testy integracyjne: Pokrycie wszystkich krytycznych ścieżek integracji.
*   **Defekty:**
    *   Brak defektów krytycznych (Bloker, Krytyczny) w środowisku Staging przed wdrożeniem na produkcję.
    *   Akceptowalna liczba defektów wysokiego i średniego priorytetu, z jasnym planem naprawy.
*   **Wydajność:**
    *   Czas odpowiedzi dla krytycznych endpointów API < 500ms (dla 95% żądań) pod oczekiwanym obciążeniem.
    *   Czas generacji listu < 30 sekund.
    *   Czas uploadu CV < 5 sekund.
*   **Bezpieczeństwo:**
    *   Brak zidentyfikowanych luk bezpieczeństwa wysokiego/krytycznego ryzyka.
*   **Funkcjonalność:**
    *   Wszystkie funkcje działają zgodnie ze specyfikacją.
    *   Wszystkie scenariusze testowe (pozytywne i negatywne) przechodzą pomyślnie.
*   **Użyteczność:**
    *   Interfejs jest responsywny i intuicyjny, brak znaczących błędów wizualnych.

## 10. Role i Odpowiedzialności w Procesie Testowania

*   **Lider QA/Inżynier QA:**
    *   Opracowanie i utrzymanie planu testów.
    *   Zarządzanie procesem testowania.
    *   Tworzenie scenariuszy testowych i przypadków testowych.
    *   Raportowanie i śledzenie defektów.
    *   Nadzorowanie automatyzacji testów.
    *   Przeprowadzanie testów funkcjonalnych, integracyjnych, bezpieczeństwa.
*   **Programiści (Backend/Frontend):**
    *   Pisanie i utrzymywanie testów jednostkowych i integracyjnych.
    *   Naprawianie zgłoszonych defektów.
    *   Współpraca z QA w celu rozwiązywania problemów.
*   **Product Owner/Biznes:**
    *   Definiowanie wymagań i kryteriów akceptacji.
    *   Przeprowadzanie testów akceptacyjnych użytkownika (UAT).
*   **DevOps Engineer:**
    *   Konfiguracja i utrzymanie środowisk testowych.
    *   Konfiguracja i monitorowanie CI/CD.

## 11. Procedury Raportowania Błędów

*   **System śledzenia błędów:** JIRA (lub podobne).
*   **Proces zgłaszania:**
    1.  Testujący identyfikuje defekt.
    2.  Defekt jest zgłaszany w systemie śledzenia błędów, zawierając:
        *   Tytuł (zwięzły opis problemu).
        *   Szczegółowy opis (co się stało, a co powinno się stać).
        *   Kroki do reprodukcji.
        *   Oczekiwany rezultat.
        *   Faktyczny rezultat.
        *   Środowisko (np. przeglądarka, wersja aplikacji).
        *   Dowody (screeny, logi, nagrania wideo).
        *   Priorytet (Bloker, Krytyczny, Wysoki, Średni, Niski).
        *   Severity (Bloker, Krytyczny, Major, Minor, Cosmetic).
        *   Przypisanie do odpowiedzialnego dewelopera.
*   **Cykl życia defektu:** New -> Open -> In Progress -> To Be Tested -> Retest -> Closed / Reopen.
*   **Raportowanie statusu:** Regularne raporty statusu testów i defektów dla zespołu projektowego i interesariuszy.