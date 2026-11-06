# SplitSmart MVP Architecture (simplified Architecture B)

**Status**: Design proposal for the CIS 285 lab; generated artifacts await human review.
**Decision**: [docs/decisions.md](../../docs/decisions.md) · **Scope exceptions and lab rules**:
[spec.md](./spec.md#architecture-and-scope-decision-2026-11-05) · **Narrative and trade-offs**:
[docs/architecture-alt/architecture-alt.md](../../docs/architecture-alt/architecture-alt.md)

## Scope and deployment shape

One Java 21/Maven module, one local Swing application, one embedded SQLite database,
and an app-managed local receipt directory. There is **no** server, HTTPS API,
PostgreSQL, real mail provider, cloud storage, synchronization service, or deployment
work in this lab.

```text
Swing views (passive) <- presenters (plain Java) -> inbound ports (use cases + DTOs)
                                                        |
                                              application.service (orchestration)
                                               |            |            |
                                        domain rules   application.authz  outbound ports
                                                                              |
                          SQLite repositories + UnitOfWork / local receipt files /
                          password hasher / clock / simulated verification outbox
```

Because all accounts share one local database, "several users" means several accounts
signing in sequentially on one machine. This is the accepted single-device
simulation exception; it does not demonstrate distributed collaboration.

## Canonical packages

| Package | Responsibility |
|---|---|
| `domain` | Accounts, groups/membership, expenses/shares, payments, notifications, money/allocation, approval rules. |
| `application.port.in` | Use-case interfaces and immutable boundary commands/results. |
| `application.port.out` | Repositories, receipt store, password hasher, verification sender (and outbox reader), clock, `UnitOfWork`. |
| `application.service` | Synchronous use-case orchestration and queries. |
| `application.authz` | Authorization policy using the trusted signed-in account context. |
| `adapter.in.swing` | Views, presenters, view models, formatting, background/EDT coordination. |
| `adapter.out.persistence` | SQLite repositories, shared-connection `UnitOfWork`, simulated outbox storage. |
| `adapter.out.files` | Local receipt store. |
| `adapter.out.security` | PBKDF2 password hasher, token generation/hashing. |
| `adapter.out.system` | System clock. |
| `bootstrap` | Manual composition root and startup (including the orphan receipt sweep). |

**Boundary rules.** `domain` and `application` must not import Swing, JDBC, or
adapter classes. Presenters delegate every business decision through inbound ports
and never hold domain entities. A single Maven module does not enforce package
isolation by itself; the plan is an automated import-rule check (for example an
architecture test or a build-time source scan) added during implementation. **No such
check exists yet**, so the separation is a design commitment until it does. Use cases
run off the EDT (for example via `SwingWorker`); view updates return to the EDT.

## Component breakdown and FR traceability

| Component | Responsibility and boundary | FR coverage |
|---|---|---|
| Swing views and presenters | Passive views; presenters map gestures to commands and results/errors to view models; no allocation, approval, balance, SQL, or authorization rules. | FR-001–FR-015 (UI for each) |
| Trusted current-account context + `AccessPolicy` | Set only by successful sign-in; every use case resolves the caller from it, never from a command field; checks current membership/reviewer/recipient. | FR-002, FR-003, FR-008–FR-015; NFR-002 |
| Account use cases + simulated outbox | Registration (normalized email unique across all accounts), verification, sign-in, recovery, outbox reading before sign-in; hashed expiring single-use tokens. | FR-001–FR-002 |
| Group/membership use cases | Create group (creator = manager + reviewer), add/remove members, update roles, set/clear reviewer flag, last-reviewer/manager protection. | FR-003, FR-010 |
| Expense submission | Validate, store receipt, `BEGIN IMMEDIATE`, check membership, allocate, store pending expense + shares + receipt + notifications, commit. | FR-004–FR-009 |
| Allocation (`ShareAllocator`, `Money`) | Exact integer minor-unit allocation (see data-model.md). | FR-005–FR-007; NFR-001 |
| Receipt store + `GetReceipt` | Validate/copy local file; authorized retrieval by opaque ID; cleanup. | FR-008 |
| Notification query | Recipient-only reads after membership recheck; refresh + polling ≤ 60 s. | FR-009 |
| Approval (single reviewer) | Reviewer check, conditional PENDING→APPROVED/REJECTED once, decision record. | FR-010–FR-011 |
| Balance query | Derive pairwise net balances from approved shares and confirmed payments. | FR-012 |
| Payment use cases | Record pending; recipient-only confirmation under the serialized-write protocol. | FR-013 |
| Report query | Status/date semantics per spec; consistent read snapshot. | FR-014–FR-015 |
| SQLite adapters + `UnitOfWork` | One connection and one write transaction per state-changing use case. | FR-001–FR-015 |
| *(Future)* REST adapter and web/Android/iOS clients | Not implemented; see extension section. | FR-016 (deferred) |

## Key workflows

### Expense creation and approval

1. The presenter builds an immutable `SubmitExpenseCommand` and runs the use case off
   the EDT. The caller identity comes from the trusted context.
2. The service validates input shape and exactness (plain decimals, exact at the group
   scale, limits). Excess precision such as USD `10.005` is rejected.
3. If a receipt file is attached, the receipt store validates type/size by content and
   copies it to the app directory under an opaque ID. This file I/O is **outside** the
   SQLite transaction.
4. The service starts `BEGIN IMMEDIATE`, then checks current membership of submitter,
   payer, and participants; allocates exactly; stores the pending expense, ordered
   shares, receipt record, and one notification per other current member; and commits.
   Any failure rolls back, deletes the copied file (best effort; a startup sweep removes
   orphans), and returns a failure with no success indication.
5. An authorized reviewer later approves or rejects. A single transaction checks
   current membership and reviewer flag, conditionally changes `PENDING` once, and
   records the decision. A second decision gets a conflict and has no effect.

See [expense-creation-approval.puml](./diagrams/expense-creation-approval.puml).

### Balance tracking and payment settlement

For each approved expense, every participant other than the payer owes their share to
the payer (the payer's own share creates no self-debt; an excluded payer is owed every
share). Confirmed payments reduce the payer→recipient obligation. Balances are
derived on demand from this history; nothing stores a mutable balance.

A payment is stored `PENDING` and has no effect. Confirmation runs the protocol in
[spec.md](./spec.md#architecture-and-scope-decision-2026-11-05): `BEGIN IMMEDIATE`,
load, current-membership checks for the actor and both parties, recipient check,
pending check, in-transaction debt derivation, then conditional confirm and commit.
Debt 100 with two pending payments of 60: only one confirms; the second sees 40 and
stays pending with a validation error.

See [payment-settlement.puml](./diagrams/payment-settlement.puml).

## Persistence and consistency

- **Store**: one embedded SQLite file (WAL journal mode planned so read-only report
  queries get a consistent snapshot while one writer proceeds).
- **Writes**: every state-changing use case obtains a write transaction with
  `BEGIN IMMEDIATE` *before* reading mutable state used for validation; all repository
  calls in the use case share that connection. Busy/locked → bounded wait, then restart
  the **whole** transaction (rerunning authorization and debt checks); exhaustion →
  clear failure, no change.
- **Money**: exact integer minor units (signed 64-bit) plus currency code; aggregation
  is application-side with arbitrary-precision integers; SQLite `SUM` is not used for
  money. Lab limits are in the spec.
- **Derived balances**: no stored balance totals and no separate ledger table; the
  authoritative "financial history" is approved expenses/shares plus confirmed payments.
- **Receipts**: local private directory, opaque IDs, no path in any contract; retrieval
  rechecks current membership.
- **Notifications**: rows written in the submission transaction; read by recipient only.
- **Schema**: versioned by numbered scripts applied at startup (planned; none exist).

## Not delivered by the Swing MVP (and how a future design could extend)

- **Web, Android, and iOS clients** (FR-016, AC-012, SC-007, cross-client NFR-005):
  not implemented.
- **Shared multi-device use**, real email verification/recovery, multi-stage approval,
  external notification channels, multi-currency, report export.

*Extension (future work only)*: a REST adapter could host the same inbound use cases on a
central server. That would still require shared persistence (replacing local SQLite,
including receipt storage), network identity/session security, API contracts
(the proposal in [contracts/openapi.yaml](./contracts/openapi.yaml) is only a starting
point), a re-verified concurrency strategy, real email delivery, and the new clients
themselves. Reuse of use-case code is an aim, not an established result.

## Requirement traceability

| Component | FR-IDs |
|---|---|
| Swing views and presenters | FR-001–FR-015 |
| Current-account context and authorization | FR-002, FR-003, FR-008–FR-015 |
| Account use cases and simulated outbox | FR-001–FR-002 |
| Group and membership use cases | FR-003, FR-010 |
| Expense submission and allocation | FR-004–FR-009 |
| Approval policy and decision handling | FR-010–FR-011 |
| Notification use cases | FR-009 |
| Balance query service | FR-012 |
| Payment record and confirmation | FR-013 |
| Report query service | FR-014–FR-015 |
| SQLite persistence and `UnitOfWork` | FR-001–FR-015 |
| Receipt store | FR-008 |
| Future REST adapter and web/Android/iOS clients | FR-016 (deferred; not covered by this MVP) |
