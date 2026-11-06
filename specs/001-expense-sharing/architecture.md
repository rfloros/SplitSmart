# SplitSmart MVP Architecture

## Scope and deployment shape

The MVP is a Swing desktop client backed by one shared Java service and PostgreSQL:

```text
Swing desktop (presentation only)
        │ HTTPS / JSON (OpenAPI)
        ▼
REST adapter → application use cases → domain rules
                         │                  │
                         └──── ports ───────┘
                                  │
                PostgreSQL / receipt store / email adapter
```

The server is authoritative for identity, membership, authorization, expense
decisions, payment confirmation, and balances. Desktop installations must not
connect directly to PostgreSQL. All group-scoped reads and writes authorize the
current account against current membership on the service.

## Layered component breakdown

| Layer / component | Responsibility and boundary | FR coverage |
|---|---|---|
| Swing views and presenters | Render screens, collect input, display service results/errors, and delegate actions. No allocation, approval, balance, SQL, or authorization rules. Network work is off the EDT; UI updates return to the EDT. | FR-001–FR-015 |
| HTTPS API adapter | Authenticate requests, validate transport shapes, map requests to use cases, and map results/errors to HTTP responses. It is the only service interface used by clients. | FR-001–FR-015 |
| Identity use cases | Registration, verified-email sign-in, session handling, and account recovery; password hashes and one-time tokens stay server-side. Email is sent through a delivery port. | FR-001–FR-002 |
| Group and membership use cases | Create groups, manage members, enforce manager permissions and active-membership access. | FR-003 |
| Expense use cases | Validate members, participants, positive amount, split inputs, optional receipt, and proposed shares; submit expenses pending review. | FR-004–FR-008 |
| Allocation domain service | Calculate equal/percentage shares in `BigDecimal`, use currency precision and the largest-remainder rule, and guarantee shares sum to the expense total. Stable tie-break order is stored with shares. | FR-005–FR-007, NFR-001 |
| Approval use cases and policy | Enforce current reviewer permission and single-stage MVP policy; transition only a pending expense to approved or rejected once. | FR-010–FR-011 |
| Balance query service | Derive pairwise net amounts from approved expense shares and confirmed payments; pending/rejected expenses and pending payments are excluded. | FR-012–FR-013 |
| Payment use cases | Record a valid payment as pending; only its recipient can confirm it. Revalidate the outstanding amount during confirmation and commit the transition atomically. | FR-013 |
| Notification use cases | Create in-app expense-created notifications for other current group members and authorize notification/detail reads. | FR-009 |
| Reporting use cases | Summarize expenses, balances, and payments for authorized groups; apply inclusive date filters and reject reversed ranges. | FR-014–FR-015 |
| Persistence adapters | Implement repositories and transaction boundaries in PostgreSQL; persist amounts as integer minor units and currency codes. Balance remains derived rather than a separately mutable source of truth. | FR-001–FR-015 |
| Receipt storage adapter | Store image content privately and associate it with an expense; serve it only after group authorization. | FR-008 |
| Email delivery adapter | Deliver account verification and recovery messages. This is distinct from optional expense-update notification channels. | FR-001–FR-002 |
| Test suite | Verify requirements at domain, application, API, and persistence boundaries; include monetary, authorization, concurrency, and invalid-input cases. | FR-001–FR-015, NFR-001–NFR-006 |

## Key workflows

### Expense creation and approval

1. The Swing presenter submits the expense details to the API.
2. The service confirms the submitter is a current group member, the payer and
   participants belong to the group, the amount is positive, and the split inputs
   are valid.
3. The domain allocation service calculates exact shares. Equal shares and
   percentage shares use largest remainder at the group's currency scale; ties use
   the stored stable participant order.
4. The service stores the expense as `PENDING`, its shares, receipt reference, and
   in-app notifications for other current members in one database transaction.
   Receipt content is uploaded and validated separately; failed submissions may
   leave an unlinked object for periodic cleanup. Pending expenses have no effect
   on balances.
5. An authorized reviewer approves or rejects the pending expense. A transaction
   conditionally changes its state and records one decision. Only approval makes it
   an input to balance calculations.

See [expense-creation-approval.puml](./diagrams/expense-creation-approval.puml).

### Balance tracking and payment settlement

For each approved expense, each participant other than the payer owes their share
to the payer. If the payer participates, their own share is not a debt to
themselves. Confirmed payments reduce the corresponding debtor-to-creditor
obligation. The service derives the net pairwise balance from this history.

A payment is stored as `PENDING` and does not change the balance. Only the recipient
may confirm it. At confirmation, the service rechecks the outstanding amount and
conditionally changes the payment to `CONFIRMED` within a transaction. This
revalidation handles a balance that changed after the payment was recorded; if it
no longer fits, confirmation is refused and the payment remains pending.

See [payment-settlement.puml](./diagrams/payment-settlement.puml).

## Persistence and consistency

- PostgreSQL is the shared source of truth; each use case that changes related
  records executes within one transaction.
- Store monetary values as integer minor units plus ISO currency code. Convert to
  and from `BigDecimal` at the persistence boundary using the currency's defined
  scale; reject unsupported precision rather than silently rounding user input.
- Store the participant order for each expense allocation so equal fractional
  remainders resolve deterministically.
- Store expense and payment state transitions as records with actor and timestamp.
  Conditional `PENDING` transitions prevent duplicate decisions and confirmations.
- Derive balances from approved expense shares and confirmed payments. Do not
  persist an independently mutable balance total.
- Keep receipt content in private storage behind a port; keep expense linkage and
  metadata in PostgreSQL. Never expose a filesystem path as the receipt contract.
- Accept JPEG and PNG receipts up to 10 MiB. Validate actual image content as well
  as the declared media type; clean up uploaded content that is never linked to an
  expense. This is a proposed MVP validation policy, not a limit stated in the
  customer requirements.
- Version database schema changes and run migrations as part of service startup or
  deployment.
- Enforce membership and reviewer authorization in the service for every request;
  hiding a UI control is not authorization.

## Swing MVP boundary and future extension

### In scope for this architecture

- Account registration, verified-email sign-in, and password recovery.
- Group creation and manager-controlled membership.
- Expense submission with optional receipt and equal/percentage shares.
- A single authorized approval or rejection decision.
- Pairwise balance views and pending/recipient-confirmed payment settlement.
- Expense-created in-app notifications.
- Expense, balance, and payment summaries with inclusive date-range filtering.

### Not delivered by the Swing MVP

- Browser/web, Android, and iOS user interfaces. FR-016 remains unsatisfied by this
  desktop slice; the shared API is an extension seam, not those clients.
- Multi-stage approval. The MVP uses one review decision; a versioned approval
  policy can later describe ordered stages or thresholds.
- Expense-update email, push, or SMS notifications. In-app notifications are
  included. Email for account verification and password recovery remains necessary
  for FR-001–FR-002 and uses a separate adapter.
- Multi-currency conversion, report export/sharing, and notification preferences
  beyond the clarified spec scope.

Future clients should call the same API and share the same service-side domain
rules. New notification channels, receipt backends, and approval policies should
implement their ports/policies rather than placing behavior in a client. Any
release claiming full product scope must separately implement and verify FR-016
and the deferred features.

## Requirement traceability

The table maps each architectural component to functional requirements; the
test plan must map each requirement onward to acceptance and automated tests.

| Component | FR-IDs |
|---|---|
| Swing views and presenters | FR-001–FR-008, FR-010–FR-015 |
| HTTPS API and authorization adapter | FR-001–FR-015 |
| Identity and email delivery | FR-001–FR-002 |
| Group and membership use cases | FR-003 |
| Expense submission and allocation | FR-004–FR-008 |
| Approval policy and decision handling | FR-010–FR-011 |
| Notification use cases | FR-009 |
| Balance query service | FR-012 |
| Payment record and confirmation | FR-013 |
| Reporting use cases | FR-014–FR-015 |
| PostgreSQL persistence and transaction adapter | FR-001–FR-015 |
| Receipt storage adapter | FR-008 |
| Future web, Android, and iOS clients | FR-016 (future work; not covered by this MVP) |
