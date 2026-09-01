# StockFlow

A minimal inventory & invoicing app I built for the "StockFlow" take-home. Staff sign in, keep a product catalog, and raise invoices against it. Stock drops when an invoice is issued and comes back if that invoice gets cancelled — that's really the whole product.

**Live demo:** https://stockflow-web-beta.vercel.app (API at https://stockflow-api-six.vercel.app, docs at `/docs`). Both sides are deployed on Vercel and point at the same Neon Postgres database, so the demo login below works there too. Give the first request a couple of extra seconds — it's a serverless cold start.

It's a monorepo on npm workspaces:

- `apps/api` — NestJS + Prisma + PostgreSQL
- `apps/web` — Next.js (App Router) + Tailwind

## Why I think this is worth your time

A few decisions I'm actually proud of, since they're the kind of thing that's easy to get subtly wrong in a rushed take-home:

- **Stock can't go negative, even under concurrent requests.** Issuing an invoice decrements stock with a single conditional `UPDATE ... WHERE quantityOnHand >= ?` instead of reading the quantity, checking it in application code, and writing it back. That read-then-write pattern is exactly how two almost-simultaneous "issue" clicks oversell the same product — the check passes for both before either write lands. The conditional UPDATE closes that window because Postgres serializes it at the row level.
- **The same guard protects `cancel` and `pay`, not just `issue`.** I originally only hardened the stock decrement and left invoice status transitions as a plain check-then-write. I went back and fixed that too, so two concurrent "cancel" clicks on the same issued invoice can't both pass the status check and double-credit stock. I proved this with an actual test — ten concurrent cancel requests against the same invoice, one succeeds, nine get a clean 409, and the stock number comes out exactly right.
- **Prices are snapshotted onto the invoice line, not looked up live.** `unitPrice` and `productName` are copied onto the `InvoiceItem` the moment the invoice is created. Change a product's price next week and every invoice already issued still shows what the customer was actually charged.
- **Money is never a float.** Everything — unit price, subtotal, tax, total — is stored and computed as integer minor units (cents-equivalent). Tax is `Math.round(subtotal * rate / 100)`, so rounding happens once, in one place, not scattered across float arithmetic that could drift.
- **The server is the only thing that calculates totals.** The frontend shows a live preview while you're building an invoice, purely for feedback, but whatever it sends gets recalculated from scratch server-side. A client can't just POST a fake total.
- **Every query is scoped to the logged-in user.** There's no "workspace" or "tenant" table — ownership is just a `userId` column that every single product/invoice query filters on. I actually tested this by creating two accounts and trying to read, edit, and delete one user's data from the other's session; all of it came back 404, not 403, so there isn't even a way to confirm another user's data exists.
- **Auth errors don't leak which part was wrong — and I mean that at the timing level, not just the message.** "Wrong password" and "no such account" return the identical message and status code, but I also had bcrypt run against a dummy hash when the email doesn't exist, because otherwise skipping the hash check makes the response measurably faster and someone could enumerate registered emails just by timing requests.
- **A product referenced by an invoice can't quietly disappear.** Deleting it returns a `409` naming the conflict instead of either silently failing or leaving an invoice pointing at nothing.

None of this is exotic — it's the stuff that's genuinely easy to skip when you're moving fast, and I'd rather you find it already handled than have to ask me why it isn't.

## Prerequisites

- Node.js 20+
- A PostgreSQL database (I used a free Neon database for this, but any Postgres works — SQLite would need a small schema tweak)

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

Fill in `DATABASE_URL` (and `DATABASE_URL_UNPOOLED` if you're on Neon — that one's for migrations, the pooled one is for normal queries). Everything else already has a sensible default for local dev.

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
| `NEXT_PUBLIC_TAX_RATE_PERCENT` | Only used for the live totals preview on the invoice form — should match the backend's `TAX_RATE_PERCENT`. The server always recalculates, so this is cosmetic, not authoritative. |

### 3. Migrate and seed the database

```bash
cd apps/api
npx prisma migrate deploy
npm run seed
```

This creates a demo user and five products for you to click around with.

**Demo login:** `demo@stockflow.dev` / `password123`

### 4. Run it

From the repo root, in two terminals:

```bash
npm run dev:api   # http://localhost:4000
npm run dev:web   # http://localhost:3000
```

Open `http://localhost:3000` and you'll land on the login page.

### 5. Run tests

```bash
npm run test:api
```

This runs the backend's e2e suite (11 tests) against whatever database is configured in `apps/api/.env`. It registers its own throwaway user and cleans up after itself, so it's safe to point at your dev database.

## API docs

Swagger UI runs at `http://localhost:4000/docs` once the backend is up.

Quick reference if you'd rather not open it:

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

- **NestJS** for the API. It gives me structure — modules, guards, pipes — that's easy for someone else to navigate quickly, and dependency injection means I could unit-test the invoice service in isolation if I needed to.
- **Prisma + Postgres.** The money/stock logic needs real transactions and row-level atomicity, which Postgres gives me for free. Prisma's migration workflow is fast enough to set up in a one-day project without fighting it.
- **Neon** for the database. It's free, it's serverless Postgres, and it plugs straight into Vercel — so there's no "go spin up a database server" step for whoever's reviewing this.
- **JWT in an httpOnly cookie**, not a bearer token in localStorage. It isn't readable from JS, which is the more defensible call against XSS for a browser app.
- **Money as integer minor units** everywhere (Rp 15.000 is stored as `1500000`), so subtotal/tax/total math is plain integer arithmetic — no floating point involved anywhere in the chain.
- **npm workspaces monorepo** instead of two separate repos. One clone, one install, easier for you to run.
- **NestJS on Vercel as a serverless function.** `apps/api/api/index.ts` builds the Nest app once through a shared `createApp()` (pulled out of `main.ts` so local dev and the serverless entrypoint bootstrap identically) and hands the underlying Express instance straight to Vercel's Node runtime — a Vercel Node function is just `(req, res) => void`, which is exactly what Express already is. No adapter package needed.
- **bcryptjs over bcrypt.** bcrypt's native binding turned out to be flaky to build in Vercel's serverless environment. bcryptjs is pure JS and a bit slower, but it's one less moving part for a project this size, and I'd rather have a boring dependency than a flaky one.

## Trade-offs and known limitations

Things I knowingly didn't do, and why:

- **No refresh tokens.** The JWT just expires after `JWT_EXPIRES_IN` (a day) and you log in again. Fine for an internal tool, not fine for something people stay logged into for months.
- **No roles.** Every user is effectively STAFF with full access to their own workspace. ADMIN/STAFF is explicitly a bonus item in the brief, and I'd rather ship the core cleanly than half-build a role system on top of it.
- **Invoice editing replaces all line items wholesale**, not a diff of individual lines. It's simpler to reason about and it's correct, but editing one line on a ten-line invoice re-validates and rewrites all ten rows.
- **No rate limiting on login.** Also a bonus item; skipped to keep the core solid instead.
- **Logout doesn't invalidate the JWT server-side.** It clears the cookie, but a copy of the token — if it somehow got extracted — would keep working until it expires. That's the standard trade-off of a stateless JWT; a session store or a refresh-token setup would close it, at the cost of the simplicity a stateless token gives a one-day project.
- **Invoice numbers can technically have gaps** — the numbering counter and the invoice write aren't fully decoupled, so a mid-request failure after the counter increments (not currently reachable given the code path, but worth naming) would skip a number. Not a correctness bug, just something I'd rather be upfront about than have you discover.
- **The multi-column forms and the invoice line-item row aren't tuned for narrow phone screens.** This is a desktop-first back-office tool, which lines up with the brief's own "plain and functional is fine, pixel-perfect UI not required."

## What I'd do with one more week

- Add role-based access (ADMIN vs STAFF) and a stock-movement ledger — both bonus items in the brief.
- Add refresh-token rotation instead of one long-lived JWT.
- Replace the wholesale invoice-item replace-on-edit with a real diff.
- Add optimistic UI updates instead of a full refetch after every mutation.
- Add a Postman/Bruno collection next to the Swagger docs, for people who'd rather not open a browser.
- Wire up CI (lint + test) on GitHub Actions.

## AI usage

I built this with Claude Code end to end — scaffolding both apps, the Prisma schema and NestJS modules, the Next.js pages, the e2e tests, and this README. I didn't just accept what it produced: I tested every endpoint and page myself before calling anything done — curl against the API, a real browser session walking through login → create invoice → issue → cancel — and I can explain and defend any part of it.

After the first pass, I went back and deliberately tried to break my own app: cross-user data isolation, a login-timing side channel, XSS/SQLi payloads, firing concurrent duplicate requests at `cancel`, malformed input, keyboard navigation, whether form labels were actually wired to their inputs. A few of those turned up real issues — the timing side-channel and the concurrent-cancel race being the two I'd call genuine bugs — and I fixed them rather than leaving them as "known limitations" to write around.

## Time spent

Roughly one focused day, in line with the brief's budget.
