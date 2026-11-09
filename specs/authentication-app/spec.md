# Praxio Authentication Foundation — Requirements and Specification

**Status:** Updated — MongoDB Atlas  
**Constitution:** [Project Constitution](../../.specify/memory/constitution.md)

> Scope note: This specification covers the original authentication
> foundation only. It is not the requirements specification for the complete
> Customer, Shop, and Admin marketplace.

## 1. Purpose

Deliver a small, independently runnable web application that lets a user create
an account, sign in, access a protected dashboard, and sign out. The application
uses an Angular frontend and a NestJS REST API backed by MongoDB Atlas and Mongoose.

## 2. Scope

### In scope

- Account registration and login using an email address and password.
- Secure password hashing with bcrypt.
- JWT access-token issuance and validation.
- Protected backend endpoints and an authenticated dashboard.
- Frontend registration, login, and dashboard flows with validation and clear
  success and error feedback.
- Angular authentication service, HTTP interceptor, and route guard.
- NestJS Auth, Users, and Database modules, DTO validation, centralized error
  handling, environment-based configuration, and Swagger documentation.
- Mongoose schemas and MongoDB indexes for persistence and uniqueness.
- Unit and integration tests for critical authentication behavior, plus
  frontend tests for the authentication flow.
- Setup, API, and architecture documentation.

### Out of scope unless separately approved

- Social, SSO, or multi-factor authentication.
- Password reset, email verification, account recovery, and user administration.
- Refresh tokens, persistent server-side sessions, and role-based permissions.
- Production hosting, CI/CD, and a production observability platform.

## 3. Actors

- **Unauthenticated visitor:** Can register or sign in.
- **Authenticated user:** Can view the protected dashboard and sign out.
- **Operator/developer:** Configures the application and MongoDB Atlas using
  environment variables, and runs tests.

## 4. Functional Requirements

### Registration

- **FR-REG-01:** A visitor can submit an email address and password to create an
  account.
- **FR-REG-02:** The API validates required fields and rejects invalid input
  with a client error and field-level details that do not expose internals.
- **FR-REG-03:** The API stores a bcrypt hash, never the submitted plaintext
  password.
- **FR-REG-04:** An email address can identify at most one account. A duplicate
  registration receives a conflict response without exposing database details.
- **FR-REG-05:** The frontend displays registration success or actionable
  validation/registration errors.

### Login and token validation

- **FR-AUTH-01:** A registered user can submit an email address and password to
  sign in.
- **FR-AUTH-02:** The API verifies the password against its bcrypt hash and
  issues a signed JWT access token after successful authentication.
- **FR-AUTH-03:** Invalid credentials produce a generic unauthorized response
  that does not reveal whether the email address exists.
- **FR-AUTH-04:** The API validates token signature and expiry when a protected
  endpoint is called. Missing, invalid, or expired tokens are rejected with an
  unauthorized response.
- **FR-AUTH-05:** The frontend reports login failures clearly and does not
  treat an unsuccessful response as authenticated.

### Protected dashboard and logout

- **FR-UI-01:** A visitor can open the login and registration pages.
- **FR-UI-02:** A visitor cannot access the dashboard; the route guard redirects
  them to sign in.
- **FR-UI-03:** An authenticated user can view the dashboard and retrieve
  protected user information from the API.
- **FR-UI-04:** The frontend attaches authentication credentials to requests
  that require them and handles unauthorized responses by clearing the local
  authenticated state and directing the user to sign in.
- **FR-UI-05:** A user can sign out; after sign-out, the dashboard is no longer
  accessible without authenticating again.

### Platform and maintainability

- **FR-API-01:** The API exposes documented REST endpoints and interactive
  Swagger documentation.
- **FR-API-02:** The backend separates Auth, Users, and Database concerns into
  NestJS modules and validates API input through DTOs.
- **FR-DB-01:** Persisted documents use explicit Mongoose schemas and MongoDB
  indexes; production must not depend on SQL migrations or TypeORM.
- **FR-OPS-01:** Frontend and backend can be configured and run independently
  from documented setup instructions.
- **FR-OPS-02:** Required runtime settings are loaded from environment
  variables; committed example files contain placeholders only.

## 5. Non-Functional Requirements

- **NFR-SEC-01:** Passwords, password hashes, JWTs, signing secrets, and
  authorization headers are never returned to clients or written to logs.
- **NFR-SEC-02:** Authentication secrets have no insecure hard-coded fallback;
  missing required configuration is reported at startup.
- **NFR-SEC-03:** Authentication, authorization, and validation are enforced
  server-side regardless of frontend state.
- **NFR-SEC-04:** Browser token storage, token lifetime, CORS allowlist, and
  logout/revocation semantics must be explicitly decided in the architecture
  checkpoint before implementation.
- **NFR-REL-01:** Invalid requests and expected authentication failures return
  consistent HTTP statuses and non-sensitive JSON error responses.
- **NFR-MAINT-01:** TypeScript types, module boundaries, and naming remain
  consistent with the approved constitution and chosen framework conventions.
- **NFR-TEST-01:** Unit, integration, and frontend tests cover the critical
  success and failure paths before the feature is considered complete.
- **NFR-DOC-01:** Setup, environment configuration, schema/index behavior,
  tests, and API usage are documented.
- **NFR-UX-01:** Forms provide accessible labels, validation feedback, and
  responsive layouts suitable for common desktop and mobile viewport sizes.

## 6. API Behavior Requirements

The approved API design must provide equivalent operations for:

- Registering an account.
- Logging in and setting an access-token cookie.
- Returning the current user's safe profile from an authenticated request.
- Logging out by clearing the access-token cookie.

| Method | Path                 | Request               | Success                                         |
| ------ | -------------------- | --------------------- | ----------------------------------------------- |
| `POST` | `/api/auth/register` | `{ email, password }` | `201`, `{ data: { user } }`                     |
| `POST` | `/api/auth/login`    | `{ email, password }` | `200`, `{ data: { user } }` and HttpOnly cookie |
| `POST` | `/api/auth/logout`   | Cookie if present     | `204`, cleared cookie                           |
| `GET`  | `/api/users/me`      | Valid HttpOnly cookie | `200`, `{ data: { user } }`                     |

Safe user data contains only `id`, `email`, and `createdAt`. Error responses
use `{ statusCode, code, message, fieldErrors? }`; validation `fieldErrors` is
an array of non-sensitive messages. Every operation documents authentication
requirements, success statuses, and expected validation/authentication
failures in Swagger.

## 7. Acceptance Criteria

- **AC-01:** A valid registration creates one user whose stored password value
  is a bcrypt hash and is not equal to the submitted password.
- **AC-02:** Invalid registration data is rejected, and duplicate email
  registration does not create another user.
- **AC-03:** Correct credentials return a valid access token; incorrect
  credentials return a generic unauthorized response.
- **AC-04:** A valid token can access the protected profile endpoint; missing,
  malformed, invalid-signature, and expired tokens cannot.
- **AC-05:** A visitor is redirected away from the dashboard, while an
  authenticated user can load it and view safe profile information.
- **AC-06:** Signing out clears the cookie and frontend auth state; a copied
  stateless access token remains valid only until its configured expiry
  (24-hour default).
- **AC-07:** The frontend exercises registration, login, protected navigation,
  unauthorized handling, and logout with clear feedback.
- **AC-08:** Mongoose models enforce the required document shape and unique
  normalized email index in MongoDB Atlas without SQL migrations.
- **AC-09:** Swagger describes the implemented endpoints, and the documented
  setup is sufficient to run the frontend, backend, and tests independently.
- **AC-10:** Relevant backend unit/integration tests and frontend tests pass.

## 8. Approved Architecture Decisions

The following decisions were approved at the architecture checkpoint:

1. Keep the signed JWT in an `HttpOnly`, `SameSite=Lax` cookie; set `Secure` in
   production. The Angular app never reads or persists the JWT.
2. Use a stateless access token with a 24-hour default lifetime (configurable
   from 60 seconds to 24 hours), without refresh tokens or a server-side
   blacklist. The cookie lifetime matches the token. Logout clears the cookie
   and frontend state; copied tokens remain usable until expiry. The 24-hour
   default was explicitly requested after implementation.
3. Use same-site frontend/API deployment, exact credentialed CORS origins, and
   reject unsafe cross-origin requests unless their `Origin` is allowlisted.
4. Sign and verify tokens with HS256 and a random, environment-supplied secret
   of at least 32 bytes. Missing or placeholder secrets fail startup.
5. Require passwords of at least 8 characters with uppercase, lowercase, and a
   number, and no more than 72 UTF-8 bytes for bcrypt.
6. Trim and lowercase email addresses, and enforce uniqueness with a MongoDB
   unique index.
7. Configure MongoDB Atlas using `MONGO_URI` supplied through the environment;
   never commit the URI or its credentials. Use a separate test database and
   explicit origin allowlists.
8. Use the `data` success envelope and `{ statusCode, code, message,
fieldErrors? }` error envelope described above.

## 9. Approval

This document and its acceptance criteria were approved before architecture
planning. The persistence requirement was subsequently amended at the user's
request from MySQL/TypeORM to MongoDB Atlas/Mongoose; the API and authentication
requirements remain unchanged.
