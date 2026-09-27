# Personal Finance Tracker

A modular monolith personal finance tracker with Telegram Bot, REST API, and Next.js Dashboard.

## Architecture

- **Backend**: NestJS + PostgreSQL + Prisma + Redis + BullMQ
- **Frontend**: Next.js 14 + Tailwind CSS + TanStack Query
- **AI**: Abstracted AI providers (Gemini, OpenAI, Claude)
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

- Node.js 20+
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

# Seed default categories (after creating a user)
# pnpm --filter @finance-tracker/backend run seed:categories

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

## API Documentation

Swagger UI available at `http://localhost:3000/api/docs` when backend is running.

## Telegram Bot

Set `TELEGRAM_BOT_TOKEN` in `.env` and start the backend to run the bot.

## Deployment

```bash
# Build production images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Deploy
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Learning Goals

This project covers:
- Next.js 14 App Router
- React 18 + TypeScript
- Tailwind CSS
- TanStack Query
- REST API design
- NestJS modular architecture
- Clean Architecture / DDD basics
- PostgreSQL + Prisma ORM
- Redis caching & BullMQ queues
- JWT authentication
- AI integration with provider abstraction
- OCR / Vision AI for receipts
- Telegram Bot API
- Docker & Docker Compose
- CI/CD pipelines
- Testing strategies
- Observability (logging, monitoring)