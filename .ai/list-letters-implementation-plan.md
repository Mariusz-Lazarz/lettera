# API Endpoint Implementation Plan: List letters

## 1. Przegląd punktu końcowego
Zwraca wszystkie listy (letters) należące do aktualnie uwierzytelnionego użytkownika. Brak paginacji (użytkownik może mieć maksymalnie 5 list). Odpowiedź zawiera listę elementów z polami: `id`, `html`, `status`, `created_at`, `updated_at`.

## 2. Szczegóły żądania
- Metoda HTTP: GET
- Struktura URL: `/letters`
- Parametry:
  - Wymagane: brak (autentykacja wymagana)
  - Opcjonalne: brak
- Request Body: brak
- Nagłówki: `Authorization: Bearer <token>` (lub mechanizm sesji zgodny z usługą uwierzytelniania projektu)

## 3. Wykorzystywane typy
- Zewnętrzne/generated DTOs:
  - `LetterResponseDto` (z `apps/backend/src/generated-dtos.ts`) — używany jako wzorzec pól zwracanych z bazy danych: `id`, `userId`, `html`, `pdfS3Key`, `createdAt`, `updatedAt`.
- API response model (kierowany do klienta):
  - ListItemsResponse: { items: Array<{ id: string; html: string; status: 'completed' | 'pending'; created_at: string; updated_at: string; }> }

Uwaga: DTO generowane przez Prisma/Nest mogą używać camelCase (np. `createdAt`) — w warstwie kontrolera/serializacji należy przemapować je do formatu oczekiwanego przez klienta (`created_at`, `updated_at`) oraz dodać pole `status`.

## 4. Przepływ danych
1. Kontroler (`LettersController`) otrzymuje żądanie `GET /letters`.
2. Middleware lub guard uwierzytelnia użytkownika i dostarcza `userId` (np. przez `Request.user.id`). Jeśli brak — odpowiedź 401.
3. Kontroler wywołuje serwis (`LettersService`) metodę `listByUser(userId: string)`.
4. `LettersService` używa Prisma (`prisma.letter.findMany`) z filtrem `where: { userId }` i sortowaniem (np. `orderBy: { createdAt: 'desc' }`). Ograniczenie 5 nie jest konieczne, ale można dodać `take: 5` na wszelki wypadek.
5. Serwis mapuje wynik DB na model API:
   - `id` -> `id`
   - `html` -> `html`
   - `status` -> jeżeli `pdf_s3_key` (pdfS3Key) istnieje => `'completed'` else `'pending'` (wyjaśnione w analizie)
   - `created_at` i `updated_at` -> iso8601 string (UTC)
6. Kontroler zwraca `200` z payload `{ items: [...] }`.

Diagram prosty:
- Request -> AuthGuard -> LettersController.list() -> LettersService.listByUser(userId) -> Prisma query -> map -> 200 { items }

## 5. Względy bezpieczeństwa
- Uwierzytelnianie: wymagane. Użyj istniejącego mechanizmu auth (JWT guard lub sesja NestJS). Zweryfikuj tożsamość użytkownika przed dostępem do serwisu.
- Autoryzacja: filtruj zapytanie DB po `userId` — nigdy nie zwracaj list innego użytkownika.
- Walidacja danych: brak ciała żądania, jedynie weryfikacja obecności `userId` po uwierzytelnieniu.
- Bezpieczeństwo danych: nie ujawniać `pdf_s3_key` w odpowiedzi — zamiast tego zwrócić `status` oraz (opcjonalnie) podpisany URL tylko przez dedykowany endpoint do pobierania PDF, który dopiero generuje signed URL i sprawdza uprawnienia.
- Ochrona przed wyciekami: nie logować pełnego `html` w logach produkcyjnych; jeśli logujesz, stosować truncation/obfuscation.

## 6. Obsługa błędów
- 200 OK — powodzenie, zwraca `{ items: [...] }` (może być pusta tablica)
- 401 Unauthorized — brak/nieprawidłowy token lub brak użytkownika w kontekście żądania
- 400 Bad Request — nie dotyczy (żądanie bez ciała). Zwrócić 400 tylko gdy wprowadzone zostaną nieprawidłowe parametry (nie dotyczy tego endpointu)
- 404 Not Found — nie stosować globalnie (użytkownik bez list otrzyma 200 z pustą listą); 404 stosować jedynie gdy endpoint wymaga konkretnego zasobu ID (nie dotyczy)
- 500 Internal Server Error — błędy bazy danych, wyjątki nieprzewidziane

Logowanie błędów:
- Na poziomie serwisu/catch: loguj błąd z meta: { userId, route: '/letters', event: 'list_letters_failed', errorMessage }
- Opcjonalnie: zapisz istotne błędy do centralnego loggera (np. Sentry) z kontekstem użytkownika (bez danych wrażliwych)

## 7. Wydajność
- Użytkownik ma maksymalnie 5 list — zapytanie `findMany` bez paginacji jest dopuszczalne.
- Dodaj indeks DB na `user_id` jeśli jeszcze istnieje (Prisma zwykle tworzy indeks FK). Zapytanie `where user_id = ?` jest szybkie.
- Limit `take: 5` w zapytaniu Prisma zabezpiecza przed nieoczekiwanym wzrostem danych.
- Upewnij się, że pola `html` są pobierane tylko jeśli konieczne; w razie dużych HTML można rozważyć zwracanie skrótu lub tylko metadanych (ale spec wymaga pola `html`).

## 8. Kroki implementacji
1. Dodaj lub zaktualizuj kontroler: `apps/backend/src/letters/letters.controller.ts`
   - Nowa metoda: `@Get()` `list(@Req() req)` lub `@UseGuards(AuthGuard)` + `@Get()` `list(@User() user)`
   - Wywołuje `LettersService.listByUser(user.id)`
   - Mapuje wynik na odpowiedź API i zwraca `200`.

2. Dodaj/uzupełnij serwis: `apps/backend/src/letters/letters.service.ts`
   - Metoda `async listByUser(userId: string): Promise<Array<ApiLetter>>`:
     - `const letters = await this.prisma.letter.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 5 });`
     - Mapowanie: ustaw `status = pdfS3Key ? 'completed' : 'pending'`.
     - Konwersja dat do ISO (`toISOString()` lub `Date` serializacja w UTC).
   - Obsługa wyjątków i rethrowing z kontrolowanym logiem.

3. DTO / Serializer
   - Utwórz funkcję/mapping `toApiLetter(dbLetter): ApiLetter` w serwisie lub w `letters.mapper.ts`.
   - Nie modyfikuj wygenerowanych DTO generowanych przez Prisma — użyj ich jako typów wewnętrznych i mapuj do formatu odpowiedzi.

4. Testy jednostkowe i integracyjne
   - Jednostkowo: mock Prisma w testach serwisu; sprawdzić, że `status` jest poprawnie ustawiany.
   - Integracyjne: uruchomić test z autoryzacją (testowy użytkownik) i sprawdzić endpoint zwraca `200` i poprawną strukturę.

5. Dokumentacja i Swagger
   - Dodaj opis endpointa w dekoratorach kontrolera (`@ApiOperation`, `@ApiResponse`) zgodnie z pozostałą konwencją.

6. Logging i monitoring
   - Dodać logi na poziomie `info` przy udanym wywołaniu (opcjonalnie: tylko ilość zwróconych elementów), a `error` przy niepowodzeniu.

7. Commit i code review
   - W PR opisać mapowania pól (camelCase -> snake_case) i decyzję dotyczącą `status` (pochodzenie z `pdf_s3_key`).

8. Uruchomienie i weryfikacja
   - `pnpm lint`, `pnpm typecheck`, uruchomić backend lokalnie i wykonać testy integracyjne.


---

### Implementacyjne wskazówki i uwagi techniczne (krótkie)
- Pole `status` nie istnieje w schemacie DB — zdefiniować regułę: `status = pdf_s3_key ? 'completed' : 'pending'`.
- Nie ujawniać `pdf_s3_key` w publicznej odpowiedzi. Zamiast tego zapewnić oddzielny endpoint `GET /letters/:id/pdf` który zwraca signed URL po weryfikacji własności zasobu.
- Zwróć uwagę na zgodność nazw pól w odpowiedzi: spec używa `created_at` i `updated_at` (snake_case). Zastosuj jednolite mapowanie przed serializacją.




