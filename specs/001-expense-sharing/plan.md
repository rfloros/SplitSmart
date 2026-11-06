# Implementation Plan: SplitSmart Expense Sharing

**Branch**: `001-expense-sharing` | **Date**: 2026-11-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification, recorded clarifications, and project constitution.

## Summary

Design a Java 21/Maven expense-sharing product with a Swing desktop client separated
from business logic and a shared HTTPS service backed by PostgreSQL. The service is
the source of truth for accounts, groups, expenses, decisions, payments, and derived
balances; it supports transactions and lets future clients use the same application
operations. Money uses `BigDecimal` in the domain and exact integer minor units in
persistence. The MVP uses single-stage expense review and in-application
notifications. The web, Android, and iOS clients and external email/push/SMS
notifications are not delivered by this Swing slice.

## Technical Context

**Language/Version**: Java 21

**Primary Dependencies**: Maven; Java Swing desktop client; HTTPS/JSON REST API
described with OpenAPI; PostgreSQL persistence through JDBC; JUnit 5; PlantUML.
The HTTP framework and email delivery provider are deployment choices behind the
documented contracts, not prerequisites for this architecture.

**Storage**: PostgreSQL for authoritative account and group data; private receipt
content storage behind a `ReceiptStorage` port, with metadata and ownership in
PostgreSQL. Currency amounts persist as integer minor units with an ISO currency
code, not floating-point SQL values.

**Testing**: JUnit 5 unit tests for domain and use cases; PostgreSQL-backed
integration tests for transactional operations; API contract tests; Swing
presentation tests limited to view behavior and delegation.

**Target Platform**: Java 21 desktop (Swing) plus a Java 21 service on a supported
server runtime. Future browser and mobile clients are outside this implementation
slice.

**Project Type**: Maven multi-module desktop-client and service application.

**Performance Goals**: Preserve the spec's NFR-003 target: 95% of common
expense, balance, and report views usable within 3 seconds for groups of up to 100
members and 10,000 expenses under ordinary network conditions. This is a
verification target, not a result established by this design.

**Constraints**: Swing views must not contain business decisions or persistence
logic. All monetary logic uses `BigDecimal`; rounding is explicit and allocation
shares reconcile exactly. Expense decisions and payment confirmations must be
transactional and idempotent. Access to group records is authorized on the service.
Use one supported ISO currency per group; multi-currency conversion is excluded.
Receipt uploads accept JPEG or PNG images up to 10 MiB.

**Scale/Scope**: Initial desktop client, shared service, and one relational database;
single-stage review, in-app notifications, core group/expense/balance/payment
workflows, and date-filtered reports. The spec's full web/mobile platform matrix and
multiple approval stages remain future scope.

## Constitution Check

*Gate: evaluated before research and again after the design.*

| Principle or constraint | Gate | Evidence / treatment |
|---|---|---|
| Customer requirements and traceability | PASS | [architecture.md](./architecture.md) maps architectural components to FR-IDs; implementation tasks and tests must continue this trace. |
| Object-oriented design and GUI separation | PASS | Swing client calls application operations over the API; server-side domain and application logic do not depend on Swing. |
| Monetary accuracy | PASS | Domain amounts are `BigDecimal`; currency precision and largest-remainder allocation are explicit; storage uses integer minor units. |
| Verified behavior | PASS | JUnit 5 and requirement-linked test scenarios are planned in [quickstart.md](./quickstart.md). |
| Human review of AI output | PASS | Generated diagrams and design are proposals requiring human review before acceptance. |
| Java 21, Maven, Swing, JUnit 5, PlantUML | PASS | All are included in the technical context and project structure. |
| Full platform scope (FR-016) | BOUNDED EXCEPTION | A Swing MVP does not meet the web-primary/Android/iOS customer requirement. This is explicit in the spec; the shared service/API enables future clients but does not claim delivery or verification of them. |

No unapproved architecture violation is introduced. The bounded platform scope is
not a claim that FR-016 has been satisfied.

## Project Structure

### Documentation (this feature)

```text
specs/001-expense-sharing/
├── plan.md
├── research.md
├── architecture.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
└── diagrams/
    ├── domain-model.puml
    ├── application-services.puml
    ├── expense-creation-approval.puml
    └── payment-settlement.puml
```

### Source Code (repository root)

```text
pom.xml                         # Maven reactor
splitsmart-core/
├── src/main/java/               # Domain model, rules, use cases, and ports
└── src/test/java/               # Domain and application unit tests
splitsmart-server/
├── src/main/java/               # REST adapters, PostgreSQL and receipt adapters,
│                                # email adapter, and composition root
├── src/main/resources/          # Versioned database schema
└── src/test/java/               # API and persistence integration tests
splitsmart-desktop/
├── src/main/java/               # Swing views/presenters and HTTPS API client
└── src/test/java/               # Presentation/delegation tests
```

**Structure Decision**: Use three Maven modules. `splitsmart-core` owns the
framework-independent domain and use cases; `splitsmart-server` implements ports
and exposes the API; `splitsmart-desktop` is a thin Swing client and depends only
on the API contract/client, not on server persistence. This keeps business behavior
testable without constructing Swing components and avoids distributing database
credentials to desktop installations.

## Design Outputs

- [Architecture and FR traceability](./architecture.md)
- [Domain model and validation](./data-model.md)
- [REST interface contract](./contracts/openapi.yaml)
- [Domain class diagram](./diagrams/domain-model.puml)
- [Application/service class diagram](./diagrams/application-services.puml)
- [Expense creation and approval activity](./diagrams/expense-creation-approval.puml)
- [Payment settlement activity](./diagrams/payment-settlement.puml)
- [Validation guide](./quickstart.md)

## Complexity Tracking

No constitution violations require an exception beyond the explicitly bounded
platform scope above. The three-module split is the minimum separation that keeps
Swing independent from business logic and persistence while providing one shared
service for multiple clients.
