# SplitSmart Domain Model

## Modeling conventions

- Every entity has an immutable identifier. Relationships use identifiers; callers
  do not infer authorization from a supplied group or account ID.
- A group has exactly one supported ISO currency. Accept codes available from the
  Java runtime's currency registry with a non-negative minor-unit precision.
  Currency conversion is not modeled.
- Domain money is a non-negative or signed `BigDecimal` paired with a currency.
  Inputs with excess precision are rejected. The largest-remainder allocator
  explicitly rounds down to the currency scale and distributes remaining minor
  units in deterministic order.
- PostgreSQL stores amounts as integer minor units plus currency code, avoiding
  binary floating-point or approximate numeric storage.
- Balances are query results derived from approved expense shares and confirmed
  payments; they are not an independently editable entity.

## Entities and value objects

| Concept | Fields / relationships | Invariants and behavior |
|---|---|---|
| **Account** | `accountId`, normalized unique `email`, display name, account state, created timestamp. One account may have memberships in many groups. | Sign-in requires verified email. Credentials are stored as a server-side password hash, not as a domain password field. Recovery uses expiring, single-use tokens. |
| **Group** | `groupId`, name, creator account ID, ISO currency code, created timestamp, approval policy. Has memberships, expenses, payments, and notifications. | The creator is a manager. All group money uses the group's one currency. Only active members may access group records. |
| **Membership** | `groupId`, `accountId`, role (`MANAGER` or `MEMBER`), active status, joined/removed timestamps. | Unique per group/account. Only creator or designated manager can add/remove members or designate reviewers. Removed members lose access immediately. |
| **ApprovalPolicy** | Group ID, MVP policy kind (`SINGLE_STAGE`), reviewer membership IDs. | At least one current, authorized reviewer. Domain shape permits a future staged policy, but this MVP accepts one decision. |
| **Expense** | `expenseId`, `groupId`, submitter ID, payer ID, amount (`BigDecimal`/currency), date, description, split method, receipt reference (optional), state, created timestamp, version. Has ordered shares and decisions. | Amount must be positive; payer and participants must be group members; at least one participant; shares sum exactly to total. State begins `PENDING`; only pending expenses transition to `APPROVED` or `REJECTED`. |
| **ExpenseShare** | `expenseId`, participant ID, stable participant order, allocated amount, optional input percentage. | Amount is non-negative. Percentage is non-negative and percentages total exactly 100% when split method is percentage. All shares reconcile exactly at group currency precision. |
| **ApprovalDecision** | `decisionId`, expense ID, reviewer ID, result (`APPROVE` or `REJECT`), timestamp, optional reason. | Reviewer must be authorized at decision time. A pending expense receives only one effective decision in the MVP. |
| **Payment** | `paymentId`, `groupId`, payer/debtor ID, recipient/creditor ID, amount, date, state, created timestamp, optional confirmation timestamp. | Payer and recipient are distinct current members; amount is positive and no greater than the outstanding amount. Starts `PENDING`; only recipient may confirm. A pending payment does not affect balance. |
| **Notification** | `notificationId`, `groupId`, recipient account ID, expense ID, type, created/read timestamps. | Created for other current group members after expense submission. Reads recheck current membership and never reveal records to non-members. |
| **Balance** (projection) | `groupId`, debtor account ID, creditor account ID, net amount, currency, as-of time. | Derived from approved expense obligations and confirmed payments. Zero-net pairs may be omitted. |
| **Report** (projection) | Group ID, inclusive start/end dates, expense/payment summaries, current balances. | Caller must be a current member. Start date must not follow end date. No matches produce empty lists and zero totals. |
| **Receipt** (stored content) | Receipt ID, optional expense ID until linked, media type, byte size, content hash, private storage key. | Optional. Accept JPEG or PNG up to 10 MiB; validate actual image content. Access is through authorized expense retrieval, never a public storage key. Unlinked uploads are periodically cleaned up. |

## Relationships

- `Account` 1—* `Membership` *—1 `Group`.
- `Group` 1—* `Expense`; each expense has exactly one payer and one or more
  participant `ExpenseShare` records.
- `Expense` 1—0..1 `Receipt`; `Expense` 1—0..1 effective `ApprovalDecision` in the
  single-stage MVP.
- `Group` 1—* `Payment`; payment payer and recipient both refer to group members.
- `Expense` 1—* `Notification` for eligible members other than the submitter.
- `Balance` and `Report` are read projections over group-owned records, not mutable
  aggregates persisted as a second financial source of truth.

## Monetary allocation rules

### Equal split

1. Validate a positive amount and at least one unique participant.
2. Convert total to exact minor units for the group's currency.
3. Divide minor units among participants, retaining each exact remainder.
4. Assign remaining units by descending fractional remainder; break ties by the
   persisted stable participant order.
5. Persist each allocated share and verify their sum equals the original total.

### Percentage split

1. Require each entered percentage to be non-negative and the exact total to be
   100%.
2. Calculate each raw share with `BigDecimal`, round down to currency precision,
   and retain fractional remainders.
3. Distribute leftover minor units by descending remainder, with the same stable
   tie-break order; verify exact reconciliation.

When the payer is a participant, their own share is not an amount owed to
themselves. For each other participant, the share is an obligation to the payer.
When the payer is excluded, all participant shares are obligations to the payer.

## State transitions

| Aggregate | From | To | Actor / guard | Balance effect |
|---|---|---|---|---|
| Expense | — | `PENDING` | Valid group member submits; allocation succeeds | None |
| Expense | `PENDING` | `APPROVED` | Authorized reviewer; conditional transaction succeeds once | Included in derived balances |
| Expense | `PENDING` | `REJECTED` | Authorized reviewer; conditional transaction succeeds once | None |
| Payment | — | `PENDING` | Owing member records valid amount | None |
| Payment | `PENDING` | `CONFIRMED` | Recipient confirms; outstanding amount revalidated atomically | Reduces the debt by payment amount |

No transition from `APPROVED` or `REJECTED` is defined for the MVP. Repeated or
concurrent decisions/confirmations cannot apply a financial effect twice.

## Validation and authorization

- Normalize email before uniqueness checking; reject duplicate addresses.
- Unverified accounts cannot sign in. Passwords never appear in application
  responses or logs.
- Group membership and review permissions are checked in service use cases on
  every operation, not just in Swing controls.
- Reject expenses with non-positive amounts, no participants, non-members, invalid
  percentages, or shares that do not reconcile.
- Accept only supported ISO currency codes with a defined non-negative minor-unit
  precision. Each group uses one currency.
- Reject zero, negative, wrong-currency, or excess payment amounts. Recheck the
  outstanding obligation on confirmation to handle intervening changes.
- Reject reversed report ranges; include both endpoints in date filtering.
- Report invalid receipt image type/size or unavailable content explicitly without
  reporting a successful attachment.
