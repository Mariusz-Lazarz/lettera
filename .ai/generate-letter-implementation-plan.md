# API Endpoint Implementation Plan: Create letter (generate) - `POST /letters`

## 1. Przegląd punktu końcowego
- Cel: Uruchomić pipeline generowania listu motywacyjnego w formacie HTML na podstawie wybranego CV i opisu stanowiska. Punkt końcowy ma zwracać wynik w trybie synchronicznym (201 + gotowy HTML) i egzekwować limit na użytkownika (maks. 5 listów).
- Lokalizacja: `apps/backend/src/letters/` (nowy moduł `LettersModule` jeśli brak) z `LettersController`, `LettersService` i ewentualnie `AiProviderService`.

## 2. Szczegóły żądania
- Metoda HTTP: `POST`
- Struktura URL: `/letters`
- Nagłówki:
  - **Authorization**: `Bearer <jwt>` (używać istniejącego mechanizmu auth)
  - Content-Type: `application/json`
- Parametry:
  - Wymagane:
    - `cv_id` (uuid) — identyfikator CV użytkownika
    - `job_title` (string) — tytuł stanowiska
    - `job_description` (string) — treść ogłoszenia, długość: **1000–10000** znaków
  - Opcjonalne: brak w specyfikacji
- Request Body (JSON):

```json
{
  "cv_id": "uuid",
  "job_title": "Senior Backend Engineer",
  "job_description": "<text 1000-10000 chars>"
}
```

## 3. Wykorzystywane typy (DTOs i Command Modele)
- Istniejące/generated DTOs (z `apps/backend/src/generated-dtos.ts`):
  - `CreateLetterDto` (istnieje) — używać jako model zapisu w DB
  - `LetterResponseDto` — użyć jako zwracany format
- Nowe DTO/typy do zaimplementowania:
  - `GenerateLetterRequestDto` (class-validator):
    - `@IsUUID()` `cv_id`
    - `@IsString() @Length(1,200)` `job_title` (limit przykładowy)
    - `@IsString() @Length(1000,10000)` `job_description`
  - `GenerateLetterCommand` (POJO/immutable): { userId, cvId, jobTitle, jobDescription }
  - `GenerateLetterResult` (typ zwracany przez service): { id, userId, html, status, createdAt, pdfS3Key? }

## 3. Szczegóły odpowiedzi
- Sukces (synchronous completed):
  - Status: `201 Created`
  - Body:

```json
{ "id":"uuid","user_id":"uuid","html":"<string>","status":"completed","created_at":"iso8601" }
```

- Kody błędów (przykłady):
  - `400 Bad Request` — brak/nieprawidłowe pola (np. za krótki/za długi `job_description`) lub CV brak/extraction failed
  - `401 Unauthorized` — brak/nieprawidłowy token
  - `403 Forbidden` — użytkownik osiągnął limit 5 listów
  - `404 Not Found` — CV nie istnieje (opcjonalnie zamiast 400)
  - `422 Unprocessable Entity` — błąd AI provider (niepoprawna/wadliwa odpowiedź)
  - `500 Internal Server Error` — niespodziewane błędy serwera

## 4. Przepływ danych (end-to-end)
1. Controller (`LettersController.POST /letters`)
   - Autoryzacja (JWT Guard) → pobierz `userId` z tokena.
   - Walidacja `GenerateLetterRequestDto` przez `ValidationPipe`.
   - Zbuduj `GenerateLetterCommand` i przekaż do `LettersService.generateLetter(command)`.

2. Service (`LettersService.generateLetter(command)`) — orchestrator:
   - a) Per-user limit: policz existing letters: `SELECT COUNT(*) FROM letters WHERE user_id = :userId`.
       - Jeżeli >= 5 → rzuć `ForbiddenException` (403).
   - b) Pobierz CV: `cvs` row by `cv_id`.
       - Jeżeli brak => `NotFoundException` (404).
       - Sprawdź pole z ekstraktem tekstu (np. `extracted_text` lub odpow. kolumna). Jeśli brak/failed -> `BadRequestException` (400) i zapisz log błędu.
   - c) Przygotuj prompt i dane wejściowe dla AI (poziom sanitacji: usuń kontrolne sekwencje, limit tokenów).
   - d) Wywołanie AI: `AiProviderService.generateLetter({cvText, jobTitle, jobDescription})`.
       - Timeout i retry: ustawić rozsądny timeout (np. 20–30s) i ograniczone retry (1-2 razy) na błędy transient.
       - AI error -> mapuj na `UnprocessableEntityException` (422) i zapisz do `api_error_logs`.
   - e) Persist: utwórz wpis w `letters` przez Prisma/`PrismaService` (w transakcji jeśli wymagane):
       - `html` (db char limit <= 200000 — sprawdzić rozmiar), `user_id`, generated id.
   - f) (Opcjonalnie) Generate PDF: jeśli wymagane, uruchom generator PDF asynchronicznie i zapisz `pdf_s3_key`.
   - g) Zwróć `GenerateLetterResult` z `status: 'completed'` i danymi.

3. Controller: zwraca `201 Created` + `LetterResponseDto`.

## 5. Względy bezpieczeństwa
- Uwierzytelnianie: użyj istniejącego JWT Guard; pobieraj `userId` z tokena; nigdy nie polegaj na `user_id` z body.
- Autoryzacja: sprawdź właściciela CV przed użyciem.
- Input validation: użyj `class-validator` i `ValidationPipe`.
- Limit długości pól i sanitacja `job_description` (usuniecie kontrolnych, HTML, skrypto-iniekcji).
- Rate limiting i quota: enforce limit 5 listów na użytkownika. Rozważyć logikę leżącą także w cache (Redis) dla natychmiastowej kontroli przy dużym ruchu.
- Bezpieczne logowanie: nie logować pełnych promptów zawierających PII ani kluczy API. Zapisywać tylko hashowane/ograniczone meta.
- Secrets: klucze AI w env (`process.env.AI_API_KEY`) i konfiguracja w `apps/backend/.env`.
- XSS: HTML wygenerowane przez AI może zawierać niebezpieczne elementy — przed zwróceniem i przechowaniem rozważyć sanitizację (np. `sanitize-html`) lub bezpieczne renderowanie po stronie klienta (Content-Security-Policy).

## 6. Obsługa błędów
- Mapowanie wyjątków i logika zapisu:
  - `BadRequestException` (400): validation error, missing/short job_description, CV extraction missing.
  - `UnauthorizedException` (401): brak tokenu lub nieważny.
  - `ForbiddenException` (403): limit osiągnięty.
  - `NotFoundException` (404): CV nie znaleziono.
  - `UnprocessableEntityException` (422): AI provider zwrócił błąd lub niepoprawny output.
  - `InternalServerErrorException` (500): db error / nieoczekiwane.
- Rejestracja błędów:
  - Dodaj tabelę `api_error_logs` (jeśli brak) z kolumnami: `id`, `user_id`, `cv_id`, `endpoint`, `error_type`, `error_message`, `meta JSON`, `created_at`.
  - Na błędach AI/extraction/db wstawiaj wpisy z kontekstem (user_id, cv_id, letter_id jeśli jest) i ograniczonym fragmentem promptu/answer (do debugu).
  - Alternatywnie wysyłaj zdarzenia do Sentry + lokalnego `api_error_logs`.

## 7. Wydajność
- Potencjalne wąskie gardła:
  - Wywołania AI (latency) — długi czas odpowiedzi -> można przenieść do background jobów (202 Accepted) gdy odpowiedzi są dłuższe niż progu synchr.
  - Limit 5 list na user jest szybkim checkiem DB; jeśli wysoki ruch, przenieść liczenie do cache (Redis) z atomicznym incr.
  - Parsowanie/extraction CV (jeśli kosztowne) — powinno być robione wcześniej przy uploadzie CV, a nie w czasie generowania listu.
- Optymalizacje:
  - Cache per-user count in Redis with TTL to avoid COUNT(*) at DB przy dużym ruchu.
  - Ustal timeout dla AI i fallback path (zwrot 422 lub 202 + jobId jeśli asynchroniczne).
  - Używaj batch/stream jeśli trzeba generować PDF asynchronicznie.

## 8. Kroki implementacji (szczegółowe)
1. Przygotowanie środowiska i zależności
   - Upewnij się, że `PrismaService` i `Prisma client` są dostępne.
   - Dodaj/zweryfikuj moduł `LettersModule` w `apps/backend/src/letters`.
   - Zainstaluj potrzebne biblioteki: `class-validator`, `class-transformer`, `sanitize-html` (opcjonalnie), klient AI (np. `openrouter` sdk) jeśli jeszcze nie ma.

2. Typy i DTO
   - Utwórz `GenerateLetterRequestDto` w `apps/backend/src/letters/dto/generate-letter-request.dto.ts` z dekoratorami `class-validator`.
   - Utwórz `GenerateLetterCommand` i `GenerateLetterResult` w `apps/backend/src/letters/dto` lub `models`.

3. AI Provider client
   - Wydziel `AiProviderService` (lub repo) w `apps/backend/src/integrations/ai/ai-provider.service.ts` z metodą `generateLetter(promptInput): Promise<string>`.
   - Abstrakcja pozwoli mockować w testach i zmieniać provider.

4. Service
   - Zaimplementuj `LettersService.generateLetter(command: GenerateLetterCommand): Promise<GenerateLetterResult>`:
     - Check per-user limit (DB or Redis)
     - Fetch CV (verify ownership)
     - Validate CV extraction exists
     - Build prompt (limit tokens)
     - Call `AiProviderService` with timeout/retry
     - Save letter via Prisma: `prisma.letter.create({ data: { userId, html, ... }})`
     - Return result
   - Dodać transakcję tam, gdzie potrzebna (np. persistent + pdf generation atomicity)

5. Controller
   - `LettersController` z handlerem `@Post()` używając `AuthGuard`:
     - @UsePipes(new ValidationPipe({ whitelist: true }))
     - Parse body to `GenerateLetterRequestDto`
     - Build `GenerateLetterCommand` z `userId` z tokena
     - Call `lettersService.generateLetter()`
     - Return `201` z `LetterResponseDto`

6. Baza danych / migracje
   - `letters` tabela już istnieje (zgodnie ze spec): sprawdzić constraint `letters_html_max_length`.
   - Opcjonalnie: dodać `api_error_logs` migration jeśli zdecydujemy się na logi w DB.

7. Testy
   - Unit tests: `AiProviderService` (mock), `LettersService` (scenariusze: success, limit reached, cv not found, extraction missing, ai error)
   - Integration tests: e2e test endpointu `POST /letters` z realnym auth token (mock user) i DB testową.

8. Dokumentacja i Swagger
   - Dodaj `@ApiOperation`, `@ApiResponse` w kontrolerze i zarejestruj `GenerateLetterRequestDto` oraz `LetterResponseDto`.

9. Monitoring i alerting
   - Loguj AI timeouts/errors to `api_error_logs` + Sentry
   - Metryki: liczba wygenerowanych list / błędy AI / latencja AI

10. Rollout
   - Canary deploy: uruchomić wstępnie jako feature-flag -> monitorować błędy i latencję
   - Po stabilizacji usunąć flagę

## 9. Przykładowe fragmenty kodu (schematyczne)
- `GenerateLetterRequestDto` (schemat):

```ts
export class GenerateLetterRequestDto {
  @IsUUID()
  cv_id: string;

  @IsString()
  @Length(1, 200)
  job_title: string;

  @IsString()
  @Length(1000, 10000)
  job_description: string;
}
```

- `LettersController.POST` (schemat):
  - Pobierz `userId` z `req.user` (guard), waliduj, wywołaj service, zwróć 201.

## 10. Mapowanie błędów do kodów statusu (skrót)
- Validation errors -> 400
- CV not found -> 404
- CV extraction missing -> 400
- User over limit -> 403
- AI provider errors -> 422
- Unexpected server/DB errors -> 500


---

> Uwagi końcowe:
> - Specyfikacja wymaga synchronicznej odpowiedzi. Jeśli AI latency spowoduje >~20s odpowiedzi w realnym ruchu, warto rozważyć asynchroniczny wariant (202 Accepted + background job) z webhookiem/endpointem do pobierania statusu.
> - Przed produkcyjnym zapisaniem HTML rozważyć sanitizację/escape i politykę CSP po stronie klienta.
