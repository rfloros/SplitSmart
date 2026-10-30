<!--
Sync Impact Report
Version change: uninitialized -> 1.0.0
Modified principles: None; this establishes the initial principles.
Added sections: Implementation Constraints; Development Workflow.
Removed sections: None.
Follow-up TODOs: Confirm the original ratification date.
-->

# SplitSmart Constitution

## Core Principles

### I. Customer Requirements and Traceability
`UserRequirement.md` is the source of customer requirements. Specifications and work
items MUST distinguish those requirements from implementation decisions such as
language, framework, or diagramming tool. Each customer requirement MUST be traceable
through its specification and implementation work to relevant tests or an explicit
reason why it is not testable. Conflicts between a customer requirement and an
implementation decision MUST be made visible and resolved in the feature specification;
an implementation choice MUST NOT be represented as a customer requirement.

### II. Object-Oriented Design and GUI Separation
The application MUST use object-oriented design to give domain concepts and business
rules clear responsibilities. Swing presentation code MUST delegate business decisions
to non-GUI application or domain logic. Business rules MUST be testable without
constructing or interacting with Swing components. This separation limits UI coupling
and keeps behavior verifiable.

### III. Monetary Accuracy
Currency amounts and monetary calculations MUST use `BigDecimal`, never binary
floating-point types. Rounding scale and mode MUST be explicit at defined monetary
boundaries, and tests MUST cover relevant split, percentage, and rounding behavior.
This prevents representation error from silently changing balances.

### IV. Verified Behavior
JUnit 5 tests MUST verify business rules and acceptance criteria, including relevant
boundary cases. Changes to behavior MUST update or add tests, and tests MUST be run
before work is considered complete. Test names and organization SHOULD make their
covered requirements identifiable.

### V. Human Review of AI Output
AI-generated code, tests, specifications, and diagrams MUST receive human review
before acceptance. Reviewers MUST verify correctness, requirement alignment, and
consistency with this constitution; generated output is a proposal, not an authority.

## Implementation Constraints

The project MUST use Java 21 and Maven. Its desktop user interface MUST use Java Swing.
JUnit 5 MUST be used for automated tests, and PlantUML MUST be used for maintained
architecture or design diagrams. These are implementation decisions, not customer
requirements. In particular, selecting Swing alone does not satisfy the
web-based/Android/iOS platform requirement recorded in `UserRequirement.md`; any
platform scope or compatibility decision MUST be resolved and documented in the
relevant feature specification.

## Development Workflow

Specifications MUST identify customer requirements separately from implementation
decisions and provide traceability to planned work and verification. Implementation
work MUST preserve the separation between Swing presentation and business logic.
PlantUML diagrams MUST be updated when a change materially alters the design they
describe. Before acceptance, reviewers MUST check the relevant JUnit 5 results,
requirement coverage, diagram accuracy where applicable, and human review of any AI
output.

## Governance

This constitution governs project specifications, implementation, and review.
Amendments MUST be made by updating this document, explaining the change and its
impact, and obtaining human review before acceptance. Version numbers follow
semantic versioning: MAJOR for incompatible governance changes, MINOR for new or
materially expanded principles or sections, and PATCH for clarifications and
non-semantic edits. Feature reviews MUST check compliance with applicable principles,
requirement traceability, tests, and human review. Any deviation MUST be documented
with its rationale and approved by a human reviewer.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE): 2026-10-29 | **Last Amended**: 2026-10-29
