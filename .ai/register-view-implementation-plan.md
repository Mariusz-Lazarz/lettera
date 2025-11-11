# Plan implementacji widoku Rejestracja / Logowanie

## 1. Przegląd
Widok rejestracji/login służy do utworzenia nowego konta lub zalogowania istniejącego użytkownika. Cel: bezpieczna rejestracja (email + password + confirmPassword) oraz uwierzytelnienie (email + password) z walidacją po stronie klienta (Zod + react-hook-form) i obsługą błędów serwera. Po udanej rejestracji/logowaniu użytkownik zostaje przekierowany do profilu (`/profile`) a sesja jest utrzymywana przez cookie httpOnly (backend).

Widok ma być dostępny jako osobna ścieżka `/register` oraz `/login` lub jako jeden komponent dwukartowy (`Login` / `Register`) z przełącznikiem, aby ułatwić UX i zmniejszyć liczbę stron.

## 2. Routing widoku
- `/register` — główna ścieżka rejestracji
- `/login` — główna ścieżka logowania
- Alternatywnie: jeden komponent `AuthPage` z toggle'em (karta `login` / `register`) dostępny pod `/auth` i osobnymi pod-ścieżkami.

Zalecenie implementacyjne: zaimplementować zarówno `/login` jak i `/register` (prostota nawigacji i SEO), ale udostępnić komponenty współdzielone dla formularzy.

## 3. Struktura komponentów (hierarchia)
- `pages/`
  - `apps/frontend/src/pages/LoginPage.tsx` — wrapper strony logowania
  - `apps/frontend/src/pages/RegisterPage.tsx` — wrapper strony rejestracji
- `components/auth/`
  - `AuthPage.tsx` — (opcjonalny) karta / layout dla formularzy z toggle (Login / Register)
  - `AuthForm.tsx` — główny, generyczny formularz obsługujący pola i walidację (parametryzowany)
  - `RegisterFields.tsx` — pola specyficzne dla rejestracji (`confirmPassword`, `terms`)
  - `LoginFields.tsx` — pola specyficzne dla logowania
  - `AuthToggle.tsx` — przełącznik widoku (jeśli użyty)
- `hooks/`
  - `useAuth.ts` — hook do akcji auth (login, register, logout) + stan globalny (czas życia tokena, user)
  - `useAuthForm.ts` (opcjonalny) — wrapper dla react-hook-form + zod schema reuse
- `lib/api/`
  - `auth.ts` — funkcje wywołujące API (`register`, `login`) (fetch/axios/ky)
- `lib/validation/`
  - `authSchemas.ts` — Zod schematy dla `registerSchema`, `loginSchema`
- `providers/`
  - `AuthProvider.tsx` — kontekst / provider dla danych użytkownika (opcjonalnie; integracja z cookie session)
- `ui/`
  - `ErrorList.tsx`, `FormField.tsx`, `Button.tsx` — wspólne komponenty UI

## 4. Szczegóły komponentów

### `AuthForm` (generyczny)
- Opis: Przyjmuje konfigurację (tryb: `login` | `register`), schemat Zod, pola (children lub render prop), i zarządza formularzem przez `react-hook-form`.
- Główne elementy: `<form>`, `FormField` dla każdego pola, `Submit` button, link do switch (np. "Masz konto? Zaloguj się").
- Obsługiwane zdarzenia:
  - `onSubmit` — walidacja z użyciem Zod + wysyłka do API
  - `onError` — focus na pierwszym błędnym polu, pokazanie błędów
- Warunki walidacji (frontend):
  - `email` — poprawny format email (Zod `z.string().email()`), wymagane
  - `password` — minLength 8 (Zod `min(8)`), wymagane; (opcjonalnie: reguły złożoności)
  - `confirmPassword` (register only) — musi równać się `password`
  - `terms` (opcjonalne) — boolean must be true jeśli wymagane
- Typy (DTO / ViewModel):
  - `RegisterRequestVm` { email: string; password: string; confirmPassword?: string; acceptTerms?: boolean }
  - `LoginRequestVm` { email: string; password: string }
- Propsy komponentu:
  - `mode: 'login' | 'register'`
  - `onSuccess?: (user: User, token?: string) => void` (opcjonalne)
  - `defaultValues?: Partial<RegisterRequestVm|LoginRequestVm>`
  - `className?: string`

### `RegisterFields`
- Opis: Renderuje pola `email`, `password`, `confirmPassword`, (opcjonalnie) `acceptTerms`.
- Główne elementy: etykiety, inputy z `aria-*`, komunikaty błędów inline.
- Obsługiwane zdarzenia: lokalna walidacja pola `confirmPassword` zależna od `password`.
- Propsy: otrzymuje `register`, `errors`, `watch` z `react-hook-form`.

### `LoginFields`
- Opis: Renderuje `email` i `password` oraz zapamiętaj opcjonalnie (nie zapisywać tokenów w localStorage).
- Główne elementy: pole password z toggle pokazywania hasła, link do resetu hasła (jeśli jest funkcja).
- Propsy: `register`, `errors`.

### `AuthPage` (layout)
- Opis: Layout strony, tytuł, opis, karta z `AuthForm`, miejsce na toasty i spinner.
- Główne elementy: nagłówek, sekcja z formularzem, footer z linkami.

### `AuthProvider` / `useAuth` (hook)
- Opis: Abstrakcja nad stanem zalogowanego użytkownika i metodami `login`, `register`, `logout`.
- API hooka:
  - `const { user, isLoading, login, register, logout } = useAuth()`
  - `login(credentials): Promise<void>` — wywołuje `lib/api/auth.login`, ustawia kontekst i redirect
  - `register(payload): Promise<void>` — wywołuje `lib/api/auth.register`, ustawia kontekst
- Zadania: nie przechowywać tokena w localStorage; jeśli backend ustawia httpOnly cookie, to frontend nie musi zapisywać tokenu. Jeśli backend zwraca token i wymaga zapisu, preferuj cookie z serwera.
- Stan: `user: User | null`, `isAuthenticated: boolean`, `isLoading: boolean`.

## 5. Typy (szczegółowo)
- `User` (frontend view model):
  - `id: string`
  - `email: string`
  - `createdAt?: string`

- `RegisterRequestVm`:
  - `email: string`
  - `password: string`
  - `confirmPassword?: string` (frontend only)
  - `acceptTerms?: boolean` (opcjonalne)

- `LoginRequestVm`:
  - `email: string`
  - `password: string`

- `RegisterResponseDto` (zgodnie z backendem):
  - `user: { id: string; email: string; created_at: string }`
  - `token?: string` (jeśli backend zwraca)

- `LoginResponseDto`:
  - `user: { id: string; email: string }`
  - `token?: string`

- Zod schematy (w `authSchemas.ts`):
  - `registerSchema = z.object({ email: z.string().email(), password: z.string().min(8), confirmPassword: z.string().min(8), acceptTerms: z.boolean().optional() }).superRefine(...)` (superRefine do porównania password/confirmPassword)
  - `loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) })`

## 6. Zarządzanie stanem
- Lokalny formularz: `react-hook-form` dla każdego formularza. Użyć `useForm({ resolver: zodResolver(schema) })`.
- Globalny stan auth: `AuthProvider` z React Context lub Zustand (jeśli już używane). `AuthProvider` przechowuje `user` i metody `login/register/logout`.
- Opcjonalny: `useAuth` hook wywołujący kontekst i prosty reselect.
- Flagi UI: `isSubmitting`, `serverError`, `validationErrors`.

## 7. Integracja API
- Endpointy (zgodnie z backendem):
  - `POST /auth/register` — body: `{ email, password }` — response 201: `{ user, token }` lub 409/400
  - `POST /auth/login` — body: `{ email, password }` — response 200: `{ user, token }` lub 401
- Mapowanie wywołań (plik `apps/frontend/src/lib/api/auth.ts`):
  - `async function register(payload: RegisterRequestVm): Promise<RegisterResponseDto>` — wyślij JSON, zwróć parsed body lub rzuć błędy.
  - `async function login(payload: LoginRequestVm): Promise<LoginResponseDto>`
- Obsługa cookies: jeśli backend ustawia httpOnly cookie, frontend nie musi zapisywać tokenu. Jeśli backend zwraca token i wymaga klienta do przechowywania, preferuj mechanizm cookie ustawiany z serwera (Set-Cookie z backendu). W przeciwnym razie, jeśli trzeba, zapisać token w cookie sesyjnym (nie localStorage).

## 8. Interakcje użytkownika (flow)
- Rejestracja:
  1. Użytkownik wypełnia `email`, `password`, `confirmPassword` i klika `Register`.
  2. Frontend waliduje pola przez Zod. Jeśli błędy — fokus na pierwszym błędzie i inline messages.
  3. Po przejściu walidacji frontend wywołuje `register` API.
  4. Jeśli API zwraca 201 — pokaz success-toast: "Konto utworzone" i redirect na `/login` lub automatyczne zalogowanie i redirect do `/profile` w zależności od biznesu.
  5. Jeśli API zwraca 409 — pokaż error-toast z informacją "Email już istnieje" oraz inline marker na polu `email`.
  6. Jeśli błędy sieciowe — pokaż ogólny error-toast i możliwy retry.

- Logowanie:
  1. Użytkownik podaje `email`, `password` i klika `Login`.
  2. Walidacja klienta; następnie `login` API.
  3. Jeśli 200 — jeśli backend ustawił cookie, `useAuth` fetchuje /me (jeśli konieczne) i redirect do `/profile`.
  4. Jeśli 401 — pokaż inline error na polu `password` lub generalny komunikat "Nieprawidłowe dane logowania".

## 9. Warunki i walidacja (szczegółowo)
- Frontend (Zod):
  - `email`: required, email format
  - `password`: required, minLength 8
  - `confirmPassword`: must equal `password` (register only)
  - `acceptTerms`: if required, must be true
- Dodatkowe kontrole:
  - limit długości pól (np. max 254 dla email), trimowanie wartości wejściowych
  - debounce dla walidacji inline (opcjonalne)
- Walidacja API -> mapowanie błędów:
  - 400: wyświetlić szczegóły walidacji (jeśli backend zwraca struktury errors)
  - 409 (register): podświetlić pole email + error-toast
  - 401 (login): generalny komunikat autoryzacji

## 10. Obsługa błędów i scenariusze edge-case
- Błędy sieciowe / timeout: pokaż toast z propozycją spróbowania ponownie.
- Rate limit (backend może zwrócić 429): pokaż czytelny komunikat "Zbyt wiele prób. Spróbuj później." i dezaktywuj przycisk na czas rosnący (exponential backoff) lub blokuj UI chwilowo.
- Błędy serwera (500): toast "Wystąpił błąd. Spróbuj ponownie później." + opcjonalne logowanie zdarzenia (frontend) do Sentry.
- Duplikat email: mapowanie 409 -> inline error + toast.
- Niepoprawne formaty: obsłuż walidację w Zod i pokaż precyzyjne komunikaty.
- Accessibility: dla komunikatów błędów użyć `aria-invalid`, `aria-describedby`, fokus na pierwszym błędnym elemencie.

## 11. Kroki implementacji (krok po kroku)
1. Przygotowanie: upewnij się, że `react-hook-form`, `zod` i `@hookform/resolvers` są zainstalowane w `apps/frontend`:
   - `pnpm add zod @hookform/resolvers react-hook-form`
2. Utwórz Zod schematy: `apps/frontend/src/lib/validation/authSchemas.ts` — `registerSchema`, `loginSchema`.
3. Stwórz API client: `apps/frontend/src/lib/api/auth.ts` z funkcjami `register` i `login` (fetch/ky/axios). Obsłuż mapowanie błędów HTTP na wyjątki/obiekty.
4. Stwórz `AuthForm.tsx` w `apps/frontend/src/components/auth/AuthForm.tsx`:
   - Implementuj formularz generyczny z `useForm({ resolver: zodResolver(schema) })` i props `mode`.
   - Zadbaj o fokus na pierwszym błędnym polu: `setFocus` z react-hook-form lub `errors` traversal.
5. Stwórz pola `RegisterFields.tsx` i `LoginFields.tsx` korzystające z `FormField` wspólnego komponentu.
6. Stwórz `pages/RegisterPage.tsx` i `pages/LoginPage.tsx` które wykorzystują `AuthForm`.
7. Implementuj `useAuth` hook i `AuthProvider` (jeśli projekt nie ma globalnego provider). Upewnij się, że po loginie/registracji wykonuje się redirect.
8. Dodaj toasty (success/error) wykorzystując istniejący mechanizm toast w projekcie (`ui/Toast` albo shadcn/ui). Pokaż success-toast przy pozytywnych akcjach.
9. Testy manualne: sprawdź walidację, błędy serwera (symulując 409/401), fokus i dostępność.
10. E2E / jednostkowe: napisz testy integracyjne dla `AuthForm` (opcjonalnie) — sprawdź walidację i mapowanie błędów.
11. Dokumentacja i Swagger: upewnij się, że komunikacja z backendem zgadza się z API (ścieżki i formaty JSON). Skonsultuj z backendem, czy token będzie w cookie httpOnly.
12. Review i optymalizacje: popraw UX (spinner na przycisku submit), dodaj debounce dla pola email (jeśli autouzupełnianie lub walidacja z serwera).

## 12. Dodatkowe uwagi dotyczące bezpieczeństwa i UX
- Nie przechowywać tokenów w localStorage. Preferuj httpOnly cookies ustawiane przez backend.
- Upewnij się, że formularz nie loguje haseł w konsoli.
- Ułatwienia dostępności: aria-labels na wszystkich inputach, etykiety widoczne, keyboard-first (tab order), odpowiednie kontrasty kolorów.
- Po rejestracji – rozważ wysłanie informacji o weryfikacji email (jeśli backend to obsługuje) i komunikat opisujący następne kroki.
- Rate-limit UX: jeśli backend zwraca 429, pokaż licznik/odliczanie lub informację o blokadzie.

---

Plików i ścieżek plików proponowane lokalizacje (frontend):
- `apps/frontend/src/pages/RegisterPage.tsx`
- `apps/frontend/src/pages/LoginPage.tsx`
- `apps/frontend/src/components/auth/AuthForm.tsx`
- `apps/frontend/src/components/auth/RegisterFields.tsx`
- `apps/frontend/src/components/auth/LoginFields.tsx`
- `apps/frontend/src/hooks/useAuth.ts`
- `apps/frontend/src/lib/api/auth.ts`
- `apps/frontend/src/lib/validation/authSchemas.ts`
- `apps/frontend/src/providers/AuthProvider.tsx` (opcjonalnie)

Uwaga końcowa: plan zgodny z PRD oraz wymaganiami historii użytkownika — rejestracja tworzy konto i zwraca odpowiedź 201/409; login zwraca 200/401. Zadbaj o komunikację z backendem w kwestii cookie httpOnly vs token w body (uzgadniać z zespołem backendu).
