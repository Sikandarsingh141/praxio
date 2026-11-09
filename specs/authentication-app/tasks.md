# Praxio Authentication Foundation — Task Breakdown

**Status:** In progress — MongoDB implementation and non-database checks complete; Atlas validation pending
**Plan:** [Architecture Plan](./plan.md)  
**Specification:** [Requirements and Specification](./spec.md)

> Scope note: These tasks track the original authentication foundation only.
> They do not represent the completion status of later Customer, Shop, or Admin
> features. The validation counts and review outcome below are snapshots from
> that foundation work and must not be read as current whole-project results.

Tasks are ordered in implementation phases. Database-backed validations remain
pending until a private, rotated MongoDB Atlas URI is configured for validation.

## Phase A — Workspace Foundations

- [x] **A1. Bootstrap the NestJS backend**
  - Create the independent backend package using the approved Node/NestJS
    versions and strict TypeScript conventions.
  - Add application bootstrap, health/startup behavior, baseline tests, and
    scripts for build, lint, test, and development.
  - **Validation:** Backend dependency install and baseline build/tests pass.
- [x] **A2. Bootstrap the Angular frontend**
  - Create the independent frontend package with responsive app shell and
    baseline scripts.
  - **Validation:** Frontend dependency install, baseline build, and tests pass.
- [ ] **A3. Configure development and test environments** _(implemented; Atlas connection awaits a privately configured URI)_
  - Add safe `.env.example` files, runtime config validation, API base URL
    configuration, and a local-only MongoDB test URI.
  - **Validation:** Missing required backend settings fail clearly; examples
    contain no credentials; tests cannot use the Atlas URI.

## Phase B — Database and User Foundation

- [ ] **B1. Implement DatabaseModule and Mongoose configuration** _(implemented; Atlas connection test pending)_
  - Configure MongoDB Atlas through validated `MONGO_URI` and connect through
    NestJS Mongoose integration.
  - **Validation:** Database module connects using a private test URI.
- [ ] **B2. Implement the user schema and unique index** _(implemented; database-backed index check pending)_
  - Add normalized unique email, excluded password hash, ObjectId, and
    timestamps with appropriate schema and index definitions.
  - **Validation:** Mongoose schema applies and duplicate email is rejected by
    the MongoDB unique index.
- [x] **B3. Implement UsersModule safe profile operations**
  - Add Mongoose lookup/create behavior and a safe profile projection that
    excludes password hashes by default.
  - **Validation:** Unit tests cover normalization, lookup, and hash exclusion.

## Phase C — Backend Authentication

- [x] **C1. Implement registration DTO and service**
  - Validate email/password requirements, hash with bcrypt, and map duplicate
    email constraint failures to a safe conflict response.
  - **Validation:** Unit/integration tests cover valid registration, invalid
    input, duplicate email, and stored hash.
- [x] **C2. Implement login and JWT issuance**
  - Verify credentials without account-enumeration messages and issue the
    configured JWT using validated secret configuration.
  - **Validation:** Correct credentials succeed; wrong/unknown credentials
    return the same generic unauthorized behavior; JWT signature and expiry
    tests pass.
- [x] **C3. Implement cookie transport, guard, logout, and origin checks**
  - Apply approved cookie settings; protect the profile endpoint; clear the
    cookie on logout; enforce approved CORS and unsafe-request Origin policy.
  - **Validation:** Integration tests cover missing/invalid/expired tokens,
    cookie flags, logout, allowed origins, and rejected origins.
- [x] **C4. Implement centralized error responses and Swagger**
  - Standardize the approved error envelope and document endpoint payloads,
    cookie authentication, statuses, and errors.
  - **Validation:** API tests assert response shapes; Swagger exposes all
    endpoints and security requirements without secrets.
- [ ] **C5. Complete backend tests before UI integration** _(28 unit/API tests pass; MongoDB-backed integration awaits a test database)_
  - Run authentication unit/integration suites against an isolated MongoDB
    test database.
  - **Validation:** All backend tests pass, including unique-index and
    protected-resource behavior.

## Phase D — Angular Authentication

- [x] **D1. Implement responsive registration and login forms**
  - Use reactive forms, accessible field labels, approved client-side checks,
    and API-driven success/error feedback.
  - **Validation:** Component tests cover valid/invalid submissions and
    displayed API errors.
- [x] **D2. Implement Angular authentication service and interceptor**
  - Manage in-memory user state; call registration, login, logout, and current
    profile APIs; attach credentials only to the configured API origin.
  - **Validation:** Service/interceptor tests verify request behavior, state
    transitions, and that no token is read from browser storage.
- [x] **D3. Implement route guard and unauthorized handling**
  - Resolve session state on app load, protect dashboard navigation, and handle
    API `401` responses without redirect loops.
  - **Validation:** Guard/interceptor tests cover anonymous, authenticated,
    expired-session, and login-page cases.
- [x] **D4. Implement protected dashboard and logout UI**
  - Load and display safe profile data and clear local state on logout.
  - **Validation:** Component tests cover profile display, loading/error states,
    and logout navigation.

## Phase E — Review and Delivery

- [ ] **E1. Run end-to-end application validation** _(blocked until a private, rotated Atlas URI is configured)_
  - Connect to MongoDB Atlas, run both applications, and exercise
    registration, login, protected access, expiry/unauthorized behavior, and
    logout.
  - **Validation:** Record outcomes for acceptance criteria AC-01 through AC-10.
- [x] **E2. Perform code and security review**
  - Review credential handling, token/cookie boundaries, authorization,
    validation, database access, error leakage, accessibility, and code
    quality; resolve material findings.
  - **Validation:** Review findings are resolved or explicitly documented and
    accepted; relevant checks pass again.
  - **Review outcome:** No application-code findings were identified in the
    reviewed authentication, authorization, validation, database, error, and
    frontend session flows. TypeORM and MySQL dependencies were removed as
    part of the MongoDB change. The updated production dependency audit reports
    zero vulnerabilities; the full dependency tree reports 28 development-tool
    advisories (5 low and 23 moderate; no high/critical), primarily through
    Jest and Nest CLI tooling. No breaking audit fixes were applied.
- **Available validation results:** Backend build, lint, 28 unit/API tests, and
  the health e2e test pass. Frontend production build and 15 tests pass.
  Desktop/mobile UI smoke checks passed. Atlas connection, unique-index
  creation, and DB-backed integration/e2e flows remain unverified.
- [x] **E3. Complete setup and API documentation**
  - Document prerequisites, independent startup, environment variables,
    Mongoose schema/index behavior, tests, Swagger, and known security semantics.
  - **Validation:** Follow the documentation from a clean local setup.

## Dependency Notes

- A1 and A2 are independent.
- A3 depends on A1 and A2.
- B1 depends on A1 and A3; B2 depends on B1; B3 depends on B2.
- C1 depends on B2 and B3; C2 depends on C1; C3 depends on C2; C4 depends on
  C3; C5 depends on C1 through C4.
- D1 can proceed after A2; D2 depends on A2 and C5; D3 depends on D2; D4
  depends on D2 and D3.
- E1 depends on C5 and D4; E2 depends on E1; E3 may proceed alongside Phase D
  and must be complete before delivery.
