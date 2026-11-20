# SplitSmart Prototype (CIS 285 Lab 9)

A web app for tracking shared expenses within a group: create groups, add members,
record equally split expenses, and view expense history and per-member balances.

Stack: Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Prisma 6 + SQLite · Vitest.

## Running

```bash
cd prototype
echo 'DATABASE_URL="file:./dev.db"' > .env   # only if .env is missing (it is gitignored)
npx prisma db push                            # create/update prisma/dev.db and generate the client
npm run dev                                   # http://localhost:3000
```

Run unit tests with `npm test`.

## Layout

| Path | Purpose |
|---|---|
| `prisma/schema.prisma` | `Group`, `Member`, `Expense`, `ExpenseParticipant` models (money stored as integer cents) |
| `src/lib/money.ts` | Pure rules: amount parsing, equal split with deterministic remainder, balance calculation, formatting |
| `src/lib/splitsmart.ts` | Service layer: validation and Prisma persistence |
| `src/lib/api.ts` | Shared route helpers (error → HTTP status mapping) |
| `src/app/api/groups/...` | JSON API route handlers |
| `src/app/SplitSmartApp.tsx` | Client UI |

## API

| Method | Path | Body |
|---|---|---|
| GET | `/api/groups` | — |
| POST | `/api/groups` | `{ name }` |
| GET | `/api/groups/:id` | — returns members, expenses (newest first), balances |
| POST | `/api/groups/:id/members` | `{ name }` |
| POST | `/api/groups/:id/expenses` | `{ description, amount: "12.34", payerId, participantIds: number[] }` |

Validation errors return `400 { error }`; unknown groups return `404 { error }`.

## Business rules

- Amounts are parsed from decimal strings straight into integer cents (no floating point). They must be > $0, at most $1,000,000.00, and have at most 2 decimal places.
- Each expense is split equally. Leftover cents go one each to participants in ascending member-ID order, so $10 split among three people gives $3.34 / $3.33 / $3.33.
- The payer and all participants must be members of the expense's group.
- Balance = amount paid − sum of own shares. Balances always sum to $0.00.
