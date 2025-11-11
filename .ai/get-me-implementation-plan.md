# API Endpoint Implementation Plan: GET /users/me

## 1. Przegląd punktu końcowego
Endpoint `GET /users/me` zwraca minimalny profil aktualnie uwierzytelnionego użytkownika. Jest to prosty punkt odczytowy, używany przez frontend do pobrania informacji o zalogowanym użytkowniku (np. do wyświetlenia e-maila i daty utworzenia konta).

- Cel: Udostępnić klientowi bezpieczny, minimalny zestaw pól profilu: `id`, `email`, `created_at` w formacie ISO8601.
- Kontekst: Wywoływany z nagłówkiem autoryzacji (np. Bearer JWT). Powinien zwracać 401 kiedy brak/nieprawidłowy token.

## 2. Szczegóły żądania
- Metoda HTTP: GET
- Struktura URL: `/users/me`
- Parametry:
  - Wymagane: brak parametrów ścieżki ani zapytania.
  - Opcjonalne: brak.
- Request Body: brak (GET nie przyjmuje body).
- Nagłówki:
  - `Authorization: Bearer <jwt>` — wymagane (lub inny mechanizm auth zgodny z projektem).

## 3. Wykorzystywane typy (DTO i Command Modele)
- `MeResponseDto` (nowy, eksportowany dla kontrolera i dokumentacji Swagger):
  - `id: string` (UUID)
  - `email: string`
  - `created_at: string` (ISO8601)

Uzasadnienie: istniejący `UserResponseDto` w `generated-dtos.ts` zawiera `passwordHash` i pola, które nie powinny być ujawniane; stwórz dedykowany `MeResponseDto` z minimalnym zestawem pól.

Przykład TypeScript (opisowo):
```ts
export class MeResponseDto {
  id: string;
  email: string;
  created_at: string; // ISO8601
}
```

## 4. Szczegóły odpowiedzi
- Sukces 200 OK
  - Body (application/json):
  ```json
  {
    "id": "uuid",
    "email": "user@example.com",
    "created_at": "2025-10-30T12:34:56.789Z"
  }
  ```
- Błędy:
  - 401 Unauthorized — brak tokenu lub nieprawidłowy token
  - 404 Not Found — *opcjonalne*, gdy token jest ważny, ale użytkownik z danym ID nie istnieje w DB (rzadki przypadek)
  - 500 Internal Server Error — błąd serwera / DB

## 5. Przepływ danych
1. Klient wysyła `GET /users/me` z nagłówkiem `Authorization`.
2. Middleware/Guard (np. Passport JWT guard) weryfikuje token i odczytuje `userId` (np. `req.user.id`). Jeśli nieautoryzowany → 401.
3. Kontroler `UsersController.getMe` wywołuje `UsersService.getByIdMinimal(userId)`.
4. `UsersService.getByIdMinimal` używa Prisma (`prisma.user.findUnique`) z selekcją pól: `id`, `email`, `createdAt` (mapowane do `created_at`).
5. Serwis mapuje rekord DB na `MeResponseDto`:
   - `id` → `id`
   - `email` → `email`
   - `createdAt` → `created_at` (string `toISOString()`)
6. Kontroler zwraca 200 z JSON.

Wskazówki implementacyjne:
- Użyć selekcji w zapytaniu Prisma (`select: { id: true, email: true, createdAt: true }`) aby uniknąć pobierania `password_hash`.
- Trzymać logikę dostępu do DB w `UsersService` (kontroler jedynie orkiestruje i zwraca DTO).

## 6. Względy bezpieczeństwa
- Autoryzacja: Endpoint wymaga uwierzytelnienia (np. JWT via Passport). Zasada: żadna anonimowa odpowiedź 200.
- Poufność: Nigdy nie wystawiać `password_hash` ani innych wrażliwych pól w odpowiedzi.
- Walidacja: Brak body — walidacja dotyczy tokena oraz istnienia użytkownika. Sprawdzać, że `req.user.id` jest UUID i pochodzi z zaufanego guard-a.
- Ataki: chronić przed brute-force rate limiting (ograniczenie wywołań na IP/token), CORS oraz ochrona CSRF nie jest krytyczna dla GET z Bearer tokenem, ale warto sprawdzić politykę CSRF dla aplikacji web.
- Uprawnienia: Jeśli w przyszłości endpoint miałby zwracać więcej pól, dodatkowa autoryzacja (role/scopes) może być wymagana.

## 7. Obsługa błędów
- 401 Unauthorized
  - Przyczyny: brak nagłówka Authorization, nieprawidłowy/wyekspirowany token, nieudana weryfikacja.
  - Działanie: Guard powinien przerwać przepływ i zwrócić 401 z krótkim JSONem `{message: 'Unauthorized'}`.

- 404 Not Found
  - Przyczyny: token poprawny, ale użytkownik usunięty z DB.
  - Działanie: `UsersService` zwraca `null`/throws NotFoundException → kontroler mapuje do 404. Alternatywa: zwrócić 401 jeśli preferujemy "nie ujawniać" braku konta.

- 500 Internal Server Error
  - Przyczyny: błąd DB, błąd serializacji, błąd zależnych serwisów.
  - Działanie: Zalogować błęd z metadanymi (requestId, userId jeśli dostępny) i zwrócić 500 z ogólnym komunikatem.

Logowanie błędów:
- Używać centralnego loggera NestJS (`Logger`) lub dedykowanego serwisu logowania.
- Jeśli organizacja przechowuje błędy w tabeli/monitoringu, tworzyć wpis z: `timestamp`, `userId` (jeśli dostępne), `route`, `errorCode`, `message`, `stack` (trzymać poza publicznymi logami), `requestId`.
- W tym projekcie nie ma jeszcze tabeli errors — zalecane: wysyłać zdarzenia do systemu obserwowalności (Sentry/Datadog) zamiast tworzyć nową tabelę w DB, chyba że wymagane przez politykę.

## 8. Wydajność
- Zapytanie jest lekkie (SELECT po kluczach i trzech polach). Nie wymaga paginacji.
- Możliwości optymalizacji:
  - Cache (Redis) dla często odpytywanych profili (gdy system zwraca niezmienne pola) — ale należy dbać o spójność (invalidation przy aktualizacji profilu).
  - Prisma query z `select` minimalizuje payload i koszt.
- Skalowanie: Endpoint będzie skalował się liniowo z instancjami backendu. Rozważyć rate limiting i caching jeśli spodziewany jest wysoki RPS.

## 9. Testy
- Unit tests:
  - `UsersService.getByIdMinimal` — mock Prisma, sprawdzić, że zwraca poprawny DTO i że `password_hash` nie jest pobierany/ujawniany.
  - Kontroler `getMe` — mock guard i serwis, sprawdzić mapowanie i status 200.
- E2E tests:
  - Test autoryzacji: brak tokenu → 401.
  - Test prawidłowego tokenu → 200 i poprawny payload.
- Testy integracyjne: uruchomić testową bazę (Postgres) z migracjami, zapisać przykładowego użytkownika i sprawdzić end-to-end.

---

(Analiza zakończona) Teraz tworzę ostateczny plan wdrożenia w formacie markdown i zapiszę go do `.ai/get-me-implementation-plan.md`.

Następnie zapiszę plik i zaktualizuję listę zadań jako zakończoną.


---

Teraz zapisuję plik z planem wdrożenia. (Operacja zapisu w toku.)
