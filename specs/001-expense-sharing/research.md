# Research: SplitSmart Expense Sharing

## Shared persistence and client architecture

**Decision**: The MVP uses the Swing application as a client of a shared Java service
over HTTPS. The service owns authorization, domain use cases, and PostgreSQL
persistence. The desktop client does not connect directly to the database.

**Rationale**: Accounts and groups must be shared between people and the original
product is intended to support multiple clients. A central service gives separate
desktop installations one authoritative source of truth. SQLite is appropriate for
local or single-device storage, but does not by itself synchronize separate
installations; H2 server mode would centralize a database but would still need an
application service for authorization, business rules, email, and a client API.

**Alternatives considered**:

- **SQLite embedded in each desktop installation**: simplest for a local-only
  demonstration, but every installation would have separate group data. It does
  not satisfy shared live group state without a synchronization service.
- **H2 server mode**: can centralize data, but does not replace the required
  application/API layer.
- **PostgreSQL behind a shared service**: selected because transaction boundaries,
  service authorization, and a common API serve the desktop MVP and later clients.

## Layering and Swing behavior

**Decision**: Keep Swing presentation, application use cases, domain rules, and
infrastructure adapters in separate modules/layers. The Swing client delegates to
the API; it never implements expense allocation, approval, or balance decisions.

**Rationale**: Swing's separable-model approach supports independent views and
application data. Network calls run off the Event Dispatch Thread, then the UI is
updated on the EDT. The server-side domain and application modules can be tested
without constructing Swing components.

**Alternatives considered**: Direct JDBC calls from Swing listeners were rejected
because that couples presentation to persistence, duplicates business rules across
future clients, and exposes database access to desktop installations.

## Transactions, monetary representation, and idempotency

**Decision**: Run approval and payment confirmation as database transactions.
Treat approved expenses and confirmed payments as the authoritative inputs to
derived balances; persist money as integer minor units with an ISO currency code.
Use `BigDecimal` in all domain calculations and an explicit currency scale and
rounding mode at allocation boundaries.

**Rationale**: PostgreSQL transactions provide all-or-nothing updates; JDBC exposes
commit and rollback controls. A conditional transition from `PENDING` prevents
duplicate expense decisions or payment confirmations from applying twice. Integer
minor-unit persistence avoids approximate decimal database representations, while
`BigDecimal` meets the domain's no-binary-floating-point requirement.

**Alternatives considered**: Persisting balances as independently updated values
was rejected because they could drift from the expense/payment history. Floating
point types were rejected by the constitution and NFR-001.

## Authentication and receipts

**Decision**: Keep account registration, verified-email state, authentication, and
password-reset tokens in the service. Store password hashes produced by a suitable
slow password-hashing algorithm; use a mail-delivery port for verification and
recovery messages. Store receipt metadata and access control in PostgreSQL and
content behind a private receipt-storage port.

**Rationale**: Central identity prevents credentials and mail-service secrets from
being distributed to each desktop installation. Expiring, single-use reset tokens
and non-enumerating recovery responses follow OWASP guidance. A storage port
isolates receipt access so storage can change without altering domain rules.

**Alternatives considered**: Plaintext passwords, reusable reset links, and
desktop-local receipt paths were rejected because they expose credentials or fail
to support shared, authorized receipt access.

## Service and client contract

**Decision**: Describe the HTTPS/JSON interface with OpenAPI. Keep server runtime
framework and mail provider behind adapters; neither is needed to specify the
domain, transaction boundaries, or client contract.

**Rationale**: OpenAPI gives future web and mobile clients a discoverable contract
without coupling them to Swing or server implementation details. Deferring a
framework choice avoids an unsupported dependency decision at the architecture
stage.

**Alternatives considered**: A Java-only service interface would not define a
language-neutral contract for future non-Java clients.

## References

- SQLite, [Appropriate Uses For SQLite](https://www.sqlite.org/whentouse.html)
- PostgreSQL, [Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
- Java 21, [`Connection`](https://docs.oracle.com/en/java/javase/21/docs/api/java.sql/java/sql/Connection.html)
- Oracle, [Swing components and models](https://docs.oracle.com/javase/tutorial/uiswing/components/model.html)
- Java 21, [`SwingWorker`](https://docs.oracle.com/en/java/javase/21/docs/api/java.desktop/javax/swing/SwingWorker.html)
- OpenAPI Initiative, [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
- OWASP, [Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- OWASP, [Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
