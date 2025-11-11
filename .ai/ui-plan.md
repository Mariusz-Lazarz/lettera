# Architektura UI dla Lettera

## 1. Przegląd struktury UI

Lettera to prosty, mobilny-first interfejs dla generowania listów motywacyjnych na podstawie przesłanego CV i opisu oferty pracy. Aplikacja składa się z autoryzowanego obszaru użytkownika (dashboard) z dwoma głównymi zasobami: CV (maks. 5) i Letters (maks. 5). Integracja z backendem odbywa się przez REST API opisane w planie API; autoryzacja używa httpOnly cookie i `GET /users/me` jako walidacja sesji. TanStack Query zarządza fetch/cache/mutacjami; formularze używają `react-hook-form + zod`.

Kluczowe założenia UX i dostępności:
- Mobile-first, responsywne układy (single-column mobile, dwa/panelowe desktop).
- Pełna obsługa klawiatury, focus management, ARIA roles oraz testy screen-reader.
- Centralny system powiadomień (toast/modal) i centralny error-mapper mapujący kody serwera na czytelne komunikaty.
- Brak optimistic updates dla krytycznych operacji (upload, generate) — UI czeka na potwierdzenie serwera.

## 2. Lista widoków

- **Register / Rejestracja**
  - Ścieżka: `/register` (albo zintegrowana z `/login` jako karta/toggle)
  - Główny cel: Utworzenie konta (email + password + confirmPassword); walidacja z użyciem `zod` i obsługa błędów serwera.
  - Kluczowe informacje: pola `email`, `password`, `confirmPassword`, zgoda na regulamin (opcjonalnie), informacja o błędach (validation/server). CTA: Register / Create account.
  - Kluczowe komponenty: `AuthForm` (rozszerzenie), `AuthProvider` hook, error-toast, success-toast, redirect po rejestracji.
  - UX/dostępność/bezpieczeństwo: aria-labels, focus na pierwszym błędnym polu, nie przechowywać tokenów w localStorage, rate-limit feedback, potwierdzenie email (opcjonalnie).
  - Możliwość integracji z widokiem Login: rozważ implementację jako dwukartowy komponent (`Login` / `Register`) lub przełącznik w jednym formularzu, by zmniejszyć liczbę stron i ułatwić przepływ użytkownika.

- **Login**
  - Ścieżka: `/login`
  - Główny cel: Uwierzytelnienie użytkownika za pomocą email + hasło; ustawienie sesyjnego httpOnly cookie.
  - Kluczowe informacje: pola `email`, `password`, informacja o błędach (validation/server). CTA: Login.
  - Kluczowe komponenty: `AuthForm` (react-hook-form + zod), `AuthProvider` hook, error-toast.
  - UX/dostępność/bezpieczeństwo: aria-labels, focus on first invalid field, nie przechowywać tokenów w localStorage, rate-limit feedback.

- **Dashboard / Profile**
  - Ścieżka: `/` (chronione)
  - Główny cel: przegląd zasobów użytkownika — lista CV i lista Letters; szybkie akcje (upload, generate, download, delete).
  - Kluczowe informacje: liczba CV (limit 5), lista CV `{id, filename, createdAt}`, lista Letters `{id, status, createdAt}`.
  - Kluczowe komponenty: `CVList`, `LettersList`, `FileUploader` (modal/dropzone), globalny `ToastArea`, limit-warning banner.
  - UX/dostępność/bezpieczeństwo: klarowny empty-state, potwierdzenia przy delete, komunikaty limitów, aria-live regions dla toastów.

- **Upload CV (część Dashboard lub Modal)**
  - Ścieżka: (modal z `/` albo route `/upload`)
  - Główny cel: umożliwić przesłanie pliku PDF (tekstowy) z klient-side walidacją i progressem.
  - Kluczowe informacje: input file (accept `.pdf`), wyświetlenie nazwy pliku, rozmiar, walidacja nazwy, progress bar, przycisk Cancel.
  - Kluczowe komponenty: `FileUploader` (drag'n'drop + file input), `UploadProgress` (cancelable), client-side validators (MIME, size, filename length).
  - UX/dostępność/bezpieczeństwo: aria-describedby dla ograniczeń pliku, keyboard operable dropzone, enforce server as source of truth po odpowiedzi.

- **CV List Item / CV Detail (opcjonalne krótkie metadane)**
  - Ścieżka: `/cvs` (część dashboard)
  - Główny cel: przegląd i zarządzanie przesłanymi CV (delete)
  - Kluczowe informacje: filename, createdAt, przycisk delete, przycisk select (dla generowania listu).
  - Kluczowe komponenty: `CVListItem`, `ConfirmDeleteModal`.
  - UX/dostępność/bezpieczeństwo: potwierdzenie przed delete, rollback UI tylko po potwierdzeniu serwera.

- **Create Letter (Generate)**
  - Ścieżka: `/letters/new` lub modal
  - Główny cel: utworzyć listę motywacyjny z wykorzystaniem wybranego CV i opisu oferty (1000–10000 chars).
  - Kluczowe informacje: select CV (id), `job_title`, `job_description` (zliczanie znaków, walidacja zod), CTA Generate.
  - Kluczowe komponenty: `GenerateLetterForm` (react-hook-form + zod), `ProgressModal` (2-min timeout + cancel), `ErrorMapper` integration.
  - UX/dostępność/bezpieczeństwo: debounce/confirm przed wysłaniem, aria-live dla statusu generowania, możliwość anulowania po 2 min (frontend cancel token jeśli serwer obsługuje).

- **Letters List**
  - Ścieżka: `/letters`
  - Główny cel: przegląd wygenerowanych list (maks. 5), szybkie akcje preview i download.
  - Kluczowe informacje: status (completed/pending/failed), createdAt, przyciski Preview, Download PDF, Copy text.
  - Kluczowe komponenty: `LetterListItem`, `LetterStatusBadge`, `PreviewButton`, `DownloadButton`.
  - UX/dostępność/bezpieczeństwo: przy failed show retry CTA (z instrukcją), limit-warning banner, aria oznaczenia statusu.

- **Letter Preview (Modal / Page)**
  - Ścieżka: `/letters/:id/preview` (modal preferowany)
  - Główny cel: wyświetlić bezpiecznie wyrenderowane HTML listu (read-only), umożliwić kopiowanie i pobranie PDF.
  - Kluczowe informacje: sanitized HTML preview, Copy text, Download PDF (GET /letters/:id/download), meta (createdAt, used CV).
  - Kluczowe komponenty: `SanitizedHtmlContainer` (no scripts), `CopyTextButton`, `DownloadPdfButton`.
  - UX/dostępność/bezpieczeństwo: sanitize HTML, focus trap w modal, aria-labels dla akcji, confirm download modal opcjonalnie.

- **Error / Limits View (Global)**
  - Ścieżka: global component
  - Główny cel: informować o limitach zasobów i błędach krytycznych (403/409/422/500)
  - Kluczowe informacje: przyczyna, rekomendowany następny krok (delete CV, retry), CTA (Contact, Retry).
  - Kluczowe komponenty: `GlobalToast`, `LimitModal`, `ErrorMapper`.
  - UX/dostępność/bezpieczeństwo: aria-live region, keyboard dismissible, links do help/contact.

- **Settings / Profile (minimalne)**
  - Ścieżka: `/settings`
  - Główny cel: wyświetlić podstawowe dane konta i umożliwić logout.
  - Kluczowe informacje: email, createdAt, logout button.
  - Kluczowe komponenty: `ProfileCard`, `LogoutButton`.
  - UX/dostępność/bezpieczeństwo: potwierdzenie logout, clear auth context on 401.

## 3. Mapa podróży użytkownika

- Główny scenariusz (Upload CV → Generate Letter → Preview → Download):
  1. Użytkownik loguje się (`/login`) → backend ustawia httpOnly cookie; frontend wywołuje `GET /users/me` i ładuje dashboard.
  2. Na Dashboard użytkownik klika `Upload CV` → otwiera się modal `FileUploader`.
  3. Użytkownik wybiera PDF; klient wykonuje walidację (MIME `application/pdf`, rozmiar, długość nazwy). Jeśli błąd, pokaż validation message.
  4. Jeśli walidacja ok, użytkownik potwierdza; frontend wysyła `POST /cvs` (multipart/form-data) — pokazuj `UploadProgress` z cancel. Po sukcesie invaliduj `GET /cvs` query i pokaż success toast.
  5. Użytkownik przechodzi do `Generate Letter` (`/letters/new`) wybiera CV z listy i wkleja `job_description` (1000–10000 chars). Formularz waliduje.
  6. Użytkownik naciska `Generate` → wysyłane `POST /letters`. UI otwiera `ProgressModal` z progressem i timeoutem 2 min; opcja Cancel jeżeli wspierana.
  7. Po sukcesie odpowiedź zawiera HTML listu; invaliduj `GET /letters` i dodaj nowy element do listy. Pokaż toast z CTA `Preview`.
  8. Użytkownik otwiera `Preview` → sanitized HTML w modal; może `Copy text` lub `Download PDF` (GET `/letters/:id/download`).

- Edge/alternate flows:
  - Jeśli `POST /cvs` zwraca 403/409 (limit), pokaż `LimitModal` z instrukcją i linkiem do usuwania CV.
  - Jeśli `POST /letters` zwraca error 422/AI error, pokaż human-friendly komunikat z retry CTA.
  - Jeśli `GET /users/me` zwraca 401 → `AuthProvider` czyści stan i przekierowuje do `/login`.

## 4. Układ i struktura nawigacji

- Główne elementy nawigacji (po zalogowaniu):
  - Top bar / App shell z logo, linkami: `Dashboard` (CV + Letters), `Letters` (lista), `Settings/Logout`.
  - Mobile: hamburger menu z tymi samymi pozycjami; sticky bottom action button `+` dla szybkiego `Upload CV`/`Generate` (contextual).
  - Breadcrumbs/Secondary nav: tylko gdy użytkownik jest w modalach lub deep view (np. `/letters/:id`).
  - Route guards: chronione trasy sprawdzane przez `AuthProvider`/hook; on 401 redirect do `/login`.

Nawigacja priorytetowa:
- Primary: Dashboard (`/`) — centralny punkt startowy.
- Secondary: `/letters`, `/settings`.
- Modale/overlay dla uploadu i preview, by zachować kontekst sesji i łatwe zamykanie.

## 5. Kluczowe komponenty

- **AuthProvider (React Context)**
  - Funkcje: `login()`, `logout()`, `checkSession()` (GET /users/me), global 401 handler.
  - Zależności: TanStack Query for user query.

- **FileUploader**
  - Funkcjonalność: drag'n'drop + file input, client-side validation (MIME, size, filename length), start upload, expose cancel token, progress UI.
  - Accessibilty: role="button" dla dropzone, aria-describedby dla ograniczeń.

- **UploadProgress**
  - Funkcjonalność: pokazuje pasek postępu, procent, przycisk Cancel; state machine: uploading → success/failure/cancelled.

- **GenerateLetterForm**
  - Funkcjonalność: select CV, job_title, job_description (char counter + zod schema), generate action.
  - UX: confirm modal before sending, disable form while generating.

- **ProgressModal**
  - Funkcjonalność: centralny modal dla długich operacji (upload/generate), pokazuje timeout 2 min, cancel, accessible progress announcements (aria-live).

- **SanitizedHtmlContainer**
  - Funkcjonalność: bezpieczne renderowanie HTML (strip scripts, style policy), provide text-only extraction for `Copy text`.

- **GlobalToast / ErrorMapper**
  - Funkcjonalność: centralne mapowanie błędów i wyświetlanie toastów/modali z CTA (Retry/Delete/Contact). Mapuje statusCode i opcjonalny `code` z serwera.

- **CVList & LettersList + Item components**
  - Funkcjonalność: list rendering (max 5 items), empty/limit states, item actions (preview/download/delete), aria labels and keyboard navigation.

- **ConfirmDeleteModal**
  - Funkcjonalność: potwierdzenie usunięcia zasobu; perform `DELETE /cvs/:id`, invalidate query on success.

- **RouteGuard (hook/HOC)**
  - Funkcjonalność: chroni prywatne trasy, używa `AuthProvider` i `GET /users/me`.

## Mapowanie wymagań PRD → elementy UI

- PRD: tylko PDF, max kilka MB → `FileUploader` z client-side MIME+size check i server validation feedback.
- PRD: max 5 CV, max 5 Letters → `CVList` i `LettersList` pokazują liczbę i `LimitModal` blokujący dalsze dodania; serwer 403/409 traktowany jako source-of-truth.
- PRD: Extraction required (if extraction failed, show message) → gdy backend zgłasza extraction failure podczas `POST /letters`, UI pokaże przyjazny komunikat `No data: could not generate letter` i sugestie.
- PRD: Synchronous generation (UI blocks do 2 min) → `ProgressModal` (timeout 2 min) z Cancel i jasnymi instrukcjami.
- PRD: Download PDF → `DownloadPdfButton` wywołuje GET `/letters/:id/download` i obsługuje błędy 500.
- PRD: Read-only preview → `SanitizedHtmlContainer` + `CopyTextButton`.

## Stany błędów i punkty brzegowe (przykładowe)

- Upload: invalid file type, file too large, filename too long → show field-level errors before upload.
- Upload: server returns 422 (OCR/validation failed) → show modal z instrukcją (upload different CV) and log event.
- Upload: network failure/interrupted → allow retry and expose resume via re-select file.
- Generate: AI provider error (422/AI_ERROR) → show friendly message with retry and Contact support CTA.
- Generate: exceed time limit (2 min) → show cancel state and suggestion to try again later.
- Global: 401 from any endpoint → `AuthProvider` clears session and redirect to `/login`.
- Limits: concurrent attempts to upload beyond 5 from different clients → server 403/409; UI must revalidate list after server response and present final state.

## Uwaga dotycząca zgodności z API

- Upload uses `POST /cvs` multipart/form-data; UI implements required content-type and progress/cancel.
- List endpoints `GET /cvs` and `GET /letters` are canonical sources for list rendering; UI uses TanStack Query to fetch and invalidate after mutations.
- Generate uses `POST /letters` synchronous flow; UI expects HTML in response and status handling per plan API.
- Download uses `GET /letters/:id/download` returning PDF binary; UI handles Content-Disposition and triggers file save.
- Auth uses `GET /users/me` and server-set httpOnly cookie; frontend never stores JWT.

## Potencjalne punkty bólu użytkownika i propozycje łagodzące

- Długi czas generowania: jasno komunikować 2-min timeout, pokazywać progres i opcję cancel; po anulowaniu zapisać log i suggest retry.
- Nieudane ekstrakcje: provide actionable feedback (try different CV, check if PDF has embedded text) i link do help.
- Limit zasobów: show clear quota UI (e.g., "3/5 CV used") i szybki path do usunięcia starych CV.
- Błędy serwera/AI: centralny error-mapper z CTA (Retry / Contact) i możliwość zgłoszenia problemu z automatycznie dołączonym logiem zdarzenia.


---

Plik ten ma służyć jako źródło prawdy dla zespołu frontendowego przy implementacji MVP Lettera: opisuje widoki, podróże użytkownika, nawigację oraz komponenty i mapowania do API.
