# Testy jednostkowe - Pages

## Uruchamianie testów

```bash
# Uruchom wszystkie testy
pnpm test

# Tryb watch (automatyczne uruchamianie po zmianach)
pnpm test:watch

# Interfejs graficzny
pnpm test:ui
```

## Struktura

- `LoginPage.spec.tsx` - testy strony logowania
- `RegisterPage.spec.tsx` - testy strony rejestracji

## Pokrycie

Testy sprawdzają:
- Renderowanie formularzy
- Walidację pól (email, hasło, potwierdzenie hasła)
- Obsługę błędów API (401, 409, 429, błędy sieciowe)
- Nawigację między stronami
- Integrację z AuthContext

