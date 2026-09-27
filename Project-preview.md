# Personal Finance Tracker — Project Plan

## 1. Project Overview

**Project Name:** Personal Finance Tracker
**Project Type:** Backend + AI + Telegram Bot + Web Dashboard (Next.js)
**Architecture:** Modular Monolith
**Primary Interface:** Telegram Bot

Project ini adalah aplikasi pencatatan keuangan pribadi yang memungkinkan pengguna mencatat transaksi melalui Telegram.

Pengguna dapat mengirim:

1. Text

   * `45000 makan siang`
   * `150000 bensin`
   * `25000 kopi`

2. Foto struk

   * User mengirim foto struk.
   * Sistem membaca informasi dari gambar menggunakan Vision AI / OCR.
   * Sistem mengubah hasil pembacaan menjadi data transaksi terstruktur.
   * User melakukan konfirmasi sebelum transaksi disimpan.

Tujuan utama project bukan hanya membuat aplikasi yang berjalan, tetapi juga digunakan sebagai **project pembelajaran backend dan software architecture**.

---

# 2. Project Goals

## Functional Goals

Sistem harus dapat:

* Membuat user melalui Telegram.
* Mencatat transaksi melalui text.
* Menerima foto struk.
* Mengekstrak informasi transaksi dari foto.
* Mengategorikan transaksi.
* Meminta konfirmasi user.
* Menyimpan transaksi ke database.
* Menampilkan riwayat transaksi.
* Menampilkan ringkasan pengeluaran.
* Mendukung beberapa wallet/account.
* Menangani pesan Telegram secara idempotent.
* Memproses pekerjaan berat menggunakan background job.

## Learning Goals

Project ini digunakan untuk mempelajari:

* Next.js
* React
* Tailwind CSS
* TanStack Query
* REST API
* Backend architecture
* Modular monolith
* Clean Architecture
* Domain-driven design dasar
* Database design
* PostgreSQL
* Prisma ORM
* Authentication
* Redis
* Background jobs
* Queue
* Event-driven architecture
* AI integration
* OCR
* Telegram Bot API
* API design
* Testing
* Docker
* CI/CD
* Logging
* Monitoring
* Scalability

---

# 3. Initial Architecture

Kita akan mulai dengan **Modular Monolith**, bukan microservices.

```text
                     ┌──────────────────┐         ┌──────────────────┐
                     │     Telegram     │         │      Web App     │
                     │      Client      │         │   (Next.js)      │
                     └────────┬─────────┘         └────────┬─────────┘
                              │                            │
                              ▼                            ▼
                     ┌──────────────────┐         ┌──────────────────┐
                     │   Telegram Bot   │         │   REST API       │
                     │      Module      │         │   (NestJS)       │
                     └────────┬─────────┘         └────────┬─────────┘
                              │                            │
                              └───────────────┬────────────┘
                                              ▼
                                     ┌──────────────────┐
                                     │   Application    │
                                     │      Layer       │
                                     └────────┬─────────┘
                                              │
                              ┌───────────────┼───────────────┐
                              ▼               ▼               ▼
                       ┌────────────┐  ┌────────────┐  ┌────────────┐
                       │ Transaction│  │  Receipt   │  │    User    │
                       │   Module   │  │   Module   │  │   Module   │
                       └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
                             │               │               │
                             └───────────────┼───────────────┘
                                             ▼
                                     ┌──────────────────┐
                                     │    PostgreSQL    │
                                     └──────────────────┘

                               ┌────────────────────────────┐
                               │          Redis             │
                               │ Cache + Queue + Idempotency│
                               └─────────────┬──────────────┘
                                             │
                                             ▼
                                     ┌──────────────────┐
                                     │    Background    │
                                     │      Worker      │
                                     └────────┬─────────┘
                                              │
                                              ▼
                                     ┌──────────────────┐
                                     │   Vision AI /    │
                                     │       OCR        │
                                     └──────────────────┘
```

---

# 4. Technology Stack

## Frontend (Dashboard)

* Next.js 14+ (App Router)
* TypeScript
* Tailwind CSS
* TanStack Query (React Query)
* Chart.js / Recharts (visualizations)

## Backend

* Node.js
* TypeScript
* NestJS

## Database

* PostgreSQL
* Prisma ORM

## Cache / Queue

* Redis
* BullMQ

## AI

AI provider harus dibuat melalui abstraction layer agar provider dapat diganti.

Contoh:

```text
AIService
    │
    ├── GeminiAdapter
    ├── OpenAIAdapter
    └── ClaudeAdapter
```

Jangan membuat business logic bergantung langsung kepada Gemini/OpenAI/Claude.

---

## Telegram

Telegram Bot API digunakan sebagai interface utama aplikasi.

Telegram hanya bertanggung jawab sebagai:

```text
Input / Output Interface
```

Business logic tidak boleh bergantung langsung kepada Telegram.

Contoh:

```text
Telegram Message
       ↓
Telegram Adapter
       ↓
Application Command
       ↓
Transaction Use Case
```

Dengan begitu, suatu hari kita dapat menambahkan:

```text
Telegram
Web App
Mobile App
REST API
```

tanpa mengubah business logic utama.

---

# 5. High-Level Modules

Project akan dibagi menjadi beberapa module.

```text
src/
│
├── auth/
├── users/
├── wallets/
├── categories/
├── transactions/
├── receipts/
├── ai/
├── telegram/
├── notifications/
├── jobs/
├── reports/
├── dashboard/        # REST API controllers for web dashboard
└── common/
```

## Module Responsibilities

### Users

Mengelola:

* User
* Telegram identity
* User preferences

---

### Wallets

Mengelola sumber uang.

Contoh:

```text
Cash
BCA
Mandiri
Gopay
OVO
Credit Card
```

---

### Categories

Contoh:

```text
Food
Transport
Shopping
Entertainment
Bills
Health
Salary
Other
```

---

### Transactions

Core domain dari aplikasi.

Contoh transaksi:

```text
Amount: 45000
Category: Food
Description: Lunch
Wallet: BCA
Date: 2026-09-26
```

---

### Receipts

Mengelola:

* Receipt image
* Receipt metadata
* OCR result
* AI extraction result
* Processing status
* User confirmation

---

### AI

Bertanggung jawab terhadap integrasi AI.

AI module tidak boleh langsung mengubah database transaction.

AI hanya menghasilkan structured result.

Contoh:

```json
{
  "merchant": "ABC Restaurant",
  "date": "2026-09-26",
  "total": 125000,
  "currency": "IDR",
  "items": [
    {
      "name": "Nasi Goreng",
      "quantity": 1,
      "price": 35000
    }
  ]
}
```

---

### Telegram

Bertanggung jawab terhadap:

* menerima update
* membaca message
* membaca photo
* mengirim response
* confirmation button
* command handling

Telegram module tidak mengandung business rules transaksi.

---

### Jobs

Mengelola pekerjaan asynchronous.

Contoh:

```text
Receipt uploaded
      ↓
Create Job
      ↓
Queue
      ↓
Worker
      ↓
AI/OCR
      ↓
Save result
      ↓
Notify user
```

---

### Reports

Menghasilkan:

* Daily spending
* Weekly spending
* Monthly spending
* Spending by category
* Spending by wallet

---

### Dashboard (Web API)

Bertanggung jawab terhadap:
* REST API endpoints untuk web dashboard
* Authentication (JWT email/password)
* Aggregated data untuk charts/visualizations
* User management (web-specific)

Web dashboard tidak mengandung business logic transaksi.
Hanya meng-expose data melalui REST API yang sudah ada.

---

# 6. Database Design

Initial database:

```text
users
  │
  ├── wallets
  │
  └── transactions
          │
          └── categories

users
  │
  └── receipts
```

## Users

```text
users
----------------
id
telegram_id
name
created_at
updated_at
```

## Wallets

```text
wallets
----------------
id
user_id
name
type
currency
balance
created_at
updated_at
```

## Categories

```text
categories
----------------
id
user_id
name
type
created_at
```

## Transactions

```text
transactions
----------------
id
user_id
wallet_id
category_id
amount
currency
description
transaction_date
source
created_at
updated_at
```

Possible `source`:

```text
TEXT
RECEIPT
MANUAL
```

## Receipts

```text
receipts
----------------
id
user_id
transaction_id
file_url
processing_status
raw_text
extracted_data
created_at
updated_at
```

Possible processing status:

```text
PENDING
PROCESSING
COMPLETED
FAILED
WAITING_CONFIRMATION
```

---

# 7. Receipt Processing Flow

## Version 1 — Simple

Untuk MVP, kita mulai dengan Vision AI langsung.

```text
User
 │
 │ Send receipt photo
 ▼
Telegram
 │
 ▼
Backend
 │
 ▼
Download Image
 │
 ▼
Vision AI
 │
 ▼
Structured JSON
 │
 ▼
Validation
 │
 ▼
Telegram Confirmation
 │
 ├── Confirm
 │      ↓
 │   Save Transaction
 │
 └── Cancel
        ↓
     Discard
```

Contoh:

User mengirim foto struk.

AI menghasilkan:

```json
{
  "merchant": "Indomaret",
  "date": "2026-09-26",
  "total": 87000,
  "category": "Shopping"
}
```

Bot membalas:

```text
Saya menemukan transaksi:

Merchant: Indomaret
Tanggal: 26 Sep 2026
Total: Rp87.000
Kategori: Shopping

Simpan transaksi?
[✅ Confirm] [❌ Cancel]
```

---

# 8. Receipt Processing — Production Version

Setelah MVP berjalan, architecture dapat dikembangkan menjadi:

```text
Telegram
   │
   ▼
Telegram Module
   │
   ▼
Receipt Module
   │
   ▼
Create Receipt
   │
   ▼
Queue
   │
   ▼
Receipt Worker
   │
   ├── OCR
   │
   └── Vision AI
          │
          ▼
    Structured Result
          │
          ▼
       Validator
          │
          ▼
 Waiting Confirmation
          │
          ▼
      Transaction
```

Keuntungan:

* Telegram tidak menunggu AI terlalu lama.
* AI processing dapat di-retry.
* Worker dapat ditambah ketika workload meningkat.
* Error dapat ditangani secara terpisah.

---

# 9. AI Abstraction

Jangan membuat kode seperti:

```typescript
const result = await gemini.generateContent(...)
```

langsung di Transaction Service.

Gunakan abstraction:

```typescript
interface ReceiptAIService {
  extractReceipt(
    image: Buffer
  ): Promise<ReceiptExtractionResult>;
}
```

Kemudian:

```text
ReceiptAIService
       │
       ├── GeminiReceiptAI
       ├── OpenAIReceiptAI
       └── ClaudeReceiptAI
```

Business logic hanya mengetahui:

```typescript
ReceiptAIService
```

bukan provider tertentu.

---

# 10. ReceiptExtractionResult

Gunakan struktur yang terdefinisi.

```typescript
interface ReceiptExtractionResult {
  merchant: string | null;
  date: string | null;
  total: number | null;
  currency: string | null;

  items: ReceiptItem[];

  category: string | null;

  confidence: number;
}
```

Item:

```typescript
interface ReceiptItem {
  name: string;
  quantity: number | null;
  price: number | null;
}
```

---

# 11. Human-in-the-Loop

AI tidak boleh langsung dipercaya untuk membuat transaksi final.

Flow:

```text
AI
 ↓
Extract
 ↓
Validate
 ↓
Show User
 ↓
User Confirm
 ↓
Database
```

Alasannya:

* OCR bisa salah membaca angka.
* AI bisa salah membaca tanggal.
* Total dapat salah.
* Kategori dapat salah.
* Foto dapat blur.
* Struk dapat terpotong.

User confirmation menjadi safety layer.

---

# 12. Telegram Commands

Initial commands:

```text
/start
/help
/balance
/transactions
/summary
/categories
/wallets
```

Natural language juga didukung.

Contoh:

```text
45000 makan siang
```

Backend mengubahnya menjadi:

```json
{
  "amount": 45000,
  "description": "makan siang",
  "category": "Food"
}
```

Kemudian meminta konfirmasi jika diperlukan.

---

# 13. Idempotency

Telegram update tidak boleh menyebabkan transaksi dibuat dua kali.

Contoh:

```text
Telegram Update ID
       ↓
Check Redis / Database
       ↓
Already processed?
   │          │
  YES         NO
   │           │
 Ignore      Process
```

Simpan:

```text
telegram_update_id
```

atau identifier unik lainnya sebagai idempotency key.

Target:

```text
1 Telegram event
      =
1 business operation
```

---

# 14. API Design

Walaupun Telegram menjadi interface utama, backend tetap akan memiliki REST API.

Contoh:

```text
POST   /transactions
GET    /transactions
GET    /transactions/:id
PATCH  /transactions/:id
DELETE /transactions/:id

GET    /wallets
POST   /wallets

GET    /categories
POST   /categories

GET    /reports/monthly
GET    /reports/category
```

API akan didokumentasikan menggunakan OpenAPI/Swagger.

---

# 15. Authentication

## REST API (Web Dashboard + External Clients)

```text
Client
  ↓
Login (email/password)
  ↓
JWT
  ↓
Protected API
```

## Telegram Bot

Telegram user identification akan menggunakan Telegram identity.

```text
Telegram User
  ↓
Telegram Bot Module
  ↓
Internal User ID (linked to telegram_id)
```

## Auth Strategy

| Interface | Method | Use Case |
|-----------|--------|----------|
| Web Dashboard | Email/Password + JWT | Primary web access |
| REST API (3rd party) | JWT Bearer Token | API integrations |
| Telegram Bot | Telegram ID | Chat-based interaction |

Authentication dan authorization harus tetap dipisahkan.

```text
Authentication
= Who are you?

Authorization
= What are you allowed to access?
```

Future: Link Telegram account ke web account untuk unified experience.

---

# 16. Error Handling

Error harus dikategorikan.

Contoh:

```text
Validation Error
Authentication Error
Authorization Error
Not Found
Conflict
External Service Error
AI Error
Database Error
```

Jangan mengembalikan raw error dari provider ke user.

Contoh buruk:

```text
Google API error 429 RESOURCE_EXHAUSTED...
```

Lebih baik:

```text
Maaf, struk belum dapat diproses.
Silakan coba lagi beberapa saat.
```

Detail error tetap dicatat di log.

---

# 17. Background Jobs

Gunakan queue untuk pekerjaan yang tidak perlu synchronous.

Contoh:

```text
Receipt Processing
AI Processing
Notification
Report Generation
Retry
```

Architecture:

```text
Application
     │
     ▼
   Queue
     │
     ▼
   Worker
     │
     ▼
External Service
```

BullMQ digunakan sebagai queue framework.

Redis digunakan sebagai backend queue.

---

# 18. Caching

Redis dapat digunakan untuk data yang sering dibaca.

Contoh:

```text
Monthly Summary
Category List
User Preferences
```

Pattern:

```text
Request
  ↓
Redis?
 ├── HIT → Return
 │
 └── MISS
       ↓
    Database
       ↓
      Redis
       ↓
     Return
```

Cache harus memiliki TTL.

---

# 19. Event-Driven Architecture

Setelah core system stabil, kita dapat memperkenalkan domain events.

Contoh:

```text
TransactionCreated
        │
        ├── Update balance
        │
        ├── Clear cache
        │
        └── Send notification
```

Tujuannya untuk belajar decoupling.

Namun event-driven architecture **tidak akan digunakan terlalu awal**.

---

# 20. Testing Strategy

Testing akan dibuat bertahap.

## Unit Test

Test business logic.

Contoh:

```text
calculate balance
categorize transaction
validate receipt
calculate monthly spending
```

## Integration Test

Test:

```text
Service
 +
Database
```

## E2E Test

Test:

```text
Telegram/API
      ↓
Application
      ↓
Database
```

Target architecture testing:

```text
Unit Tests
     ↓
Integration Tests
     ↓
E2E Tests
```

---

# 21. Docker

Development environment:

```text
Docker Compose
│
├── PostgreSQL
├── Redis
├── Backend (NestJS)
└── Dashboard (Next.js)
```

Contoh:

```text
docker compose up
```

Production:
- Backend: Multi-stage Dockerfile (builder + runner)
- Dashboard: Next.js standalone output + Dockerfile
- Reverse proxy: Nginx/Traefik untuk routing

Tujuannya agar environment mudah direplikasi.

---

# 22. Observability

Minimal:

```text
Logs
Error tracking
Request ID
Processing duration
Job status
AI request status
```

Contoh log:

```text
[INFO] Receipt received
[INFO] Receipt processing started
[INFO] AI extraction completed
[INFO] Receipt waiting for confirmation
[INFO] Transaction created
```

Jangan log:

```text
API keys
JWT secrets
passwords
sensitive credentials
```

---

# 23. Project Folder Structure

Initial structure (Monorepo):

```text
finance-tracker/
│
├── apps/
│   ├── backend/              # NestJS API + Telegram Bot
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── wallets/
│   │   │   ├── categories/
│   │   │   ├── transactions/
│   │   │   ├── receipts/
│   │   │   ├── ai/
│   │   │   ├── telegram/
│   │   │   ├── notifications/
│   │   │   ├── jobs/
│   │   │   ├── reports/
│   │   │   ├── dashboard/    # REST API for web dashboard
│   │   │   └── common/
│   │   ├── prisma/
│   │   ├── test/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── dashboard/            # Next.js Web Dashboard
│       ├── src/
│       │   ├── app/          # App Router pages
│       │   ├── components/
│       │   ├── lib/          # API client, utils
│       │   ├── hooks/
│       │   └── types/
│       ├── package.json
│       ├── tsconfig.json
│       ├── tailwind.config.ts
│       └── next.config.js
│
├── packages/
│   ├── prisma/               # Shared Prisma schema
│   │   └── schema.prisma
│   │
│   └── shared/               # Shared types, DTOs, constants
│       ├── src/
│       │   ├── types/
│       │   ├── dto/
│       │   ├── enums/
│       │   └── validation/
│       └── package.json
│
├── docker/
│
├── docs/
│
├── .env.example
├── docker-compose.yml
├── package.json              # Root workspace (pnpm)
├── turbo.json                # Turborepo config
├── tsconfig.base.json
└── README.md
```

---

# 24. Environment Variables

Secret/configuration harus berada di environment variable.

Contoh:

```env
# Database
DATABASE_URL=
REDIS_URL=

# Telegram
TELEGRAM_BOT_TOKEN=

# AI
AI_PROVIDER=
AI_API_KEY=
AI_BASE_URL=
AI_MODEL=

# Auth
JWT_SECRET=
JWT_EXPIRES_IN=

# Next.js Dashboard
NEXT_PUBLIC_API_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Email (optional, for magic links)
EMAIL_SERVER_HOST=
EMAIL_SERVER_PORT=
EMAIL_SERVER_USER=
EMAIL_SERVER_PASSWORD=
EMAIL_FROM=
```

Jangan commit:

```text
.env
```

ke Git.

Yang boleh di-commit:

```text
.env.example
```

---

# 25. Development Roadmap

## Phase 0 — Project Setup

* [ ] Create repository
* [ ] Initialize NestJS
* [ ] Configure TypeScript
* [ ] Configure ESLint
* [ ] Configure Prettier
* [ ] Configure environment variables
* [ ] Configure Git
* [ ] Create Docker Compose
* [ ] Setup PostgreSQL
* [ ] Setup Prisma

---

## Phase 1 — Core Transaction

Goal:

> Membuat backend finance tracker sederhana.

Implement:

* [ ] User
* [ ] Wallet
* [ ] Category
* [ ] Transaction
* [ ] CRUD transaction
* [ ] Database relations
* [ ] REST API
* [ ] Swagger

At this stage:

```text
Client
  ↓
REST API
  ↓
Service
  ↓
PostgreSQL
```

---

## Phase 2 — Architecture

Refactor project menjadi modular architecture.

Learn:

* [ ] Controller
* [ ] Service
* [ ] Repository
* [ ] Domain
* [ ] DTO
* [ ] Dependency Injection
* [ ] Interface
* [ ] Separation of concerns

Goal:

```text
Infrastructure
      ↓
Application
      ↓
Domain
```

---

## Phase 3 — Telegram

Implement:

* [ ] Telegram Bot
* [ ] `/start`
* [ ] `/help`
* [ ] Text transaction
* [ ] Transaction confirmation
* [ ] Transaction history
* [ ] Monthly summary

Flow:

```text
Telegram
   ↓
Bot Adapter
   ↓
Application
   ↓
Transaction
```

---

## Phase 4 — AI Text Parsing

Implement:

```text
45000 makan siang
        ↓
AI Parser
        ↓
Structured Transaction
```

Output:

```json
{
  "amount": 45000,
  "description": "makan siang",
  "category": "Food"
}
```

Add:

* [ ] AI abstraction
* [ ] Provider adapter
* [ ] Structured output
* [ ] Validation
* [ ] Confirmation

---

## Phase 5 — Receipt AI

Implement:

```text
Telegram Photo
      ↓
Vision AI
      ↓
ReceiptExtractionResult
      ↓
Validation
      ↓
Confirmation
      ↓
Transaction
```

Add:

* [ ] Image download
* [ ] AI vision
* [ ] Receipt extraction
* [ ] Confidence score
* [ ] User confirmation
* [ ] Error handling

---

## Phase 6 — Redis & Queue

Implement:

* [ ] Redis
* [ ] BullMQ
* [ ] Receipt queue
* [ ] Worker
* [ ] Retry
* [ ] Job status
* [ ] Idempotency

Architecture:

```text
Telegram
   ↓
API
   ↓
Queue
   ↓
Worker
   ↓
AI
```

---

## Phase 7 — Reporting

Implement:

* [ ] Daily summary
* [ ] Weekly summary
* [ ] Monthly summary
* [ ] Category breakdown
* [ ] Wallet balance
* [ ] Telegram report

Example:

```text
September 2026

Food           Rp1.250.000
Transport        Rp750.000
Shopping         Rp900.000
Bills          Rp1.100.000
--------------------------
Total          Rp4.000.000
```

---

## Phase 8 — Web Dashboard (Next.js)

Implement:

* [ ] Monorepo setup (pnpm + Turborepo)
* [ ] Next.js 14+ project dengan App Router
* [ ] Tailwind CSS + shadcn/ui components
* [ ] TanStack Query untuk data fetching
* [ ] Authentication pages (login/register)
* [ ] Dashboard overview (charts, summary cards)
* [ ] Transactions page (list, create, edit, delete)
* [ ] Wallets page (CRUD)
* [ ] Categories page (CRUD)
* [ ] Reports page (charts, filters)
* [ ] Settings page
* [ ] Shared types package (packages/shared)
* [ ] Shared Prisma schema (packages/prisma)
* [ ] Docker Compose untuk full stack

Architecture:

```text
Web Dashboard (Next.js)
         ↓
    REST API (NestJS)
         ↓
    PostgreSQL + Redis
```

---

## Phase 9 — Testing

Implement:

* [ ] Unit tests
* [ ] Integration tests
* [ ] E2E tests
* [ ] Test database
* [ ] Mock AI provider
* [ ] Mock Telegram API
* [ ] Dashboard component tests

---

## Phase 10 — Production Engineering

Learn:

* [ ] Docker production image
* [ ] CI/CD
* [ ] Logging
* [ ] Monitoring
* [ ] Health check
* [ ] Graceful shutdown
* [ ] Database migration
* [ ] Backup strategy
* [ ] Rate limiting
* [ ] Security

---

# 26. Future Architecture

Setelah modular monolith matang, kita dapat mengevaluasi apakah module tertentu layak dipisahkan.

Potential services:

```text
                 API Gateway
                      │
       ┌──────────────┼──────────────┐
       ▼              ▼              ▼
 User Service   Transaction      Receipt
                  Service         Service
                                    │
                                    ▼
                                AI Worker
```

Namun pemisahan menjadi microservices **bukan target awal**.

Microservices hanya dilakukan jika ada alasan teknis yang jelas, misalnya:

* independent scaling
* deployment independence
* workload isolation
* team ownership
* infrastructure requirements

---

# 27. Architecture Principles

Project ini mengikuti prinsip:

### 1. Separation of Concerns

Setiap module memiliki responsibility yang jelas.

### 2. Dependency Inversion

Business logic tidak bergantung langsung pada external provider.

Contoh:

```text
Transaction
     ↓
AI Interface
     ↑
Gemini Adapter
```

### 3. Interface Before Implementation

Untuk external services:

```typescript
interface AIService
interface StorageService
interface NotificationService
```

### 4. Domain Logic Should Be Provider Agnostic

Transaction logic tidak boleh tahu apakah input berasal dari:

```text
Telegram
REST API
Web
AI
```

### 5. External Services Are Untrusted

AI, Telegram, storage, dan API eksternal dapat:

* timeout
* error
* return invalid data
* rate limit
* unavailable

Sistem harus mengantisipasinya.

### 6. Human Confirmation for AI-generated Financial Data

AI output bukan source of truth.

User confirmation adalah final validation sebelum transaksi dibuat.

---

# 28. Learning Strategy

Jangan meminta AI coding agent membangun seluruh project sekaligus.

Gunakan pendekatan:

```text
Requirement
    ↓
Design
    ↓
Small Task
    ↓
Implementation
    ↓
Test
    ↓
Review
    ↓
Refactor
    ↓
Next Task
```

Contoh task:

```text
Implement Transaction entity and repository.
```

Kemudian:

```text
Implement CreateTransaction use case.
```

Kemudian:

```text
Implement POST /transactions.
```

Kemudian:

```text
Write unit tests.
```

Dengan cara ini kita dapat memahami **mengapa architecture tersebut dibuat**, bukan hanya menghasilkan source code.

---

# 29. Definition of Done

Sebuah feature dianggap selesai apabila:

* [ ] Requirement jelas
* [ ] Architecture sesuai
* [ ] Implementation selesai
* [ ] Validation tersedia
* [ ] Error handling tersedia
* [ ] Unit test tersedia jika diperlukan
* [ ] Integration test tersedia jika diperlukan
* [ ] API/documentation diperbarui
* [ ] Logging sesuai
* [ ] Tidak ada secret yang di-hardcode
* [ ] Code dapat dijalankan dari clean environment

---

# 30. First Milestone

Kita **tidak langsung membuat AI receipt scanner**.

Milestone pertama:

```text
Telegram
   ↓
"45000 makan siang"
   ↓
Backend
   ↓
Transaction Service
   ↓
PostgreSQL
   ↓
Confirmation
   ↓
Saved Transaction
```

Setelah flow ini stabil:

```text
Telegram
   ↓
Photo Receipt
   ↓
Vision AI
   ↓
Structured Data
   ↓
Confirmation
   ↓
Transaction
```

Kemudian Web Dashboard (Next.js):

```text
Next.js Dashboard
       ↓
REST API (NestJS)
       ↓
PostgreSQL + Redis
```

Kemudian baru:

```text
Queue
Redis
Worker
OCR
Caching
Events
Testing
Docker
CI/CD
Monitoring
```

Dengan urutan ini, project berkembang dari **simple working system → well-architected backend → multi-interface system → production-oriented system**.
