# SplitSmart architecture reviews and comparison

**Date:** 2026-11-05  
**Branch reviewed:** local checkout of `lab7-architecture`  
**Status:** Design review proposal for human review; no architecture accepted by this report.

## Scope and criteria

This review evaluates the repository documents, not an implemented application or the live GitHub branch. The checkout reported `lab7-architecture...origin/lab7-architecture`; no remote fetch was performed. No Java sources, Maven build, or executable tests were found. Coverage below means **documented design coverage**, not passed acceptance tests. PlantUML source was inspected; diagrams were not rendered or syntax-validated.

Criteria, in order of authority:

- [UserRequirement.md](../UserRequirement.md): customer accounts, groups, expenses, notifications, approval, balances, payments, reports, and primary web plus Android/iOS support.
- [Feature specification](../specs/001-expense-sharing/spec.md): FR-001–FR-016, AC-001–AC-013, NFR-001–NFR-006, clarifications, and the explicitly bounded Swing MVP.
- [Constitution](../.specify/memory/constitution.md): requirement/test traceability; object-oriented design and Swing separation; `BigDecimal` with explicit rounding; JUnit 5; human review; Java 21, Maven, Swing, and maintained PlantUML diagrams.

Architecture A includes [plan.md](../specs/001-expense-sharing/plan.md), [architecture.md](../specs/001-expense-sharing/architecture.md), [data-model.md](../specs/001-expense-sharing/data-model.md), [research.md](../specs/001-expense-sharing/research.md), [quickstart.md](../specs/001-expense-sharing/quickstart.md), the [OpenAPI contract](../specs/001-expense-sharing/contracts/openapi.yaml), the requirements checklist, and all four `.puml` diagrams. Architecture B is [architecture-alt.md](architecture-alt/architecture-alt.md), including its embedded class and activity diagrams.

The specification permits single-reviewer approval and in-app notifications for the Swing slice. This does not satisfy full FR-010 multi-stage support or FR-016. Neither design should be penalized for omitting optional export or extra notification channels that the specification does not require for this slice. Conversely, a future extension point is not delivered functionality.

## Report A — Spec Kit base

### Requirements coverage

| FR-IDs | Design assessment | Evidence and qualification |
|---|---|---|
| FR-001–FR-002 | Substantially specified | Identity use cases, real email-delivery port, verified-email sessions, unique normalized email, and expiring single-use recovery tokens. Server-side identity and authorization support private account scope. Operational configuration and tests remain necessary. |
| FR-003 | Substantially specified | Manager-controlled membership and current-member checks on all group reads/writes. Reviewer designation is described, but the API for updating an existing member's roles needs clarification. |
| FR-004–FR-005 | Substantially specified | Expense amount/date/description/payer/participants and payer-included/excluded semantics are explicit in the model and contract. Unique participants are required in allocation prose but not expressed in the request schema. |
| FR-006–FR-007 | Strong design coverage | Explicit largest-remainder allocation, stable stored participant order, nonnegative percentages totaling exactly 100%, and reconciliation to the total. |
| FR-008 | Substantially specified | Private receipt storage, authorized retrieval, actual-content validation, JPEG/PNG up to 10 MiB, opaque IDs, and cleanup of unlinked uploads. Receipt ownership/linking rules need more precision. |
| FR-009 | Strong design coverage | Expense, shares, and notification rows are persisted in one database transaction. Reads recheck membership. Client refresh timing is not specified sufficiently to establish the 60-second target. |
| FR-010 | Partial full-product coverage; Swing scope covered | One authorized review decision is modeled. Multi-stage policy is future work, not implemented support. |
| FR-011–FR-012 | Strong design coverage | Conditional pending-state transition prevents repeat decisions; balances derive from approved shares and confirmed payments. Payer self-shares do not create self-debt. |
| FR-013 | Covered with a concurrency gap | Pending payments, recipient-only confirmation, and confirmation-time debt revalidation are explicit. Transactional state changes alone do not establish serialization across different payments against the same debt. |
| FR-014–FR-015 | Substantially specified | Expense/payment summaries, current balances, inclusive date filtering, reversed-range rejection, and empty results. Status inclusion and temporal balance semantics need a single explicit definition. |
| FR-016 | Deferred | Shared language-neutral API supports future clients. No primary web experience or Android/iOS application is delivered. |

### GUI/business-logic separation

A separates `splitsmart-core`, `splitsmart-server`, and `splitsmart-desktop`. Swing presenters call the HTTPS API; the server owns allocation, authorization, approval, payments, and persistence. Network calls run off the Event Dispatch Thread (EDT), with UI changes returned to the EDT. This is a sound fit for Constitution II, and keeping database credentials out of desktop installations is a useful boundary.

The application/service diagram reinforces this separation. The proposed module layout alone does not prove it: dependency declarations and import checks still need to enforce a Swing-free core. Presenter interfaces and DTO mappings are less explicit than in B. The plan's claim that three modules are the “minimum separation” is overstated; a single module can enforce package boundaries, though separate deployment makes this split reasonable.

### BigDecimal and money handling

A uses `BigDecimal` in domain calculations, exact minor-unit storage with a currency code, decimal strings in the API, rejection of excess input precision, and explicit round-down plus remainder distribution. These choices align well with Constitution III and FR-006–FR-007. Integer persistence is a representation boundary, not a proposal to use floating-point arithmetic.

Define maximum monetary values and exact conversion/overflow behavior before implementation. If minor units use a fixed-width integer, conversion must reject overflow; SQL totals also need a defined range. The domain class diagram does not show the expense total, and its dotted `Money` links do not clearly express typed ownership. These are diagram omissions rather than evidence that the prose omits money rules.

### Testability with JUnit 5

Core domain/use-case tests can run without Swing. The validation guide also plans PostgreSQL integration tests, API contract tests, presentation delegation checks, monetary boundaries, authorization, and performance verification. This is appropriate coverage across the real boundaries and stronger on deployed-system validation than B's primarily local test approach.

No executable suite or FR-to-test inventory exists yet. The plan's constitution gates marked `PASS` for verified behavior should be read as planned alignment, not proof of compliance. Add identified JUnit 5 cases for every FR/AC, using fakes for fast core tests and the real database for transaction/isolation tests. A same-payment retry test is insufficient: two distinct pending payments for 60 against a debt of 100 must not both confirm.

### Diagram quality — class and activity

The maintained sources are [domain-model.puml](../specs/001-expense-sharing/diagrams/domain-model.puml), [application-services.puml](../specs/001-expense-sharing/diagrams/application-services.puml), [expense-creation-approval.puml](../specs/001-expense-sharing/diagrams/expense-creation-approval.puml), and [payment-settlement.puml](../specs/001-expense-sharing/diagrams/payment-settlement.puml).

Strengths: separate domain/service views; useful multiplicities and ownership; clear infrastructure ports; swimlanes that show client/service/storage responsibilities; pending, approved, rejected, and confirmed semantics; explicit rejection/conflict paths. The diagrams are compact enough for a student to explain.

Gaps: most domain fields lack types and methods; `Expense` lacks its total; `Payment` lacks the version mentioned in the plan's state-safety intent; the service diagram omits several authorization and balance-query dependencies. The expense activity's lane labeled “PostgreSQL and receipt store” can imply one atomic transaction across the database and file/object storage, while the prose correctly describes separate upload and orphan cleanup. Receipt-validation failure needs its own activity branch. The payment activity does not branch on an unauthorized confirming actor and does not explicitly recheck current membership at confirmation. These diagrams simplify the design but should not obscure these failure paths.

### Complexity/risk for a student MVP

**Operational risk: high relative to a local demo. Domain/workflow complexity: moderate.** A requires a server, HTTPS/session handling, PostgreSQL, schema management, email delivery, receipt storage, API serialization, and a network-aware Swing client. These are substantial setup and integration costs for a class project. The server framework and concrete build/deployment choices are still undecided.

The financial design is comparatively simple: approved expenses and confirmed payments remain the authoritative history; no separate event bus or ledger-posting pipeline must stay synchronized. A central service also gives different users one shared group state. This is a stronger fit for the customer collaboration use case, even though it costs more to build and run.

### Extensibility to web, Android, and iOS

A has the more concrete extension route: future clients consume an existing HTTPS/OpenAPI boundary and reuse centrally enforced financial rules. Swing itself is not reusable on mobile or in a browser. Client applications, client authentication behavior, deployment, and cross-platform AC-012/SC-007 verification still require implementation. API-first design reduces that work; it does not fulfill FR-016.

### Gaps and inconsistencies to resolve

1. **High — cross-payment concurrency:** specify a shared lock/serialization rule for each group/account pair, or serializable transactions with retry. A conditional update on payment P1 cannot prevent payment P2 from also confirming against the same earlier balance. Authorizations and membership changes likewise need a defined transaction boundary.
2. **Medium — contract completeness:** adding a member is also described as designating a reviewer, but only `POST` with “membership created” is provided. Define updates to existing members, reviewer removal, creator reviewer defaults, and protection against removing the last reviewer. Return relevant validation/conflict responses consistently.
3. **Medium — receipt lifecycle:** define same-group ownership checks when linking `receiptId`, whether a receipt can be reused, and who can read an unlinked upload. An opaque ID alone is not authorization.
4. **Medium — reporting semantics:** define whether expense totals/counts include pending/rejected records, whether payment counts include pending payments, and that current balances are not date-filtered historical balances. Align SC-006's zero financial effect for pending/rejected records with these fields.
5. **Medium — traceability and verification:** add implementation tasks and FR/AC-linked tests; no task artifact or executable results were found. Keep constitution gates and the checklist's “meets measurable outcomes” wording from suggesting measured success.
6. **Low — document consistency:** plan metadata says branch `001-expense-sharing`, while this checkout is `lab7-architecture`; the spec says its branch is not managed. Architecture traceability's Swing row omits FR-009 despite the presentation-layer table including it. Align diagrams with receipt transaction boundaries and typed money fields.

## Report B — Alternative hexagonal/event-driven design

### Requirements coverage

| FR-IDs | Design assessment | Evidence and qualification |
|---|---|---|
| FR-001–FR-002 | Partial | Accounts, hashing, verification flags, and recovery tokens are modeled. An in-app verification outbox demonstrates token handling but does not verify control of an email address. Recovery access and session/principal handling are underspecified. |
| FR-003 | Local design coverage | Group roles and `AccessPolicy` support manager/member restrictions. A local SQLite file does not share group state across independent desktop installations. |
| FR-004–FR-005 | Strong local design coverage | Explicit expense aggregate, fields, validation, payer inclusion/exclusion, and participant shares. |
| FR-006–FR-007 | Covered with numerical-policy concerns | Largest remainder, stable order, exact percentage-total validation, and a final reconciliation assertion are specified. Input rounding and approximate intermediate division need correction or tighter bounds. |
| FR-008 | Substantially specified locally | Receipt port, opaque reference, file copying, image validation, and configured size/type limits. Protected retrieval and failed-submission cleanup need explicit workflows. |
| FR-009 | Partial reliability coverage | Expense-submitted events create persisted notifications for other members. After-commit processing can lose work without a durable outbox written in the expense transaction and a retry worker. Local polling is not evidence of meeting the network target. |
| FR-010 | Partial full-product coverage; Swing scope covered | Single-reviewer policy plus a proposed multi-stage strategy. Future policy types are not implemented multi-stage behavior. |
| FR-011–FR-012 | Strong local design coverage, conditional on atomic posting | Expense state/version checks and unique ledger source-line keys prevent duplicate effects when handlers share the transaction. Ledger pairwise netting and payer self-share treatment are explicit. |
| FR-013 | Covered with concurrency/diagram gaps | Pending/confirmed states, recipient-only confirmation, and revalidation. Per-payment versions do not by themselves protect a shared debt across different payments. Current membership checks are missing from the confirmation activity. |
| FR-014–FR-015 | Substantially specified | Report read models, inclusive dates, reversed-range errors, and empty totals. Ledger effective-date and report-status semantics need definition. |
| FR-016 | Deferred | A future REST adapter is proposed. Neither shared server deployment nor web/mobile clients exist in the MVP design. |

### GUI/business-logic separation

B gives the clearest presentation design: passive view interfaces, plain-Java presenters, immutable command/result DTOs, inbound use-case interfaces, and outbound infrastructure ports. Views format/display money while core logic calculates it. `SwingWorker` keeps synchronous use cases off the EDT. Fake views make presenter tests independent of Swing construction.

The claim that Swing “physically cannot reach” the domain is stronger than the design supports. All packages are in one Maven module; package organization alone does not prohibit public-class imports. Proposed import/architecture checks can enforce the boundary only after they are implemented. Also clarify that the restriction on Swing imports applies to production core code, while presenters, view interfaces, and Swing wiring may appropriately reside in the presentation adapter.

### BigDecimal and money handling

An immutable `Money` with amount/currency, centralized `ShareAllocator`, `BigDecimal` percentages, explicit scale, and integer minor-unit persistence are good foundations. Signed ledger entries intentionally need negative money values; expense/payment commands must independently enforce positivity and currency agreement.

Two policies weaken the otherwise strong design:

- `Money.of` applies `HALF_EVEN` at input boundaries. An entered USD amount of `10.005` would become `10.00`, conflicting with AC-003's preservation of the amount unless that normalization is explicitly specified and communicated. The constitution permits explicit rounding, but it does not authorize changing the entered amount silently. Reject unsupported precision or resolve the policy in the spec.
- `MathContext.DECIMAL128` division is finite precision, not an exact representation of every rational share. The sum assertion proves reconciliation, not that the fractional remainder ranking was correct. Use exact minor-unit quotient/remainder for equal shares; use exact finite-decimal percentage arithmetic, or define precision/input bounds and prove the ranking is preserved. Specify integer conversion overflow limits too.

### Testability with JUnit 5

B has excellent planned seams: repositories, clock, password hasher, receipt store, verification sender, `UnitOfWork`, view fakes, and requirement-linked JUnit 5 tags/display names. Tests can independently exercise allocation, access decisions, state transitions, posting, reports, and presentation mapping without Swing or a database.

In-memory repositories cannot establish JDBC uniqueness, rollback, transaction joining, crash recovery, or concurrency behavior. Add real SQLite integration tests for those properties, replay tests that verify duplicate handling rather than simply provoking unique-key exceptions, and presenter/EDT tests where appropriate. Include failure injection between saving an aggregate, posting ledger entries, committing, and notification delivery. Future server adapters need their own integration and cross-client tests. No tests have run in this document-only review.

### Diagram quality — class and activity

B embeds two class diagrams and two activity diagrams in sections 4–5. Domain classes include useful types, operations, enums, aggregate stereotypes, approval strategies, events, stable share positions, and versions. The adapter diagram makes dependency direction and passive presenters more explicit than A. The activities illustrate notification reactions and ledger posting as well as invalid percentages, unauthorized reviewers, optimistic conflicts, and stale payment amounts.

The diagrams are large and harder to follow as a student presentation. Account/group relationships are mostly represented as IDs rather than associations; the ledger-entry class does not draw all its money/source relationships. `Notification` is listed in traceability but not modeled in the domain diagram. `PaymentService` lacks depicted `UnitOfWork`/authorization dependencies, and some declared service/repository types are not wired. Package names differ between the layout (`application.authz`, `application.event`) and diagram (`application.core`).

The prose calls the bus synchronous, but the expense activity uses `fork`, suggesting parallel handlers. The rejection branch notifies before commit despite the after-commit rule. Activities do not consistently show rollback on validation failures. The payment confirmation activity has no current-membership gate. Extracting embedded PlantUML into maintained `.puml` files would simplify rendering and CI checks; embedded PlantUML is not itself a constitution violation. B explicitly admits its diagrams have not been rendered, so visual quality and syntax remain unverified.

### Complexity/risk for a student MVP

**Operational risk: low for a single-machine demo. Domain/workflow complexity: high.** One Maven module, embedded SQLite, manual wiring, and a local file store are easy to launch. The passive-view approach also makes individual classes understandable and testable.

However, ports, DTOs, aggregate events, two handler phases, an append-only ledger, idempotent postings, optimistic versions, and a durable retry mechanism introduce more concepts than the financial workflow needs. The ledger is an additional financial representation that must remain atomic with aggregate state; uniqueness prevents duplicates but does not prevent missing postings. The claim that reports “cannot disagree” with balances requires shared queries, consistent snapshots, and consistent status/date semantics, not just a ledger.

For a classroom simulation with multiple accounts on one machine, this is workable. For separate people using separate devices, shared storage, identity delivery, and service access are material missing scope. Replacing SQLite with JSON is not a trivial equivalent adapter change if transactions, uniqueness, and crash guarantees must be preserved.

### Extensibility to web, Android, and iOS

B's inbound interfaces and infrastructure ports provide good business-code reuse. A REST adapter could host the same use cases on a server, with new browser/mobile clients using that service. That transition still requires transport contracts, authenticated principal/session handling, server deployment, shared receipt access, database migration, concurrency verification, and real verification/recovery delivery. The claim that application code can be reused “unchanged” is an aim, not an established result, especially while session handling is deferred to a future `SessionPort` despite sign-in being in MVP scope.

### Gaps and inconsistencies to resolve

1. **High — collaboration scope:** specify that the current deployment is a single-device simulation, or add a shared application service. Local files do not synchronize accounts, group expenses, receipts, and notifications across installations.
2. **High — identity fidelity:** replace simulated delivery for acceptance testing of FR-001–FR-002, or document a human-approved scope exception in the spec. “Unique verified email” also needs correction: FR-001 rejects addresses associated with any account, including an unverified account.
3. **High — notification durability:** define an outbox table/event ID, atomic enqueue during expense submission, retry/dispatch timing, and deduplication. “Outbox-style” publication and retry on next startup alone do not establish NFR-004's 60-second target. Notifications are required behavior even if their failure should not roll back an approved expense.
4. **High — transaction/concurrency protocol:** define how all JDBC repositories and posting handlers share one connection, how rollback works, and how conflicting payments are serialized. SQLite write serialization may help in the local deployment, but stale read/write failures need an explicit retry/revalidation policy; per-row versions are insufficient as a general future-server solution.
5. **Medium — money policy:** resolve input rounding and replace or justify finite-precision remainder ranking. Define currency matching and supported amounts.
6. **Medium — financial read semantics:** define source dates versus posting/confirmation dates, current versus historical balances, pending/rejected totals, and event replay behavior. A unique-key collision needs deliberate idempotent handling; uniqueness alone is not successful replay processing.
7. **Medium — receipt and authorization lifecycle:** define failed-submission file cleanup, protected receipt retrieval, a trusted authenticated principal for every use case, and membership checks during confirmation. Reconcile activity diagrams with the handler/transaction rules.
8. **Low — enforcement claims:** replace “compile-time” and “strongest possible” separation claims with the actual package-rule checks planned for the single module. Keep performance and delivery claims conditional on measurement.

## Side-by-side comparison

| Dimension | A — Spec Kit base | B — Alternative |
|---|---|---|
| Deployment | Swing client + shared Java HTTPS service + PostgreSQL | Single-process Swing application + local SQLite |
| FR-001–FR-002 | Real email port and session contract; implementation pending | Simulated email outbox; session/principal model incomplete |
| FR-003–FR-008 | Shared group state, expenses, exact splits, private receipts | Strong local modeling; cross-device sharing absent; input rounding concern |
| FR-009 | Notification rows committed with expense | After-commit handlers; durable outbox/retry incompletely defined |
| FR-010 | Single-stage now; multi-stage deferred | Single-reviewer strategy now; future staged strategy |
| FR-011–FR-013 | Derived approved/confirmed history; conditional transitions | Same lifecycle plus atomic event-driven ledger postings and unique source-line keys |
| FR-014–FR-015 | Explicit API/read model; status/date semantics need tightening | Read models over ledger and records; status/date semantics need tightening |
| FR-016 | Existing API design is a concrete future client boundary; clients deferred | Core ports reusable; REST/server work and clients deferred |
| GUI separation | Clear client/server and module boundaries | More detailed passive views/presenters; package enforcement still proposed |
| Money | BigDecimal, decimal-string API, exact minor units, rejects excess precision | Money value object, BigDecimal, exact storage; input rounding and DECIMAL128 concerns |
| JUnit 5 strategy | Unit + PostgreSQL integration + API contract + presentation checks | Strong fakes and presenter seams; needs real DB/outbox/transaction failure tests |
| Class diagrams | Compact; good relationships; sparse types/operations | Detailed operations/strategies/events; larger and partly unwired |
| Activity diagrams | Easier to read; transaction/authorization failures need detail | Richer edge paths; handler phase and fork inconsistencies |
| Student MVP effort | More infrastructure and deployment work | Easier local startup; more financial/event machinery to implement |
| Main correctness risk | Concurrent different payments oversettle one debt without serialization | Same debt concurrency plus missing ledger postings or lost post-commit notifications |
| Traceability | FR/component mapping and validation guide; no executable evidence | Detailed FR/AC/NFR mapping and test naming convention; no executable evidence |
| Constitution assessment | Strong proposed alignment; tests/review still required | Strong separation intent; identity exception and unproven enforcement need resolution |

## Recommendation — separate from the reports

**Choose A as the architecture baseline for the stated customer-facing MVP, and adopt B's passive views, plain-Java presenters, immutable boundary DTOs, and explicit test seams.** A already addresses the need for different people to share one authoritative set of accounts, groups, expenses, and payments. Its existing API boundary also gives the most concrete path toward the customer's primary web and mobile product. Its direct transactional workflow is easier to explain and verify than an additional event-to-ledger pipeline.

A is not the cheapest classroom build. If the assignment explicitly permits a single-machine demonstration, a simplified B can be a reasonable lower-setup choice, but its local-only collaboration and simulated email must be stated as scope exceptions in the feature specification and receive human review. That permission is not established by the documents reviewed here. The current Swing subset does not itself waive email verification or shared-use behavior.

Before implementation, prioritize these decisions:

1. Define the concurrency invariant and transaction/locking strategy for pairwise payment confirmation, including two different pending payments against one debt.
2. Resolve reviewer-management defaults, receipt ownership/linking, and report status/date semantics in the spec and contract.
3. Select A's concrete server runtime and deployment setup; implement a narrow vertical slice from accounts/group through expense approval and balances before adding further abstractions.
4. Keep notification persistence transactional; add external-channel/outbox machinery only when an actual delivery boundary requires it. Avoid adding B's event bus and separate ledger solely to prevent duplicate approval effects that conditional state transitions already handle.
5. Add FR/AC-linked JUnit 5 unit and real-database tests, render/check PlantUML, measure NFR targets, and obtain human review before acceptance.

Both architectures remain proposals. Neither meets full FR-010 or FR-016 today, and neither has executable evidence of constitution compliance or acceptance success.
