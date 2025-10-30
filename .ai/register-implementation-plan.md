# API Endpoint Implementation Plan: POST /auth/register

## 1. Przegląd punktu końcowego
Endpoint rejestruje nowego użytkownika (email + hasło). Po pomyślnej rejestracji zwraca token JWT oraz dane użytkownika. Implementacja musi zapewnić walidację, bezpieczne hashowanie haseł, obsługę konfliktu (email zajęty) oraz generowanie JWT zgodnie z konfiguracją NestJS.

## 2. Szczegóły żądania
- Metoda HTTP: POST
- Struktura URL: `/auth/register`
- Parametry:
  - Wymagane:
    - `email` (string) — adres e-mail nowego użytkownika
    - `password` (string) — surowe hasło użytkownika
  - Opcjonalne: brak
- Request Body (JSON):
  ```json
  { "email": "user@example.com", "password": "strongPassword" }
  ```

## 3. Wykorzystywane typy (DTO / Command)
- `RegisterRequestDto` (request DTO)
  - fields: `email: string`, `password: string`
  - validation: `IsEmail`, `IsString`, `MinLength(8)` plus opcjonalne reguły złożoności
- `UserResponseDto` (response DTO)
  - reuse existing `UserResponseDto` (z `generated-dtos.ts`) lub adaptacja zwracająca `id`, `email`, `created_at`
- `RegisterCommand` (wewnętrzny model opcjonalny)
  - fields: `email`, `password` (raw) — przekazanie do serwisu

> Uwaga: `CreateUserDto` w `generated-dtos.ts` zawiera `passwordHash`; rejestracja powinna przyjąć surowe `password`, a serwis powinien utworzyć `passwordHash` i użyć `CreateUserDto` lub wywołać `prisma.user.create` bezpośrednio.

## 4. Szczegóły odpowiedzi
- 201 Created — sukces
  ```json
  {
    "user": { "id": "uuid", "email": "user@example.com", "created_at": "2025-10-29T...Z" },
    "token": "jwt"
  }
  ```
- Błędy i kody statusu:
  - 400 Bad Request — błędy walidacji (np. niepoprawny email, zbyt krótkie hasło)
  - 409 Conflict — email już istnieje
  - 500 Internal Server Error — niespodziewany błąd serwera

## 5. Przepływ danych
1. Kontroler (`AuthController.register`) odbiera `RegisterRequestDto` i przekazuje dane do `AuthService.register`.
2. `AuthService.register` wykonuje:
   - Walidacja dodatkowa (jeśli konieczna)
   - Hashowanie hasła (bcrypt, ilość rund z `process.env.BCRYPT_ROUNDS`)
   - Próba utworzenia użytkownika w bazie (`prisma.user.create`) z `email` i `passwordHash` w transakcji
   - W przypadku sukcesu: generuje JWT (`JwtService.sign(payload)`), zwraca `UserResponseDto` i token
   - W przypadku konfliktu email: rzuca wyjątek mapowany na 409
3. Kontroler mapuje wynik na odpowiedź HTTP 201 i body jak wyżej.

## 6. Względy bezpieczeństwa
- Hashowanie haseł: użyj `bcrypt` z konfigurowalnym salt rounds (np. 12) — nie zapisuj surowych haseł.
- Przechowywanie sekretów: JWT secret i bcrypt rounds w `apps/backend/.env` (nie commitować).
- Walidacja wejścia: `class-validator` dla DTO; sanityzacja emaila (lowercase + trim).
- Ograniczenie szybkości: rate limiting (np. globalny lub per-IP) aby zapobiec brute-force i masowym rejestracjom.
- Zabezpieczenie przed enumeracją kont: nie ujawniać szczegółów które ułatwiają sprawdzenie istnienia konta (jednak 409 jest wymagany — zamieścić krótką, niespecyficzną wiadomość).
- TLS: endpoint dostępny tylko przez HTTPS.
- Uwierzytelnianie JWT: po rejestracji zwrócić token, ale endpoint nie jest chroniony.

## 7. Obsługa błędów
- Walidacja (400): zwrócić szczegóły walidacji zgodne ze strukturą błędów projektu (lista pól + komunikaty).
- Konflikt (409): złapać błąd unikalności z Prisma (`P2002`) i zwrócić 409 z komunikatem typu `"email already exists"`.
- Błędy serwera (500): loguj szczegóły (stack trace, request metadata) i zwróć ogólny komunikat.
- Mapowanie wyjątków:
  - Prisma `P2002` (Unique constraint) → 409
  - Inne znane wyjątki → odpowiedni kod lub 500

## 8. Rozważania dotyczące wydajności
- Operacja rejestracji jest I/O-bound (baza danych, bcrypt). Potencjalne wąskie gardło: bcrypt kosztowny CPU.
  - Zalecenie: ustawić rozsądne rounds (np. 10-12) i monitorować CPU.
  - Dla bardzo dużej skali: rozważyć delegowanie hashów do workerów asynchronicznych (zaawansowane).
- Optymalizacja DB: indeks na `email` (unikat) już istnieje.
- Monitorowanie: metryki czasu odpowiedzi dla `/auth/register`, liczby konfliktów i błędów.

## 9. Kroki implementacji (szczegółowe)
1. Dodaj DTO i walidację
   - Plik: `apps/backend/src/auth/dto/register-request.dto.ts`
   - Zawartość: `RegisterRequestDto` z dekoratorami `class-validator` (`IsEmail`, `MinLength(8)`, `IsString`, `Trim/Lowercase` jeśli macie helpery)
   - Dodaj Swagger decorators (`@ApiProperty`).

2. Zaimplementuj logikę serwisową
   - Plik: `apps/backend/src/auth/auth.service.ts`
   - Metoda: `async register(dto: RegisterRequestDto): Promise<{ user: UserResponseDto; token: string }>`
   - Kroki wewnętrzne:
     - Normalize email: `email = dto.email.trim().toLowerCase()`
     - Hash password: `const passwordHash = await bcrypt.hash(dto.password, rounds)`
     - Próba insertu: `prisma.user.create({ data: { email, passwordHash } })`
     - Przy sukcesie: `const token = this.jwtService.sign({ sub: user.id, email: user.email })`
     - Zwróć obiekt
   - Obsłuż `P2002` i rzuć `ConflictException`.

3. Dodaj endpoint w kontrolerze
   - Plik: `apps/backend/src/auth/auth.controller.ts`
   - Metoda: `@Post('register') async register(@Body() dto: RegisterRequestDto)`
   - Walidacja globalna lub lokalna: upewnij się, że `ValidationPipe` jest aktywny (globalnie w `main.ts`).
   - Zwracaj `Created` (201) z ciałem jak w specyfikacji.

4. Konfiguracja JWT i env
   - Upewnij się, że `JwtModule` jest skonfigurowany w `AuthModule` z `secret` i `expiresIn` pobieranym z env.
   - Dodaj walidację obecności zmiennych środowiskowych w konfiguracji procesu.

5. Obsługa błędów i logowanie
   - Dodaj logowanie strukturalne (np. `logger.error(...)`) przy złapanych wyjątkach.
   - Jeśli istnieje centralna tabela błędów/eventów, emituj event `User_Registration_Failed` lub `User_Registered` z metadanymi (bez haseł).
   - Mapuj Prisma `P2002` na `ConflictException`.

7. Dokumentacja i Swagger
   - Upewnij się że `RegisterRequestDto` i `UserResponseDto` mają `@ApiProperty` i endpoint jest widoczny w Swagger.

8. Uruchomienia i checks
   - `pnpm lint`, `pnpm typecheck`, uruchom testy
   - Manualne testy e2e (Postman) — testuj prawidłową rejestrację i konflikt email

---

### Dodatkowe uwagi implementacyjne
- Nie zapisuj `password` w logach ani w tabelach.
- W payload JWT nie umieszczaj wrażliwych danych; minimalny payload: `{ sub: user.id, email: user.email }`.
- Dla zgodności z `generated-dtos.ts`: mapuj pola `createdAt` ↔ `created_at` jeśli macie różne konwencje nazw.
- Jeśli używacie `PrismaService`, użyj `this.prisma.user.create(...)` i nie zapominaj o obsłudze transakcji jeśli będzie potrzeba dalszych operacji.
