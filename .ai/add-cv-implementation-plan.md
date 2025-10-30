<!--
  Implementation plan for Upload CV endpoint
  Save location: .ai/add-cv-implementation-plan.md
-->
# API Endpoint Implementation Plan: Upload CV (POST /cvs)

## 1. Przegląd punktu końcowego
- Cel: Przyjąć pojedynczy plik CV (PDF) w `multipart/form-data` pod polem `cv`, opcjonalnie przyjąć `filename`; zweryfikować plik, wymusić limit maksymalnie 5 CV na użytkownika, przesłać plik do S3, a następnie utworzyć rekord w tabeli `cvs` w jednej obsłudze żądania. W przypadku niepowodzenia zachować spójność (usunąć plik z S3 jeżeli DB insert nie powiódł się) i zwrócić odpowiedni kod błędu.

## 2. Szczegóły żądania
- Metoda HTTP: POST
- Struktura URL: `/cvs`
- Parametry:
  - Wymagane:
    - multipart/form-data file field `cv` (Content-Type: `application/pdf`)
  - Opcjonalne:
    - `filename` (string) — użyte jako nazwa widoczna użytkownikowi; maks. długość 255 znaków
- Request Body (multipart/form-data):
  - `cv`: binary PDF
  - `filename`: string (opcjonalne)

## 3. Wykorzystywane typy (DTOs i Command Modele)
- `UploadCvRequestDto` (request)
  - `cv`: Express.Multer.File (handled by multer or Nest's FileInterceptor)
  - `filename?`: string (max length 255)

- `CvRecordDto` (response)
  - `id`: string (uuid)
  - `user_id`: string (uuid)
  - `filename`: string
  - `s3_key`: string
  - `created_at`: string (ISO8601)

- Internal command / service input: `UploadCvCommand { userId: string; file: Buffer | ReadStream; originalFilename?: string; contentType: string; size: number }`

## 4. Szczegóły odpowiedzi
- Sukces 201 Created
```json
{ "id": "uuid", "user_id": "uuid", "filename": "cv.pdf", "s3_key": "user/<userId>/cvs/<uuid>.pdf", "created_at": "2025-10-30T12:34:56Z" }
```
- Błędy:
  - 400 Bad Request — brak pliku, nie-PDF, `filename` za długie, walidacja multipart
  - 401 Unauthorized — brak/nieprawidłowy token
  - 403 Forbidden — użytkownik osiągnął limit CV (5)
  - 422 Unprocessable Entity — upload/S3 validation failed (np. plik uszkodzony, antywirus/OCR odrzucił)
  - 500 Internal Server Error — niespodziewany błąd serwera

## 5. Przepływ danych
1. Autoryzacja: endpoint zabezpieczony (AuthGuard/JWT). Wyciągnij `userId` z tokenu.
2. Multer/FileInterceptor odbiera plik; kontroler wykonuje wstępną walidację rozmiaru i content-type.
3. Serwis `CvsService.uploadCv(uploadCmd)` — cała logika biznesowa:
   - Sanity checks: obecność pliku; rozmiar < (limit, np. 10MB) — odrzucić 400.
   - Sprawdź `filename` długość <= 255; jeśli brak -> wygeneruj bezpieczną nazwę z oryginalnego pliku.
   - Przeprowadź magic-bytes check (PDF header `%PDF-`) i potwierdź `application/pdf` -> jeśli niezgodne -> 400.
   - Odczytaj liczbę istniejących CV użytkownika w transakcji (Prisma transaction):
       - `const count = await prisma.cvs.count({ where: { user_id: userId } })`
       - Jeśli `count >= 5` -> throw ForbiddenException (403).
   - Przygotuj `s3Key` = `user/${userId}/cvs/${uuid()}.pdf`.
   - Upload do S3 (putObject) z Content-Type `application/pdf` i odpowiednimi ACL/metadata.
   - Po zakończonym uploadzie uruchom synchronous validation pipeline:
       - (Opcjonalne) scan antywirusowe (ClamAV / 3rd party) — synchroniczne lub synchronously awaited worker.
       - (Opcjonalne) OCR/extraction sanity (sprawdzić czy plik zawiera tekst lub podstawowe metadane) — jeśli wymagane.
       - Jeśli walidacja pliku po uploadzie nie przejdzie -> usuń obiekt z S3 (best-effort) i zwróć 422.
   - W granicach transakcji (Prisma transaction): utwórz rekord w `cvs`:
       - `prisma.cvs.create({ data: { user_id: userId, s3_key: s3Key, filename: sanitizedFilename } })`
       - Jeśli DB insert rzuci błędem -> spróbuj usunąć S3 object (cleanup) i zwróć 500.
   - Zwróć utworzony rekord (id, user_id, filename, s3_key, created_at).

Dodatkowe uwagi o atomowości:
- Nie ma idealnej globalnej transakcji obejmującej S3; stosujemy sekwencję: upload -> validation -> DB insert -> jeśli DB insert się nie powiedzie, wykonaj kompensację (usuniecie z S3). W logach zapisujemy niepowodzenie kompensacji do dalszej inspekcji.

## 6. Względy bezpieczeństwa
- Autoryzacja: wymagany JWT + AuthGuard; `userId` dopasowywany do właściciela zasobu.
- Walidacja wejścia: użyć DTO + `class-validator` dla `filename` (max length) i dodatkowych guardów w kontrolerze dla pliku.
- Plik: weryfikacja magic bytes (PDF header) oraz content-type; ograniczenie rozmiaru; odrzucenie plików wykonywalnych.
- S3: zapisywać pliki na prywatnym bucketcie; generować signed URLs do pobierania; nie używać public ACL.
- Sanity checks/antivirus: uruchomić AV scan i (opcjonalnie) OCR check przed zaakceptowaniem — jeśli AV wykryje zagrożenie zwrócić 422.
- Path traversal / filename sanitization: nigdy nie używać surowych nazw plików jako kluczy S3 bez sanityzacji; generować własne klucze zawierające UUID.
- Rate limiting: rozważ rate limit na uploady (gateway/express-rate-limit)
- Logowanie: nie logować treści pliku ani pełnych nagłówków auth; logować zdarzenia z metadanymi (userId, event, ip, user_agent, s3_key, size).

## 7. Obsługa błędów
- Mapowanie na statusy:
  - 400 Bad Request — brak pliku, file type mismatch (not PDF), filename too long, multipart malformed
  - 401 Unauthorized — brak/niepoprawny token
  - 403 Forbidden — max CVs reached (5)
  - 422 Unprocessable Entity — upload ok ale plik odrzucony po walidacji (virus, OCR fail, content mismatch)
  - 500 Internal Server Error — problem z DB, S3 (nieudane usuwanie po nieudanej transakcji), nieoczekiwane błędy

- Logowanie błędów/system events:
  - W systemie zalecane jest zapisywanie zdarzeń do centralnego loggera (Nest Logger/Winston) z event_type: `CV_upload_attempt`, `CV_upload_success`, `CV_upload_failed`, `CV_validation_failed`, `CV_compensation_delete_failed`.
  - Opcjonalnie: tabela `file_upload_logs` lub `system_events` (columns: id, user_id nullable, event_type, metadata jsonb, created_at) — rejestrować s3_key i przyczynę błędu dla audytu.

## 8. Wydajność
- Wąskie gardła:
  - Upload pliku do S3 (sieć) — może dominować czas odpowiedzi
  - Synchronous AV/OCR scanning — kosztowny czasowo
+- Strategie optymalizacji:
  - Limit rozmiaru pliku i odmowa dużych uploadów
  - Opcjonalnie asynchroniczne przetwarzanie: zaakceptuj upload i rekordz utworzyć od razu, potem w background workerze wykonać AV/OCR i oznaczyć rekord jako `validated` lub `rejected`. (Uwaga: spec wymaga walidacji w tym samym żądaniu — więc jeśli zachowujemy synchroniczność, zaakceptować twardsze SLA i timeouty.)
  - Użyć multipart upload limits i stream upload do S3 (avoid buffering whole file in memory)
  - Użyć connection pooling dla bazy (Prisma) oraz limitów jednoczesnych workerów do skanów AV.

## 9. Kroki implementacji (szczegółowe)
Przed rozpoczęciem: upewnij się, że zależności są zainstalowane (`@nestjs/platform-express` / multer, `@aws-sdk/client-s3` lub `aws-sdk`, ewentualny klient ClamAV/antivirus, `class-validator`, `class-transformer`, Prisma client jest aktualny).

1. DTO i kontroler
   - Utwórz `apps/backend/src/cvs/dto/upload-cv-request.dto.ts` (jeśli przydatne). Uwaga: plik przesyłany przez Multer; DTO waliduje `filename`.
   - W `apps/backend/src/cvs/cvs.controller.ts` dodaj metodę `@Post()` z `@UseInterceptors(FileInterceptor('cv'))`:
     - Pobierz `@UploadedFile() file: Express.Multer.File` i `@Body() dto: UploadCvRequestDto`.
     - Zwróć `201` z `CvRecordDto` po sukcesie.

2. Serwis
   - Utwórz/wzbogac `apps/backend/src/cvs/cvs.service.ts` z metodą `async uploadCv(userId: string, file: Express.Multer.File, filename?: string)`:
     - Implementuj logikę opisaną w sekcji Przepływ danych.
     - Upewnij się, że używasz `prisma.$transaction` tam, gdzie potrzebne, i wykonujesz cleanup S3 przy błędach.
     - Użyj `@Injectable()` i wstrzykuj `PrismaService`, `S3Client` i logger.

3. S3 helper / storage adapter
   - Dodaj warstwę `StorageService` (w `apps/backend/src/storage/storage.service.ts`) abstrakującą upload/delete/getSignedUrl.
   - Implementacja używa `@aws-sdk/client-s3` z konfiguracją przez `ConfigService` (bucket name, region, credentials z env).

4. Validation pipeline
   - Dodaj AV scan i magic-bytes check. Dla AV: integracja z lokalnym ClamAV lub zewnętrznym API.
   - Jeśli OCR/extraction jest wymagane, użyj workerów lub biblioteki Tesseract w kontrolowanym środowisku.

5. DB
   - Użyj `prisma.cvs` (zgodnie ze schematem) i ewentualnie dodaj `file_upload_logs` jeśli audyt wymagany.
   - Przeprowadź migracje jeśli dodajesz nową tabelę.

6. Tests
   - Jednostkowe testy `CvsService.uploadCv` (mock Prisma, mock S3, mock AV). Testuj sukces i wszystkie scenariusze błędów (403, 422, 500).
   - Integracyjne testy endpointu (multipart upload), testy walidacji MIME i magic bytes.

7. Dokumentacja & API
   - Dodaj opis do OpenAPI/Swagger: `@ApiConsumes('multipart/form-data')`, `@ApiBody` wskazujące pole `cv` i `filename`.

## 10. Potencjalne rozszerzenia (opcjonalne)
- Background validation workflow: zaakceptuj upload i utwórz rekord w stanie `pending_validation`, przetwarzanie AV/OCR w workerze i uaktualnienie stanu (validated/rejected). Ten wariant poprawia latencję HTTP lecz wymaga zmiany specyfikacji.
- Dodanie pola `is_validated`/`validation_status` do tabeli `cvs` oraz tabela `auth_logs` dla audytu.

---

Zakończenie: plan powyżej zawiera szczegółowe wskazówki dla zespołu deweloperskiego, implementujących endpoint `POST /cvs` z wymaganą walidacją, limitami na użytkownika, bezpiecznym przechowywaniem w S3 i obsługą błędów oraz strategią kompensacji dla zachowania spójności.


