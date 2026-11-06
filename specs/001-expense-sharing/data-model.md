# SplitSmart Domain Model (simplified Architecture B)

Diagram: [domain-model.puml](./diagrams/domain-model.puml). Lab rules and limits:
[spec.md](./spec.md#architecture-and-scope-decision-2026-11-05). This document describes
a conceptual model and persistence mapping; it contains no SQL or Java.

## Modeling conventions

- Entities have immutable identifiers. Relationships use identifiers; callers never
  infer authorization from a supplied group or account ID, and commands carry no
  actor ID for the caller (the trusted current-account context supplies it).
- A group has exactly one explicitly supported currency and scale (lab default set:
  USD, EUR at scale 2; JPY at scale 0). Currency conversion is not modeled.
- `Money` = `BigDecimal` + currency; positive amounts for expenses/payments. **Signed
  balances use a distinct type** so a negative value can never be accepted as an
  expense or payment input.
- Input decimals must be plain decimal text. A value not exactly representable at the
  group's scale is **rejected** (USD `10.005` rejected; `10.000` → `10.00`). There is no
  input rounding mode and no approximate division anywhere.
- Persistence stores integer minor units (SQLite signed 64-bit) plus currency code.
  Lab limits: single amount ≤ 10^12 minor units; input text ≤ 32 characters;
  percentages ≤ 4 decimal places. Over-limit input is rejected before any state change.
- Balances and reports are query results derived from approved expense shares and
  confirmed payments ("financial history"); they are not stored entities. There is no
  separate ledger table, event, or stored balance total.

## Entities and value objects

| Concept | Fields / relationships | Invariants and behavior |
|---|---|---|
| **Account** | `accountId`, normalized unique `email`, display name, verified flag, created timestamp. Password hash and tokens are stored by the account use cases, not exposed by the domain model. | Normalized email unique across **all** accounts, verified or not. Sign-in requires verification. |
| **VerificationToken / outbox message** (account support) | Hashed token, purpose (`VERIFY` or `RECOVER`), account, expiry, used flag; simulated outbox message addressed to an email. | Random, expiring (30/15 min lab default), single-use; a new token invalidates the previous one. Outbox is lab-only. |
| **Group** | `groupId`, name, creator ID, currency code, created timestamp, approval policy. | Creator is manager and reviewer on creation (lab default). Always at least one manager and one reviewer (lab default). |
| **Membership** | `groupId`, `accountId`, role (`MANAGER`/`MEMBER`), `reviewer` flag, active flag, joined/removed timestamps. | Unique per group/account. Creator/managers add, remove, change role, set/clear reviewer. Removal/demotion/clearing that would leave no reviewer or manager is rejected. Removed members lose access immediately. |
| **ApprovalPolicy** | Group ID, kind `SINGLE_REVIEWER`. | One decision by any current reviewer. Multi-stage is future work. |
| **Expense** | `expenseId`, `groupId`, submitter, payer, `total` (Money), date, description, split method, receipt reference (optional), status, created timestamp. Ordered shares; at most one decision. | Total positive; payer, submitter, participants are current members; ≥1 unique participant; shares sum exactly to total. `PENDING` → `APPROVED`/`REJECTED` once. |
| **ExpenseShare** | `expenseId`, participant, stored participant order, allocated Money, optional input percentage. | Non-negative; percentages sum exactly 100 for percentage splits; shares reconcile exactly. |
| **ApprovalDecision** | `decisionId`, expense, reviewer, result, timestamp, optional reason. | Reviewer authorized at decision time; self-review allowed (lab default). |
| **Receipt** (reference) | Opaque ID, group, expense, media type, size, content hash, local storage name (internal only). | JPEG/PNG by content, ≤ 10 MiB; created in the same transaction and group as its expense; never reused or exposed by path. |
| **Payment** | `paymentId`, `groupId`, payer (debtor), recipient (creditor), amount, date, status, created and optional confirmed timestamps. | Distinct current members; amount positive and ≤ current net debt payer→recipient at record **and** at confirmation. `PENDING` → `CONFIRMED` once; only the recipient confirms; no effect while pending. |
| **Notification** | `notificationId`, `groupId`, **recipient account**, **expense**, type `EXPENSE_CREATED`, created/read timestamps. | One per other current member, written in the submission transaction. Read only by the recipient after rechecking current membership. |
| **Balance** (derived result) | debtor, creditor, signed amount, currency, as-of time. | Derived from approved expense shares and confirmed payments only. Zero-net pairs may be omitted. |
| **Report** (derived result) | Group, inclusive dates, approved-expense and confirmed-payment counts/totals, separate pending/rejected/pending-payment counts, current balances. | See report rules below. |

## Relationships

- `Account` 1—* `Membership` *—1 `Group`.
- `Group` 1—* `Expense`; each expense has one payer and ≥1 ordered `ExpenseShare`.
- `Expense` 1—0..1 `Receipt`; `Expense` 1—0..1 `ApprovalDecision`.
- `Group` 1—* `Payment` (payer and recipient are group members).
- `Expense` 1—* `Notification`; each notification has exactly one recipient account.
- `Balance` and `Report` are read-only derived results.

## Exact allocation

All arithmetic is on integers (arbitrary-precision for intermediates); `BigDecimal` is the
monetary boundary type.

1. Validate positive amount, unique current-member participants, and currency. Convert
   the total exactly to integer minor units `T` (overflow-checked).
2. **Equal split**: `q = T div n`, `r = T mod n`. Everyone gets `q`; the first `r`
   participants in stored order get one extra unit. (All fractional remainders are
   equal, so this is the largest-remainder rule with stable-order ties — FR-006.)
3. **Percentage split**: require percentages ≥ 0 summing exactly to 100. With common
   scale `k`, `w_i` = percentage as an integer at scale `k`, `D = 100 × 10^k`. Compute
   `T × w_i`; floor share = quotient by `D`; remainder kept exactly. Leftover units
   `L = T − Σ floors` (necessarily fewer than the number of participants with nonzero
   remainder) go one each to the largest remainders, ties by stored order — FR-007.
4. Verify Σ shares = `T` exactly. No approximate intermediate division is used.

Worked examples (USD):

- Equal: 100.00 among three: `T = 10000`, `q = 3333`, `r = 1` → 33.34, 33.33, 33.33
  in stored order.
- Percentage: 0.10 at 33.33% / 33.33% / 33.34%: `T = 10`, `k = 2`, `D = 10000`,
  `w = 3333, 3333, 3334`. Products `T × w` = 33330, 33330, 33340 → floors 3, 3, 3 with
  remainders 3330, 3330, 3340. `L = 10 − 9 = 1` goes to the largest remainder (the
  third) → 0.03, 0.03, 0.04, which sums to 0.10.

**Self-share and exclusion**: when the payer is a participant, their own share creates
no debt; for every other participant the share is a debt to the payer. When the payer
is excluded, every participant owes their share to the payer.

**Aggregation**: balances and report totals sum per-row minor units application-side
with arbitrary-precision integers. SQLite `SUM` over money is not used.

## Derived balances

Net debt `A → B` = Σ approved shares where A is a participant and B is the payer (A ≠ B)
− Σ approved shares where B is a participant and A is the payer + Σ confirmed payments
`B → A` − Σ confirmed payments `A → B`. A positive result means A owes B. Pending/rejected
expenses and pending payments contribute nothing.

## State transitions

| Aggregate | From | To | Actor / guard | Financial effect |
|---|---|---|---|---|
| Expense | — | `PENDING` | Current member submits; allocation succeeds; notifications written | None |
| Expense | `PENDING` | `APPROVED` | Current reviewer; conditional update changes exactly one row | Included in derived balances |
| Expense | `PENDING` | `REJECTED` | Current reviewer; conditional update changes exactly one row | None |
| Payment | — | `PENDING` | Payer records; amount ≤ net debt | None |
| Payment | `PENDING` | `CONFIRMED` | Recipient; current membership; debt re-derived inside the write transaction | Reduces debt by amount |

No transition leaves `APPROVED`, `REJECTED`, or `CONFIRMED`. A repeated decision or
confirmation is refused as a conflict and cannot apply an effect twice.

## Concurrency (summary)

Every state-changing use case: trusted caller → `BEGIN IMMEDIATE` → read/validate →
conditional update → commit, on one connection. Busy/locked → bounded wait and
whole-transaction restart. Different pending payments against one debt are serialized
by the write lock and each re-derives the debt (debt 100, payments 60 and 60: one
confirms, the other stays pending with a validation error). Per-row version checks are
not relied on for this. Membership changes use the same protocol. Reports use one
consistent read transaction.

## Reports

- Financial totals: **approved expenses** and **confirmed payments** only.
- Pending/rejected expenses and pending payments: separate status counts only.
- Date-filtered totals use the entered expense/payment date; endpoints inclusive;
  `end < start` rejected; no matches → zero totals and empty lists.
- Current balances: all approved/confirmed history, not date-filtered, labeled
  "current as of" generation time.

## Validation and authorization

- Normalize email; reject duplicates against all accounts. Unverified accounts cannot
  sign in. Passwords never appear in results or logs.
- Group membership, reviewer permission, and recipient identity are checked inside the
  use case on every operation (hiding a control is not authorization).
- Reject expenses with non-positive amounts, no/duplicate participants, non-members,
  invalid percentages, unrepresentable precision, or over-limit values.
- Reject zero, negative, wrong-currency, or excess payment amounts at record and again
  at confirmation.
- Receipts: report invalid type/size/unreadable content without a success indication.
