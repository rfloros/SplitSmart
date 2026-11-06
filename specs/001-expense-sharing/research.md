# Research: SplitSmart Expense Sharing

## Selected decision (2026-11-05): simplified Architecture B

**Decision**: One Java 21/Maven module; local Swing application; embedded SQLite;
app-managed receipt directory; simulated verification/recovery outbox; ports/adapters
with passive views and plain-Java presenters. See [docs/decisions.md](../../docs/decisions.md).

**Rationale**: CIS 285 is a short lab sequence ending after the next continuation, so a
local single-machine application with no server, PostgreSQL, or deployment is
preferred. B has the clearest GUI/logic separation and the best JUnit 5 seams.
SQLite serializes writers, which gives a simple concrete concurrency rule
(`BEGIN IMMEDIATE`) for the payment-oversettlement race found in review.

**Accepted trade-offs**: single-device simulation, simulated email, deferred web/mobile
(see the exception table in [spec.md](./spec.md#architecture-and-scope-decision-2026-11-05)).

**Simplifications adopted from review**: drop the event bus, handlers, and separate
ledger because conditional state transitions already prevent duplicate effects; write
notifications in the expense transaction; reject (never silently round) excess input
precision; exact integer allocation; current-membership check at payment
confirmation; whole-transaction retry on busy.

## Historical: Architecture A (not selected; not in lab scope)

Retained for comparison and as a future-extension reference only.

**A's approach**: Swing client of a shared HTTPS Java service backed by PostgreSQL,
with real email delivery and private shared receipt storage; three Maven modules;
OpenAPI contract.

**A's rationale**: separate installations need one authoritative source of truth;
SQLite embedded per installation does not synchronize; H2 server mode would still need
an application service; PostgreSQL behind a service gives transactions, central
authorization, and a client API for future web/mobile clients.

**Why it was not selected for the lab**: it needs a server runtime, HTTPS/session
handling, PostgreSQL, schema deployment, mail delivery, and shared receipt storage —
infrastructure beyond a class lab (the decision is the user's; review history is in
[docs/architecture-review.md](../../docs/architecture-review.md) and
[docs/reviews/architecture-reviews.md](../../docs/reviews/architecture-reviews.md)).

**Where A remains relevant**: if the product moves to shared multi-device use or web/mobile
clients (FR-016), a central service like A is the natural direction; the
[future REST proposal](./contracts/openapi.yaml) is the starting point. That migration
needs shared persistence, network identity/security, API contracts, real email, and
re-verified concurrency; none of it exists now.

## Transactions, money, and idempotency

**Decision**: Each state-changing use case runs in one SQLite `BEGIN IMMEDIATE`
transaction on one shared connection; approved expenses and confirmed payments are the
authoritative inputs to derived balances; money is `BigDecimal` at the domain boundary
with exact integer minor units for arithmetic and storage.

**Rationale**: SQLite allows one writer at a time; taking the write lock before reading
state makes check-then-update atomic, so two pending payments cannot both confirm
against the same debt. Conditional `PENDING` transitions prevent duplicate decisions.
Integer arithmetic gives exact largest-remainder allocation without approximate
division.

**Alternatives rejected**: stored balance totals (can drift); a separate ledger plus
events (extra representation to keep atomic; unnecessary here); `HALF_EVEN` input
normalization (silently changes entered amounts); finite-precision division for
percentages (cannot guarantee remainder ranking); SQLite `SUM` over money (floating
aggregation risk beyond integer range); floating point (constitution, NFR-001).

## Authentication and receipts

**Decision**: Passwords hashed with salted PBKDF2 (JDK); tokens random, stored hashed,
expiring, single-use; messages delivered to a simulated in-app outbox reachable before
sign-in (lab-only). Receipts are validated by content, copied to a private local
directory under opaque IDs, retrieved only through an authorized use case.

**Rationale**: demonstrates the token lifecycle and private-receipt behavior without
external services; its limits (no real email ownership, no distributed access) are
recorded as scope exceptions.

## References

- SQLite, [Appropriate Uses For SQLite](https://www.sqlite.org/whentouse.html)
- SQLite, [Transactions (BEGIN IMMEDIATE)](https://www.sqlite.org/lang_transaction.html)
- SQLite, [Write-Ahead Logging](https://www.sqlite.org/wal.html)
- Java 21, [`BigDecimal`](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/math/BigDecimal.html)
- Java 21, [`SwingWorker`](https://docs.oracle.com/en/java/javase/21/docs/api/java.desktop/javax/swing/SwingWorker.html)
- Oracle, [Swing components and models](https://docs.oracle.com/javase/tutorial/uiswing/components/model.html)
- OWASP, [Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- OWASP, [Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- Historical (A): PostgreSQL [Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html); OpenAPI [Specification](https://spec.openapis.org/oas/latest.html)
