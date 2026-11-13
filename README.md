# Personal Finance Tracker

A modular monolith personal finance tracker with Telegram Bot, REST API, and Next.js Dashboard.

## Architecture

- **Backend**: NestJS 11 + PostgreSQL + Prisma + Redis sessions
- **Frontend**: Next.js 15 + React 19 + Tailwind CSS
- **AI**: Gemini and OpenAI-compatible providers (OpenAI, Groq, 9router)
- **Monorepo**: pnpm + Turborepo

## Project Structure

```
finance-tracker/
├── apps/
│   ├── backend/          # NestJS API + Telegram Bot
│   └── dashboard/        # Next.js Web Dashboard
├── packages/
│   ├── prisma/           # Shared Prisma schema
│   └── shared/           # Shared types, DTOs, validation
├── docker/
└── docs/
```

## Getting Started

### Prerequisites

- Node.js 22+ (Docker images use Node.js 22)
- pnpm 9+
- Docker & Docker Compose
- PostgreSQL 16
- Redis 7

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start infrastructure
docker-compose up -d postgres redis

# Generate Prisma client
pnpm db:generate

# Push database schema
pnpm db:push

# Each new account automatically receives default expense and income categories.

# Start development servers
pnpm dev
```

### Development

```bash
# Start all services
pnpm dev

# Backend only
pnpm --filter @finance-tracker/backend run start:dev

# Dashboard only
pnpm --filter @finance-tracker/dashboard run dev

# Run tests
pnpm test

# Lint
pnpm lint

# Build
pnpm build
```

### Database Commands

```bash
# Generate Prisma client
pnpm db:generate

# Push schema changes
pnpm db:push

# Run migrations
pnpm db:migrate

# Open Prisma Studio
pnpm db:studio
```

## Environment Variables

See `.env.example` for all required variables.

### Google sign-in

1. In [Google Auth Platform](https://console.cloud.google.com/auth/clients), create an OAuth client with application type **Web application**. Configure the consent screen and test users if the app is in testing mode.
2. Add `http://localhost:3000` to **Authorized JavaScript origins**. Add the exact HTTPS dashboard origin for production. This integration uses the Google Identity Services popup; no redirect URI or client secret is needed.
3. Set both `GOOGLE_CLIENT_ID` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in the root `.env` to that web client ID. Docker Compose and root `pnpm dev` load this file for both services. When starting the dashboard directly with a package-filtered command, use `apps/dashboard/.env.local` or export its public variables in the shell.
4. Add the nullable, unique `googleId` field with `pnpm --filter @finance-tracker/backend exec prisma db execute --schema=prisma/schema.prisma --file=../../packages/prisma/add-google-auth.sql`, then run `pnpm --filter @finance-tracker/backend run db:generate`. The SQL is additive and safe to rerun; do not reset the database. With Docker, run `docker compose exec -T -w /app/apps/backend backend pnpm exec prisma db execute --schema=../../packages/prisma/schema.prisma --file=../../packages/prisma/add-google-auth.sql`, then `docker compose up -d --build --no-deps backend dashboard`.
5. Restart both services (rebuild the dashboard for production), visit `/login`, and choose **Sign in with Google**. First sign-in creates an account with default categories. Returning users are identified by Google's stable account ID.

The backend verifies the Google token before issuing the app's normal JWT. Existing email/password accounts must use their original sign-in method; matching email alone never links accounts because password registration does not verify email ownership. Password sign-in remains available. Without a client ID, email sign-in stays available.

## API Documentation

### Dashboard sessions

Login, registration, and Google sign-in set an HttpOnly `finance_session` cookie. Redis enforces a two-hour idle timeout; dashboard interactions renew the cookie and server session at most once per minute. Passive API reads do not renew it. The dashboard returns to login after two hours without activity, including after a sleeping tab wakes. Activity and logout synchronize across tabs.

Tokens are no longer stored in localStorage or returned by login endpoints. Existing sessions require a fresh login after this update. Logout revokes the Redis session. Production cookies use `Secure`; serve the dashboard and API over HTTPS on the same site and configure the exact dashboard origin in `CORS_ORIGIN`. Redis must be available. The existing JWT lifetime remains an absolute session limit in addition to idle expiry.

Swagger UI available at `http://localhost:3001/api/docs` when backend is running.

## Telegram Bot

Set `TELEGRAM_BOT_TOKEN` in `.env` and start the backend to run the bot.

Send `/report week`, `/report month`, `/report year`, or `/report all` for a PDF. Telegram and dashboard exports use the same report template, including cash-flow charts, spending insights, category and wallet tables, pagination, and Jakarta generation time.

Send `/link` to the bot in a private chat, then paste its one-time pairing code into the dashboard's Telegram settings. Codes expire after ten minutes. A numeric Telegram ID alone cannot link an account. Existing links continue to work. Transaction confirmations also expire after ten minutes and require the Telegram account to remain linked.

## Deployment

See [VPS deployment and CI/CD](docs/deployment.md) for Ubuntu/Docker setup, GitHub Actions secrets, IP-only HTTPS, backups, and rollback. Production uses `docker-compose.prod.yml` by itself; do not merge it with the development file.

## Learning Goals

This project covers:
- Next.js 15 App Router
- React 19 + TypeScript
- Tailwind CSS
- REST API design
- NestJS modular architecture
- Clean Architecture / DDD basics
- PostgreSQL + Prisma ORM
- Redis sessions and expiring Telegram pairing codes
- JWT authentication
- AI integration with provider abstraction
- OCR / Vision AI for receipts
- Telegram Bot API
- Docker & Docker Compose
- CI/CD pipelines
- Testing strategies
- Observability (logging, monitoring)
