# Lettera 

> AI-powered cover letter generator that transforms your CV and job descriptions into tailored, professional cover letters in seconds.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.x-61dafb.svg)](https://reactjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11.x-e0234e.svg)](https://nestjs.com/)

## 📑 Table of Contents

- [Project Description](#project-description)
- [Tech Stack](#tech-stack)
- [Getting Started Locally](#getting-started-locally)
- [Available Scripts](#available-scripts)
- [Project Scope](#project-scope)
- [Project Status](#project-status)
- [License](#license)

## 📖 Project Description

Lettera is a web application that automates the creation of personalized cover letters. Job seekers spend valuable time manually tailoring cover letters for each position—Lettera eliminates this tedious process by leveraging AI to generate customized, professional cover letters based on your CV and the job posting.

### Key Features (MVP)

- **User Authentication**: Secure registration and login with email/password
- **CV Management**: Upload and manage up to 5 PDF CVs with automatic text extraction
- **Job Description Input**: Paste job descriptions (1,000-10,000 characters) or use structured forms
- **AI-Powered Generation**: Automatic cover letter generation using advanced AI models via Openrouter.ai
- **Edit & Download**: Simple editor for customization and PDF export
- **User Profile**: Dashboard showing uploaded CVs and generated cover letters
- **Usage Limits**: Max 5 CVs and 5 cover letters per user (manual cleanup required)

### Problem We Solve

Candidates waste significant time customizing cover letters for each job application. The process is repetitive, time-consuming, and often leads to generic results. Lettera automates this workflow, providing tailored cover letters in seconds while maintaining professional quality.

## 🛠 Tech Stack

This project is built as a modern **monorepo** using pnpm workspaces.

### Frontend
- **[React 19](https://react.dev/)** - Latest React with improved performance and concurrent features
- **[Vite](https://vitejs.dev/)** - Lightning-fast build tool and dev server
- **[TypeScript 5](https://www.typescriptlang.org/)** - Type safety and enhanced developer experience
- **[Tailwind CSS 4](https://tailwindcss.com/)** - Utility-first CSS framework
- **[shadcn/ui](https://ui.shadcn.com/)** - Beautiful, accessible UI components

### Backend
- **[NestJS](https://nestjs.com/)** - Progressive Node.js framework with TypeScript
- **[Prisma](https://www.prisma.io/)** - Next-generation ORM with type-safe database access
- **[PostgreSQL](https://www.postgresql.org/)** - Robust relational database
- **[Openrouter.ai](https://openrouter.ai/)** - Unified API for multiple AI models (OpenAI, Anthropic, Google, etc.)

### Storage & Infrastructure
- **S3-compatible storage** - DigitalOcean Spaces or AWS S3 for PDF storage
- **Docker** - Application containerization
- **GitHub Actions** - CI/CD pipeline
- **DigitalOcean** - Hosting and deployment

### Development Tools
- **pnpm** - Fast, disk space efficient package manager
- **ESLint** - Code linting and quality enforcement
- **Prettier** - Consistent code formatting

### Testing
- **[Jest](https://jestjs.io/)** - Unit and integration testing framework for backend
- **[Vitest](https://vitest.dev/)** - Fast unit testing framework for frontend (Vite-native)
- **[React Testing Library](https://testing-library.com/react)** - Testing utilities for React components
- **[Supertest](https://github.com/ladjs/supertest)** - HTTP assertion library for API testing
- **[Playwright](https://playwright.dev/)** - End-to-end testing framework for web applications
- **[Cypress](https://www.cypress.io/)** - Alternative E2E testing framework (optional)

## 🚀 Getting Started Locally

### Prerequisites

Ensure you have the following installed:

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **PostgreSQL** >= 14.x

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/lettera.git
   cd lettera
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up PostgreSQL database**
   ```bash
   # Create database
   createdb lettera
   
   # Or using psql
   psql -U postgres
   CREATE DATABASE lettera;
   ```

4. **Configure environment variables**
   
   Create `apps/backend/.env`:
   ```env
   # Database
   DATABASE_URL="postgresql://postgres:example@localhost:5432/lettera?schema=public"
   
   # Application
   PORT=3000
   NODE_ENV=development
   
   # AI Integration (add when ready)
   OPENROUTER_API_KEY=your_api_key_here
   
   # Storage (add when ready)
   AWS_ACCESS_KEY_ID=
   AWS_SECRET_ACCESS_KEY=
   AWS_REGION=
   S3_BUCKET_NAME=
   ```

5. **Run database migrations**
   ```bash
   pnpm prisma:migrate
   ```

6. **Generate Prisma Client**
   ```bash
   pnpm prisma:generate
   ```

7. **Start the development servers**
   ```bash
   pnpm dev
   ```

   The application will be available at:
   - **Frontend**: http://localhost:5173
   - **Backend**: http://localhost:3000

## 📜 Available Scripts

### Development

```bash
pnpm dev              # Start both frontend and backend concurrently
pnpm dev:frontend     # Start frontend only (Vite dev server)
pnpm dev:backend      # Start backend only (NestJS watch mode)
```

### Build

```bash
pnpm build            # Build both frontend and backend for production
pnpm build:frontend   # Build frontend only
pnpm build:backend    # Build backend only
```

### Code Quality

```bash
pnpm lint             # Run ESLint across all workspaces
pnpm format           # Format code with Prettier
pnpm typecheck        # Run TypeScript type checking
```

### Database (Prisma)

```bash
pnpm prisma:generate  # Generate Prisma Client
pnpm prisma:migrate   # Run database migrations
pnpm prisma:studio    # Open Prisma Studio (database GUI)
```

### Testing

```bash
pnpm test             # Run tests (when implemented)
pnpm test:e2e         # Run end-to-end tests (when implemented)
```

## 🎯 Project Scope

### ✅ In Scope (MVP)

- User registration and authentication (email/password)
- Upload and manage PDF CVs (text-based PDFs only, no scanned images)
- Automatic text extraction from CVs using AI
- Job description input via paste or structured form
- AI-powered cover letter generation
- Simple text editor for cover letter customization
- Download cover letters as PDF
- User profile with CV and cover letter history
- Resource limits: 5 CVs and 5 cover letters per user
- English language only
- Logging system for key events (uploads, generations, errors)

### ❌ Out of Scope (MVP)

- Support for CV formats other than PDF
- OCR for scanned/image-based PDFs
- Cover letter export in formats other than PDF
- Import job descriptions from URLs
- Integration with job platforms (LinkedIn, Indeed, etc.)
- Social features or sharing
- Multi-language support
- Version history or undo/redo functionality
- Advanced AI cost management
- Automatic resource cleanup (manual deletion required)
- Mobile native apps

### Key Constraints

- **File Size**: CV uploads limited to a few MB
- **CV Limit**: Maximum 5 CVs per user
- **Cover Letter Limit**: Maximum 5 generated letters per user
- **Job Description Length**: 1,000-10,000 characters
- **Language**: English only for input and output
- **PDF Type**: Text-embedded PDFs only (no scanned documents)

## 📊 Project Status

### ✅ Completed

- [x] Monorepo setup with pnpm workspaces
- [x] Frontend scaffolding (React 19 + Vite + TypeScript)
- [x] Backend scaffolding (NestJS + Prisma)
- [x] Tailwind CSS 4 configuration
- [x] shadcn/ui integration
- [x] Database schema design (User model)
- [x] Development environment setup
- [x] Shared TypeScript and ESLint configurations
- [x] User authentication implementation (JWT/sessions)
- [x] CV upload and validation logic
- [x] PDF text extraction integration
- [x] Openrouter.ai integration for AI generation
- [x] S3 storage integration for file management
- [x] Cover letter generation pipeline
- [x] Text editor component
- [x] PDF generation for download
- [x] User profile and dashboard
- [x] Error handling and user feedback

### 🚧 In Progress / To Do

- [ ] Logging system implementation
- [ ] Deployment setup (Docker + DigitalOcean)
- [ ] CI/CD pipeline (GitHub Actions)

### Current Version

**v0.1.0** - Initial setup and architecture

## 📁 Project Structure

```
lettera/
├── .ai/                      # Project documentation
│   ├── prd.md               # Product Requirements Document
│   ├── tech-stack.md        # Technology decisions
│   ├── mono-repo.md         # Monorepo setup guide
│   └── project-desc.md      # Project description
├── apps/
│   ├── backend/             # NestJS API application
│   │   ├── prisma/          # Database schema and migrations
│   │   ├── src/             # Source code
│   │   └── test/            # Tests
│   └── frontend/            # React application
│       ├── src/
│       │   ├── components/  # React components
│       │   ├── lib/         # Utilities
│       │   └── App.tsx      # Main application
│       └── public/          # Static assets
├── packages/
│   ├── eslint-config/       # Shared ESLint configuration
│   └── tsconfig/            # Shared TypeScript configuration
├── pnpm-workspace.yaml      # pnpm workspace configuration
└── package.json             # Root package configuration
```

## 🤝 Contributing

This is a monorepo managed with pnpm workspaces. When contributing:

1. Run all commands from the **root directory**
2. Use `pnpm --filter <package-name>` for package-specific commands
3. Keep shared configurations in `packages/`
4. Follow the existing code style (enforced by ESLint/Prettier)
5. Write tests for new features
6. Update documentation as needed

### Adding shadcn/ui Components

```bash
cd apps/frontend
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add input
npx shadcn@latest add form
```

## 📚 Additional Documentation

- **[Product Requirements](/.ai/prd.md)** - Detailed feature specifications and user stories
- **[Tech Stack Decisions](/.ai/tech-stack.md)** - Technology choices and rationale
- **[Monorepo Setup](/.ai/mono-repo.md)** - Development environment guide

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Built with ❤️ using modern web technologies**
