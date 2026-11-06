# Contracts

| File | Status | Meaning |
|---|---|---|
| [inbound-use-cases.md](./inbound-use-cases.md) | **Current** | The interface the Swing application's presenters use: inbound use-case ports with immutable commands/results. This is the contract of the lab MVP. |
| [openapi.yaml](./openapi.yaml) | **Future, non-MVP proposal** | A sketch of a REST contract that a later server-hosted design could expose. It is **not** the Swing application's current interface, nothing implements it, and no server is built or planned in this lab. |

## About the future REST proposal

The simplified Architecture B decision ([docs/decisions.md](../../../docs/decisions.md))
selected a local single-module application. The OpenAPI file was written for the earlier
shared-server design and is kept only as a starting point should the product later
adopt a central service for shared multi-device use or web/Android/iOS clients (FR-016).

Adopting it would still require: shared persistence replacing local SQLite (and shared
receipt storage), network identity/session security, real verification/recovery email,
a re-verified concurrency strategy, reconciling the file with the then-current
inbound use cases (for example the lab's reviewer-update, receipt-with-submission, and
report-status rules), and the new clients. It has not been updated to the lab's
simplified rules and should not be treated as authoritative for them; where it differs
from [spec.md](../spec.md) or [inbound-use-cases.md](./inbound-use-cases.md), those win.
