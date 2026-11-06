# SplitSmart Validation Guide (simplified Architecture B)

This guide describes **written validation scenarios** for a future implementation. The
application, build, and tests do not exist yet; nothing here is evidence that a build
exists or has passed, and no performance target has been measured. Scenarios are not
executable tests.

## Planned local setup (future implementation steps)

- Java 21 JDK and Maven.
- An embedded SQLite database file created at first start in an app data directory
  (schema applied from numbered scripts at startup).
- An app-managed local receipt directory in the same app data directory.
- A simulated verification/recovery outbox shown in-app (no mail server, no
  credentials, no network service).

No server, PostgreSQL, HTTPS endpoint, or mail provider is needed.

## Future build command (not yet runnable)

```text
mvn clean verify
```

Once a module exists, expected results would be: fake-repository tests pass; real-SQLite
tests pass; presenter tests pass; the import-rule check passes. Until then this command
has no meaning for this repository.

## End-to-end scenarios (manual, via sequential sign-in of several accounts)

1. **Account lifecycle** (FR-001–FR-002, AC-001): register; a second registration with
   the same normalized email — including while the first is unverified — is rejected;
   read the verification message from the pre-sign-in lab outbox; verify; sign in;
   recover the password via the outbox. Use an expired token and a reused token; both
   are refused. The outbox demonstrates tokens, not real email ownership.
2. **Expense creation and approval** (FR-004–FR-005, FR-010–FR-011): create a group with
   two members; submit an equal split that creates remainder units; confirm it is
   pending and excluded from balances; approve once as a reviewer; balances change
   once; repeat with rejection and with an unauthorized reviewer.
3. **Percentage allocation** (FR-007): valid percentages summing to exactly 100 yield
   shares summing to the total; negative or non-100 totals are rejected.
4. **Money input** (NFR-001): USD `10.005` rejected; `10.000` stored as `10.00`;
   over-limit amounts rejected.
5. **Receipt and access** (FR-008, FR-003): attach a JPEG/PNG; a current member can open
   it; a non-member or removed member is denied; an unreadable/invalid file is
   reported and no expense is created.
6. **Notifications** (FR-009): after submission each other current member sees a
   notification on refresh (and within the ≤ 60 s polling interval); a non-member sees
   none. Local availability only; not evidence for network NFR-004.
7. **Payments** (FR-013): record a partial payment; balance unchanged while pending;
   recipient confirms; debt reduced exactly once; zero, negative, excess, and
   unauthorized confirmations rejected; confirm after the recipient was removed is
   refused.
8. **Oversettlement** (FR-013): debt 100, two distinct pending payments of 60: confirm
   the first; the second reports a validation error and stays pending (remaining 40).
9. **Reports** (FR-014–FR-015): records on both endpoints are included; outside records
   are excluded from totals; pending/rejected items appear only in separate status
   counts; current balances labeled "current"; reversed range rejected; empty result
   shows zero totals.
10. **Swing separation**: actions go through inbound ports; long operations do not block
    the Event Dispatch Thread; views update on the EDT.

## Planned JUnit 5 scenarios (not implemented)

Tag/name each with its FR/AC ID (Constitution I, IV). "Fake" = in-memory repositories;
"SQLite" = real embedded database; "Presenter" = fake view.

| Scenario | IDs | Kind |
|---|---|---|
| Equal split for 1–100 participants; remainder units in stored order | FR-006, AC-004 | Fake |
| Percentage split floors/remainders; tie order; Σ shares = total | FR-007, AC-005 | Fake |
| Percentages negative / ≠ 100 rejected | FR-007, AC-005 | Fake |
| Input precision (USD 10.005 rejected, 10.000 accepted); size/overflow limits | NFR-001 | Fake |
| Large-total aggregation beyond 64-bit exact; no SQL `SUM` on money | NFR-001, SC-006 | Fake + SQLite |
| Duplicate email incl. unverified account; normalization | FR-001, AC-001 | Fake |
| Token expiry, reuse, replacement; trusted-context required | FR-002, AC-001 | Fake |
| Membership removal denies restricted reads | FR-003, AC-002, NFR-002 | Fake |
| Reviewer defaults; last-reviewer/manager protection | FR-003, FR-010 | Fake |
| Payer included/excluded netting | FR-005, FR-012, AC-003, AC-009 | Fake |
| Receipt type/size/content failures; cleanup after rollback; orphan sweep | FR-008, AC-006 | Fake + SQLite/files |
| Notification failure rolls back the whole submission | FR-009, AC-007 | SQLite |
| Notification read only by recipient after membership recheck | FR-009 | Fake |
| Duplicate approval/rejection has one effect | FR-011, AC-008 | Fake + SQLite |
| Duplicate confirmation of one payment has one effect | FR-013, AC-010 | Fake + SQLite |
| Different pending payments, one debt (100; 60+60) | FR-013, AC-010 | SQLite (real write serialization) |
| Recipient/party no longer a current member at confirmation | FR-013 | Fake |
| Busy database → whole-transaction retry; exhaustion → no change | FR-013, NFR-006 | SQLite |
| Report status inclusion, date boundaries, reversed range, empty result | FR-014–FR-015, AC-011 | Fake |
| Presenter delegates, shows errors, background/EDT handoff | NFR-006, Constitution II | Presenter |
| Import-rule check (no Swing/JDBC/adapter in domain/application) | Constitution II | Build check |

Fake-repository tests cannot establish rollback, uniqueness, or concurrency; those
require the SQLite tests above.

## Release gates

- Executable tests and local timing: **not run** (documentation-only phase).
- NFR-003/NFR-004 network targets: not established by local measurement.
- FR-016, AC-012, SC-007: deferred; separate release gates for any full-product claim.
- Human review of generated artifacts: pending.
