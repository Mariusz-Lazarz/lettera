# API Endpoint Implementation Plan: Download Letter as PDF (/letters/:id/download)

## 1. Przegląd punktu końcowego
Punkt końcowy służy do wygenerowania PDF z zapisanego HTML listu (`letters.html`) i zwrócenia go jako pliku do pobrania (`Content-Type: application/pdf`, `Content-Disposition: attachment; filename="letter-<id>.pdf"`). Generacja PDF powinna być deterministyczna, bezpieczna (tylko właściciel listu może pobrać), oraz powinna zapisywać wynik do storage (S3/DigitalOcean Spaces) opcjonalnie do cache.

## 2. Szczegóły żądania
- Metoda HTTP: GET
- Struktura URL: `/letters/:id/download`
- Parametry:
  - Wymagane:
    - `id` (path param): UUID identyfikujący list
  - Opcjonalne:
    - `inline` (query boolean) — jeśli `true`, wysyłamy `Content-Disposition: inline` zamiast `attachment` (opcjonalne; domyślnie attachment)
- Request Body: Brak (GET)
- Nagłówki wymagane:
  - `Authorization: Bearer <token>` — JWT lub inny mechanizm auth używany przez system

## 3. Wykorzystywane typy
- DTO istniejące (z `apps/backend/src/generated-dtos.ts`):
  - `LetterResponseDto` — reprezentacja listu z bazy (używana do walidacji i mapowania)
- Proponowane Command/Service models (wewnętrzne):
  - `DownloadLetterCommand` {
      letterId: string;
      userId: string;
      inline?: boolean;
    }
  - `PdfGenerationResult` {
      buffer?: Buffer; // jeśli bezpośrednio generujemy
      s3Key?: string; // jeśli uploadujemy
      sizeBytes: number;
    }

## 4. Szczegóły odpowiedzi
- Sukces (200): Zwraca binarny strumień PDF z nagłówkami:
  - `Content-Type: application/pdf`
  - `Content-Length: <bytes>` (jeśli znana)
  - `Content-Disposition: attachment; filename="letter-<id>.pdf"` (lub `inline` gdy query inline=true)
- Błędy:
  - 401 — brak/nieprawidłowe uwierzytelnienie
  - 403 — użytkownik nie jest właścicielem listu
  - 404 — list nie znaleziony
  - 500 — błąd wewnętrzny (np. generacja PDF nie powiodła się)

## 5. Przepływ danych (high level)
1. Kontroler odbiera GET `/letters/:id/download` i wyciąga `id` oraz `inline`.
2. Middleware/auth guard dekoduje `Authorization` i dostarcza `userId` do request (NestJS Guard/Decorator).
3. Walidacja: sprawdź, że `id` jest poprawnym UUID — natychmiast 400 jeśli nie.
4. Serwis `LettersService` (albo `LetterPdfService`) wykonuje komendę `DownloadLetterCommand`:
   - Pobiera list z bazy przez Prisma: `prisma.letter.findUnique({ where: { id } })`.
   - Jeśli brak → 404.
   - Porównuje `letter.userId` z `request.userId` → jeśli różne → 403.
   - Jeśli `letter.pdf_s3_key` istnieje i pasuje polityce TTL/cache → rozważyć pobranie gotowego pliku z S3 i od razu stream do klienta.
   - W przeciwnym razie: wygenerować PDF z `letter.html`.
     - Użyć zaufanej biblioteki headless (np. `playwright` lub `puppeteer`) uruchomionej w trybie bezpiecznym; alternatywnie dedykowany serwis renderujący (worker).
     - Ustawić bezpieczne sandboxowanie: nie pozwalać na zewnętrzne requesty z wewnętrznego HTML (blokowanie sieci), limit pamięci i czasu.
   - Jeśli generacja powiodła się: opcjonalnie zapisać PDF do S3 (`pdf_s3_key`) i zaktualizować rekord `letters` (atomiczna aktualizacja `pdf_s3_key` i `updated_at`).
   - Zwrócić `PdfGenerationResult` z buforem lub s3Key.
5. Kontroler zwraca stream PDF do klienta z odpowiednimi nagłówkami i statusem 200.

## 6. Względy bezpieczeństwa
- Uwierzytelnianie: endpoint zabezpieczony JWT Guard / sesja NestJS.
- Autoryzacja: właściciel listu tylko (porównanie `letter.userId === request.userId`).
- Walidacja path param: `id` musi być UUID — wprowadzić walidator (class-validator lub ręczna sprawdzarka w guardzie/routerze).
- Sanitacja HTML: HTML używany do generacji powinien być już zapisany w DB — jeśli HTML może zawierać zewnętrzne tagi/skrypty, przed renderem należy oczyścić niebezpieczne skrypty i zabronić zewnętrznych zasobów (ustawić Content-Security-Policy w head podczas renderu lub użyć opcji w Puppeteer aby wyłączyć sieć).
- Izolacja renderera: uruchamiać Puppeteer/Playwright w trybie bezpiecznym (no-sandbox możliwe, ale wymaga kontroli; rozważyć dedykowany service w kontenerze z ograniczeniami zasobów).
- Limit rozmiaru: chronić endpoint przed tworzeniem ogromnych PDF (np. limit długości HTML z DB ma check 200k chars — już jest). Dodać dodatkowe ograniczenia czasu i pamięci procesu generacji.
- S3 signed URLs: jeśli zwracamy link do S3 zamiast streamu, używać krótkoterminowych signed URLs.

## 7. Obsługa błędów
- 400 Bad Request
  - Niepoprawny UUID (walidacja path param)
- 401 Unauthorized
  - Brak tokena lub token nieprawidłowy
- 403 Forbidden
  - Użytkownik nie jest właścicielem listu
- 404 Not Found
  - List o podanym `id` nie istnieje
- 500 Internal Server Error
  - Błąd generacji PDF (np. Puppeteer crash)
  - Błąd uploadu do S3
  - Nieoczekiwany wyjątek

Dodatkowe działania przy błędach serwera:
- Logować szczegóły błędu (bez wrażliwych danych) do centralnego loggera (w pliku/kolejce/observability): timestamp, userId, letterId, errorType, stackTrace (truncated).
- Opcjonalnie: zapisywać krytyczne błędy generacji PDF w tabeli `error_logs` z polymorficznym schematem { id, user_id, resource_type, resource_id, event, message, metadata, created_at } — jeśli projekt wymaga audytu.

## 8. Wydajność i skalowalność
- Generacja PDF jest kosztowna: zalecane uruchamianie w dedykowanym workerze lub service (async job) jeśli operacje często przekraczają limity czasu HTTP.
- Opcje skalowania:
  - Synchronous (sync): krótkie requesty — generuj w procesie, streamuj wynik (proste, ale ryzykowne przy długich renderach).
  - Async + polling/webhook: przy generacji dłuższej niż X ms (np. 5s) utwórz job i zwróć 202 z lokacją statusu; po wygenerowaniu klient pobiera lub dostaje signed URL.
  - Cache: po generacji zapisz do S3 `pdf_s3_key` i używaj go dopóki wersja HTML się nie zmieni (porównać `updated_at`).
- Ograniczenia zasobów: ustawić timeout 30s–60s dla renderu, limit pamięci i liczby jednoczesnych rendererów.

## 9. Kroki implementacji (szczegółowo)
1. API surface
   1.1. Dodać route w `LettersController` (NestJS):
        `@Get(':id/download') downloadLetter(@Param('id') id: string, @Query('inline') inline?: string, @Req() req)`
   1.2. Dodać guard/auth decorator (np. `@UseGuards(AuthGuard)` i `@CurrentUser()` dla userId).
2. Walidacja
   2.1. Dodać walidator dla `id` (UUID). Jeśli używamy DTO dla paramów, utworzyć `DownloadLetterParamsDto` z `@IsUUID()`.
3. Serwis/Logika biznesowa
   3.1. Jeśli istnieje `LettersService`, dodać metodę `getLetterByIdForUser(letterId: string, userId: string)` (zwraca letter lub throws 404/403).
   3.2. Utworzyć `LetterPdfService` (jeśli nie istnieje):
        - `generatePdfFromHtml(html: string): Promise<Buffer>` — używa Puppeteer/Playwright z konfiguracją sandbox.
        - `uploadPdfToS3(buffer: Buffer, key: string): Promise<string>` — upload i zwraca s3Key.
        - `getPdfStreamFromS3(key: string): Promise<Readable>` — pobieranie strumienia gdy cached.
        - `downloadLetter(command: DownloadLetterCommand): Promise<PdfGenerationResult>` — orchestrator.
   3.3. Zaimplementować retry/backoff i timeouts w generacji/upload.
4. Integracja z S3
   4.1. Dodać konfigurację S3 (endpoint, bucket, credentials) w `apps/backend/.env` i `ConfigModule`.
   4.2. Użyć `@aws-sdk/client-s3` lub `minio` client do uploadu i pobierania.
5. Kontroler: streaming odpowiedzi
   5.1. Jeśli mamy Buffer: ustawić odpowiednie nagłówki i `res.send(buffer)` lub `res.end()` (w NestJS użyć `@Res()` z manualnym streamem).
   5.2. Jeśli mamy S3: strumieniować odpowiedź pobieraną z S3 do `res` (pipe), ustawić Content-Length gdy dostępny.
6. Testy
   6.1. Unit tests dla `LetterPdfService` (mock Puppeteer, mock S3).
   6.2. Integration tests dla `LettersController` z auth mock, testy scenariuszy 200/401/403/404/500.
7. Observability
   7.1. Dodać logi info/debug: request start/end, duration (ms), sizeBytes.
   7.2. Dodać metryki: liczba udanych generacji, błędów, średni czas generacji.
8. Dokumentacja & Swagger
   8.1. Dodać opis endpointu w Swagger (`@ApiOperation`, `@ApiResponse`) używając `LetterResponseDto` jako referencji, ale zwrócić uwagę że odpowiedź binarna.
9. Deployment
   9.1. Jeśli używamy Puppeteer: zaktualizować Dockerfile backenda o zależności (libnss, fonts, itp.) lub uruchomić renderer w osobnym obrazie.
   9.2. Zaktualizować stack infra: worker autoscaling, S3 bucket policy, secrets manager dla S3 creds.

## 10. Przykładowe edge-case'y i decyzje projektowe
- Gdy HTML jest większy niż limit → zwrócić 400 z komunikatem "Letter HTML too large to render".
- Jeśli generacja zajmuje > threshold → rozważyć async job zamiast blokowania requestu.
- Jeśli upload do S3 nie powiedzie się po X retry → zwrócić 500, logować szczegóły i nie nadpisywać `pdf_s3_key`.
- Jeśli `pdf_s3_key` istnieje, ale pobranie z S3 zwraca 404 → ponownie wygenerować PDF i przepisać `pdf_s3_key`.

---

### Wymagane pliki/zmiany kodu (sugestia implementacyjna)
- `apps/backend/src/letters/letters.controller.ts` — dodać handler `download`.
- `apps/backend/src/letters/letters.service.ts` — dodać `getLetterByIdForUser` (jeśli brak).
- `apps/backend/src/letters/letter-pdf.service.ts` — nowy service do generacji/upload/streamingu.
- `apps/backend/src/letters/dto/download-letter-params.dto.ts` — DTO dla parametru `id` z `@IsUUID()`.
- Testy jednostkowe i integracyjne w `apps/backend/test/`.
- Konfiguracja S3 w `apps/backend/.env` oraz `ConfigModule`.
- (Opcjonalnie) migracja DB do dodania tabeli `error_logs` jeśli wymagany audyt błędów.


---

Powyższy plan zapewnia kompletny, bezpieczny i skalowalny sposób wdrożenia endpointu GET `/letters/:id/download` zgodny z używanym stackiem (NestJS, Prisma, S3, Puppeteer/Playwright).
