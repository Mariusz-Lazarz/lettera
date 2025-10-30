# API Endpoint Implementation Plan: DELETE /cvs/:id

## 1. Przegląd punktu końcowego
Cel: Usunąć rekord CV z bazy danych oraz odpowiadający mu obiekt w magazynie S3 (DigitalOcean Spaces / AWS S3). Operacja jest dostępna tylko dla właściciela CV. Usuwanie obiektu S3 ma być wykonywane synchronnie; jeśli usunięcie S3 nie powiedzie się, operacja powinna zaplanować ponowną próbę (retry/queue) i zwrócić 500.

Kluczowe warunki:
- Autoryzacja: tylko właściciel (`user_id`) może usunąć CV.
- Atomowość: Najpierw spróbować usunąć obiekt S3; jeśli to się powiedzie, usunąć rekord DB w transakcji. Jeśli usunięcie S3 się nie powiedzie — nie usuwać rekordu DB, zapisać zadanie retry i zwrócić 500.


## 2. Szczegóły żądania
- Metoda HTTP: DELETE
- Struktura URL: `/cvs/:id`
- Parametry:
  - Wymagane:
    - `id` (path param): UUID identyfikujący rekord CV
  - Opcjonalne:
    - brak
- Request Body: brak


## 3. Wykorzystywane typy
- DTOs / modele (TypeScript):
  - `DeleteCvCommand` (command model, używany w service layer):
    - `cvId: string` (uuid)
    - `userId: string` (uuid) — z tokenu autoryzacyjnego

  - Nie jest potrzebny request DTO (brak body). Można udostępnić `CvResponseDto` ze `generated-dtos.ts` jeśli wymagane w logach.


## 4. Szczegóły odpowiedzi
- 204 No Content — operacja zakończona poprawnie (S3 usunięte i rekord DB usunięty).
- 404 Not Found — brak rekordu CV o podanym `id`.
- 403 Forbidden — użytkownik nie jest właścicielem CV.
- 400 Bad Request — niepoprawny format `id` (np. nie-UUID).
- 500 Internal Server Error — niepowodzenie przy usuwaniu obiektu S3 (po zaplanowaniu retry) lub inny błąd serwera.


## 5. Przepływ danych
1. Autoryzacja: request przechodzi przez AuthGuard (JWT/session). `userId` wyciągamy z tokenu.
2. Walidacja `id`: sprawdzenie, czy `id` to poprawne UUID (np. użyć `ParseUUIDPipe` w NestJS lub manualnej walidacji Zod/class-validator).
3. Pobranie rekordu CV z DB (`prisma.cvs.findUnique`) — zapytanie wybiera `id`, `user_id`, `s3_key`, `filename`.
4. Weryfikacja właściciela: porównać `cv.user_id` z `userId` z tokenu; jeśli nie pasuje, zwrócić 403.
5. Próba synchronicznego usunięcia obiektu S3:
   - Użyć istniejącego `StorageService` (np. `storageService.deleteObject(bucket, s3Key)`).
   - Jeśli usunięcie zwraca błąd sieciowy/404/S3 error — nie usuwać DB; zapisać task do kolejki retry i zwrócić 500.
6. Jeśli usunięcie S3 powiedzie się:
   - Wykonać usunięcie rekordu DB w transakcji (`prisma.$transaction([prisma.cvs.delete({where:{id}})])`).
   - Zwrócić 204.

Uwagi dotyczące transakcji: operacja S3 nie jest transakcyjna względem DB — sekwencja S3-delete -> DB-delete minimalizuje ryzyko pozostawienia odwołania w DB do usuniętego obiektu. To zgodne ze specyfikacją, która preferuje synchroniczne usunięcie S3 przed DB.


## 6. Względy bezpieczeństwa
- Autoryzacja: użyć istniejącego `AuthGuard` / `JwtAuthGuard` w NestJS i w kontrolerze sprawdzić, że `request.user.id === cv.user_id`.
- Walidacja wejścia: wymusić UUID (ParseUUIDPipe) aby zapobiec injection i niepoprawnym zapytaniom.
- Rate limiting: opcjonalnie zabezpieczyć endpoint od nadużyć (np. brute-force usuwania zasobów) za pomocą rate-limiter middleware.
- Least privilege: service używający poświadczeń S3 powinien mieć minimalne uprawnienia do operacji delete.
- Audit logging: logować operacje usunięcia (kto, kiedy, cvId, filename, s3Key) do systemu logów lub audytowej tabeli.


## 7. Obsługa błędów i scenariusze
- Scenariusze i kody:
  - CV nie istnieje -> 404
  - Użytkownik nie jest właścicielem -> 403
  - Niepoprawny UUID -> 400
  - Błąd przy usuwaniu S3 (timeout, 5xx S3) ->
    - Zapisać wpis do kolejki retry (Bull/BullMQ/Redis lub tabela `pending_deletions`).
    - Zwrócić 500 z krótką wiadomością (bez ujawniania szczegółów S3). Logować szczegóły błędu.
  - Błąd DB przy usuwaniu rekordu po sukcesie S3 -> 500 (z retry/alertem operatora). Ten przypadek jest mało prawdopodobny; obsłużyć przez ponowne próby lub alerty.

- Retry handling (propozycje):
  - Preferred: użyć kolejki (BullMQ) z workerem, który próbuje usunąć obiekt S3 z eksponential backoff i po kilku próbach trwale loguje niepowodzenie i powiadamia operatora.
  - Alternative: zapisać wpis do tabeli `pending_deletions { id, s3_key, attempts, last_error, created_at }` i uruchamiać cron/worker do przetwarzania.


## 8. Wydajność
- Operacja jest I/O-bound (S3 + DB). Ograniczenia:
  - Latency do S3: synchronous delete może dodać ~100-200ms lub więcej w zależności od sieci.
  - Przy dużej liczbie równoległych delete'ów warto kontrolować równoległość workerów i ewentualne throttling przy S3.

- Optymalizacje:
  - Użyj krótkiego timeoutu dla wywołań S3 i szybkie failover do retry-queue.
  - Batch cleanup worker dla zaległych usunięć w retry queue.


## 9. Etapy wdrożenia (kroki implementacji)
1. Przejrzeć `apps/backend/src/storage/storage.service.ts` i `prisma` client, potwierdzić metody `deleteObject` oraz konfigurację S3.
2. Dodać `DeleteCvCommand` typ w `apps/backend/src/cvs/dtos` (jeśli istnieje folder DTOs), albo wewnętrzny typ w `cvs.service.ts`.
3. W serwisie CV (`CvsService` lub `CvRepository`) dodać metodę `deleteCv(cvId: string, userId: string)` implementującą logikę:
   - Pobranie rekordu, weryfikacja właściciela
   - Synchronous S3 delete via `StorageService`
   - DB delete w transakcji po sukcesie S3
   - W przypadku błędu S3: push do kolejki `pendingDeletionQueue.add({cvId, s3Key})` i wyrzucenie wyjątku powodującego 500
4. W kontrolerze `CvsController` dodać endpoint `@Delete(':id')` z:
   - `@UseGuards(AuthGuard)`
   - `@Param('id', ParseUUIDPipe) id: string`
   - `@Req() req` lub `@User() user` do pobrania `userId`
   - Wywołanie `cvsService.deleteCv(id, userId)` i zwrócenie `204`.
5. Implementować kolejkę retry:
   - Preferred: dodać `BullModule` queue `pendingDeletionQueue` i worker `PendingDeletionProcessor`.
   - Worker próbuje usunąć S3 i po sukcesie usuwa rekord DB (jeśli nadal istnieje) lub oznacza jako resolved.
   - Alternatywa: dodać tabelę `pending_deletions` i worker cron.
6. Dodać unit/integration tests:
   - test: właściciel może usunąć CV (mock S3 delete success)
   - test: inny użytkownik otrzymuje 403
   - test: nieistniejące CV -> 404
   - test: S3 delete fails -> 500 and queue entry created
7. Dodać audit log przy usunięciach i błądach (structured logs)
8. Uruchomić `pnpm lint`, `pnpm typecheck` i uruchomić testy
9. Code review i deploy

---

Plik ten zawiera kompletny plan implementacji endpointu `DELETE /cvs/:id` zgodny z architekturą NestJS + Prisma + S3 i zasadami monorepo. Pozostawione opcje (BullMQ vs tabela retry) należy wybrać zgodnie z istniejącą infrastrukturą projektu.
