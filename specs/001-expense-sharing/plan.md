# Implementation Plan: SplitSmart Expense Sharing

**Branch**: `lab7-architecture` (working branch; the spec's branch field is unmanaged) | **Date**: 2026-11-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification (including the 2026-11-05 architecture/scope decision),
project constitution, and [docs/decisions.md](../../docs/decisions.md).

> This plan was realigned from the earlier shared-server design to the user-selected
> **simplified Architecture B**. The earlier design is kept as a historical comparison
> in [research.md](./research.md). Everything below is a plan; nothing has been built.

## Summary

A single Java 21/Maven module containing a local Swing application separated from
business logic by ports and adapters (passive views, plain-Java presenters, immutable
command/result DTOs, manual composition root). Persistence is one embedded SQLite
database; receipts are files in an app-managed local directory; verification and
recovery messages go to a simulated in-app outbox. Money uses `BigDecimal` at the
domain boundary with exact integer minor-unit arithmetic and storage. The MVP uses
single-reviewer approval and in-app notifications. No server, HTTPS API, PostgreSQL,
real mail provider, cloud storage, synchronization, or deployment work is planned.
Web, Android, and iOS clients (FR-016) are deferred.

## Technical Context

**Language/Version**: Java 21

**Primary Dependencies**: Maven; Java Swing; an SQLite JDBC driver (single adapter
dependency); JUnit 5; PlantUML. The JDK provides password hashing (PBKDF2) and
cryptographic randomness. No HTTP framework, mail provider, or DI framework.

**Storage**: One embedded SQLite file (WAL journal mode planned). Amounts persist as
signed 64-bit integer minor units plus ISO currency code. Receipt content lives in a
private app-managed directory addressed by opaque IDs; metadata lives in SQLite.

**Testing** (all planned, none written): JUnit 5 unit tests with in-memory fakes for
domain/use cases; presenter tests with fake views; real-SQLite tests for rollback,
uniqueness, and write-serialization behavior. See [quickstart.md](./quickstart.md).

**Target Platform**: Java 21 desktop on one machine.

**Project Type**: Single Maven module.

**Performance Goals**: The spec's NFR-003/NFR-004 targets are network-oriented
full-product targets. For the lab, any local measurements are labeled local and do not
establish them. Notification refresh: on demand plus polling ≤ 60 s while signed in.

**Constraints**: Swing views contain no business decisions or persistence. Money uses
`BigDecimal`; amounts not exact at the group scale are rejected; allocation is exact
integer arithmetic. Every state-changing use case takes a `BEGIN IMMEDIATE` write
transaction before reading mutable state used for validation. Receipt file I/O is not
part of the SQLite commit. One supported currency per group (lab set USD, EUR, JPY).
Receipts: JPEG/PNG ≤ 10 MiB (lab default).

**Scale/Scope**: Local single-device simulation of the full workflow set: accounts,
groups, expenses with exact splits, single-reviewer approval, pairwise balances,
pending/confirmed payments, in-app notifications, date-filtered reports.

## Constitution Check

| Principle or constraint | Gate | Evidence / treatment |
|---|---|---|
| Customer requirements and traceability | PLANNED | [architecture.md](./architecture.md) maps components to FR-IDs; AC/NFR/SC applicability to the lab is tabulated in the spec. No tests exist yet. |
| Object-oriented design and GUI separation | PLANNED | Passive views and presenters depend only on inbound ports. Import-rule checks are planned, **not yet implemented**; a single module does not enforce isolation by itself. |
| Monetary accuracy | PLANNED | `BigDecimal`, exact-scale input rejection, integer allocation, integer storage, application-side aggregation; tests to be written. |
| Verified behavior | PLANNED | Scenarios described in the validation guide; executable tests and results do not exist. |
| Human review of AI output | PENDING | All generated artifacts await human review. The architecture *choice* is the user's and is not reopened. |
| Java 21, Maven, Swing, JUnit 5, PlantUML | PLANNED | Included in the technical context and structure. |
| Full platform scope (FR-016) and shared use | RECORDED EXCEPTION | User-accepted lab exceptions in the spec: single-device simulation, simulated verification/recovery, deferred platforms. Not a claim that FR-016 or shared use is satisfied. The constitution is not amended. |

## Project Structure

### Documentation (this feature)

```text
specs/001-expense-sharing/
├── plan.md
├── research.md
├── architecture.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
├── contracts/
│   ├── README.md                # explains current vs future contract
│   ├── inbound-use-cases.md     # CURRENT: use-case/DTO contract (Markdown)
│   └── openapi.yaml             # FUTURE, non-MVP REST proposal
└── diagrams/
    ├── domain-model.puml
    ├── application-services.puml
    ├── expense-creation-approval.puml
    └── payment-settlement.puml
```

Also: [docs/architecture-alt/architecture-alt.md](../../docs/architecture-alt/architecture-alt.md)
(selected-design narrative and trade-offs).

### Planned source layout (not created)

```text
pom.xml                                  # one module
src/main/java/.../domain
src/main/java/.../application/port/in
src/main/java/.../application/port/out
src/main/java/.../application/service
src/main/java/.../application/authz
src/main/java/.../adapter/in/swing
src/main/java/.../adapter/out/persistence
src/main/java/.../adapter/out/files
src/main/java/.../adapter/out/security
src/main/java/.../adapter/out/system
src/main/java/.../bootstrap
src/main/resources/                      # numbered schema scripts (planned)
src/test/java/                           # fakes-based, presenter, real-SQLite tests
```

**Structure Decision**: One module with the package responsibilities in
[architecture.md](./architecture.md). Package isolation is enforced only by planned
import-rule checks; until they exist it is a design commitment.

## Design Outputs

- [Architecture and FR traceability](./architecture.md)
- [Domain model, allocation, and validation](./data-model.md)
- [Current inbound use-case contract](./contracts/inbound-use-cases.md)
- [Future REST proposal (non-MVP)](./contracts/openapi.yaml) — see [contracts/README.md](./contracts/README.md)
- [Domain class diagram](./diagrams/domain-model.puml)
- [Application structure diagram](./diagrams/application-services.puml)
- [Expense creation and approval activity](./diagrams/expense-creation-approval.puml)
- [Payment settlement activity](./diagrams/payment-settlement.puml)
- [Validation guide](./quickstart.md)

## Complexity Tracking

| Item | Why kept | Simpler alternative rejected because |
|---|---|---|
| Ports/adapters, passive views, presenters, DTOs | Strong GUI/logic separation and JUnit 5 seams (Constitution II, IV). | Direct JDBC from Swing listeners couples UI to persistence and blocks Swing-free tests. |
| `UnitOfWork` with `BEGIN IMMEDIATE` | Serializes financial writes locally, closing the cross-payment race. | Per-row version checks alone do not protect different payments against one debt. |
| Simulated outbox | Demonstrates token lifecycle without a mail server. | Real mail delivery is outside the lab scope. |

Removed from the earlier B proposal: event bus, domain-event pipeline, handler phases,
posting handler, persisted ledger table, notification retry/outbox subsystem.
