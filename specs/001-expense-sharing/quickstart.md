# SplitSmart Architecture Validation Guide

This guide describes validation scenarios for implementation of the design. It
does not imply that the application or its performance targets have already been
implemented or measured.

## Prerequisites

- Java 21 JDK and Maven.
- PostgreSQL available to the service, with database URL and credentials supplied
  through the deployment environment.
- A configured email adapter for account verification and password recovery.
- Private receipt storage configured for the service.

Do not place database credentials, email secrets, or receipt storage credentials in
the Swing client.

## Build and automated verification

From the repository root, after the Maven modules are implemented:

```text
mvn clean verify
```

Expected result: domain/application unit tests pass; PostgreSQL integration tests
exercise transactional state transitions; API contract tests agree with
[`contracts/openapi.yaml`](./contracts/openapi.yaml); the build reports no test
failures.

## End-to-end scenarios

1. **Account lifecycle**: Register a unique email, verify it through the configured
   email flow, sign in, and complete password recovery. A duplicate or unverified
   account cannot sign in; recovery responses do not disclose whether an address
   exists.
2. **Expense creation and approval**: Create a group with two members, submit an
   equal split that creates remainder minor units, and inspect its exact shares.
   Confirm it is pending and excluded from balances. Approve once as an authorized
   reviewer; verify balances change once. Repeat with rejection and an unauthorized
   reviewer.
3. **Percentage allocation**: Submit valid percentages totaling exactly 100% and
   verify shares sum to the expense total. Submit a negative allocation or
   percentages not totaling 100%; expect a clear validation error and no balance
   change.
4. **Access and receipt**: Attach an allowed image and retrieve it as a current
   group member. Attempt access as a non-member or after membership removal; expect
   denial without disclosing expense or receipt details.
5. **Payment settlement**: Record a valid partial payment. Verify its pending state
   leaves the balance unchanged. Confirm as the recipient and verify the net debt
   decreases exactly once. Attempt zero, negative, excess, and unauthorized
   confirmation operations; expect rejection and no unintended balance change.
6. **Reports**: Select an inclusive date range containing records on both
   endpoints. Verify only in-range records contribute to filtered expense/payment
   totals, balances reflect the authoritative ledger, a reversed range is rejected,
   and an empty range returns zero totals.
7. **Swing separation**: Exercise the UI and verify actions delegate to the API;
   no Swing component accesses PostgreSQL or calculates splits/balances. Confirm
   slow API calls do not block the Event Dispatch Thread.

The split and state rules are defined in [`data-model.md`](./data-model.md);
service boundaries and requirement mapping are in
[`architecture.md`](./architecture.md).

## Performance and release gates

- Measure the spec's NFR-003 workload (up to 100 members and 10,000 expenses):
  95% of common expense, balance, and report views usable within 3 seconds under
  ordinary network conditions.
- Verify 100% denial in the defined unauthorized-access and unauthorized-review
  test set (NFR-002).
- Verify in-app notifications become available to authorized members within
  60 seconds, with none disclosed to non-members (NFR-004).
- Treat FR-016 as a separate release gate: web-primary, Android, and iOS clients
  need their own implementation and cross-client financial-result verification.
