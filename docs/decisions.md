# Architecture Decision

**Chosen:** Architecture B (hexagonal), simplified.

**Where it is recorded and elaborated**
- Spec decision and scope exceptions: [spec.md](../specs/001-expense-sharing/spec.md#architecture-and-scope-decision-2026-11-05)
- Selected design narrative: [architecture-alt.md](architecture-alt/architecture-alt.md)
- Feature design: [plan.md](../specs/001-expense-sharing/plan.md),
  [architecture.md](../specs/001-expense-sharing/architecture.md),
  [data-model.md](../specs/001-expense-sharing/data-model.md),
  [contracts/](../specs/001-expense-sharing/contracts/README.md),
  [diagrams/](../specs/001-expense-sharing/diagrams/)
- Historical reviews (unchanged): [architecture-review.md](architecture-review.md),
  [reviews/architecture-reviews.md](reviews/architecture-reviews.md)

## Why B
SplitSmart is a single lab project for CIS 285, and the next lab is
expected to continue this work and then conclude the project. A local,
single-machine Swing application is enough for that scope. B runs as one
Maven module with an embedded SQLite file, so there is no server,
PostgreSQL, or deployment setup to build. B also has the strongest
separation of GUI and business logic (passive views, plain-Java
presenters, ports and adapters) and the best test seams for JUnit 5,
which fits the constitution.

*Clarification:* "strongest separation" describes the design intent. One Maven
module does not enforce package isolation by itself; the planned automated
import-rule check does not exist yet.

## Why not A
A needs a shared HTTPS server, PostgreSQL, email delivery, and receipt
storage. That infrastructure is beyond the scope of a class lab and
would slow down the next lab.

## Accepted trade-offs and scope exceptions
- Single-device simulation: accounts, groups, and notifications do not
  sync across computers.
- Email verification and recovery are simulated with an in-app outbox.
- Web and Android/iOS support (FR-016) are deferred; a REST adapter is
  the future path.

These are recorded as exceptions in the spec. They do not claim that the full
customer requirements are satisfied.

## Simplifications and fixes adopted
- Keep B's passive views, presenters, ports, DTOs, and test seams.
- Drop or simplify the event bus and separate ledger where conditional
  state transitions already prevent duplicate effects. (Applied: both are removed.)
- Reject excess monetary input precision instead of silently rounding.
- Use exact arithmetic for allocation.
- Write notifications in the same transaction as the expense.
- Add a current-membership check to payment confirmation.
- Define a concurrency rule for payments against the same debt
  (`BEGIN IMMEDIATE` write transaction per state-changing use case).

## Process note
The consolidation instructions (docs/architecture-b-agent-instructions.md)
were drafted by Codex (OpenAI) from the architecture review and my
decision, in place of a separate ChatGPT chat session. They were then
executed with Claude Code and reviewed by me.
