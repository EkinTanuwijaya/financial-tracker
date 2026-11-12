# Project review — 7 November 2026

Reviewed dashboard flows, API controllers and services, sessions, Telegram, AI/OCR, Prisma schemas, workspace/build configuration, and production dependencies. Existing work in the checkout was preserved.

## Fixes

| Area | Problem | Result |
| --- | --- | --- |
| API validation | Inline TypeScript body types did not activate runtime validation. Extra fields could reach Prisma updates. | Validated DTOs reject unknown fields, invalid money, dates, pagination, and unsupported values. Profile updates explicitly select writable fields. |
| Account isolation | Transactions could use another user's wallet/category. Receipt status and linking endpoints lacked owner checks. | Referenced records must belong to the authenticated user. Missing or foreign records return 404. |
| Money consistency | Concurrent edits read stale transaction amounts outside the database transaction. | Serializable writes retry conflicts. Decimal arithmetic preserves exact balance adjustments. Same-wallet edits use one balance update. |
| Category changes | Changing a used category from expense to income changed reports without correcting balances. | Used category types cannot change; the API explains that a new category is needed. |
| Reports | Summaries loaded every transaction and full related records into memory. Special names could collide with object prototypes. | PostgreSQL aggregates amounts; summary dictionaries safely support arbitrary category/wallet names. Default category seeding uses one bulk insert. |
| Transactions UI | Edit links led to a missing route. Lists stopped at 50 rows. | Create/edit share one form. Pagination exposes later records, uses stable sorting, and labels page totals accurately. Failed filters clear stale rows. |
| Sessions | Delayed requests could clear a newer login or restore a logged-out profile. | Authentication revisions reject stale results. Login waits for pending logout, and abandoned restoration effects are cancelled. |
| Telegram pairing | A numeric ID alone was accepted as proof of access to a Telegram account. | `/link` issues a random, single-use pairing code backed by Redis with a ten-minute expiry. Existing links remain valid. |
| Telegram confirmations | Receipts were saved without linking their transaction, confirmations survived unlinking, and confirmation signs could differ from the actual category. | Receipt linking is atomic with transaction creation. Confirmations expire, recheck account linking, and show the category's actual direction. |
| Telegram operation | Thinking-message IDs were read from the wrong response envelope; empty names matched the first wallet; polling could delay shutdown. | Correct response handling, empty-name rejection, bounded requests, pending-confirmation cleanup, and interruptible polling. |
| Logging | Download URLs contained the bot token; OCR logs included receipt text. | Credential-bearing URLs and raw receipt/extraction contents are omitted from those logs. |
| AI | OpenAI-compatible requests retried invalid credentials and stopped their timeout before reading the body. | Timeouts cover response reading; non-retryable responses fail immediately. Extracted fields are validated. Groq uses its endpoint; 9router requires an explicit URL. |
| Dates | UTC conversion could choose yesterday for Jakarta users. | Calendar dates use Jakarta where bot/default transaction dates are generated. Invalid dates are rejected; report day counts no longer overcount. |
| Build/workspace | Shared Prisma generation lacked its client dependency; root development skipped the backend and did not load root environment values; test commands were incomplete. Nested pnpm workspaces maintained conflicting lockfiles. | Shared client wiring, backend development task, root environment loading, executable test configuration, and a single root workspace/lockfile. Docker contexts omit browser test artifacts. |
| Dependencies | The production audit reported 5 critical, 30 high, 28 moderate and 7 low advisories. | Patched Next.js 15, React 19, NestJS 11 and Zod 4; compatible transitive patches; unused runtime packages removed. Final production audit reports zero advisories. Docker uses Node.js 22. |

## Verification

- Backend, dashboard and shared TypeScript checks.
- Root `pnpm test`: 80 backend tests, 18 dashboard tests and 3 shared-schema tests. Three Python OCR tests also passed (104 total).
- Backend production compilation and normal dashboard production build, including lint and type checks. Existing `any` and unused-variable lint warnings remain non-blocking.
- Both Docker images built successfully.
- Live two-account API checks: overposting, cross-account references, concurrent money edits, receipt ownership, pagination, summaries, pairing-code replay, email normalization and session revocation.
- Existing transaction ownership consistency query found zero cross-account references.
- Browser checks: registration, cookie-authenticated dashboard, transaction editing, resulting wallet balance, pagination past 50 records and last-page controls.
- PaddleOCR smoke test: two receipt reads preserved the amount/date; invalid images were rejected.
- Temporary test accounts, transactions, wallets, categories, pairing codes and sessions were removed.

## Compatibility and limits

Use Node.js 22+ for the supported local environment. Telegram linking now needs a `/link` pairing code instead of a numeric ID. Inputs previously accepted without validation may now return 400; referenced records cannot be deleted while transactions use them.

This was a code review and regression exercise, not a formal penetration test or production load test. Live Google consent, real Telegram pairing messages and paid AI-provider responses were not exercised. Those external interactions were tested with mocks or local integration fixtures.
