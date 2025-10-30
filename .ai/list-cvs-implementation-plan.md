# API Endpoint Implementation Plan: List CVs

## 1. Przegląd punktu końcowego
Endpoint `GET /cvs` zwraca wszystkie CV przypisane do aktualnie uwierzytelnionego użytkownika. Nie jest wymagana paginacja (maks. 5 CV na użytkownika). Endpoint ma być lekki, bez zwracania wrażliwych pól (np. s3_key), i bez śladów logiki biznesowej w kontrolerze.

## 2. Szczegóły żądania
- Metoda HTTP: GET
- Struktura URL: `/cvs`
- Parametry:
  - Wymagane: brak (user pobierany z kontekstu uwierzytelnienia)
  - Opcjonalne: brak
- Request Body: brak
- Headers:
  - `Authorization: Bearer <token>` — wymóg autoryzacji (JWT lub inny mechanizm używany w projekcie)

## 3. Wykorzystywane typy
- `CvResponseDto` (istnieje w `apps/backend/src/generated-dtos.ts`) — odpowiada strukturze pojedynczego elementu na liście. Zwracana struktura powinna zawierać tylko: `id`, `filename`, `created_at` (mapować z `createdAt`).

```107:138:apps/backend/src/generated-dtos.ts
// ========== Cv Response DTO ==========
export class CvResponseDto {
  @ApiProperty({
    description: 'id',
    type: String,
  })
  id: string;

  @ApiProperty({
    description: 'userId',
    type: String,
  })
  userId: string;

  @ApiProperty({
    description: 's3Key',
    type: String,
  })
  s3Key: string;

  @ApiProperty({
    description: 'filename',
    type: String,
  })
  filename: string;

  @ApiProperty({
    description: 'createdAt',
    type: Date,
  })
  createdAt: Date;
}
```

- Dodatkowe DTO nie są wymagane dla tego endpointu (listowanie prostych rekordów). Można utworzyć dedykowany `ListCvItemDto` zawierający tylko wymagane pola (bez `userId` i `s3Key`) albo mapować wynik Prisma bez dodatkowego DTO, ale preferowane jest użycie istniejących/generated DTO lub nowego DTO które jawnie wyklucza `s3Key` i `userId`.

## 4. Szczegóły odpowiedzi
- Status 200 OK — pomyślne pobranie
  - Body:
  ```json
  { "items": [{"id":"uuid","filename":"cv.pdf","created_at":"2025-10-30T12:34:56.789Z"}] }
  ```
  - Pole `created_at` to ISO8601 (mapować z `createdAt` timestamptz z bazy danych)
- Statusy błędów (zob. sekcja Obsługa błędów): 401, 400 (rzadko), 500

## 5. Przepływ danych
1. Kontroler `CvsController` przyjmuje żądanie GET `/cvs` i jest chroniony strażnikiem autoryzacji (np. `JwtAuthGuard`).
2. Kontroler wyciąga `userId` z kontekstu żądania (`request.user.id`).
3. Kontroler wywołuje `CvsService.listForUser(userId)`.
4. `CvsService` używa `PrismaService` i wykonuje zapytanie:
   - `prisma.cv.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { id: true, filename: true, createdAt: true } })`
   - Ważne: NIE wybierać `s3_key` ani `user_id` do odpowiedzi.
5. `CvsService` mapuje wynik na format API (`items: [{ id, filename, created_at }]`) i zwraca go kontrolerowi.
6. Kontroler zwraca wynik z kodem 200.

## 6. Względy bezpieczeństwa
- Uwierzytelnianie: endpoint musi być dostępny tylko dla uwierzytelnionych użytkowników (`AuthGuard`).
- Autoryzacja: nie polegać na przekazywanych parametrach — zawsze używać `userId` z kontekstu sesji/tokena (nie przyjmować `userId` z query/body).
- Least privilege: nie zwracać `s3_key`, `user_id`, ani innych wrażliwych meta-danych.
- SQL Injection: użycie Prisma zapobiega ręcznemu konkatenowaniu zapytań; i tak należy sanityzować/valdiować wejście (tu brak wejścia od klienta).
- Rate limiting / brute force: rozważyć globalny rate limit dla API lub dedykowany limiter dla konta (np. 100 req/min) jeśli dostępny w infrastrukturze.
- Logging: logować tylko metadane (request id, user id, eventType="ListCVs", timestamp) — nie logować zawartości plików ani kluczy.

## 7. Obsługa błędów
- 200 — OK (lista może być pusta)
- 401 — Unauthorized: gdy brak/niepoprawny token
  - Treść: `{ "error": "Unauthorized" }`
- 400 — Bad Request: nieoczekiwane dane wejściowe (nie powinno się zdarzyć dla GET bez parametrów)
- 404 — Not Found: nie dotyczy listy (zwrócić 200 z pustą listą zamiast 404)
- 500 — Internal Server Error: baza/nieoczekiwany wyjątek
  - Treść: `{ "error": "Internal Server Error" }` (szczegóły w logach, nie na kliencie)

Dodatkowo:
- Błędy Prisma (np. połączenia) powinny być mapowane na 500 i logowane ze stack trace (bez tajemnicznych danych użytkownika).
- Jeśli dostępne centralne table/logi błędów, zapisać zdarzenia krytyczne (eventType, userId, errorCode, message, timestamp).

## 8. Wydajność
- Maks. 5 rekordów na użytkownika — query jest lekkie.
- Zapytanie `findMany` z `select` minimalizuje transfer i czas wykonania.
- Dobrą praktyką jest indeks na `user_id` i `created_at` (zwykle `user_id` jest FK i domyślnie indeksowany przez Postgres/prisma). Sprawdzić migracje/DDL pod kątem indeksów.
- Cache (opcjonalne): jeśli potrzebne (częste wywołania), rozważyć krótkotrwały cache w pamięci (per-user TTL 10s) lub CDN dla wyników statycznych. Ze względu na mały rozmiar, zwykle niepotrzebne.

## 9. Kroki implementacji
1. Projekt i decyzje (TYTUŁ — done): dodać/zaakceptować plan implementacji. (zadanie `Draft API analysis and design`)
2. Utworzyć folder/plik `apps/backend/src/cvs/cvs.service.ts` i zaimplementować metodę:
   - `async listForUser(userId: string): Promise<{ id: string; filename: string; created_at: string }[]>` która używa `PrismaService.prisma.cv.findMany(...)` z `select` i mapowaniem `createdAt` -> `created_at` (ISO string).
3. Utworzyć `apps/backend/src/cvs/cvs.controller.ts` z:
   - Dekoratorami NestJS: `@Controller('cvs')` oraz `@UseGuards(JwtAuthGuard)` (lub inny stosowany guard)
   - Endpoint: `@Get()` wywołuje `this.cvsService.listForUser(request.user.id)` i zwraca `{ items }`.
   - Użyć `@Req()` lub dedykowanego dekoratora `@User()` (jeśli projekt ma helper) do pobrania `userId`.
4. Utworzyć `apps/backend/src/cvs/cvs.module.ts` aby zarejestrować `CvsService` i `CvsController`. Zarejestrować `PrismaService` jako provider (najczęściej już dostępny i importowany w module głównym).
5. Typy/DTO:
   - Jeżeli preferowany jest jawny DTO, utworzyć `ListCvItemDto` z polami `id: string`, `filename: string`, `created_at: string` i `ListCvResponseDto { items: ListCvItemDto[] }`.
   - Alternatywnie użyć istniejącego `CvResponseDto` ale mapować / filtrować pola (usuwać `s3Key` i `userId`) przed serializacją.
6. Testy:
   - Unit tests dla `CvsService.listForUser` (mock `PrismaService`): sprawdzić poprawne mapowanie i selekcję pól.
   - E2E/integration test dla `GET /cvs` (uruchomić serwer testowy z DB testową lub mock): sprawdzić autoryzację, poprawny format odpowiedzi oraz brak `s3_key` w body.
7. Dokumentacja:
   - Zaktualizować dokumentację API (OpenAPI/Swagger jeśli używane) aby dodać endpoint `/cvs` i schemat odpowiedzi.
8. Weryfikacja jakości:
   - `pnpm lint` i `pnpm typecheck` uruchomić i naprawić błędy.
   - Uruchomić testy `pnpm test` (albo odpowiedni skrypt repozytorium).

## 10. Dodatkowe uwagi i zalecenia
- Nie zapewniać paginacji ani filtrów, dopóki nie zostaną uzasadnione (spec mówi max 5 CV).
- Upewnić się, że migracja bazy zawiera constraint `cvs_filename_length` (już w DDL) i indeks na `user_id`.
- Audyt bezpieczeństwa: zwrócić uwagę na to, gdzie i w jakim kontekście generowane są signed URLs do S3; nie zwracać ich w tym endpointzie.

---

Plik gotowy do wdrożenia: utworzyć pliki `cvs.service.ts`, `cvs.controller.ts`, `cvs.module.ts`, testy i zaktualizować moduły aplikacji. Postępuj zgodnie z powyższą kolejnością kroków i walidacjami.
