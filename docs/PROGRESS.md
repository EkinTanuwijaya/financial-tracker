# Finance Tracker - Development Progress

## Project Overview
**Personal Finance Tracker** - Modular monolith with Telegram Bot, REST API, and Next.js Dashboard.

**Stack**: NestJS + Next.js 14 + PostgreSQL + Prisma + Redis + BullMQ + Turborepo

---

## Phase 0: Project Setup ✅ COMPLETED (2026-09-26)

### Infrastructure
- [x] Monorepo structure with pnpm + Turborepo
- [x] Docker Compose (PostgreSQL 16, Redis 7)
- [x] Environment configuration (.env.example)
- [x] Prisma schema with all models

### Backend (NestJS)
- [x] NestJS 10 project setup with TypeScript
- [x] Modular architecture (auth, users, wallets, categories, transactions, receipts)
- [x] Prisma ORM with PostgreSQL
- [x] JWT Authentication (register, login, me)
- [x] Swagger API documentation at `/api/docs`
- [x] ESLint + Prettier configuration
- [x] Global validation pipes

### Database Schema
- [x] **User** - telegramId, email, name, passwordHash
- [x] **Wallet** - name, type, currency, balance
- [x] **Category** - name, type (EXPENSE/INCOME)
- [x] **Transaction** - amount, currency, description, date, source (TEXT/RECEIPT/MANUAL)
- [x] **Receipt** - fileUrl, processingStatus, rawText, extractedData

### Frontend (Next.js 14)
- [x] Next.js 14 with App Router
- [x] Tailwind CSS configured
- [x] TanStack Query v5 setup
- [x] TypeScript + ESLint + Prettier
- [x] Basic landing page
- [x] Authentication pages (login/register)
- [x] JWT auth context + protected layout
- [x] Dashboard overview with summary cards
- [x] Transactions page (list, create, delete, filter)
- [x] Wallets page (CRUD)
- [x] Categories page (CRUD + seed defaults)
- [x] Reports page (by category, by wallet, period filter)

### Shared Packages
- [x] `@finance-tracker/shared` - Types, DTOs, Enums, Validation
- [x] `@finance-tracker/prisma` - Shared Prisma schema

---

## Phase 1: Core Transaction (MOSTLY COMPLETE — auto-seed remaining)

### Backend
- [x] Transaction CRUD with wallet balance updates
- [x] Transaction filtering (by wallet, category, date range)
- [x] Monthly/weekly/daily summaries (GET /api/transactions/summary)
- [x] Categories CRUD + seed defaults
- [x] Wallets CRUD
- [ ] Create default wallets for new users (auto-seed)
- [ ] Seed default categories on user creation (auto-seed)

### API Endpoints
- [x] POST /api/transactions
- [x] GET /api/transactions
- [x] GET /api/transactions/:id
- [x] PATCH /api/transactions/:id
- [x] DELETE /api/transactions/:id
- [x] GET /api/transactions/summary
- [x] POST /api/categories/seed

### Frontend
- [x] Transaction list page
- [x] Create transaction form
- [x] Dashboard with summary cards
- [x] Wallet management page
- [x] Category management page
- [x] Reports page

---

## Phase 2: Architecture Refactor (PLANNED)

- [ ] Repository pattern implementation
- [ ] Domain/Application/Infrastructure layer separation
- [ ] DTOs for all modules
- [ ] Interface-based dependencies

---

## Phase 3: Telegram Bot (IN PROGRESS - /wallets ✅ 2026-09-28)

### `/wallets` command ✅
- [x] `telegram` module registered in `AppModule` (no controller — service only)
- [x] `TelegramService` — Bot API client over global `fetch`, no new
      dependencies
- [x] Long polling with exponential backoff (1s → 30s cap); per-update error
      isolation so one bad message cannot kill the loop
- [x] Commands: `/wallets`, `/balance` (alias), `/start`, `/help`
- [x] Telegram login: `/login <email> <password>`, `/logout`, `/whoami`
      - reuses `AuthService.verifyCredentials` (extracted from `login` so no
        throwaway JWT is minted)
      - writes the link through a dedicated `UsersService.setTelegramId` so
        the unauthenticated `PATCH /api/users/:id` cannot hijack a link
      - 5 failed attempts per chat per 10 minutes
      - password message is deleted after success; if Telegram refuses, the
        bot says so instead of claiming it deleted it
      - refuses to overwrite an account already linked to another Telegram ID
- [x] Identity via `User.telegramId`; unlinked users are told to use `/login`
- [x] Private chats only — ignored in groups
- [x] IDR formatting consistent with the dashboard (`Rp 12.500.000`)
- [x] Graceful no-op when `TELEGRAM_BOT_TOKEN` is empty (logs a warning)
- [x] Empty-wallet, unlinked, unknown-command, and negative-balance cases
      verified against the real database
- [ ] `POST /api/users` and `GET /api/users/telegram/:telegramId` are still
      unauthenticated (see Open Issues) — needs guarding before linking is
      safe over the public API
- [ ] Transaction creation from text (Phase 3 remainder)

**To enable:** put the BotFather token in `.env` as `TELEGRAM_BOT_TOKEN` and
restart the backend. Long polling means only one instance may poll per token.

---

## Phase 4: AI Text Parsing (PLANNED)

- [ ] AI abstraction layer (Gemini/OpenAI/Claude)
- [ ] Structured output parsing
- [ ] Validation & confirmation

---

## Phase 5: Receipt AI (PLANNED)

- [ ] Image download from Telegram
- [ ] Vision AI / OCR integration
- [ ] ReceiptExtractionResult structure
- [ ] User confirmation flow

---

## Phase 6: Redis & Queue (PLANNED)

- [ ] Redis caching
- [ ] BullMQ for background jobs
- [ ] Receipt processing queue
- [ ] Worker for AI processing
- [ ] Idempotency keys

---

## Phase 7: Reporting (PLANNED)

- [ ] Daily/Weekly/Monthly summaries
- [ ] Category breakdown
- [ ] Wallet balance tracking
- [ ] Telegram report commands

---

## Phase 8: Web Dashboard (IN PROGRESS - Core pages ✅)

- [x] Authentication pages (login/register)
- [x] Dashboard overview with summary cards
- [x] Transactions page (list, create, delete, filter)
- [x] Wallets page (CRUD)
- [x] Categories page (CRUD + seed defaults)
- [x] Reports page (by category, by wallet, period filter)
- [x] Charts/visualizations — custom SVG/CSS concentration bar + spend
      breakdown (no Recharts usage; see Open Issues)
- [ ] Edit transaction page
- [ ] Settings page

---

## Phase 8.5: Dashboard Insight Refactor ✅ COMPLETED (2026-09-27)

### Insight-first UI
Replaced button-heavy layouts with analytics-led views.

- [x] Dashboard insight cards: net worth, monthly income/spending, savings
      rate, average daily spend, top spending categories, wallet
      distribution, recent activity
- [x] Compact row actions + summary analytics on transactions, wallets,
      categories, reports
- [x] Shared helpers centralized in `src/lib/utils.ts` (`formatCurrency`,
      `formatNumberForInput`, `parseAmountInput`, `walletSlices`,
      `savingsRate`, `topCategories`, `chartColor`)
- [x] Stable wallet-name color mapping so chart and list swatches agree
- [x] Tailwind configured to scan `src/lib/**` (palette classes were being
      purged from dynamic class names)
- [x] Structured `ApiError` surfaced in transactions UI

### Currency: single-currency (IDR)
Multi-currency support was built, then reverted in favor of hardcoded IDR.

- [x] `CURRENCY_CODE` / `CURRENCY_SYMBOL` / `CURRENCY_LABEL` constants
- [x] `formatCurrency` fixed to `id-ID` / IDR, 0 decimals
- [x] Currency `<select>` replaced with a read-only IDR field
- [x] Balance input accepts digits only, keeps one leading `-` (credit cards
      can start overdrawn)
- [x] Verified round-trip stability for `100.000`, `1.500.500`, `9.999.999`,
      `abc`, empty, and negative inputs

**Two bugs fixed by the revert** (present in the multi-currency version):
`100.000` parsed as `100` instead of `100000`, and blur formatting mutated
values (`1500` → displayed `1.501` → re-parsed as `1501`). IDR has no minor
unit, so there is no decimal separator to disambiguate.

### Backend security
- [x] Fixed `req.user.sub` → `req.user.id` in `auth.controller.ts` (current-user
      lookup)
- [x] Added `JwtAuthGuard` + user scoping to wallets, categories,
      transactions, receipts

### Quality gates
- [x] `tsc --noEmit` clean
- [x] `next lint` — 0 errors (prettier violations fixed across 9 files)
- [x] All dashboard routes return 200
- [x] API round-trip verified (created + read back an IDR wallet, then
      cleaned up the test data)

---

## Open Issues

- [ ] **`apps/backend/dist/main.js` was a stale webpack bundle** shadowing all
      backend code. A container restart was running Sep 27 code, so backend
      fixes on disk were not live. Fixed by deleting `dist/` and rebuilding;
      consider adding `dist/` cleanup to the Dockerfile or a `prebuild` script,
      since `nest-cli.json` is absent and nothing guards against a mixed build.
- [ ] **`/login` sends a password through Telegram** — acceptable for a local
      single-user app (the bot deletes the message afterwards) but it does put
      the credential in Telegram's servers. Before multi-user use, switch to a
      one-time code generated from the dashboard.
- [ ] **`users.controller.ts` is completely unauthenticated** and leaks data —
      verified live: unauthenticated `GET /api/users/:id` returns the full user
      record **including the bcrypt `passwordHash`**. `POST /api/users` also
      accepts `passwordHash` directly, letting an attacker mint an account with
      a password they know. `PATCH /api/users/:id` can modify any user. Add
      `JwtAuthGuard` and strip `passwordHash` from all responses.
- [ ] **`currency` column is not pinned server-side** — `Wallet.currency` and
      `Transaction.currency` still exist with a `"IDR"` default and the API
      still accepts the field. The UI always sends `IDR`, so nothing is broken,
      but a direct API call can write a non-IDR value. Either drop the column
      or enforce IDR in the DTO/service.
- [ ] **Recharts is an unused dependency** — declared in the dashboard
      `package.json` but never imported; all visualizations are custom
      SVG/CSS. Remove it or adopt it.
- [ ] **`apps/backend/src/reports` is an empty directory** — the reports page
      aggregates client-side from `/api/transactions/summary`. Remove the dead
      folder or implement the server-side module.
- [ ] **Auto-seed** default wallets and categories on user creation (still
      open from Phase 1).
- [ ] **Line endings** — no `.gitattributes`; `core.autocrlf=true` plus
      Prettier's default `endOfLine: "lf"` cause working-copy churn on edited
      files. Add `* text=auto eol=lf` and remove the warning.
- [ ] **Local Prisma client can go stale** — `apps/backend` typecheck failed
      with implicit `any` until `npx prisma generate` was run. Run it after any
      schema change.

---

## Phase 9: Testing (PLANNED)

- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Mock AI provider
- [ ] Mock Telegram API
- [ ] Dashboard component tests

---

## Phase 10: Production Engineering (PLANNED)

- [ ] Multi-stage Dockerfiles
- [ ] CI/CD pipeline
- [ ] Logging & monitoring
- [ ] Health checks
- [ ] Graceful shutdown
- [ ] Database migrations
- [ ] Backup strategy
- [ ] Rate limiting
- [ ] Security hardening

---

## Commands Reference

```bash
# Development
pnpm dev                    # Start all services
pnpm --filter @finance-tracker/backend run start:dev
pnpm --filter @finance-tracker/dashboard run dev

# Database
pnpm db:generate            # Generate Prisma client
pnpm db:push                # Push schema to DB
pnpm db:migrate             # Run migrations
pnpm db:studio              # Open Prisma Studio

# Build & Lint
pnpm build                  # Build all packages
pnpm lint                   # Lint all packages

# Docker
docker-compose up -d        # Start infrastructure
docker-compose down         # Stop infrastructure
```

---

## Architecture Notes

### Module Boundaries
```
src/
├── auth/          # Authentication (JWT, strategies, guards)
├── users/         # User management
├── wallets/       # Wallet CRUD + balance updates
├── categories/    # Category CRUD + defaults
├── transactions/  # Transaction CRUD + summaries
├── receipts/      # Receipt processing
├── ai/            # AI abstraction (future)
├── telegram/      # Telegram bot (future)
├── jobs/          # Background jobs (future)
├── reports/       # Reporting (future)
├── dashboard/     # REST API for web dashboard
└── common/        # Shared (Prisma, filters, pipes)
```

### Key Design Decisions
1. **Modular Monolith** - Not microservices yet
2. **AI Abstraction** - Provider-agnostic interface
3. **Human-in-the-loop** - All AI results require user confirmation
4. **Idempotency** - Telegram updates processed once
5. **Event-driven** - Future: domain events for balance updates, notifications
6. **Single currency (IDR)** - Multi-currency was implemented and reverted.
   Amounts are whole rupiah with `.` as the thousands separator, which makes
   input parsing unambiguous. Every stored value is IDR; no conversion rates.
7. **Insight-first UI** - Pages lead with analytics; actions stay compact and
   inline rather than occupying dedicated button panels.

---

## Next Steps

1. **Immediate**: Secure `users.controller.ts` — add `JwtAuthGuard`, strip
   `passwordHash` from responses, remove `passwordHash` from the create DTO
2. **Then**: Guard the backend build so a stale `dist/` cannot shadow source
3. **Then**: Link a Telegram account end-to-end with a real bot token
4. **Then**: Decide the fate of the `currency` column (drop vs. enforce IDR)
5. **Then**: Auto-seed default wallets/categories on registration
6. **Then**: Architecture refactor (Phase 2)
7. **Parallel**: Finish Phase 8 (edit transaction page, settings page) and
   the rest of Phase 3 (text transaction parsing)

---

*Last Updated: 2026-09-28 (Telegram /wallets command; stale dist build fixed; users controller found unauthenticated)*