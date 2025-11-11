# Plan implementacji widoku Dashboard / Profile

## 1. Przegląd
Strona `Dashboard / Profile` (ścieżka `/`, chroniona) daje użytkownikowi szybki przegląd jego zasobów: listę przesłanych CV (maksymalnie 5) oraz listę wygenerowanych listów (Letters). Umożliwia szybkie akcje: upload CV, wygenerowanie listu, pobranie PDF listu, usunięcie CV lub listu. Widok musi być dostępny (a11y), bezpieczny (tylko właściciel widzi swoje zasoby) i obsługiwać komunikaty o limitach oraz potwierdzenia przy usuwaniu.

## 2. Routing widoku
- Ścieżka: `/` (chroniona — dostęp tylko dla zalogowanych użytkowników).
- Integracja z istniejącym systemem routingu: dodać wpis w route config (np. `path: '/', element: <ProtectedRoute><DashboardPage/></ProtectedRoute>`).
- Jeśli projekt używa layoutów, `DashboardPage` powinien użyć domyślnego layoutu użytkownika.

## 3. Struktura komponentów
- `DashboardPage` (strona) — kontener i orchestrator
  - `LimitWarningBanner` — banner z komunikatem o limicie CV (jeśli liczba CV >= 5)
  - `FileUploader` (modal/dropzone) — upload nowego CV
  - `CVList` — lista CV z akcjami (download, delete)
  - `LettersList` — lista listów z akcjami (download, delete jeśli dostępne)
  - `ToastArea` — globalne toasty z aria-live
  - `ConfirmModal` — uniwersalny modal potwierdzenia usunięcia (może być projektowy komponent współdzielony)

Hierarchia:
- `DashboardPage`
  - `LimitWarningBanner`
  - `FileUploader` (modal)
  - `CVList`
    - `CVListItem` (opcjonalnie)
  - `LettersList`
    - `LetterListItem` (opcjonalnie)
  - `ToastArea`
  - `ConfirmModal`

## 4. Szczegóły komponentu

### `DashboardPage`
- Opis: Strona ładująca dane (CV i Letters), trzymająca globalny stan widoku, wywołująca API za pomocą hooka `useDashboardData`.
- Główne elementy:
  - Nagłówek z przyciskami `Upload CV` i `Generate Letter` (jeśli dostępne)
  - Sekcja `Twoje CV` z `LimitWarningBanner` i `CVList`
  - Sekcja `Wygenerowane listy` z `LettersList`
- Obsługiwane zdarzenia:
  - `onOpenUploader()` — otwiera `FileUploader`
  - `onDeleteCv(id)` — uruchamia proces usuwania CV
  - `onDeleteLetter(id)` — uruchamia proces usuwania listu
  - `onDownloadLetter(id)` — inicjuje pobranie PDF
- Walidacja:
  - Przed otwarciem uploadera sprawdzić limit CV (max 5). Jeśli >=5, zablokować i pokazać `LimitWarningBanner` oraz toast.
  - Przy usuwaniu: wymusić potwierdzenie w `ConfirmModal`.
- Typy/Propsy:
  - Props: brak (strona pobiera dane samodzielnie)
  - Wymagane typy: `CvViewModel[]`, `LetterViewModel[]`

### `CVList`
- Opis: Lista elementów CV; odzwierciedla odpowiedź z `GET /cvs`.
- Główne elementy:
  - Lista `CVListItem` pokazująca `filename`, `createdAt`, przyciski `Download` i `Delete`.
  - Empty-state (z CTA `Upload CV` oraz krótkim opisem limitu i zaleceniami).
- Obsługiwane zdarzenia:
  - `onDelete(id)` — prosi o potwierdzenie, wyświetla optimistic update
  - `onDownload(id)` — przekierowuje / otwiera pobieranie
- Walidacja:
  - Disable `Upload` jeśli ilość CV >=5
  - Przy usunięciu: obsługa 404/403/500 (toast)
- Propsy:
  - `items: CvViewModel[]`
  - `onDelete: (id: string) => void`
  - `onDownload: (id: string) => void`

### `LettersList`
- Opis: Lista wygenerowanych listów z ich statusami (np. `pending`, `completed`).
- Główne elementy:
  - Lista `LetterListItem` pokazująca `status`, `createdAt`, przyciski `Download` (jeśli completed) i ewentualnie `Delete`.
  - Empty-state z CTA do wygenerowania listu.
- Obsługiwane zdarzenia:
  - `onDownload(id)` — uruchamia `GET /letters/:id/download` (plik PDF)
  - `onDelete(id)` — jeśli backend wspiera delete (zwróć uwagę na kryteria akceptacji)
- Walidacja:
  - Nie wyświetla `Download` gdy status != `completed`
  - Obsługa błędów 403/404/500
- Propsy:
  - `items: LetterViewModel[]`
  - `onDownload: (id: string) => void`
  - `onDelete?: (id: string) => void`

### `FileUploader`
- Opis: Modal z dropzone (lub input file) do uploadu CV (PDF). Po powodzeniu wywołuje odświeżenie listy CV.
- Główne elementy:
  - Dropzone z ograniczeniem do `application/pdf`
  - Przycisk `Upload` i `Cancel`
  - Walidacja rozmiaru pliku 10mb
- Obsługiwane zdarzenia:
  - `onUploadSuccess(newCv)` — zamyka modal i dodaje element do listy (optimistic lub refetch)
  - `onUploadError(err)` — toast z błędem
- Walidacja:
  - Akceptuj tylko PDF
  - Sprawdź limit CV przed startem uploadu
- Propsy:
  - `isOpen: boolean`
  - `onClose: () => void`
  - `onSuccess?: (cv: CvViewModel) => void`

### `LimitWarningBanner`
- Opis: Widoczny gdy liczba CV >= 5 lub w pobliżu limitu (np. ==5). Pokazuje instrukcję usunięcia lub upgrade (jeśli dotyczy).
- Propsy:
  - `count: number`
  - `limit: number` (default 5)

### `ToastArea` / `ConfirmModal`
- `ToastArea`: aria-live region (`role="status"`, `aria-live="polite"`) dla komunikatów sukcesu/błędu.
- `ConfirmModal`: uniwersalny modal potwierdzający akcje destrukcyjne.

## 5. Typy
Poniższe DTO są źródłem prawdy (front-end może mapować snake_case -> camelCase):

- Źródło: `generated-dtos.ts` (backend)

Proponowane ViewModel / typy front-endowe (TypeScript):

```ts
// CvViewModel
export type CvViewModel = {
  id: string;
  filename: string;
  createdAt: string; // ISO8601
};

// LetterViewModel
export type LetterViewModel = {
  id: string;
  html: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string; // ISO8601
  updatedAt?: string; // ISO8601
};
```

Mapowanie: backend zwraca `created_at` — podczas pobierania zamapować na `createdAt`.

## 6. Zarządzanie stanem
- Główny hook: `useDashboardData()` (custom hook)
  - Cel: pobrać `GET /cvs` i `GET /letters` jednocześnie, zwrócić { cvs, letters, isLoading, isError, refetch, deleteCv, downloadLetter }
  - Implementacja: użyć fetch wrappera (np. `useFetch`, `useQuery` z React Query jeśli projekt używa), lub `fetch` + useState + useEffect.
  - Zachowanie:
    - `refetch()` po udanym uploadzie lub usunięciu
    - `deleteCv(id)` wykonuje optimistic update (usuwa lokalnie element), wysyła `DELETE /cvs/:id`; w przypadku błędu rollback i pokaż toast
- Lokalny state w `FileUploader` dla pliku/validacji
- Globalny `ToastContext` lub komponent `ToastArea` do wyświetlania komunikatów

## 7. Integracja API
Wykonane wywołania (typy request/response):

1) `GET /cvs`
- Request: no body, auth header required
- Response 200:
```json
{ "items": [{"id":"uuid","filename":"cv.pdf","created_at":"iso8601"}] }
```
- Frontend: mapować `created_at` -> `createdAt` i przypisać do `CvViewModel`.

2) `DELETE /cvs/:id`
- Request: auth, path param `id`
- Response 204 No Content
- Errors: 404, 403, 500
- Frontend: przed wysłaniem uruchomić `ConfirmModal`; przy 204 zakończyć i refetch lub wykonać optimistic update; przy 500 wyświetlić toast i ewentualnie przywrócić element.

3) `GET /letters`
- Response 200:
```json
{ "items":[{"id":"uuid","html":"<string>","status":"completed","created_at":"iso8601","updated_at":"iso8601"}] }
```
- Mapować pola podobnie.

4) `GET /letters/:id/download`
- Response 200: PDF binary stream (Content-Type: application/pdf)
- Frontend: otworzyć w nowej karcie lub pobrać przez `window.location` albo pobranie blob i `URL.createObjectURL` + link `download` żeby wymusić pobieranie.

Uwagi bezpieczeństwa: upewnić się, że wszystkie żądania zawierają nagłówki auth (token). Jeśli backend zwraca 403, pokazać toast informujący o braku uprawnień.

## 8. Interakcje użytkownika
- Upload CV
  - Użytkownik klika `Upload CV` -> jeśli < limit, otwiera `FileUploader` -> wybiera PDF -> `Upload` wysyła plik -> przy sukcesie pokazuje toast i refetch CV.
  - Gdy >= limit: przycisk `Upload` zablokowany; pokazany `LimitWarningBanner` i tooltip.

- Delete CV
  - Użytkownik klika `Delete` przy CV -> `ConfirmModal` (Treść: "Czy na pewno chcesz usunąć CV: filename?") -> klik `Confirm` -> wykonaj optimistic update i wysyłaj `DELETE /cvs/:id` -> jeśli 204: toast success; jeśli error: rollback + toast error.

- Download Letter
  - Jeśli letter.status === 'completed', przycisk `Download` widoczny. Klik wywołuje `GET /letters/:id/download` i inicjuje pobranie. W trakcie pobierania przycisk jest w stanie loading.

- Empty states
  - Jeśli brak CV: pokaż CTA `Upload CV` i krótką instrukcję.
  - Jeśli brak Letters: CTA do wygenerowania listu (jeśli feature dostępny).

## 9. Warunki i walidacja
- Limit CV: max 5. Sprawdzać przed pokazaniem uploadu i przy finalizacji uploadu.
- Plik musi być PDF: `file.type === 'application/pdf'` i extension `.pdf`.
- Rozmiar pliku: zaproponować 10MB limit — walidować przed wysyłaniem.
- Przy pobraniu PDF: sprawdzać status listu === `completed`.
- Przy usuwaniu: potwierdzenie użytkownika i właściwe mapowanie kodów błędów do komunikatów (403, 404, 500).

## 10. Obsługa błędów
- 403: toast "Brak uprawnień" i (opcjonalnie) przekierowanie do strony błędu.
- 404: toast "Zasób nie istnieje" i refetch listy.
- 500: toast "Wystąpił błąd serwera"; w przypadku DELETE z opisem "Usunięcie pliku w S3 nie powiodło się — spróbuj ponownie lub skontaktuj się z pomocą".
- Sieć: retry/backoff tylko dla idempotentnych requestów; dla operacji destrukcyjnych proponowany jednokrotny retry z rollback.
- UX: wszystkie błędy powinny być raportowane przez `ToastArea` (z aria-live) i logowane w systemie logowania (jeśli dostępne).

## 11. Kroki implementacji (krok po kroku)
1. Stwórz plik planu (ten dokument) i omów z zespołem UX/backend jeśli potrzeba.
2. Utwórz komponent `DashboardPage` w `apps/frontend/src/pages/DashboardPage.tsx` (szkielet + route entry). (TODO `todo-1`)
3. Stwórz `useDashboardData` w `apps/frontend/src/hooks/useDashboardData.ts` z funkcjami `fetchCvs`, `fetchLetters`, `deleteCv`, `downloadLetter`. (TODO `todo-3`)
4. Zaimplementuj UI list: `CVList` + `LettersList` i ich itemy (`CVListItem`, `LetterListItem`). (TODO `todo-2`)
5. Zaimplementuj `FileUploader` z walidacją MIME i rozmiarem; podłącz do `useDashboardData` aby po sukcesie wykonać refetch. (TODO `todo-2`)
6. Dodaj `ConfirmModal` i integrację usuwania z optimistic update i rollbackiem. (TODO `todo-4`)
7. Dodaj `ToastArea` z aria-live region i użyj go do wszystkich komunikatów sukcesu/błędu. (TODO `todo-5`)
8. Przetestuj scenariusze błędów: 403/404/500 i walidację przed uploadem. (TODO `todo-5`)
9. Dodaj testy jednostkowe i integracyjne oraz sprawdź dostępność (a11y). (TODO `todo-6`)
10. Code review i deploy.

---

Plik ten powinien być używany jako specyfika dla frontend developera przy implementacji widoku. Wszystkie miejsca wymagające decyzji (np. limit rozmiaru pliku) zostały oznaczone i warto je potwierdzić z zespołem product/back-end przed implementacją.
