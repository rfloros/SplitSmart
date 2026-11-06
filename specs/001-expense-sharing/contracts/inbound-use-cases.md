# Current Contract: Inbound Use Cases (package `application.port.in`)

This is the **current** interface of the Swing MVP: presenters call these use cases with
immutable command objects and receive immutable result objects or typed failures.
It is described in prose/tables only. No command carries the caller's own account ID;
the caller is the trusted current account established by sign-in. Account IDs in
commands name *other* parties. Money in commands is plain decimal text (exact at the
group scale, else rejected); results carry exact amounts and currency.

## Common failures

| Failure | Meaning |
|---|---|
| `NotSignedIn` | No trusted current account. |
| `AccessDenied` | Not a current member / not a reviewer / not the recipient / not a manager. No details disclosed, no change. |
| `ValidationFailed(fieldErrors)` | Input invalid or not exactly representable; no change. |
| `Conflict` | State already changed (e.g. already decided/confirmed); no second effect. |
| `Busy` | Database stayed busy after bounded retries; no change. |

## Use cases

| Use case | Command → Result | Notes (FR) |
|---|---|---|
| `RegisterAccountUseCase` | email, password, display name → `AccountCreated` | Normalized email unique across all accounts (FR-001). Writes verification message to the simulated outbox. |
| `VerifyEmailUseCase` | token → `Verified` | Expiring, single-use (FR-001). |
| `SignInUseCase` | email, password → `SignedIn(accountSummary)`; also `signOut` | Verified accounts only; establishes/clears the trusted context (FR-002). |
| `RecoverPasswordUseCase` | `request(email)` → uniform `Accepted`; `complete(token, newPassword)` → `PasswordChanged` | Uniform response; token expiring/single-use (FR-002). |
| `ReadSimulatedOutboxUseCase` | email → list of `OutboxMessage` | **Lab-only**, available before sign-in; no email-ownership guarantee. |
| `ManageGroupUseCase` | create group (name, currency) → `GroupSummary`; add/remove member; update role; set/clear reviewer; list members → `MemberRow` list | Managers only for changes; creator is manager + reviewer; last-reviewer/manager protection (FR-003, FR-010). |
| `SubmitExpenseUseCase` | group, payer, amount, date, description, split method, participants (+ percentages), optional receipt file → `ExpenseSummary` (`PENDING`) | Atomic expense + shares + receipt record + notifications; failure → no success (FR-004–FR-009). |
| `DecideExpenseUseCase` | expense, approve/reject, optional reason → `ExpenseSummary` | Reviewer only; once (FR-010–FR-011). |
| `GetReceiptUseCase` | expense → receipt bytes + media type | Current members only; opaque ID, no path (FR-008). |
| `RecordPaymentUseCase` | group, recipient, amount, date → `PaymentSummary` (`PENDING`) | Amount ≤ net debt (FR-013). |
| `ConfirmPaymentUseCase` | payment → `PaymentSummary` (`CONFIRMED`) | Recipient only; protocol in the spec (FR-013). |
| `QueryBalancesUseCase` | group → list of `PairBalanceRow` (debtor, creditor, signed amount, "current as of") | Derived (FR-012). |
| `QueryNotificationsUseCase` | optionally group → list of `NotificationRow` (expense, submitter, created, read); mark read | Recipient only after membership recheck; refresh + polling ≤ 60 s (FR-009). |
| `GenerateReportUseCase` | group, start date, end date (inclusive) → `ReportResult` | Approved expenses/confirmed payments in totals; separate status counts; current balances (FR-014–FR-015). |

## Result DTO notes

- `ExpenseSummary`: id, group, submitter, payer, total, date, description, split method,
  status, receipt present?, ordered shares (participant, amount, percentage).
- `PaymentSummary`: id, payer, recipient, amount, date, status, confirmed-at.
- `ReportResult`: dates, currency, approved-expense count/total, confirmed-payment
  count/total, pending/rejected expense count, pending payment count, current balances.
- Views receive formatted display values from `MoneyFormatter`; presenters do no
  monetary arithmetic.
