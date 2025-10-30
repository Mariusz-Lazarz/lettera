<!--
  Generated implementation plan for Login endpoint
  Save location: .ai/login-implementation-plan.md
-->
# API Endpoint Implementation Plan: Login

## 1. Przegląd punktu końcowego
- Cel: Wymiana poświadczeń (email, password) na JWT oraz zwrócenie podstawowych danych użytkownika.
- Endpoint udostępnia mechanizm logowania użytkownika i generowania tokena dostępowego.

## 2. Szczegóły żądania
- Metoda HTTP: POST
- Struktura URL: `/auth/login`
- Parametry:
  - Wymagane (body JSON):
    - `email` (string) — adres e-mail użytkownika
    - `password` (string) — hasło użytkownika
  - Opcjonalne: brak
- Przykład Request Body:
```json
{ "email": "user@example.com", "password": "password" }
```

## 3. Wykorzystywane typy (DTOs i Command Modele)
- `LoginRequestDto` (request)
  - email: string (required, email format)
  - password: string (required, min length 8 (team decision))

- `LoginResponseDto` (response)
  - user: { id: string; email: string }
  - token: string

- `JwtPayload` (wewnętrzny)
  - sub: string (user id)
  - email: string
  - iat/exp - jako standard JWT

> Implementacja DTO powinna używać `class-validator` i `class-transformer` (NestJS ValidationPipe).

## 4. Szczegóły odpowiedzi
- Sukces 200 OK
  - Body:
```json
{ "user": { "id": "uuid", "email": "user@example.com" }, "token": "jwt" }
```
- Błędy i kody statusu:
  - 400 Bad Request — walidacja wejścia niepomyślna (np. brak pola email, nieprawidłowy format)
  - 401 Unauthorized — nieprawidłowe dane logowania (email nie istnieje lub hasło nie pasuje)
  - 500 Internal Server Error — błędy po stronie serwera

## 5. Przepływ danych
1. Klient wysyła POST `/auth/login` z JSON { email, password }.
2. `AuthController.login` otrzymuje żądanie, DTO jest walidowane przez ValidationPipe.
3. `AuthService.login`:
   - Pobiera użytkownika z bazy przez Prisma: `prisma.user.findUnique({ where: { email } })`.
   - Jeśli brak użytkownika => rzuca `UnauthorizedException`.
   - Weryfikuje hasło za pomocą `bcrypt.compare(password, user.passwordHash)`.
   - Jeśli porównanie się nie powiodło => rzuca `UnauthorizedException`.
   - Tworzy payload JWT (`{ sub: user.id, email: user.email }`) i generuje token przez `JwtService.sign(payload)`.
   - Zwraca `LoginResponseDto` z `user` (id, email) i `token`.
4. `AuthController` zwraca 200 z tokenem.

Integracje i zależności:
- Prisma (database) — `users` table
- bcrypt — porównanie hasła
- @nestjs/jwt (JwtModule) — generowanie tokenów
- ConfigModule/env — trzymanie sekretu JWT i czasu wygaśnięcia

## 6. Względy bezpieczeństwa
- Hasła w DB: `password_hash` — przechowywane wyłącznie w postaci hasha (bcrypt, argon2 — preferowane bcrypt dla zgodności z istniejącym stosunkiem). Nie logować haseł.
- JWT secret powinien pochodzić z env (apps/backend/.env), nie commitować sekretów. Preferuj dłuższy sekret i rotację.
- Ustaw sensowny `expiresIn` (np. 15m access token; ewentualnie refresh token w przyszłości).
- Zabezpieczenia przed brute-force:
  - Rate limiting na endpoint (gateway / express-rate-limit / reverse-proxy).
  - Opcjonalne blokowanie konta po X nieudanych próbach (wymaga tabeli/atrybutu lockout).
- Timing attack: używaj bezpiecznego porównania `bcrypt.compare` (fast-fail early only after retrieval).
- Walidacja wejścia: użyj `class-validator` aby uniknąć zła formatu i ataków typu injection.
- Logowanie: nie logować pełnych credentials; logować zdarzenia (login_success, login_failed) z metadata (timestamp, source IP, userId jeśli znany).
- Przechowywanie tokenów po stronie klienta: wskazówki w dokumentacji (nie w tej implementacji) — preferowane HttpOnly secure cookie lub bezpieczne storage.

## 7. Obsługa błędów
- Scenariusze i odpowiedzi:
  - Walidacja DTO nieprzechodząca => 400 + body z informacjami o polach (standard Nest ValidationPipe).
  - Nie znaleziono użytkownika => 401 Unauthorized (message: 'Invalid credentials')
  - Niepoprawne hasło => 401 Unauthorized (message: 'Invalid credentials')
  - Błąd dostępu do DB / Błąd wewnętrzny => 500 Internal Server Error (log szczegółowy na serwerze, użytkownikowi zwrócić uogólniony komunikat)

- Logowanie błędów:
  - Korzystać z centralnego loggera (np. Nest Logger lub Winston) i logować zdarzenia z kontekstem.
  - Możliwość dodania tabeli `system_events` lub `auth_logs` do rejestrowania prób logowania (kolumny: id, user_id nullable, event_type, ip, user_agent, metadata json, created_at). Jeśli projekt już posiada mechanizm audytu — użyć go zamiast tworzyć nową tabelę.

## 8. Wydajność
- Potencjalne wąskie gardła:
  - Operacja bcrypt.compare jest kosztowna CPU; przy dużej liczbie równoległych logowań rozważyć ograniaczenie przez rate-limiter i/lub zasoby workerów.
  - Masowe zapytania do bazy równoległe — zapewnić odpowiednie poolowanie DB.
- Optymalizacje:
  - Cache wyników nie jest właściwy dla logowania (bezpieczeństwo).
  - Upewnić się, że `users.email` jest zaindeksowane (unikalne) — w schemacie DB już jest UNIQUE.

## 9. Kroki implementacji (szczegółowe)
Przed rozpoczęciem: upewnij się, że zależności są zainstalowane (`@nestjs/jwt`, `bcrypt` lub `bcryptjs`, `class-validator`, `class-transformer`) oraz `Prisma` wygenerowany klient.

1. Dodaj DTOs
   - Utwórz `apps/backend/src/auth/dto/login-request.dto.ts` z `LoginRequestDto` używając `IsEmail`, `IsString`, `MinLength`.
   - Utwórz `apps/backend/src/auth/dto/login-response.dto.ts` lub użyj istniejącego `generated-dtos.ts` do odpowiedzi z mapowaniem do `LetterResponseDto` style. Zwracaj minimalne dane `id` i `email`.

2. Kontroler
   - W `apps/backend/src/auth/auth.controller.ts` dodaj metodę `@Post('login')`:
     - Przyjmuj `@Body() dto: LoginRequestDto`.
     - Wywołaj `authService.login(dto)`.
     - Zwróć 200 z `LoginResponseDto`.
   - Użyj `ValidationPipe` globalnie lub na tym kontrolerze.

3. Serwis
   - W `apps/backend/src/auth/auth.service.ts` zaimplementuj metodę `async login(dto: LoginRequestDto)`:
     - `const user = await this.prisma.user.findUnique({ where: { email: dto.email } });`
     - Jeśli `!user` -> `throw new UnauthorizedException('Invalid credentials')`.
     - Porównaj hasło: `const ok = await bcrypt.compare(dto.password, user.passwordHash)`.
     - Jeśli `!ok` -> `throw new UnauthorizedException('Invalid credentials')`.
     - Stwórz payload: `{ sub: user.id, email: user.email }`.
     - `const token = this.jwtService.sign(payload)`.
     - Zwróć `{ user: { id: user.id, email: user.email }, token }`.

4. Konfiguracja JWT
   - W module `AuthModule` zarejestruj `JwtModule.registerAsync` i wczytaj sekret z `ConfigService` (env var: `JWT_SECRET`, `JWT_EXPIRES_IN`).
   - Upewnij się, że `JwtModule` i `PrismaService` są wstrzyknięte do `AuthService`.

5. Testy i dokumentacja
   - Dodaj jednostkowe testy dla `AuthService.login` (mock Prisma, mock bcrypt, mock JwtService).
   - Dodaj integracyjne testy endpointu (testować 200 i 401).
   - Zaktualizuj swagger/openapi: adnotacje `@ApiTags`, `@ApiResponse(200, ...)` i DTO adnotacje.

6. Operacyjne dodatki (opcjonalne)
   - Dodaj rate-limiter dla `/auth/login`.
   - Rejestruj zdarzenia logowania w tabeli `auth_logs` jeśli wymagane audytem.
   - Rozważ dodanie mechanizmu blokowania konta po X nieudanych próbach (wymaga tracking prób i czasu zablokowania).

## 10. Przykładowe fragmenty (wskazówki implementacyjne)
- Prisma query:
```ts
const user = await this.prisma.user.findUnique({ where: { email } });
```
- Bcrypt:
```ts
const ok = await bcrypt.compare(plainPassword, user.passwordHash);
```
- JWT sign:
```ts
const token = this.jwtService.sign({ sub: user.id, email: user.email });
```

---

Zakończenie: implementacja powinna trzymać się konwencji NestJS (kontroler cienki, logika w service), używać Prisma do dostępu do `users` oraz bezpiecznie porównywać hasła i generować JWT. Zastosuj walidację DTO, obsługę wyjątków (UnauthorizedException) oraz centralne logowanie zdarzeń.


