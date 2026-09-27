# Daily TODO - Finance Tracker

## Current Sprint: Phase 1 - Core Transaction

### This Week
- [ ] Create default wallet on user registration
- [ ] Seed default categories on user creation
- [ ] Implement transaction CRUD with balance updates
- [ ] Add transaction filtering (wallet, category, date range)
- [ ] Implement summary endpoint

### Next Week
- [ ] Build transaction list page (Frontend)
- [ ] Build create/edit transaction form (Frontend)
- [ ] Dashboard with summary cards (Frontend)
- [ ] Wallet management page (Frontend)

---

## Backlog

### Phase 2: Architecture
- [ ] Repository pattern
- [ ] Domain/Application/Infrastructure layers
- [ ] DTOs for all modules
- [ ] Interface-based dependencies

### Phase 3: Telegram Bot
- [ ] Bot setup & webhook
- [ ] /start, /help commands
- [ ] Text parsing ("45000 makan siang")
- [ ] Confirmation flow
- [ ] /balance, /transactions, /summary

### Phase 4: AI Text Parsing
- [ ] AI abstraction interface
- [ ] Provider adapters (Gemini, OpenAI, Claude)
- [ ] Structured output validation

### Phase 5: Receipt AI
- [ ] Image download
- [ ] Vision AI integration
- [ ] ReceiptExtractionResult
- [ ] Confirmation flow

### Phase 6: Queue & Redis
- [ ] Redis caching
- [ ] BullMQ setup
- [ ] Receipt processing queue
- [ ] Worker processes
- [ ] Idempotency keys

---

## Notes

- Run `pnpm dev` to start development
- Swagger docs at http://localhost:3000/api/docs
- Database at postgresql://postgres:postgres@localhost:5432/finance_tracker
- Redis at redis://localhost:6379

---

*Update this file daily*