# Praxio Project Constitution

**Project:** Praxio — Electronics Repair Marketplace  
**Product scope:** Customer, Shop, and Admin portals  
**Version:** 2.1.0  
**Status:** Adopted as project guidance; new feature work requires explicit approval

## Purpose and Scope

This constitution governs product and engineering decisions for Praxio, an
electronics repair marketplace with Customer, Shop, and Admin portals. The
repository contains implemented workflows across those portals, including
registration and approval, shop discovery, repair requests and progress,
quotations, administration, notifications, and Shop subscription payments.

This constitution records durable engineering principles; it is not blanket
authorization to implement every idea or feature in an earlier brief. Work
must be tied to an explicit user-approved request or approved feature
specification. For substantial or ambiguous changes, record the scope,
behavior, and validation before implementation. Existing authentication
specification documents describe the original authentication foundation only;
they do not define the complete current product.

## Core Principles

### 1. Incremental, Approved Delivery

- Implement the requested, approved scope completely and incrementally; do not
  treat an old feature brief as authorization to build unrelated capabilities.
- Customer, Shop, and Admin workflows are part of the current product. Preserve
  their existing behavior when implementing changes in any portal.
- Do not add a new business capability or materially change a workflow without
  an explicit user-approved request or feature specification.
- Inspect the current code, dependencies, and reusable patterns before making
  changes. Preserve working behavior and avoid recreating the project.
- Report changed files, implemented behavior, checks run, and outstanding
  work. Seek clarification before proceeding when scope, policy, or a
  significant product decision is ambiguous.

### 2. Modular Monolith and Separation of Concerns

- Keep one Angular application and one NestJS application, organized into
  cohesive feature areas. Do not introduce microservices.
- Keep backend controllers focused on HTTP concerns and place business rules in
  injectable providers and domain-focused modules.
- Keep Angular page orchestration, reusable presentation, API access, and
  authentication state in their appropriate components and services.
- Use dependency injection and abstractions where they improve clarity or
  testability; avoid needless layers and indirection.
- Maintain clear role-appropriate route and API boundaries across the
  Customer, Shop, and Admin portals.

### 3. Approved Technology and Infrastructure

- Frontend: Angular, TypeScript, SCSS, standalone components, Angular Router,
  Reactive Forms, and Angular HttpClient. Prefer accessible reusable UI
  components and lazy-loaded feature routes where appropriate.
- Backend: Node.js, NestJS, TypeScript, REST APIs, and Mongoose.
- Primary database: MongoDB. Use explicit Mongoose schemas and appropriate
  indexes.
- Validate uploaded file type, content, and size, and enforce authorization on
  every read and write. The current application stores bounded image data in
  MongoDB documents; use GridFS or another storage design only after an
  approved architecture decision when file size or scale requires it.
- Use a modular monolith. Do not use AWS, Azure, S3, Azure Blob Storage,
  Cloudinary, or Firebase Storage. Do not introduce a replacement storage
  provider without an approved constitution amendment.
- Add dependencies only when required by an approved design and prefer existing
  project capabilities.

### 4. Customer Experience and Accessibility

- Build a polished, customer-facing service marketplace, not a generic admin
  dashboard. Use consistent typography, spacing, color, iconography, and
  restrained visual effects.
- Support desktop, laptop, tablet, and mobile layouts. Customer workflows and
  navigation must remain usable on small screens.
- Use semantic HTML, keyboard-operable controls, visible focus, accessible
  labels, adequate contrast, and appropriate assistive-technology states.
- Provide clear loading, empty, success, and error states for implemented
  interactions. Do not use decorative placeholders in a way that suggests a
  real action or result.
- Do not present hardcoded sample content as live customer, shop, rating,
  location, quotation, or repair data. Clearly identify approved static design
  examples when needed.

### 5. Authentication, Authorization, and Privacy

- The backend is authoritative for identity, authorization, validation, and
  persisted data; frontend guards and validation are usability measures, not
  security boundaries.
- Hash passwords with bcrypt. Never persist or log plaintext passwords,
  password hashes in outward-facing responses, access tokens, or signing
  secrets.
- Load signing keys and other secrets from required environment configuration.
  Do not hardcode secrets, add insecure defaults, or weaken configuration
  validation to make startup succeed.
- Validate token signatures, allowed algorithms, and expiry on protected
  requests. Keep signing and verification configuration consistent. Reject
  missing, invalid, and expired credentials.
- Enforce authorization and ownership checks on every protected resource,
  including uploaded files and customer records. Return only the minimum
  personal data required for each use.
- Define token storage, refresh-token behavior, logout, OTP, verification, and
  account recovery in the approved security design before implementing them.
  OTP or notification delivery must use a real configured provider; never claim
  delivery when none is configured. Development-only codes must not be enabled
  in production.

### 6. API and Data Integrity

- Use documented REST endpoints, resource-appropriate HTTP methods and status
  codes, DTO-based input validation, and consistent success and error
  contracts.
- Document authentication requirements, inputs, pagination, and response/error
  shapes in Swagger for implemented endpoints.
- Enforce ownership and business invariants on the server. Use database
  constraints and indexes for uniqueness and query needs.
- Make uploads private by default. Validate file size, type, and content;
  authorize every read and write; and avoid disclosing storage details.
- Never return credentials, signing keys, password hashes, internal stack
  traces, or sensitive implementation details in API responses.

### 7. Engineering and Coding Standards

- Use strict TypeScript and preserve the repository's formatting, lint, and
  framework conventions.
- Prefer precise types, descriptive names, cohesive modules, and focused
  functions. Avoid unsafe type escapes, duplicated business rules, unexplained
  constants, and unnecessary dependencies.
- Validate all backend inputs and handle expected failures explicitly. Do not
  hide errors behind broad catches, silent defaults, or success-shaped
  fallbacks.
- Keep changes surgical and traceable to approved requirements. Do not
  overwrite working code or fix unrelated issues without a reason.
- Do not leave incomplete imports, broken builds, nonfunctional controls, or
  unreported limitations.

### 8. Testing and Verification

- Add or update tests for each implemented behavior, including relevant
  validation, authorization, persistence, and error cases.
- For applicable milestones, verify Angular and NestJS builds, implemented API
  behavior, frontend behavior, form validation, authorization, error handling,
  database operations, and file access.
- Authentication tests must cover registration and login, token issuance,
  protected resources, and invalid or expired credentials.
- Tests must not use production data or real production credentials. Use
  isolated test configuration and deterministic providers where appropriate.
- Run the smallest relevant test, lint, and build commands for each change.
  Report actual results; do not claim unrun checks passed.

### 9. Configuration and Operational Safety

- Validate required configuration at startup and fail with actionable messages
  that identify the missing or invalid setting without printing its value.
- Commit only safe example configuration. Keep `.env`, credentials, keys, and
  generated secrets out of version control.
- Keep development, test, and production settings distinct. Production must
  use explicit origins, secure transport, and secure cookie settings where
  cookies are used.
- Do not log secrets, authorization headers, cookies, OTPs, or sensitive
  personal data. Restrict CORS and file access to the approved application
  origins and authorization rules.

### 10. Documentation and Governance

- Keep the constitution, approved product requirements, architecture, milestone
  tasks, and setup/API documentation consistent with the implemented project.
- Document prerequisites, environment setup, startup commands, tests, database
  configuration, and operational constraints.
- Follow the delivery checkpoints: constitution; product requirements and
  specification; architecture and milestone tasks; implementation; tests and
  review; documentation; and end-to-end validation.
- A constitution amendment requires an explicit rationale and review.
  Unsettled product, privacy, security, or infrastructure choices must be
  recorded for approval rather than silently assumed.

## Governance

This constitution applies to contributors and generated changes in the Praxio
repository. In case of conflict, security and privacy principles take
precedence over convenience. Approved milestone specifications refine this
constitution but must not weaken its security, privacy, testing, or delivery
requirements. Amendments must record their rationale and version change.

## Amendment History

- **2.1.0:** Updated the product scope from the original Customer-Portal-only
  milestone to the implemented Customer, Shop, and Admin portals; clarified
  approval rules for future work; aligned file-storage guidance with the
  current bounded MongoDB image fields; and identified the authentication
  specifications as foundation-only documents. Rationale: prevent governance
  guidance from contradicting the current repository or overstating the scope
  of the original authentication documents.
