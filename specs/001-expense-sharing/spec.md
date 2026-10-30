# Feature Specification: SplitSmart Expense Sharing

**Feature Branch**: `not managed in this workspace`

**Created**: 2026-10-29

**Status**: Draft

**Input**: Authoritative customer requirements in `UserRequirement.md`

## Clarifications

### Session 2026-10-29

- Q: Can the person who paid for an expense be left out of the people who share its cost? (FR-005) → A: The payer may be included or excluded per expense; included payers owe only their net share, while excluded payers are owed by the participants.
- Q: Who should be allowed to add or remove members from a group? (FR-003) → A: The creator or designated group managers can add or remove members; ordinary members cannot.
- Q: When a split creates leftover cents, how should the system assign them so the shares equal the expense total? (FR-006–FR-007) → A: Use the largest-remainder rule: round shares down to cents, then distribute leftover cents by largest fractional remainder, with ties broken by a stable participant order.
- Q: How should a person sign in to a SplitSmart account? (FR-001–FR-002) → A: Use verified email and password with password recovery.
- Q: Should a recorded settlement payment reduce the balance immediately, or only after the recipient confirms receiving it? (FR-013) → A: The payment remains pending until the recipient confirms it; only then does the balance change.

## User Scenarios & Testing *(mandatory)*

### Actors

- **Account holder**: A person who signs in, creates or joins groups, records expenses
  and payments, and views their own financial information.
- **Group member**: An account holder who participates in a shared-expense group.
- **Group manager**: The creator or a member designated to manage group membership.
- **Expense submitter**: A group member who records an expense and proposes its
  participants and allocation.
- **Expense reviewer**: A group member authorized by the group to review submitted
  expenses.

### User Story 1 - Create a group expense and see balances (Priority: P1)

An account holder creates or joins a group, records a shared expense, identifies who
participated, and sees how the approved expense changes amounts owed between members.

**Why this priority**: Recording shared costs and understanding who owes whom is the
core value of expense sharing.

**Independent Test**: Create two accounts and a group, submit and approve one expense,
and verify each member's resulting share and pairwise balances.

**Acceptance Scenarios**:

1. **Given** a signed-in account holder and no group, **When** they create a group
   and add another account holder, **Then** both accounts appear as group members and
   the creator can manage membership.
2. **Given** a group with two members, **When** one member records an expense with
   amount, date, description, split method, and participants, **Then** the expense is
   recorded with those details and its proposed shares.
3. **Given** an approved expense split equally among three participants, **When** a
   member views the group balances, **Then** the expense is included and its shares
   sum exactly to the expense total.
4. **Given** a percentage split whose allocations total 100%, **When** the expense is
   approved, **Then** each participant's share reflects the entered percentage and
   the shares sum exactly to the expense total.

---

### User Story 2 - Review and approve expenses (Priority: P1)

A group reviewer examines a submitted expense and approves or rejects it before it
affects group balances.

**Why this priority**: The customer requires an approval workflow and explicitly says
expenses affect balances only after approval.

**Independent Test**: Submit an expense, verify it is pending and excluded from
balances, then approve it and verify it is included; repeat with a rejected expense.

**Acceptance Scenarios**:

1. **Given** an expense awaiting review, **When** a reviewer opens it, **Then** the
   reviewer can see its submitter, details, participants, shares, and receipt if
   attached.
2. **Given** an expense awaiting review, **When** an authorized reviewer approves it,
   **Then** its status becomes approved and its shares affect balances exactly once.
3. **Given** an expense awaiting review, **When** an authorized reviewer rejects it,
   **Then** its status becomes rejected and it does not affect balances.
4. **Given** an expense awaiting review, **When** an account without review
   permission attempts to approve or reject it, **Then** no status or balance changes.

---

### User Story 3 - Track a settlement payment (Priority: P2)

A member records a payment to another member; the recipient confirms receiving it
before the group's outstanding balances reflect the settlement.

**Why this priority**: Payments close the loop between calculated debts and real
settlements.

**Independent Test**: Create an approved expense with a known amount owed, record a
payment for part or all of it, verify the balance remains unchanged while pending,
then confirm receipt and verify the remaining balance.

**Acceptance Scenarios**:

1. **Given** one member owes another, **When** the owing member records a payment
   with amount, date, payer, and recipient, **Then** the payment appears in the
   group's payment history as pending and the balance remains unchanged.
2. **Given** a payment is pending, **When** the recipient confirms receiving it,
   **Then** the payment becomes confirmed and the outstanding amount is reduced by
   the payment.
3. **Given** a payment is pending, **When** the recipient has not confirmed it,
   **Then** it does not change either member's balance.

---

### User Story 4 - Receive expense updates (Priority: P2)

A group member is notified when another member creates a group expense and can open
the expense details from the notification.

**Why this priority**: Timely awareness supports review and keeps group members
informed about shared costs.

**Independent Test**: Create an expense as one member and verify another member of
the same group receives an update, while a non-member does not.

**Acceptance Scenarios**:

1. **Given** an expense is created in a group, **When** another member of that group
   checks notifications, **Then** they can identify the expense and submitter.
2. **Given** an expense is created in a group, **When** a non-member checks
   notifications, **Then** no notification or expense details are disclosed to them.

---

### User Story 5 - Review expense and payment reports (Priority: P2)

A member views summaries of expenses, balances, and payments, and narrows a report to
a chosen date range.

**Why this priority**: Summaries and date filtering help members understand group
spending and reconcile what remains owed.

**Independent Test**: Enter expenses and payments on dates inside and outside a
selected range, then verify the report includes only matching records and totals.

**Acceptance Scenarios**:

1. **Given** a group with expenses and payments, **When** a member opens its report,
   **Then** the report shows expense totals, current balances, and payment totals.
2. **Given** a valid start and end date, **When** a member filters a report, **Then**
   only records within the inclusive date range contribute to date-filtered totals.
3. **Given** an end date earlier than the start date, **When** a member requests the
   report, **Then** the date range is rejected with a clear validation message.

### Edge Cases

- An equal split produces fractional minor currency units: distribute the remainder
  using the largest-remainder rule; break ties by a stable participant order so
  shares still equal the recorded amount.
- Percentage allocations are negative or do not total 100%: reject the expense
  submission and identify the invalid allocation.
- An expense has no participants, includes a non-member, or has a non-positive
  amount: reject submission without changing balances.
- An expense receipt cannot be opened or is not an allowed image: report the issue
  and do not silently treat an invalid attachment as a valid receipt.
- Two reviewers act on the same pending expense: only one decision takes effect;
  later decisions do not apply balances a second time.
- A payment is zero, negative, or exceeds the outstanding amount between the payer
  and recipient: reject it without changing balances.
- A recipient does not confirm a pending payment: retain its pending status and
  leave balances unchanged.
- A report has no matching records: show an empty result and zero totals, not an
  error or unrelated records.
- A user loses group membership: the user can no longer access the group's
  restricted expense, receipt, notification, payment, or report details.

## Requirements *(mandatory)*

### Customer Requirements Inventory

These are customer needs transcribed from `UserRequirement.md`; implementation choices
are listed separately under **Java Swing MVP Subset**.

| Source ID | Original customer feature | Coverage |
|-----------|---------------------------|----------|
| C-001 | Individual user accounts, login, and access to own expense and balance information | FR-001–FR-002 |
| C-002 | Create and manage groups of people to track shared expenses and balances | FR-003 |
| C-003 | Expenses include amount, date, description, equal or percentage split, optional receipt image, and involved users | FR-004–FR-008 |
| C-004 | Notify users when other group members create an expense | FR-009 |
| C-005 | Review and approve expenses before they adjust balances; support single or multiple review levels | FR-010–FR-011 |
| C-006 | Track the amount owed by each user to every other user from entered expenses | FR-012 |
| C-007 | Record payments that settle balances | FR-013 |
| C-008 | Provide expense, balance, and payment reports, including date-range and other filters | FR-014–FR-015 |
| C-009 | Primary web-based product with applications for Android and iOS | FR-016 |

### Functional Requirements

- **FR-001**: The system MUST allow a person to create an individual account using
  an email address and password, MUST verify the email address, and MUST reject an
  email address already associated with an account.
- **FR-002**: The system MUST allow an account holder to sign in using the verified
  email address and password and recover access if they forget the password. It
  MUST restrict access to account and group information to that account's
  authorized scope.
- **FR-003**: An authorized account holder MUST be able to create a group. The
  creator or a designated group manager MUST be able to add and remove members;
  ordinary members MUST NOT be able to change membership. Only current group
  members MUST be able to access that group's records.
- **FR-004**: A group member MUST be able to submit an expense with a positive amount,
  date, description, split method, and one or more participants from the group.
- **FR-005**: An expense submitter MUST identify the group member who paid and the
  group members sharing the cost; the payer MAY be included among or excluded from
  the participants for each expense. When included, the payer's own share MUST be
  netted against the amount they paid; when excluded, participants MUST owe their
  shares to the payer.
- **FR-006**: The system MUST calculate equal shares by rounding each share down to
  the group's currency precision, then distribute remaining minor units to
  participants with the largest fractional remainders. Ties MUST be broken using a
  stable participant order, and all shares MUST sum exactly to the expense amount.
- **FR-007**: The system MUST accept percentage shares only when each percentage is
  greater than or equal to zero and the total is exactly 100%; it MUST calculate
  shares using the largest-remainder rule at the group's currency precision, with
  ties broken using a stable participant order. All shares MUST sum exactly to the
  expense amount.
- **FR-008**: An expense submitter MUST be able to attach an optional receipt image
  and authorized group members MUST be able to view it with the expense.
- **FR-009**: When an expense is created, the system MUST notify other members of
  that group and MUST NOT disclose the expense to non-members.
- **FR-010**: The system MUST support a group expense review policy of one reviewer
  or multiple approval stages, and MUST identify which group members can review.
- **FR-011**: The system MUST distinguish pending, approved, and rejected expenses;
  only approved expenses MUST affect balances, and a decision MUST affect balances
  no more than once.
- **FR-012**: The system MUST show each member's amount owed to or owed by every
  other member based on approved expenses and confirmed payments. For each expense,
  participant shares MUST be debts to the payer, net of the payer's own share when
  the payer is a participant.
- **FR-013**: A member MUST be able to record a payment with amount, date, payer,
  and recipient. A payment MUST remain pending and MUST NOT change balances until
  the recipient confirms receiving it; a confirmed valid payment MUST reduce the
  corresponding outstanding balance.
- **FR-014**: A member MUST be able to view summaries of expenses, balances, and
  payments for groups they can access.
- **FR-015**: A member MUST be able to filter reports by an inclusive date range and
  other available report parameters; invalid date ranges MUST be rejected.
- **FR-016**: The complete product MUST provide its primary experience on the web
  and provide applications that run on Android and iOS.

### Non-Functional Requirements

- **NFR-001**: All user-visible monetary amounts MUST be represented and calculated
  without binary floating-point error; displayed allocation totals MUST equal their
  expense total to the smallest supported currency unit.
- **NFR-002**: In authorization tests, 100% of attempts by non-members to access
  group data and by unauthorized members to decide expenses MUST be denied without
  disclosing protected details or changing records.
- **NFR-003**: For groups with up to 100 members and 10,000 recorded expenses,
  95% of common expense, balance, and report views MUST become usable within
  3 seconds under ordinary network conditions.
- **NFR-004**: An expense creation notification MUST be available to authorized
  group members within 60 seconds of expense submission under ordinary network
  conditions.
- **NFR-005**: For the core workflows supported on each released client, users MUST
  be able to complete sign-in, review group balances, and view expense details
  without encountering platform-specific changes to financial results.
- **NFR-006**: Rejected input and unavailable content MUST produce a clear message
  and MUST NOT result in a success indication or an unintended balance change.

### Acceptance Criteria

- **AC-001 (FR-001–FR-002)**: A person can create an account with an email address
  and password, complete email verification, sign in, and recover access after
  forgetting the password. An email already associated with an account is rejected,
  and an account cannot view another account's private information.
- **AC-002 (FR-003)**: A creator or designated manager can add and remove members;
  an ordinary member cannot change membership, and a user who is not a member
  cannot access group records.
- **AC-003 (FR-004–FR-005)**: Submitting a valid expense preserves its amount, date,
  description, split method, payer, and selected participants; the payer can be
  included or excluded. When included, only the payer's net share is owed to them;
  when excluded, participants owe their shares to the payer. Invalid amount or
  participant data is rejected without creating an expense.
- **AC-004 (FR-006)**: Equal allocations for 1–100 participants sum to the exact
  expense amount; any leftover minor units go to participants with the largest
  fractional remainders, with ties resolved by the stable participant order.
- **AC-005 (FR-007)**: Valid percentage allocations total 100% and yield shares
  summing to the expense amount using the largest-remainder rule; negative or
  non-100% allocations are rejected, and tied fractional remainders use the stable
  participant order.
- **AC-006 (FR-008)**: A valid optional image is accessible to group members; an
  absent image does not prevent expense submission.
- **AC-007 (FR-009)**: Each other group member can identify a newly created expense
  and submitter within 60 seconds; a non-member receives no expense notification.
- **AC-008 (FR-010–FR-011)**: A pending expense is excluded from balances; required
  reviewer decisions transition it to approved or rejected; only approved expenses
  affect balances, exactly once.
- **AC-009 (FR-012)**: For a test ledger of approved expenses and confirmed
  payments, every pairwise balance equals the net amount derived from that ledger.
- **AC-010 (FR-013)**: A valid payment remains pending without changing balances
  until the recipient confirms it; confirmation reduces the applicable outstanding
  amount by exactly the payment amount. Zero, negative, and excess payments are
  rejected.
- **AC-011 (FR-014–FR-015)**: Reports show expense, balance, and payment summaries;
  date-range filtering includes both endpoints and excludes records outside them.
- **AC-012 (FR-016, NFR-005)**: The release's platform support matrix confirms the
  web experience is primary and identifies a usable Android and iOS application;
  core financial results agree for equivalent data on each released client.
- **AC-013 (NFR-001–NFR-006)**: Monetary reconciliation, access-denial, response
  time, notification delivery, and invalid-input targets pass the measurable
  conditions defined by their respective non-functional requirements.

### Java Swing MVP Subset

This subsection records an implementation decision required by the project
constitution; it does not replace or narrow the customer requirements inventory
above. The proposed Java Swing MVP will cover:

- Java 21 and Maven as the project runtime and build constraints; JUnit 5 for
  automated tests and PlantUML for maintained design diagrams.
- Account creation and sign-in for individual users.
- Group creation and membership management.
- Expense entry with amount, date, description, participants, equal or percentage
  allocation, and an optional receipt image.
- A single reviewer approval or rejection step before an expense changes balances.
- In-application notifications to other members when an expense is created.
- Pairwise balance views and recording payments.
- Expense, balance, and payment summaries with date-range filtering.

The Swing MVP is a desktop implementation slice. It does not by itself satisfy the
customer's primary web, Android, or iOS platform requirement. Those clients remain
in the full-product requirements and require their own delivery scope and
verification.

### Key Entities

- **Account**: A person with unique sign-in credentials and private account data.
- **Group**: A shared-expense context with members and an approval policy.
- **Membership**: The association between an account and a group, including review
  permissions.
- **Expense**: A submitted monetary cost with date, description, payer, participants,
  split method, optional receipt, shares, and review status.
- **Expense share**: The amount or percentage attributed to one expense participant.
- **Approval decision**: A reviewer's decision and stage for an expense.
- **Notification**: An expense-created update available to authorized group members.
- **Payment**: A dated amount paid by one member to another, with pending or
  confirmed status; only confirmed payments change balances.
- **Balance**: The net amount one member owes another from approved expenses and
  confirmed payments.
- **Report**: A summary of expenses, balances, and payments for a selected scope and
  date range.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In usability testing, at least 90% of first-time participants can
  create a group, record a shared expense, and find the resulting balance within
  five minutes without assistance.
- **SC-002**: 100% of test expenses split equally or by valid percentages reconcile
  to the exact entered amount, including rounding cases.
- **SC-003**: 100% of unauthorized access attempts in the defined access test set
  are denied without revealing protected group data.
- **SC-004**: At least 95% of expense, balance, and report views for the workload
  specified in NFR-003 become usable within three seconds.
- **SC-005**: At least 99% of test expense notifications reach authorized group
  members within 60 seconds, and none are delivered to non-members.
- **SC-006**: Every approved expense and confirmed payment in the test ledger is
  reflected exactly once in reports and pairwise balances; pending or rejected
  expenses and pending payments are reflected zero times.
- **SC-007**: The release verification matrix confirms the primary web experience
  and usable Android and iOS applications, with matching financial results for the
  same test scenarios.

## Assumptions

- A person has one account; email addresses are unique within the product and must
  be verified before sign-in.
- A group member may submit expenses, while review permissions are controlled by
  that group's approval policy.
- Expense and payment amounts use one currency per group. Multi-currency conversion
  is not included unless separately specified.
- The expense creator enters the expense date and identifies the payer and
  participants; the system does not independently verify a real-world receipt or
  payment.
- Reports are viewable in the product; exporting or sharing reports is not required
  by the supplied customer request.
- For the Swing MVP, a single authorized review decision is the initial policy; the
  full product must support both single and multiple approval stages.
- In-application notifications are the initial notification channel; email, push,
  and SMS delivery are not assumed.
- Java 21, Maven, Java Swing, JUnit 5, and PlantUML are project implementation
  constraints from the constitution, not customer requirements.

## Open Questions

1. Which currencies and currency precision must groups support, and should one
   group ever permit expenses in more than one currency?
2. Which group roles may configure the approval policy and designate expense
   reviewers?
3. For multi-stage approval, must all reviewers approve, or is a threshold or
   sequential policy required?
4. Which notification channels beyond in-application notifications are required
   (email, push, SMS), and what user preferences are needed?
5. Are report export formats or sharing capabilities required?
6. Must the web, Android, and iOS clients launch together, and which workflows must
   be available on each at launch?
7. What receipt image types and maximum file sizes are acceptable?
