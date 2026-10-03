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

### Credential exposure fix (2026-09-29)
`GET /api/users/:id` was unauthenticated and returned the raw Prisma row, so
**anyone could read any account's bcrypt `passwordHash`**. `POST /api/users`
additionally accepted a caller-supplied `passwordHash` in the body, and
`PATCH /api/users/:id` let anyone rename any account. Fixed in three layers so
a new endpoint cannot reintroduce the leak:

- [x] `UsersService` selects public fields only (`id`, `email`, `name`,
      `telegramId`) on every method that can return to a caller. The strip
      lives in the data layer, not in each controller
- [x] `findCredentialsByEmail` is the single method that returns
      `passwordHash`, it is used only by `bcrypt.compare` in `AuthService`, and
      the name makes an accidental call site obvious. `emailExists` replaced the
      old public `findByEmail` for the registration conflict check
- [x] `users.controller.ts` is guarded at the class level with
      `JwtAuthGuard`. `POST /api/users` is gone — registration hashes in
      `AuthService`, so `POST /api/auth/register` is the only public way to
      create an account. The lookup-by-Telegram route is gone too; it was an
      oracle mapping a Telegram ID to an email address
- [x] `GET /api/users/:id` and `PATCH /api/users/:id` became
      `GET/PATCH /api/users/me`, always scoped to `req.user.id`, so an id in
      the path or body cannot be used to touch another account. `telegramId` is
      not accepted there; link/unlink own it
- [x] Bot token redacted from logged error messages — it is embedded in every
      Telegram API request URL, so an error carrying that URL would have
      written the credential to container logs
- [x] Verified live with 43 checks: all 26 guarded routes return 401 without a
      token, the 4 removed routes return 404, no response body on any endpoint
      contains a password field, a tampered JWT is rejected, and login gives an
      identical 401 for an unknown email and a wrong password

`.env` is gitignored and untracked; only `.env.example` (placeholders) is
committed.

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
- [x] Commands: `/wallets` (plain list), `/balance` (balances + total, the
      previous `/wallets` output), `/transaction <date>`, `/whoami`, `/start`,
      `/help`
- [x] `/transaction <date or period>` — accepts `today`, `yesterday`, `hari
      ini`, `kemarin`, `week` / `this week` / `minggu ini`, `month` / `this
      month` / `bulan ini`, `year` / `this year` / `tahun ini`, plus
      `YYYY-MM-DD` and `DD-MM-YYYY` / `DD/MM/YYYY`. Weeks start Monday.
      Day/range boundaries are computed in UTC so a period never shifts with
      the server timezone, and impossible dates (`31-02-2026`) are rejected
      instead of rolling over into March. Renders In / Out / Net totals,
      income marked `+` by `category.type === "INCOME"` to match the
      dashboard.
- [x] Display is capped at 25 rows and descriptions at 59 chars to stay under
      Telegram's 4096-character message limit; In / Out / Net are still
      computed across all fetched rows (query limit 500), so a truncated list
      still shows correct totals. Hidden rows are counted in the output.
- [x] Each rendered row carries its own date (`formatRowDate`, `DD MMM YYYY` in
      UTC) so a week/month/year list is readable without opening the dashboard;
      the header label keeps the resolved range (week range shows the year on
      both ends when it crosses a year boundary).

### `/category` command ✅ (2026-09-29)
Two forms: `/category` lists the categories themselves, `/category <date or
period>` groups spending by category. Both reuse `parseUserDate`, so every date
and period keyword that works for `/transaction` works here.

```
/category
Your categories:

Expense

1. Belanja - 1x, Rp 120.000
2. Makan - 30x, Rp 750.000
3. Tagihan - 2x, Rp 1.449.000
4. Transport - 8x, Rp 400.000
5. Unused - never used

Income

1. Gaji - 1x, Rp 6.000.000
```

```
/category month
Spending by category - September 2026

1. Makan      Rp 750.000   44%  (30x)
2. Tagihan    Rp 450.000   26%  (1x)
3. Transport  Rp 400.000   23%  (8x)
4. Belanja    Rp 120.000    7%  (1x)

Out: Rp 1.720.000
In: Rp 6.000.000
Net: Rp 4.280.000
```

- [x] `TransactionsService.sumByCategory` — Prisma `groupBy` on `categoryId` with
      `_sum.amount` and `_count`, then category names resolved in a second
      query, because Prisma cannot group by a relation field. Aggregating in the
      database means the result is not limited by any display row cap.
- [x] Period matching reuses the `/transaction` UTC boundaries; verified that a
      prior-month transaction is excluded from `/category month`
- [x] Ranking is expenses only. Income is summarised in the footer instead of
      being ranked alongside expenses, which would otherwise understate every
      expense share
- [x] Shares are rounded cumulatively via `formatShares` so the visible
      percentages always add to exactly 100. Rounding each row independently
      made a 16-row breakdown come to 101%
- [x] Zero-total period renders `0%` rather than dividing by zero (previously
      printed `NaN%`)
- [x] Capped at 15 rows plus an aggregated `N more` row, so a 200-category year
      still fits inside 4096 characters
- [x] Unused categories show `never used` instead of `Rp 0` in the list
- [x] `CategoriesModule` added to `TelegramModule`; `/categories` accepted as an
      alias; `CATEGORY_USAGE` shown when the date cannot be parsed

### `/wallet add` and `/category add` ✅ (2026-09-29)

```
$ /wallet add BCA bank 5.000.000
Added wallet "BCA".

Type: bank
Balance: Rp 5.000.000

Use it now: /transaction today
```

```
$ /category add Gaji income
Added income category "Gaji".

It shows up in /category and in the dashboard category list.
```

- [x] `parseRupiahAmount` — `.` and `,` are thousands separators, never
      decimals, matching the dashboard. `5.000.000`, `5000000`, `5,000,000` and
      `rp 5.000.000` are all 5 million. Grouping is validated, so `1.5` and
      `1.2.3` are rejected instead of being read as 1.5 rupiah. A single decimal
      is allowed only with a multiplier, where it is unambiguous: `1.5jt` is
      1.5 million. Shorthands `k`, `rb`, `jt`, `m`
- [x] Type and amount are peeled off the **end** of the argument list, never
      from the middle. Scanning every token was harmful: `Bank Central Asia
      bank` lost its leading "Bank" to the type slot and became "Central
      Asia". The consequence is that a *leading* type is treated as part of the
      name, so the type goes last
- [x] Type aliases deliberately exclude brand and everyday nouns — `tunai`,
      `gopay`, `gaji`, `ovo`, `dana`, `salary` are far more often a *name* than
      a type request, and treating them as types silently mangled names. Kept
      aliases: cash, bank, e-wallet, credit card, other, expense, income,
      pengeluaran, pemasukan, masuk, keluar
- [x] A token in double quotes is never interpreted, so a wallet genuinely
      named "Cash" or one ending in a number is still addable
- [x] Defaults: wallet `CASH` / balance 0, category `EXPENSE`
- [x] Duplicates rejected case-insensitively via a new `findByName` on both
      services. `Wallet` has no unique constraint on name (unlike `Category`,
      which is `@@unique([userId, name])`), so the check is explicit
- [x] Name capped at 40 characters; an amount on `/category add` is a specific
      error rather than a silent name; a stray `type`/`jenis` gets a targeted
      message. `/wallet frobnicate` is rejected by name
- [x] `/wallet` with no subcommand lists wallets, same as `/wallets`
- [x] Verified: 56 parser checks and 10 balance checks pass, plus an end-to-end
      run confirming the rows land in Postgres with `currency=IDR` and the
      correct type, and that a wallet created from Telegram is immediately
      usable by `/balance` and `/category`

### Wallet balance sign bug — found and fixed (2026-09-29)
`TransactionsService.create` updated the wallet balance with an unconditional
`increment: amount`. `Transaction` stores a positive amount and the direction
lives on `Category.type`, so **every recorded expense increased the wallet
balance**. `update` and `delete` had the matching defect: `update` always
re-decremented the old amount, and `delete` always decremented.

- [x] `signedAmount(categoryType, amount)` returns `+amount` for `INCOME` and
      `-amount` otherwise. An unknown category is treated as an expense, the
      safer default: it never inflates a balance
- [x] `create` looks up the category type and applies the signed amount.
      `update` resolves both the old and new category, undoes the old effect,
      then applies the new one — which also makes moving a transaction between
      wallets move the balance correctly. `delete` undoes the effect
- [x] Covered by 10 checks: expense reduces, income increases, editing an amount
      adjusts by the delta, re-categorising expense→income flips the sign
      (a 2× swing), deleting restores, and moving between wallets moves the
      balance
- [x] **Existing data repaired with the owner's approval.** Each stored balance
      was reduced by twice that wallet's expense total, which restores the
      correct value while preserving the original opening balance:
      BCA 4.010.000 → 3.990.000, CIMB 30.030.000 → 29.970.000, BCA 100.000
      unchanged. Verified afterwards by the implied opening balances, which came
      out as exact round numbers (100.000 / 4.000.000 / 20.000.000)

### Authentication: Telegram ID as identity ✅ (2026-09-28)
Identity is the Telegram user ID, matched against `User.telegramId`. The link
is created **from the dashboard**, never from the chat — no password ever
travels through Telegram.

- [x] `POST /api/users/telegram/link` — JWT-guarded, always scopes to
      `req.user.id` (a `userId` in the body is ignored, so no escalation)
- [x] `DELETE /api/users/telegram/link` — unlink
- [x] `UsersService.linkTelegram` — validates `/^\d{5,15}$/`, trims, rejects an
      ID already owned by another user (409), idempotent for the same account
- [x] Declared before `@Get(":id")` so the literal path always wins the match
- [x] Bot commands reduced to `/wallets`, `/balance`, `/whoami`, `/help`
- [x] Removed `/login` (password over Telegram) and `/logout`; the dashboard
      owns the link lifecycle
- [x] Removed the now-unused `AuthService.verifyCredentials` extraction
- [x] Unlinked users are shown their own Telegram ID by the bot so they know
      what to paste into the dashboard banner
- [x] Dashboard banner (`TelegramLinkBanner`) — amber with an input when
      unlinked, slim green row with Unlink when linked; linking is optional
- [x] `GET /api/telegram/bot` (public) returns the bot's username so the
      banner names it instead of saying "search for the bot"; result cached
      in `TelegramService`, failures are not cached so they retry
- [x] `telegramId` exposed on `User` in the dashboard auth context, plus
      `refreshUser()`
- [x] `TelegramModule` now imports `TransactionsModule` for `/transaction`

- [ ] Transaction creation from text (Phase 3 remainder)

**Flow to use it:** message the bot `/wallets` → it replies with your numeric
Telegram ID → paste that into the dashboard banner → `/wallets` works.
- [x] Private chats only — ignored in groups
- [x] IDR formatting consistent with the dashboard (`Rp 12.500.000`)
- [x] Graceful no-op when `TELEGRAM_BOT_TOKEN` is empty (logs a warning)
- [x] Empty-wallet, unlinked, unknown-command, and negative-balance cases
      verified against the real database
- [ ] `GET /api/users/telegram/:telegramId` is still unauthenticated (see
      Open Issues)

**To enable:** put the BotFather token in `.env` as `TELEGRAM_BOT_TOKEN` and
restart the backend. Long polling means only one instance may poll per token.

---

## Phase 4: AI Text Parsing ✅ (2026-09-30)

Natural language → structured transaction, with confirmation before saving.

```
$ lunch 50k bca
Please confirm:
-Rp 50.000 — Makanan (BCA)
Date: 2026-09-30
Reply "yes" to save, anything else to cancel.

$ yes
Saved. ✅
```

- [x] **AI abstraction layer** (`AiModule`, `AiService`, `AiProvider` interface) —
      provider-agnostic, currently implements OpenAI-compatible (works with 9router,
      OpenAI, Groq, local vLLM/Ollama). Configured via `AI_PROVIDER`, `AI_API_KEY`,
      `AI_BASE_URL`, `AI_MODEL`, `AI_TIMEOUT_MS`
- [x] **Function-calling schema** (`TRANSACTION_SCHEMA`) forces the LLM to return
      exactly: `amount`, `wallet`, `category`, optional `description`, `date`, `type`
      (INCOME/EXPESE). No free-text leakage.
- [x] **Fuzzy match** against the user's actual wallets/categories — case-insensitive,
      partial match ("bca" → "BCA", "bank" → "BCA"), graceful error listing
      available options when no match
- [x] **Confirmation flow** — pending confirmations stored in-memory (chat-scoped),
      "yes"/"ya"/"y"/"ok" commits, anything else cancels. No transaction is created
      without explicit confirmation.
- [x] **Fallback when AI unavailable** — if `AI_API_KEY` is empty, the bot replies
      with "Unknown command. Send /help..." instead of silently failing.
- [x] **Defaults**: `type` = EXPENSE unless user says "masuk"/"income"/"gaji"/"pemasukan";
      `date` = today if omitted; date parsing accepts "today", "yesterday",
      "hari ini", "kemarin", ISO `YYYY-MM-DD`.
- [x] **9router ready** — `.env.example` targets `http://localhost:20128/v1`,
      model `oc/nemotron-3-ultra-free`. Just add the API key and restart.
- [x] **No data leakage** — only wallet/category *names* (no balances, no IDs) are
      sent to the LLM. The schema constrains the output; malformed responses are
      rejected.

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
- [x] Reports page (by category, by wallet, period filter:
      week / month / year / all time, PDF export via jsPDF)
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

## Phase 8.6: Reports PDF Export + Periods ✅ COMPLETED (2026-10-03)

- [x] Report periods: **week / month / year / all time**
      (week starts Monday; "all time" omits `startDate`/`endDate`,
      which the backend `/api/transactions/summary` already treats
      as no date filter)
- [x] **Export PDF** button on the reports page — client-side
      generation with `jspdf` + `jspdf-autotable` (v5 API
      `autoTable(doc, options)`); downloads
      `financial-report-<period>.pdf` with headline figures
      (income / expense / net / savings rate), a By Category table
      with totals, and a By Wallet table
- [x] New `apps/dashboard/src/lib/pdf.ts` (`exportReportPdf`);
      IDR formatted as `Rp 1.234.567` (Latin-1 safe for jsPDF's
      built-in fonts)
- [x] Verified: `tsc --noEmit` clean, reports page compiles
      (951 modules), generated PDF is valid (`%PDF-` header,
      4965 bytes for a sample), summary API returns correct data
      for all-time / year / filtered ranges

### Docker fix: dashboard volume mount
`docker-compose.yml` mounted the whole `./apps/dashboard` package
directory over `/app/apps/dashboard`. The host's
`apps/dashboard/node_modules` contains symlinks created inside a
container days ago that point to `/mnt/host/d/...`, which does not
exist in new containers — so *nothing* resolved (not even `next`),
and `next dev` failed with "required package(s) installed" while
trying (and failing, `ERR_PNPM_ADDING_TO_ROOT`) to reinstall
`@types/react`/`@types/node`. Fix: mount only `src/` +
`package.json` + `tsconfig.json` (same pattern the backend uses),
so the image's working `node_modules` stays visible. Source still
hot-reloads; config-file edits now require an image rebuild.

---

## Phase 8.7: Telegram PDF Report Export ✅ COMPLETED (2026-10-03)

- [x] `/report [week|month|year|all]` (alias `/export`) —
      bot generates a PDF report and sends it as a document.
      Default period: month. Indonesian aliases accepted
      (minggu, bulan, tahun, semua)
- [x] `apps/backend/src/reports/report-period.ts` — period
      parsing + UTC range computation (week starts Monday,
      end-of-day inclusive), matching the bot's existing
      UTC date handling
- [x] `apps/backend/src/reports/report-pdf.ts` — server-side
      PDF generation with `jspdf` + `jspdf-autotable` (v5
      API). Same layout as the dashboard export: headline
      figures (income / expense / net / savings rate),
      By Category table with totals, By Wallet table
- [x] `TelegramService.sendDocument` — multipart/form-data
      upload via Bot API `sendDocument` (file bytes cannot
      go through the JSON `call` helper)
- [x] Chat action `upload_document` sent while generating;
      errors are logged (token redacted via `describe`) and
      reported as a friendly message
- [x] PDF caption includes period label, date range, income,
      expense, net, and savings rate for quick preview
      without opening the PDF
- [x] HELP_TEXT updated with the new command and periods
- [x] Verified: `tsc --noEmit` clean, jspdf installed in the
      backend image, generated PDF valid (`%PDF-` header),
      test PDF with detailed caption delivered to the linked
      Telegram chat via `sendDocument` (`ok: true`)

---

## Open Issues

- [ ] **`apps/backend/dist/main.js` was a stale webpack bundle** shadowing all
      backend code. A container restart was running Sep 27 code, so backend
      fixes on disk were not live. Fixed by deleting `dist/` and rebuilding;
      consider adding `dist/` cleanup to the Dockerfile or a `prebuild` script,
      since `nest-cli.json` is absent and nothing guards against a mixed build.
- [ ] **`/login` sent a password through Telegram** — resolved. The bot no
      longer accepts credentials; the link is created from the dashboard and
      identity is the Telegram user ID.
- [ ] **`users.controller.ts` was only partly authenticated** — resolved
      2026-09-29. `POST /api/users`, `GET /api/users/:id`, `GET
      /api/users/telegram/:telegramId` and `PATCH /api/users/:id` were
      unauthenticated and returned raw Prisma rows, so `GET /api/users/:id`
      exposed the bcrypt `passwordHash` to anyone who guessed a user id.
      `POST /api/users` also accepted `passwordHash` from the request body.
      See Phase 1 for what replaced them.
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

- [ ] **Rate-limit `POST /api/auth/login`** — unlimited attempts today, so
      passwords can be brute-forced. `@nestjs/throttler` or a Redis counter
      keyed on IP + email. Redis is already running
- [ ] **Move the dashboard JWT out of `localStorage`** — it sits in
      `apps/dashboard/src/lib/auth.tsx` and `lib/api.ts`, so any XSS on the
      dashboard reads it. An httpOnly cookie removes that, at the cost of
      cookie-based CORS and a token extractor in `JwtStrategy`. A deliberate
      choice, not an oversight
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

1. **Immediate**: Rate-limit `POST /api/auth/login`, then move the dashboard
   JWT to an httpOnly cookie
2. **Then**: Guard the backend build so a stale `dist/` cannot shadow source
3. **Then**: Link a Telegram account end-to-end with a real bot token
4. **Then**: Decide the fate of the `currency` column (drop vs. enforce IDR)
5. **Then**: Auto-seed default wallets/categories on registration
6. **Then**: Architecture refactor (Phase 2)
7. **Parallel**: Finish Phase 8 (edit transaction page, settings page) and
   the rest of Phase 3 (text transaction parsing)

---

*Last Updated: 2026-10-03 (Telegram /report PDF export with week/month/year/all periods; dashboard PDF export)*