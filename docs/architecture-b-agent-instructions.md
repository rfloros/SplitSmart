# Coding-agent instructions: align documentation with simplified Architecture B

## Task and hard boundaries

Update the SplitSmart requirements, architecture, design documents, and PlantUML sources to consistently describe the **user-selected, simplified Architecture B**. The decision is authorized; do not reopen the A-versus-B choice or ask for approval of the scope exceptions listed below.

This is a **documentation-only task**. Do not write Java code, tests, SQL migrations, Maven build files, application scaffolding, or a running application. Do not run an implementation workflow. Test cases in this task are written validation scenarios, not executable tests. Do not commit, push, or publish unless separately requested.

- Do not edit `UserRequirement.md`.
- Preserve FR-001–FR-016 identifiers and their customer/full-product meaning. Preserve existing AC/NFR/SC identifiers; clarify applicability rather than deleting or renumbering requirements to claim completion.
- Do not amend `.specify/memory/constitution.md` to accommodate this decision. Record implementation scope exceptions in the feature specification.
- Preserve unrelated edits and historical architecture reviews. Do not rewrite earlier reviews to make them endorse B retroactively.
- Inspect applicable `AGENTS.md` instructions before editing. Read the current files; do not assume their contents match a previous review.

## Read first

Read `UserRequirement.md`, `.specify/memory/constitution.md`, `specs/001-expense-sharing/spec.md`, `docs/decisions.md`, `docs/architecture-alt/architecture-alt.md`, and the architecture review reports. Then inspect the complete feature folder, including its plan, research, model, contract, validation guide, checklist, and four diagrams.

Treat `docs/decisions.md` and this brief as the user's selection of B. Customer requirements remain authoritative for the complete product; the lab deliberately implements a narrower simulation.

## Target design

One Java 21/Maven module, one local Swing application, one embedded SQLite database, and an app-managed local receipt directory. No active server, HTTPS API, PostgreSQL, real mail provider, cloud storage, synchronization service, or deployment work is part of this lab.

Keep B's ports/adapters structure, passive views, plain-Java presenters, immutable commands/result DTOs, manual composition root, and test seams for repositories, time, hashing, verification delivery, receipt storage, and transactions. Use these canonical package responsibilities consistently:

- `domain`: accounts, groups/membership, expenses/shares, payments, notifications, money/allocation, and approval rules.
- `application.port.in`: use-case interfaces and boundary commands/results.
- `application.port.out`: repositories, receipt store, password hasher, verification sender, clock, and `UnitOfWork`.
- `application.service`: synchronous use-case orchestration and queries.
- `application.authz`: authorization policy using a trusted signed-in account context.
- `adapter.in.swing`: views, presenters, view models, formatting, and background/EDT coordination.
- `adapter.out.persistence`, `adapter.out.files`, `adapter.out.security`, `adapter.out.system`: concrete infrastructure adapters.
- `bootstrap`: wiring and startup.

Domain/application code must not import Swing, JDBC, or adapter classes. Presenters delegate business decisions through inbound ports. A single module does not automatically enforce package isolation: describe planned import-rule checks honestly. Background use-case execution must not block the EDT; view updates return to the EDT.

## Record the decision and exceptions in spec.md

Add a dated architecture/scope decision referencing `docs/decisions.md`. Explain that CIS 285 is a short lab sequence ending after the next continuation, so local operation and limited setup are preferred. State that simplified B is selected and A's infrastructure is outside this implementation scope.

Add an explicit exception table containing:

| Exception | Affected criteria | Lab behavior and full-product status |
|---|---|---|
| Single-device simulation | Shared-use customer scenarios; FR-002–FR-003 and group workflows FR-004–FR-015; network conditions in NFR-003–NFR-004 | Multiple accounts use one local database, potentially by signing in sequentially. No synchronization across computers. Local acceptance does not prove distributed collaboration or network performance. |
| Simulated verification/recovery | FR-001–FR-002, AC-001 | In-app outbox exposes verification/recovery messages for the lab. It demonstrates token lifecycle, not ownership of a real email address or production identity assurance. |
| Deferred platforms | FR-016, AC-012, SC-007; cross-client portion of NFR-005 | No web, Android, or iOS clients are delivered. A future REST adapter can host the same use cases centrally; it is not implemented now. |

Preserve the existing single-reviewer limitation for FR-010 and the in-app-only notification choice. Mark multi-stage approval as future work. Record these exceptions as the user's accepted lab scope; do not claim that documentation changes satisfy the full requirements. Keep human review of generated artifacts pending as required by the constitution.

Document how a user accesses the simulated outbox before sign-in for verification/recovery. Label it a lab-only facility with no real email-ownership guarantee. Keep normalized email uniqueness across **all** accounts, including unverified ones; tokens are expiring and single-use. Define a trusted current-account context so account IDs in commands do not substitute for authentication.

## Required design corrections

### Money and exact allocation

Use `BigDecimal` for monetary values and decimal input; never `float` or `double`. Money includes currency, and each group has one explicitly supported currency/scale. Reject inputs that cannot be represented at that scale without rounding. For example, reject USD `10.005`; USD `10.000` may normalize to `10.00` because its value is exact. Remove input `HALF_EVEN` normalization and allocation `DECIMAL128` division.

Specify an exact algorithm without writing Java:

1. Validate positive amount, unique current-member participants, and currency. Convert the total exactly to integer minor units using an exact conversion with overflow checking.
2. Equal split: divide integer units by participant count using quotient/remainder. Give the quotient to each participant and distribute leftover units in stored stable order.
3. Percentage split: parse percentages as exact decimal values, require nonnegative values summing exactly to 100, and convert them to a common integer scale. With `k` the common decimal scale, let each percentage's integer numerator be `w_i` and denominator `D = 100 × 10^k`. Divide `totalMinorUnits × w_i` by `D`, retaining exact integer quotient and remainder. Assign leftover units by descending remainder, breaking ties by stored participant order.
4. Reconcile shares exactly to the total; never round by an approximate intermediate division. Use arbitrary-precision integers for intermediate products/remainders, with `BigDecimal` as the monetary domain boundary. Define documented input-size and SQLite signed-64-bit storage limits and exact overflow rejection. Avoid SQLite floating-point aggregation when totals exceed integer range; define exact application-side aggregation or reject unsupported aggregate ranges explicitly.

Keep signed balances distinct from positive expense/payment inputs. Payer self-shares create no self-debt; excluded payers are owed every participant share.

### Simplified transactions, notifications, and balances

Remove the generic event bus, domain-event publication pipeline, handler phases, `LedgerPostingHandler`, separate persisted `LedgerEntry` model, and future event-projection machinery from the active design. Do not retain an outbox/retry subsystem for ordinary expense notifications. The **simulated email outbox** is a different feature and remains.

Use direct application orchestration inside `UnitOfWork`:

- Expense submission atomically stores the pending expense, ordered shares, receipt reference, and one notification per other current group member. Notification failure rolls back submission. Return success only after commit.
- Approval/rejection conditionally transitions a pending expense once and records its decision atomically. Pending/rejected expenses have no financial effect.
- Payment recording stores a pending payment. Recipient confirmation conditionally transitions pending to confirmed once. Pending payments have no financial effect.
- Derive pairwise balances directly from approved expense shares and confirmed payments. Do not store independently mutable balance totals or duplicate ledger postings. Keep a query service/value object for balance results.

Use “financial history” to describe the authoritative expenses/payments if necessary; distinguish it from the removed separate ledger table. Read notifications only for their recipient after rechecking current group membership. Specify on-demand refresh plus a polling interval no greater than 60 seconds while signed in; test local availability separately from the full network-oriented NFR.

### Payment confirmation and concurrency

Define one concrete SQLite rule: **every state-changing use case obtains a SQLite write transaction with `BEGIN IMMEDIATE` before reading mutable state used for validation**. All repository operations in that use case share that connection/transaction. Reads, checks, conditional updates, and commit form one operation. Do not write JDBC or SQL migration code; document the transaction protocol only.

At confirmation, resolve the trusted caller; acquire the write transaction; load the payment; verify current membership for the actor and both payment parties in that group; verify the actor is the recipient; require pending state; derive the current net debt inside the same transaction; and reject a payment exceeding that debt. Only then conditionally confirm and commit. Use the same protocol for membership changes and other financial writes, so they cannot interleave with these checks.

SQLite serializes writers for the local database. If busy/locked, use a bounded wait/retry policy that restarts the **whole** transaction and reruns authorization and debt checks; on exhaustion return a clear failure with no success indication or financial change. Do not claim that per-payment version checks alone protect different payment rows. Read-only report queries should use a consistent read transaction/snapshot.

Required documented example: debt is 100; two distinct pending payments are 60 each. Concurrent confirmations may confirm only one. The second rechecks the remaining 40 and stays pending with a validation error. Repeating confirmation of the same payment also cannot change its effect twice.

### Remaining consistency fixes

- Define creator/manager reviewer designation, updating existing membership roles, default reviewer on group creation, and behavior when removing the last reviewer. Identify any new default as a lab design decision in the spec.
- Keep receipts local but private to the application, with opaque IDs and authorized retrieval. Define type/size defaults, same-group linking, and cleanup when file storage succeeds but database submission fails. File I/O is not part of SQLite atomic commit; never diagram it as one cross-resource transaction.
- Define report expense/payment status inclusion and date semantics. Financial totals use approved expenses and confirmed payments; pending/rejected records may appear only in explicitly separate status/history counts. Date-filtered totals use entered expense/payment dates; current balances use all approved/confirmed history and are labeled as current rather than historical. Include endpoints, reject reversed dates, and define empty results.
- Keep future REST/server migration as an extension section only. Explain that shared persistence, network identity/security, API contracts, and new clients will require future work; avoid claiming that they already exist or require no changes.

## Files to update

1. `specs/001-expense-sharing/spec.md`: decision, exceptions, monetary/transaction rules, local acceptance scope, and traceability while preserving identifiers.
2. `docs/decisions.md`: retain the user's rationale and link to the revised spec/design; clarify any overly broad separation claims without changing the selection.
3. `docs/architecture-alt/architecture-alt.md`: make this the selected simplified B description. Update its event-driven title, summary, package layout, tables, examples, tradeoffs, traceability, embedded diagrams, and open items. Remove claims that the now-approved architecture choice still awaits confirmation; keep artifact review pending.
4. Feature `plan.md`, `architecture.md`, `data-model.md`, `research.md`, `quickstart.md`, and `checklists/requirements.md`: align with one-module local B. Preserve A's comparison rationale as historical alternatives where useful. Replace active server/PostgreSQL prerequisites with planned local SQLite/outbox/receipt setup. Keep build/testing commands explicitly future implementation steps, not evidence that a build exists or passed.
5. `specs/001-expense-sharing/contracts/openapi.yaml`: retain only as a clearly labeled **future, non-MVP REST contract proposal**, with a matching explanation in `contracts/README.md` and all references. It is not the Swing application's current interface. Document the current inbound use-case/DTO contract in Markdown without Java code. Do not build a server or expand the future API unnecessarily.
6. All four feature `.puml` files: update to the canonical design below. Prefer those files as the maintained diagram sources; replace B's duplicated embedded diagrams with relative links, or ensure any retained copies match exactly.
7. Preserve `docs/architecture-review.md` and `docs/reviews/architecture-reviews.md` as historical reviews. Link to them from the decision rather than altering their findings/recommendation.

## PlantUML requirements

- Domain class diagram: typed Money/expense total, account/group/membership relationships, approval policy/decision, ordered expense shares, receipt reference, payment, **Notification** with recipient and expense relationships, and derived Balance/Report results. Show correct multiplicities and pending/approved/rejected and pending/confirmed statuses. Remove event and separate ledger types from the active model.
- Application diagram: use the canonical package names above, inbound interfaces, services, authorization, outbound ports, SQLite repositories/shared `UnitOfWork`, local receipt store, hashing, clock, simulated verification sender/outbox, passive views, and presenters. Show notification repository calls directly from expense submission and current-account/membership dependencies on payment confirmation. No active REST controller, PostgreSQL, bus, or handlers.
- Expense activity: validation, exact allocation, local file handling and cleanup boundary, immediate transaction, current membership checks, atomic expense/share/notification save, commit/rollback, reviewer authorization, conditional approve/reject, and conflict path. No after-commit notification phase or parallel handler fork.
- Payment activity: record pending; later confirm with current membership, recipient, state, and debt checks under the serialized-write protocol. Show invalid/unauthorized/busy/conflict outcomes and rollback. No ledger-posting phase.
- Prose and diagrams must agree on package names, transaction ownership, statuses, authorization, receipt failure handling, and notification timing. Keep diagrams readable; include essential failure branches without drawing every helper class.

## Documentation validation and completion report

Describe future JUnit 5 scenarios mapped to FR/AC IDs: exact equal/percentage allocations and ties; input precision/overflow; duplicate email including unverified accounts; simulated token expiry/reuse; membership removal; receipt failures; atomic notification rollback; duplicate approval/confirmation; different-payment oversettlement; current-member recipient confirmation; and report status/date boundaries. Distinguish fake-repository tests from real SQLite rollback/concurrency tests and fake-view presenter tests. Do not implement them.

Before finishing:

1. Verify every FR-001–FR-016 remains and the exception table does not claim full-product delivery.
2. Inspect links, names, diagrams, and diffs. Search for obsolete active-design references to PostgreSQL, server modules, `DECIMAL128`, input `HALF_EVEN`, event handlers/bus, and persisted ledger entries. Historical/future references are allowed only when clearly labeled.
3. Render or syntax-check PlantUML if existing tooling is available. Otherwise explicitly report that it was source-reviewed only; do not install tools or claim successful rendering without evidence.
4. Confirm `UserRequirement.md`, the constitution, historical reviews, and implementation files are unchanged by this task. No Java, build, migration, or test code may be added.
5. Summarize files changed, recorded scope exceptions, corrected design rules, validation performed, and unresolved product questions. Mark executable tests/performance as not run for this documentation-only task. Do not claim implementation completion or human acceptance.
