Frontend
--------

- **React 19**: komponenty interaktywne (UI aplikacji — upload, edytor, profil). React zapewni responsywność i modularność interfejsu.
- **TypeScript 5**: silne typowanie dla lepszej jakości kodu i wydajniejszego rozwoju.
- **Tailwind CSS 4**: szybkie stylowanie i spójny design bez pisania dużej ilości CSS.
- **shadcn/ui**: gotowe komponenty UI (dialogi, formularze, listy) przyspieszające budowę interfejsu.

Backend
-------

- **NestJS**: backend w TypeScript, strukturalny framework ułatwiający budowę API, testowalność i rozszerzalność.
- **Postgres**: relacyjna baza danych do przechowywania użytkowników, metadanych CV i wygenerowanych listów.
- **Prisma**: ORM / migracje i typy dla bezpiecznej pracy z bazą danych.
- **S3-compatible storage (DigitalOcean Spaces / AWS S3)**: przechowywanie plików PDF (CV i wygenerowane PDF), z signed URLs do bezpiecznego pobierania.

AI i OCR
-------

- **Openrouter.ai**: warstwa pośrednia do komunikacji z modelami (OpenAI, Anthropic, Google i inne). Umożliwia centralne zarządzanie kluczami i limitami kosztów.

Infrastruktura i DevOps
----------------------

- **Docker**: konteneryzacja aplikacji backend i workerów.
- **GitHub Actions**: CI/CD pipeline do testów, budowy obrazów i deployu.
- **Hosting — DigitalOcean**: uruchamianie aplikacji w kontenerach / dropletach lub App Platform oraz użycie DigitalOcean Spaces jako S3.


