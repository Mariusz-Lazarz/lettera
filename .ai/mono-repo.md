🚀 Monorepo Setup — React + NestJS + Prisma + Tailwind + shadcn/ui

Ten dokument opisuje proces ręcznej inicjalizacji monorepo z wykorzystaniem pnpm workspaces, React 19, NestJS, Prisma, Tailwind CSS 4, oraz shadcn/ui.
Założenie: znajdujesz się już w głównym folderze projektu (np. X/), który zawiera foldery .ai i .cursor.

📁 1. Struktura projektu

Docelowa struktura katalogów:

lettera/
├── .ai/
├── .cursor/
├── apps/
│   ├── backend/      # NestJS + Prisma + PostgreSQL
│   └── frontend/     # React 19 + Tailwind + shadcn/ui
├── packages/
│   ├── eslint-config/ # wspólna konfiguracja lintów
│   └── tsconfig/      # wspólna konfiguracja TypeScript
├── pnpm-workspace.yaml
└── package.json

🧩 2. Inicjalizacja pnpm workspace

Zainicjalizuj główny projekt (package.json).

Dodaj plik pnpm-workspace.yaml, który wskaże katalogi aplikacji i wspólnych paczek (apps/* i packages/*).

Dzięki pnpm workspace wszystkie zależności i skrypty będą współdzielone między aplikacjami.

⚙️ 3. Wspólne konfiguracje (packages/)
🔸 ESLint + Prettier

Utwórz pakiet packages/eslint-config.

Zainstaluj i skonfiguruj:

eslint

prettier

@typescript-eslint/parser i @typescript-eslint/eslint-plugin

eslint-plugin-react

eslint-plugin-prettier

eslint-config-prettier

Skonfiguruj index.js eksportujący wspólne reguły ESLint dla całego monorepo.

🔸 TypeScript

Utwórz packages/tsconfig z plikiem base.json, który definiuje podstawowe opcje kompilatora TypeScript.

W każdym projekcie (backend, frontend) rozszerzaj tę bazową konfigurację (extends: "../../packages/tsconfig/base.json").

🧱 4. Frontend (React 19 + Tailwind + shadcn/ui)

Utwórz aplikację React z TypeScript (np. przy użyciu Vite).

Zainstaluj i skonfiguruj Tailwind CSS:

Utwórz pliki konfiguracyjne (tailwind.config.js, postcss.config.js).

Dodaj ścieżki do komponentów w content.

Zainstaluj shadcn/ui:

Zainicjalizuj (shadcn init).

Wybierz framework React, style Tailwind, typy TypeScript.

Dodaj przykładowe komponenty (button, input, card).

Dodaj wspólny ESLint config oraz integrację z Prettierem.

🔙 5. Backend (NestJS + Prisma + PostgreSQL)

Utwórz aplikację NestJS (apps/backend).

Zainstaluj i skonfiguruj Prisma:

Zainicjalizuj (npx prisma init).

Ustaw połączenie z bazą danych w .env (DATABASE_URL).

Zdefiniuj modele (np. User) w schema.prisma.

Uruchom migracje (prisma migrate dev).

Dodaj wspólną konfigurację ESLint i Prettiera.

Skonfiguruj uruchamianie w trybie deweloperskim (pnpm start:dev).

🧼 6. Skrypty i linting w głównym package.json

Dodaj do głównego package.json skrypty ułatwiające pracę:

{
  "scripts": {
    "dev:frontend": "pnpm --filter frontend dev",
    "dev:backend": "pnpm --filter backend start:dev",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write ."
  }
}


pnpm dev:frontend — uruchamia Reacta

pnpm dev:backend — uruchamia NestJS

pnpm lint — sprawdza błędy lintingu

pnpm format — formatuje kod w całym monorepo

🧠 7. Dobre praktyki

Wszystkie wspólne ustawienia (lint, tsconfig, prettier) trzymaj w packages/.

Używaj pnpm zamiast npm/yarn — oszczędza miejsce i wspiera linkowanie pakietów.

W frontend możesz dodać vite.config.ts z aliasami (@/components, @/lib itd.).

W backend używaj PrismaService i ConfigModule do obsługi środowisk (.env).

🚀 8. Uruchamianie projektu

Frontend:

pnpm dev:frontend


Backend:

pnpm dev:backend


Po uruchomieniu oba serwisy działają niezależnie, ale współdzielą konfiguracje i zależności dzięki monorepo.

✅ Podsumowanie

Po wykonaniu wszystkich kroków masz gotowe środowisko:

React 19 + Tailwind + shadcn/ui (frontend)

NestJS + Prisma + PostgreSQL (backend)

pnpm workspaces do zarządzania zależnościami

ESLint + Prettier + TypeScript jako wspólne narzędzia jakości kodu
