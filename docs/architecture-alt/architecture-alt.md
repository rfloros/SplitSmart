# SplitSmart — Selected Architecture: Simplified Hexagonal (Architecture B)

**Status**: Selected by the user on 2026-11-05 ([docs/decisions.md](../decisions.md)). The
generated design artifacts below still await human review (Constitution, Principle V).
**Scope**: Java 21 / Maven / Swing lab MVP — one module, one local application, one
embedded SQLite database, local receipt directory.
**Authoritative companions**: [spec.md](../../specs/001-expense-sharing/spec.md) (decision, scope
exceptions, lab rules), [architecture.md](../../specs/001-expense-sharing/architecture.md),
[data-model.md](../../specs/001-expense-sharing/data-model.md),
[contracts/](../../specs/001-expense-sharing/contracts/README.md).
**History**: this file began as an alternative (event-driven) proposal. The event bus,
posting handlers, separate ledger, and notification retry machinery in that proposal
were **removed** after review ([architecture-review.md](../architecture-review.md),
[reviews/architecture-reviews.md](../reviews/architecture-reviews.md), kept unchanged as
historical records).

---

## 1. Summary

A hexagonal (ports-and-adapters) design in a single Maven module:

1. **Core independent of infrastructure.** `domain` and `application` import neither
   Swing, JDBC, nor adapter classes. Swing is one *driving* adapter; SQLite, local
   files, hashing, clock, and the simulated outbox are *driven* adapters behind ports.
2. **Direct orchestration inside a `UnitOfWork`.** Each use case is a short synchronous
   sequence: trusted caller → `BEGIN IMMEDIATE` → check → conditional write →
   commit. There is no event bus, handler phase, or retry subsystem.
3. **Derived balances.** Pairwise balances are computed from approved expense shares and
   confirmed payments (the "financial history"). There is no separate ledger table and
   no stored balance total.
4. **Passive views and plain-Java presenters** keep Swing free of business decisions
   (Constitution II) and give JUnit 5 seams (fake views, in-memory repositories).

This is a **single-device local simulation**. Accepted scope exceptions (single-device
simulation, simulated verification/recovery, deferred web/mobile) are recorded in the
spec; this document does not claim they are satisfied.

## 2. Component Breakdown

### 2.1 Packages

```
com.splitsmart
├── domain                   accounts, groups/membership, expenses/shares, payments,
│                            notifications, money/allocation, approval rules
├── application
│   ├── port.in              use-case interfaces, immutable commands/results
│   ├── port.out             repositories, receipt store, password hasher,
│   │                        verification sender (+ outbox reader), clock, UnitOfWork
│   ├── service              synchronous use-case orchestration and queries
│   └── authz                authorization policy + trusted current-account context
├── adapter.in.swing         views, presenters, view models, formatting, EDT/background
├── adapter.out.persistence  SQLite repositories, shared-connection UnitOfWork, outbox
├── adapter.out.files        local receipt store
├── adapter.out.security     PBKDF2 hasher, token generation/hashing
├── adapter.out.system       system clock
└── bootstrap                manual composition root, startup, orphan-receipt sweep
```

### 2.2 Responsibilities

| Component | Responsibility | May depend on |
|---|---|---|
| Domain | Allocation, expense/payment state rules, approval rule, notification and balance value types. | JDK only |
| Application services | One use case each: resolve caller, begin write transaction, validate, write, commit; queries for balances, reports, notifications. | domain, ports |
| Authorization (`application.authz`) | `CurrentAccountContext` (set only by sign-in) and `AccessPolicy` (membership, reviewer, recipient, manager). | domain, ports |
| Inbound ports | The only API presenters see. | domain value types, DTOs |
| Outbound ports | Persistence, receipts, hashing, clock, delivery, transaction scope. | domain |
| Swing adapter | Renders view models, maps gestures to commands, maps results to messages; runs use cases off the EDT. | inbound ports |
| Persistence adapter | SQLite repositories sharing one connection; write-transaction protocol. | outbound ports |
| Bootstrap | Builds the object graph, runs Swing on the EDT. | everything |

### 2.3 How the GUI stays separate

- **Passive views:** each screen has a view interface (get/set/show) implemented by a Swing
  panel, and a plain-Java presenter holding screen logic. Presenters call inbound ports
  with immutable commands and receive immutable DTOs; they hold no domain entities.
- **No arithmetic in the UI:** amounts are formatted by `MoneyFormatter` from DTO values.
- **Threading:** use cases are synchronous and UI-agnostic; the Swing adapter runs them
  off the EDT (e.g. `SwingWorker`) and returns view updates to the EDT.
- **Honest enforcement statement:** one Maven module does not by itself prevent a public
  class from being imported across packages. The plan is an automated import-rule check
  (domain/application must not import `javax.swing`, `java.sql`, or `adapter.*`;
  `adapter.in.swing` must reach the core only through `application.port.in`). It is
  **not implemented yet**. Presenters and view interfaces legitimately live in the
  Swing adapter; the Swing-import ban applies to production core code.

### 2.4 Trusted current-account context

Sign-in is the only operation that sets the context; sign-out clears it. Every use case
resolves the caller from it. Commands never contain the caller's account ID, so a supplied
ID cannot stand in for authentication.

### 2.5 Simulated verification/recovery outbox (lab-only)

Verification and recovery messages are stored in an in-app outbox. The sign-in window
offers a "Lab outbox (simulated email)" screen **before sign-in**: the tester enters an
email address and reads its messages. It demonstrates token lifecycle (random, hashed at
rest, expiring, single-use, replaced by newer tokens) and gives **no real
email-ownership guarantee**. Email uniqueness is normalized and applies across all
accounts, including unverified ones.

## 3. Domain Model and Persistence

Diagram: [domain-model.puml](../../specs/001-expense-sharing/diagrams/domain-model.puml).
Details: [data-model.md](../../specs/001-expense-sharing/data-model.md).

### 3.1 Money and exact allocation (Constitution III, NFR-001)

- `BigDecimal` is the monetary boundary type; `Money` carries a currency; each group has
  one supported currency and scale. Signed balances are a distinct type.
- Inputs must be exactly representable at the group scale or are **rejected** (USD
  `10.005` rejected; `10.000` → `10.00`). There is no input rounding mode and no
  approximate division.
- Allocation is integer arithmetic: equal split by quotient/remainder with leftover units in
  stored order; percentage split via `T × w_i` divided by `D = 100 × 10^k` with exact
  quotient and remainder, leftover units by descending remainder, ties by stored order.
  Shares must sum exactly to the total.
- Storage is signed 64-bit integer minor units plus currency; lab limits (≤ 10^12 minor
  units per amount, ≤ 32 input characters, ≤ 4 percentage decimals) reject overflow.
  Aggregation is application-side with arbitrary-precision integers (no SQLite `SUM` on
  money).

### 3.2 Aggregates and derived results

Accounts, groups (with memberships and the single-reviewer policy), expenses (with ordered
shares, optional receipt reference, one decision), payments, and **notifications** (recipient
account + expense) live in the domain. Balances and reports are derived results, not
entities. A payer's own share creates no self-debt; an excluded payer is owed every share.

### 3.3 Persistence

- Embedded SQLite (WAL planned), explicit mapping in the adapter, numbered schema scripts
  applied at startup (planned).
- **Transaction protocol:** every state-changing use case obtains a write transaction with
  `BEGIN IMMEDIATE` before reading mutable state used for validation; all repository calls
  share that connection; reads, checks, conditional updates, and commit form one
  operation. Busy/locked → bounded wait, then restart the **whole** transaction
  (rerunning authorization and debt checks); exhaustion → clear failure, no change.
  Read-only report queries use a consistent read transaction.
- **Receipts:** local private directory, opaque IDs, JPEG/PNG ≤ 10 MiB by content,
  retrieval through an authorized use case. File I/O is **not** part of the SQLite commit:
  the file is copied before the transaction and deleted (best effort) if submission fails;
  a startup sweep removes files with no database record.
- **Notifications:** written in the expense-submission transaction (failure rolls back the
  submission); read by the recipient only after a membership recheck; client refresh on
  demand plus polling ≤ 60 s while signed in.

## 4. Diagrams

Maintained PlantUML sources (single source of truth; not duplicated here):

- Domain classes: [domain-model.puml](../../specs/001-expense-sharing/diagrams/domain-model.puml)
- Application structure: [application-services.puml](../../specs/001-expense-sharing/diagrams/application-services.puml)
- Expense creation + approval: [expense-creation-approval.puml](../../specs/001-expense-sharing/diagrams/expense-creation-approval.puml)
- Payment settlement: [payment-settlement.puml](../../specs/001-expense-sharing/diagrams/payment-settlement.puml)

They were source-reviewed only; no PlantUML tooling was available, so they have **not**
been rendered or syntax-checked.

## 5. Key Rules Worked Through

**Oversettlement.** Debt is 100; two distinct pending payments are 60 each. Both
recipients confirm concurrently. The write lock serializes them: the first re-derives 100 ≥
60 and confirms; the second re-derives 40 < 60, stays pending, and reports a validation
error. Repeating the first confirmation is refused as a conflict and cannot apply twice.

**Payment confirmation.** Resolve caller → `BEGIN IMMEDIATE` → load payment → current
membership of actor and both parties → actor is recipient → payment is pending → derive
current net debt in-transaction → reject if over debt → conditional confirm → commit.

**Reviewers.** Creator is manager + reviewer by default (lab default); managers update roles
and reviewer flags; removing/demoting/clearing the last reviewer or manager is rejected;
self-review is allowed (lab default; Open Question 8).

**Reports.** Totals use approved expenses and confirmed payments only, by entered date,
endpoints inclusive, reversed range rejected; pending/rejected/pending-payment items appear
only in separate counts; current balances use all history and are labeled "current".

## 6. Traceability

| Component | FR-IDs | Related AC/NFR/SC | Lab status |
|---|---|---|---|
| Account use cases + simulated outbox | FR-001, FR-002 | AC-001 | Simulated delivery only (exception) |
| Current-account context + `AccessPolicy` | FR-002, FR-003, FR-008–FR-015 | NFR-002, SC-003 | Local |
| Group/membership use cases | FR-003, FR-010 | AC-002 | Local |
| Expense submission | FR-004, FR-005, FR-008, FR-009 | AC-003, AC-006, AC-007 | Local |
| `ShareAllocator`/`Money` | FR-006, FR-007 | AC-004, AC-005, NFR-001, SC-002 | Local |
| Notification query | FR-009 | AC-007, NFR-004 | In-app, local; network target not established |
| Approval (single reviewer) | FR-010, FR-011 | AC-008, SC-006 | Single reviewer only |
| Balance query | FR-012 | AC-009, SC-006 | Local |
| Payment use cases | FR-013 | AC-010 | Local |
| Report query | FR-014, FR-015 | AC-011 | Local |
| SQLite adapters / `UnitOfWork` | FR-001–FR-015 | NFR-003, NFR-006 | Local timings not network evidence |
| Swing presenters/views | FR-001–FR-015 | NFR-006, SC-001 | Local |
| *(Future)* REST adapter, web/Android/iOS | FR-016 | AC-012, SC-007, NFR-005 | **Deferred**; not delivered |

## 7. Trade-offs

**Strengths**: no server or deployment to build; strongest GUI/logic separation of the
options considered, with test seams for repositories, time, hashing, delivery, receipts,
and transactions; simple, explainable transactions; the oversettlement race is closed by a
concrete write-lock rule; fewer moving parts than the earlier event-driven proposal.

**Weaknesses**: still more indirection (ports, DTOs, presenters) than basic MVC; DTO/domain
mapping duplication; **no multi-device sharing**; simulated identity; SQLite serializes all
writers (acceptable locally, not a scalability story); package isolation is only as strong
as the (not yet written) import-rule check.

**Risks and mitigations**

| Risk | Mitigation |
|---|---|
| Layer rules erode | Implement the import-rule check early; run in `mvn verify`. |
| Busy/locked writes under several UI actions | Bounded wait, whole-transaction retry, clear failure; test with real SQLite. |
| Receipt files diverge from DB | Delete on failure; startup orphan sweep; never call file I/O atomic with the commit. |
| Money edge cases | Exact integer algorithm; exhaustive allocation tests incl. ties, limits. |
| Scope exceptions misread as full delivery | Exception table and applicability table in the spec; checklist leaves unmeasured items unchecked. |
| AI-generated design errors | Human review before acceptance. |

## 8. Outside the Swing MVP, and a Possible Future Extension

Outside the MVP (not implemented): web, Android, and iOS clients (FR-016, AC-012, SC-007,
cross-client NFR-005); shared multi-device use; real verification/recovery email;
multi-stage approval (FR-010 full product); email/push/SMS notifications; multi-currency;
report export.

**Possible future extension (future work only).** A REST adapter could host the same inbound
use cases on a central server (the unimplemented sketch is
[openapi.yaml](../../specs/001-expense-sharing/contracts/openapi.yaml), see
[contracts/README.md](../../specs/001-expense-sharing/contracts/README.md)). That would still
require shared persistence (replacing local SQLite and local receipts), network identity and
session security, API contracts, a re-verified concurrency strategy (the SQLite
write-lock rule does not transfer automatically), real email delivery, deployment, and the
new clients. Code reuse is an aim, not an established result.

## 9. Open Items

1. Human review of this document, the spec changes, and the diagrams (pending).
2. Render/syntax-check the PlantUML sources (not done).
3. Remaining product questions: spec Open Questions 1–9 (currencies, reviewer configuration
   roles, multi-stage rules, channels, export, platform launch scope, receipt limits,
   self-review, removed-member balances).
