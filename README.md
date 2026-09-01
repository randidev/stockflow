# StockFlow

Minimal inventory & invoicing app. Staff can sign in, manage a product catalog, and raise invoices against it. Stock goes down when an invoice is issued and comes back if it's cancelled.

**Live demo:** https://stockflow-web-beta.vercel.app (API: https://stockflow-api-six.vercel.app, docs at `/docs`). Both are deployed on Vercel and share a Neon Postgres database — same demo login as below. First request after a while may take a couple of extra seconds (serverless cold start).

Monorepo, npm workspaces:

- `apps/api` — NestJS + Prisma + PostgreSQL
- `apps/web` — Next.js (App Router) + Tailwind

## Prerequisites

- Node.js 20+
- A PostgreSQL database (the setup below uses a free Neon database, but any Postgres works — SQLite would need a schema tweak)

## Setup

```bash
git clone <this repo>
cd stockflow
npm install
```

### 1. Backend env vars

```bash
cp apps/api/.env.example apps/api/.env
```

Fill in `DATABASE_URL` (and `DATABASE_URL_UNPOOLED` if you're on Neon — that one is used for migrations, the pooled one for normal queries). Everything else has a sane default for local dev.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string used at runtime |
| `DATABASE_URL_UNPOOLED` | Direct (non-pooled) connection, used by `prisma migrate` |
| `JWT_SECRET` | Signs the session token — use a long random string in production |
| `JWT_EXPIRES_IN` | Token lifetime, default `1d` |
| `TAX_RATE_PERCENT` | Tax rate applied to invoice subtotals, default `11` |
| `PORT` | API port, default `4000` |
| `FRONTEND_ORIGIN` | Allowed CORS origin for the frontend |

### 2. Frontend env vars

```bash
cp apps/web/.env.example apps/web/.env.local
```

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Where the frontend sends API requests |
| `NEXT_PUBLIC_TAX_RATE_PERCENT` | Only used to preview totals live on the invoice form — must match the backend's `TAX_RATE_PERCENT`. The server always recalculates and is the source of truth. |

### 3. Migrate and seed the database

```bash
cd apps/api
npx prisma migrate deploy
npm run seed
```

The seed creates a demo user and five products.

**Demo login:** `demo@stockflow.dev` / `password123`

### 4. Run it

From the repo root, in two terminals:

```bash
npm run dev:api   # http://localhost:4000
npm run dev:web   # http://localhost:3000
```

Open `http://localhost:3000` — you'll land on the login page.

### 5. Run tests

```bash
npm run test:api
```

This runs the backend's e2e test suite (9 tests) against the same database configured in `apps/api/.env`. It registers its own throwaway user and cleans up after itself, so it's safe to run against the dev database.

## API docs

Swagger UI is served at `http://localhost:4000/docs` once the backend is running.

Quick reference:

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | – | email + password (min 8 chars) |
| POST | `/auth/login` | – | sets an httpOnly cookie |
| POST | `/auth/logout` | – | clears the cookie |
| GET | `/auth/me` | ✓ | current user |
| GET/POST | `/products` | ✓ | list (search, pagination) / create |
| GET/PATCH/DELETE | `/products/:id` | ✓ | delete is blocked (409) if the product is used on an invoice |
| GET/POST | `/invoices` | ✓ | list (status filter, pagination) / create as DRAFT |
| GET/PATCH | `/invoices/:id` | ✓ | PATCH only works while status is DRAFT |
| POST | `/invoices/:id/issue` | ✓ | DRAFT → ISSUED, decrements stock |
| POST | `/invoices/:id/pay` | ✓ | ISSUED → PAID |
| POST | `/invoices/:id/cancel` | ✓ | DRAFT/ISSUED → CANCELLED, restores stock if it was ISSUED |

## Tech choices and why

- **NestJS** for the API — it gives structure (modules/guards/pipes) that a reviewer can navigate quickly, and DI makes the invoice service easy to unit-test in isolation if needed.
- **Prisma + Postgres** — the money/stock logic needs real transactions (`$transaction`) and row-level atomicity, which Postgres gives me for free. Prisma's migration workflow is fast to set up for a one-day project.
- **Neon** for the database — free, serverless Postgres that plugs straight into Vercel, so there's no separate "spin up a DB server" step for whoever reviews this.
- **JWT in an httpOnly cookie** rather than a bearer token in localStorage — it's not readable from JS, which is the more defensible choice against XSS for a browser app.
- **Money as integer minor units** (e.g. Rp 15.000 stored as `1500000`) everywhere — subtotal/tax/total math is all integer arithmetic, no floating point.
- **Stock guard is enforced with a conditional `UPDATE ... WHERE quantityOnHand >= ?`** at issue time, not a separate read-then-write check — that makes the decrement atomic at the row level and safe against two concurrent "issue" requests overselling the same product.
- **Block-delete instead of soft-delete for products** — a product referenced by an invoice returns `409 Conflict` on delete. Simpler than threading a `deletedAt` filter through every query, and the invoice's line-item snapshot means the invoice doesn't actually need the product to still exist except for this integrity check.
- **Next.js App Router with plain client components + fetch**, no server actions or extra data-fetching library — the app is small enough that a data-fetching abstraction would be pure overhead.
- **npm workspaces monorepo** instead of two separate repos — one `git clone`, one `npm install`, easier for a reviewer to run.
- **NestJS on Vercel as a serverless function** — `apps/api/api/index.ts` builds the Nest app once via `createApp()` (extracted out of `main.ts` so local dev and serverless share the same bootstrap) and hands the underlying Express instance straight to Vercel's Node runtime, since a Vercel Node function is just `(req, res) => void` — the same signature Express already has. No extra adapter package needed.
- **bcryptjs instead of bcrypt** — bcrypt's native binding turned out to be unreliable to build in Vercel's serverless environment; bcryptjs is pure JS, slightly slower, but one less moving part for a project this size.

## Trade-offs and known limitations

- **No refresh tokens.** The JWT just expires after `JWT_EXPIRES_IN` (1 day) and the user has to log in again. Fine for an internal tool, not fine for a long-lived session product.
- **No roles.** Every user is STAFF-equivalent with full access to their own workspace. The spec explicitly lists ADMIN/STAFF as a bonus, and I decided the core requirements were worth more than a role system I'd have to half-finish.
- **Invoice editing replaces all line items wholesale** rather than diffing individual lines. Simpler to reason about, correct, but means editing a 10-line invoice re-validates and rewrites all 10 rows even if only one changed.
- **No rate limiting on login.** Listed as a bonus; skipped to keep the core solid.
- **The frontend's "live totals" on the invoice form use a client-side tax-rate env var that has to be kept in sync with the backend's.** It's a display-only preview — the server is what actually enforces the tax rate — but it's a small duplication I'd rather not have if I had more time (e.g. expose it via a public config endpoint instead).
- **Invoice numbers can have gaps** (e.g. if an invoice is created inside a request that then fails for an unrelated reason after the counter increments — not currently possible given the code path, but the counter and the invoice write aren't decoupled into separate concerns). Not a correctness bug, just worth naming.

## What I'd do with one more week

- Add role-based access (ADMIN vs STAFF) and a stock-movement ledger, both listed as bonus items in the brief.
- Add refresh-token rotation instead of a single long-lived JWT.
- Replace the wholesale invoice-item replace-on-edit with a real diff (add/update/remove individual lines).
- Add optimistic UI updates on the frontend instead of a full refetch after every mutation.
- Add a Postman/Bruno collection alongside the Swagger docs for people who prefer that workflow.
- Wire up CI (lint + test) on GitHub Actions.

## AI usage

Built with Claude Code end to end — scaffolding both apps, writing the Prisma schema and NestJS modules, the Next.js pages, the e2e tests, and this README. I reviewed and tested every endpoint and page manually (curl for the API, a real browser session for the full login → create invoice → issue → cancel flow) before considering anything done, and I can walk through and justify any part of it.

## Time spent

Roughly one focused day, in line with the brief's time budget.
