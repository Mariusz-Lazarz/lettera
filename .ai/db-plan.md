# Plan schematu bazy danych dla Lettera

Poniżej znajduje się kompletny projekt schematu PostgreSQL przygotowany do zaimplementowania migracji. Zawiera definicje tabel, ograniczenia, indeksy, zasady RLS i przykładowe fragmenty SQL pomocne przy transakcyjnym egzekwowaniu limitów per‑user.

---

1. Lista tabel z kolumnami, typami danych i ograniczeniami

```sql
-- Wymagane rozszerzenia
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()

-- Rola/systemowe konto (przykład) używane przy migracjach/administracji
-- CREATE ROLE app_migrations NOINHERIT;

-- Table: users
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: cvs
CREATE TABLE IF NOT EXISTS cvs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  s3_key text NOT NULL,
  filename text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cvs_filename_length CHECK (char_length(filename) <= 255)
);

-- Table: letters
CREATE TABLE IF NOT EXISTS letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  html text NOT NULL,
  pdf_s3_key text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT letters_html_max_length CHECK (char_length(html) <= 200000)
);
```

Uwagi:
- `users.password_hash` przechowuje hash (np. argon2 lub bcrypt) — decyzja o algorytmie i parametrach poza schematem DB.
- Używamy `gen_random_uuid()` (pgcrypto) do generowania UUID po stronie DB.
- Zastosowano `ON DELETE CASCADE` dla FK, aby usunięcie użytkownika automatycznie usuwało zasoby (rekordy) powiązane - należy zsynchronizować z usuwaniem obiektów w S3 (kompensacja/retry).

---

2. Relacje między tabelami

- `users` 1 — N `cvs` (jedno-do-wielu)
- `users` 1 — N `letters` (jedno-do-wielu)

Brak tabeli łączącej (no many-to-many) w aktualnym modelu.

---

3. Indeksy

```sql
-- Indeks dla szybkiego wyszukiwania użytkownika po email
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Indeksy na user_id i composite na paginację (najnowsze pierwsze)
CREATE INDEX IF NOT EXISTS idx_cvs_user_id ON cvs (user_id);
CREATE INDEX IF NOT EXISTS idx_cvs_user_created_at_desc ON cvs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_letters_user_id ON letters (user_id);
CREATE INDEX IF NOT EXISTS idx_letters_user_created_at_desc ON letters (user_id, created_at DESC);

-- Opcjonalnie: small covering index if często pobieramy tylko id+created_at
-- CREATE INDEX IF NOT EXISTS idx_cvs_user_id_cover ON cvs (user_id, created_at);
```

Uwagi do indeksów:
- Indeksy composite `user_id, created_at DESC` przyspieszają listowanie najnowszych rekordów per user (paginacja).
- Dla przewidywanego małego wolumenu per‑user (max 5/5) indeksy są lekkie, ale przy dużej liczbie użytkowników nadal przydatne.

---

4. Zasady PostgreSQL (RLS) i uprawnienia

Założenie: aplikacja ustawia kontekst sesji DB (np. po udanej walidacji JWT) przy każdym połączeniu:

```sql
-- Przykład: w aplikacji po uwierzytelnieniu
-- SELECT set_config('app.current_user', '<user_uuid>', true);
```

RLS: ograniczamy dostęp do wierszy w tabelach `cvs` i `letters` tak, aby widoczne były tylko wiersze należące do `current_user`.

```sql
-- Włączamy RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvs ENABLE ROW LEVEL SECURITY;
ALTER TABLE letters ENABLE ROW LEVEL SECURITY;

-- Users: dostęp do własnego wiersza (zwykle aplikacja nie będzie czytać password_hash)
CREATE POLICY users_per_owner ON users
  USING (id = current_setting('app.current_user', true)::uuid)
  WITH CHECK (id = current_setting('app.current_user', true)::uuid);

-- CVs: owner-only access
CREATE POLICY cvs_per_owner ON cvs
  USING (user_id = current_setting('app.current_user', true)::uuid)
  WITH CHECK (user_id = current_setting('app.current_user', true)::uuid);

-- Letters: owner-only access
CREATE POLICY letters_per_owner ON letters
  USING (user_id = current_setting('app.current_user', true)::uuid)
  WITH CHECK (user_id = current_setting('app.current_user', true)::uuid);
```

Uwaga do implementacji RLS i pooling:
- Aplikacja MUSI ustawić `app.current_user` per‑connection (najlepiej per‑request) zanim wykona zapytania. W środowisku z connection pooling (pgbouncer) wybrać strategię bezpiecznego kontekstowania (np. krótki czas życia połączeń lub proxy, które ustawia config per request) — to kwestia implementacyjna aplikacji.

Uprawnienia kolumnowe (ograniczenie dostępu do `password_hash`):

```sql
-- Revokujemy dostęp do kolumny password_hash od PUBLIC
REVOKE SELECT (password_hash) ON users FROM PUBLIC;
-- Dajmy dostęp wyłącznie roli migracji/administracji (przykład)
-- GRANT SELECT (password_hash) ON users TO app_migrations;
```

---

5. Transakcyjne egzekwowanie limitów per‑user (max 5 CV, max 5 letters)

Przykładowy wzorzec z wykorzystaniem advisory lock i krótkiej transakcji:

```sql
-- Transakcja w aplikacji (pseudokod SQL):
BEGIN;
  -- zablokuj użytkownika aby zapobiec race conditions
  SELECT pg_advisory_xact_lock(hashtext(current_setting('app.current_user', true))::bigint);

  -- sprawdź liczbę CV
  SELECT count(*) FROM cvs WHERE user_id = current_setting('app.current_user', true)::uuid;
  -- jeśli >= 5 -> ROLLBACK i zwróć błąd

  -- wstaw rekord CV (rekord musi istnieć w DB; upload do S3 powinien być zsynchronizowany z rollback/cleanup po stronie aplikacji)
  INSERT INTO cvs (user_id, s3_key, filename) VALUES (current_setting('app.current_user', true)::uuid, $1, $2);
COMMIT;
```

Alternatywa z `SELECT ... FOR UPDATE` na wierszu użytkownika:

```sql
BEGIN;
  -- pobierz wiersz użytkownika i zablokuj go
  SELECT id FROM users WHERE id = current_setting('app.current_user', true)::uuid FOR UPDATE;
  -- sprawdź count(*) z cvs
  -- insert jeśli ok
COMMIT;
```

Uwagi:
- Krótkie transakcje są kluczowe. Najbezpieczniejsza opcja to `pg_advisory_xact_lock` nad hashem user_id, żeby minimalnie oddziaływać na inne transakcje.
- Aplikacja powinna uploadować plik do S3 poza transakcją DB, lub uploadować przed commit i na wypadek rollback usuwać plik (kompensacja) — albo uploadować najpierw i dopiero potem tworzyć rekord DB w krótkiej transakcji.

---

6. Dodatkowe ograniczenia i CHECK

- `cvs.filename` ograniczono do 255 znaków (CHECK). Można rozszerzyć limit w razie potrzeby.
- `letters.html` ma check max length 200k znaków (przyjęta wartość przykładowa — dostosować według wymagań edytora/HTML). Jeśli chcesz, użyć `text` bez CHECK i kontrolować wielkość po stronie aplikacji.

---

7. Operacje związane z S3 i spójność

- DB przechowuje jedynie `s3_key` (referencja). Nie przechowujemy extracted_text ani treści pliku w DB.
- Usuwanie rekordu DB powinno być skoordynowane z usunięciem obiektu w S3. Wzorce:
  - Synchronous delete: aplikacja usuwa obiekt S3, potem usuwa rekord DB (jeśli usunięcie S3 zawiedzie, retry lub queue job)
  - Compensating job: usuń rekord DB, a asynchroniczny worker czyści S3 (wymaga mechanizmu retry i monitoringu)
- Z uwagi na brak transakcji cross‑system, rekomendowane: usuń najpierw w S3, po potwierdzeniu usuń rekord DB w krótkiej transakcji. Przy błędach S3 retry i alerty.

---

8. Backup / Restore i migracje

- Backup DB (pg_dump/pg_basebackup) musi współgrać z polityką backupu obiektów S3 — restore DB bez plików S3 będzie wymagać procedury przywrócenia plików.
- Przy migracjach używać ról administracyjnych (np. `app_migrations`) które mają dostęp do `password_hash` gdy to konieczne.

---

9. Przykładowe skrypty pomocnicze (SQL)

```sql
-- Przywrócenie aktualizacji updated_at na każdej modyfikacji (opcjonalne)
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_letters_set_updated_at
BEFORE UPDATE ON letters
FOR EACH ROW
EXECUTE FUNCTION trigger_set_updated_at();
```

---

10. Podsumowanie decyzji projektowych (krótko)

- PK: `uuid` generowane w DB przez `gen_random_uuid()` (pgcrypto).
- Minimalny model: `users`, `cvs`, `letters`.
- RLS: owner-only; aplikacja ustawia `app.current_user` per request.
- Limity per‑user (max 5) egzekwowane transakcyjnie przy pomocy advisory locks lub FOR UPDATE.
- `s3_key` jedynie referencja do plików w S3; brak przechowywania extracted_text w DB.
- ON DELETE CASCADE dla FK do users — konieczna synchronizacja usuwania obiektów S3.

Plik utworzony: `.ai/db-plan.md` — użyj tego planu jako podstawy do tworzenia migracji SQL (np. z użyciem narzędzia migracyjnego preferowanego przez projekt).
