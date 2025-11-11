# API Endpoint Implementation Plan: Delete letter (DELETE /letters/:id)

## 1. Przegląd punktu końcowego
Usługa umożliwia trwałe usunięcie listu (letter) należącego do uwierzytelnionego użytkownika. Usunięcie zwalnia przydział użytkownika (limit 5 list) i usuwa powiązane zasoby plikowe (PDF) z magazynu S3, jeśli istnieją.

## 2. Szczegóły żądania
- Metoda HTTP: DELETE
- Struktura URL: `/letters/:id`
- Parametry:
  - Wymagane:
    - `id` (path) — UUID identyfikujący listę do usunięcia
  - Opcjonalne: brak
- Request Body: brak (DELETE przez identyfikator w ścieżce)
- Nagłówki wymagane:
  - `Authorization: Bearer <token>` — token sesji użytkownika (JWT lub inny mechanizm używany w projekcie)

## 3. Wykorzystywane typy (DTO / Command modele)
- `DeleteLetterParams` (Command) — { id: string }
- (z istniejących generowanych DTO) `LetterResponseDto` — nie jest bezpośrednio używane przy usuwaniu, ale referencja do struktury listu.

Uwaga: ponieważ metoda nie ma ciała odpowiedzi (204), nie potrzebujemy DTO odpowiedzi. Typy pomocnicze i interfejsy dla serwisu:
- `DeleteLetterResult` — { success: boolean } (wewnętrzny, opcjonalny)

## 4. Przepływ logiki / wyodrębnienie logiki do service
- Kontroler (`LettersController`) — warstwa HTTP: parsowanie `id`, uwierzytelnienie (Guard), wywołanie serwisu, mapowanie wyjątków -> kody HTTP, zwrócenie 204 No Content.
- Serwis (`LettersService` lub `LetterService`) — logika biznesowa:
  - Walidacja formatu UUID (opcjonalnie — guard na poziomie frameworka/pipe)
  - Pobranie listu po id z Prisma
  - Sprawdzenie właściciela: `letter.userId === currentUser.id` → jeśli nie: rzucić wyjątek `ForbiddenException`
  - Wykonanie transakcji:
    - Jeśli `letter.pdf_s3_key` istnieje -> usuń z S3 (najpierw spróbuj usunąć plik, ale zachowaj spójność DB jeśli usunięcie S3 zawiedzie — szczegóły niżej)
    - Usuń rekord `letters` z bazy
  - Zwrócenie potwierdzenia usunięcia lub odpowiedniego wyjątku
- Repository/Prisma calls — w serwisie użyć wygenerowanego klienta Prisma (`PrismaService`) z transakcją, np. `prisma.$transaction(...)` jeśli konieczne.

Projekt struktury: użyj istniejącego `LettersService` jeśli jest; jeśli nie, dodaj nowy serwis `letters.service.ts` i zarejestruj go w module `LettersModule`.

## 5. Walidacja danych wejściowych
- `id` w path: sprawdź, że jest poprawnym UUID. Implementacja:
  - Użyć NestJS `ParseUUIDPipe` w dekoratorze parametru kontrolera: `@Param('id', new ParseUUIDPipe()) id: string`.
- Uwierzytelnienie: upewnić się, że request przeszedł przez AuthGuard i mamy `request.user` z `id`.
- Zabezpieczyć przed atakami typu injection — Prisma + typowanie zapobiegają SQL injection; nadal sanityzuj/zweryfikuj wejście.

## 6. Rejestrowanie i audyt błędów
- Logowanie zdarzeń o poziomie INFO przy udanym usunięciu: log z metadanymi { userId, letterId, timestamp, event: 'letter_deleted' }
- W przypadku błędów (DB lub storage) loguj ERRORY z metadanymi { userId?, letterId?, errorMessage, stack }
- (Opcjonalnie) Zapis do tabeli audytu / errors: jeśli projekt posiada centralny logger/tabla błędów, dodać wpisy dla `Deletion_failed` i `S3_deletion_failed` z tagami. Jeśli brak tabeli błędów, wystarczy centralny logger (np. Winston) i mapowanie HTTP 500.

## 7. Zagrożenia bezpieczeństwa i ich mitigacja
- Nieautoryzowany dostęp: wymuszanie AuthGuard i sprawdzenie właściciela. Brak uprawnień -> 403.
- Usuwanie cudzych zasobów przez manipulację `id`: rozwiązane sprawdzeniem właściciela.
- Race conditions / konkurencja usuwania: użyć transakcji DB. Rozważyć blokadę optymistyczną jeśli inne procesy modyfikują ten rekord równolegle.
- Brak spójności DB <-> S3: jeśli usunięcie pliku S3 zawiedzie, rozważyć dwa podejścia:
  - a) Atomiczna strategia DB-first: w transakcji najpierw usuń plik S3 (zewnętrzna operacja), potem usuń rekord DB. Jeśli usunięcie S3 się nie powiedzie — przerwij i zwróć 500 (czystszy) ale może pozostawić rekord nienaruszony.
  - b) DB-first z retry dla S3: usuń rekord w transakcji, zapisz zdarzenie do kolejki/retentu (background job) do usunięcia S3; jeśli S3 zostanie nieusunięty — job ponowi. To jest bardziej odporny plan w systemach o wysokiej dostępności. Dla MVP proponuję podejście (a) lub usuwać S3 przed usunięciem DB i zwracać 500 jeśli S3 delete się nie powiodło.
- Brak limitów i ochrony przed uszkodzeniem zasobów: ogranicz liczbę żądań (rate limiting) na endpoint jeśli wymagane.

## 8. Scenariusze błędów i kody statusu
- 204 No Content — usunięcie udane
- 401 Unauthorized — brak / nieprawidłowy token
- 403 Forbidden — użytkownik nie jest właścicielem listu
- 404 Not Found — rekord o danym `id` nie istnieje
- 400 Bad Request — niepoprawne UUID w path (obsłużone przez ParseUUIDPipe)
- 500 Internal Server Error — błąd DB/S3/nieoczekiwany wyjątek

---

Poniżej znajduje się szczegółowy plan wdrożenia w formacie markdown (zapiszę go do pliku `.ai/delete-letter-implementation-plan.md`).
