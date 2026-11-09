# Praxio Authentication Foundation — Architecture Plan

**Status:** Updated — MongoDB Atlas  
**Specification:** [Requirements and Specification](./spec.md)  
**Constitution:** [Project Constitution](../../.specify/memory/constitution.md)

> Scope note: This plan records the original authentication foundation. Its
> proposed repository layout and system diagrams are not a complete inventory
> of the current multi-portal application.

## 1. Proposed System Shape

Use two independently runnable applications and MongoDB Atlas:

```text
Browser
  Angular SPA
    Auth pages, dashboard, auth state, route guards
    API service + credential interceptor
          | HTTPS / JSON + HttpOnly cookie
          v
  NestJS REST API
    Auth module -> Users module -> Mongoose
    JWT guard, validation, exception filter, Swagger
          |
          v
    MongoDB Atlas
```

Keep the frontend and backend in separate `frontend/` and `backend/` package
directories. Use shared API documentation and acceptance criteria rather than
coupling runtime builds. The root contains Spec Kit artifacts and project-level
setup documentation.

## 2. Backend Architecture

- **AuthModule:** Registration and login use cases, bcrypt password
  verification/hashing, JWT issuance, logout, current-user endpoint behavior,
  and authentication guard integration.
- **UsersModule:** User schema/model operations and a safe profile
  projection. Password hashes are excluded from outward-facing DTOs.
- **DatabaseModule:** Validated `MONGO_URI` configuration and Mongoose
  connection/model registration.
- **Common/configuration:** Request validation, global exception formatting,
  environment validation, CORS/origin policy, and shared types/guards as
  appropriate.
- Controllers handle HTTP mapping; providers implement application behavior;
  DTOs validate incoming data. Mongoose models are used only within the
  backend.
- Define document fields and indexes in Mongoose schemas. Enforce unique
  normalized email at the database index level and map duplicate-key errors to
  a safe conflict response. No SQL migrations are used.

### Proposed API contract

| Method | Path                 | Authentication    | Success                                       |
| ------ | -------------------- | ----------------- | --------------------------------------------- |
| `POST` | `/api/auth/register` | No                | `201`, safe user data                         |
| `POST` | `/api/auth/login`    | No                | `200`, safe user data and HttpOnly JWT cookie |
| `POST` | `/api/auth/logout`   | Cookie if present | `204`, clear auth cookie                      |
| `GET`  | `/api/users/me`      | Valid JWT cookie  | `200`, safe user profile                      |

Use a consistent JSON error envelope for non-204 errors, with HTTP status,
stable error code/message, and optional field errors. Never include a password,
hash, signing key, or token in a JSON response. Document cookie authentication
and response/error schemas in Swagger. Exact DTO and envelope fields are to be
confirmed during implementation against this plan.

## 3. Frontend Architecture

- **Auth pages:** Reactive registration and login forms with client-side
  feedback; the API remains authoritative for validation.
- **Auth service:** Calls registration/login/logout/current-user endpoints and
  owns the in-memory authenticated user state.
- **HTTP interceptor:** Adds `withCredentials` only to requests targeting the
  configured API origin so the browser sends the HttpOnly cookie. It does not
  attempt to read or attach the JWT from JavaScript.
- **Route guard:** Checks authentication state and, on initial app load,
  resolves it using the current-user endpoint before allowing dashboard
  navigation.
- **Unauthorized handling:** A `401` clears in-memory auth state and routes the
  user to login. Avoid redirect loops for login/register requests.
- **Dashboard:** Loads and displays only safe current-user profile data and
  provides a logout action.
- Organize application code around `core/`, `auth/`, `dashboard/`, and
  `shared/`, using standalone Angular components unless the selected Angular
  version or established project convention suggests otherwise.

## 4. Data Model and Database

Initial `User` entity:

| Field          | Proposed type/constraint              | Notes                                 |
| -------------- | ------------------------------------- | ------------------------------------- |
| `id`           | MongoDB ObjectId                      | Serialized as a string in the API     |
| `email`        | String, required, unique index        | Trim and lowercase before persistence |
| `passwordHash` | String, required, excluded by default | Bcrypt hash; selected only for login  |
| `createdAt`    | Date, required                        | Mongoose timestamp                    |
| `updatedAt`    | Date, required                        | Mongoose timestamp                    |

Create the unique email index through the Mongoose model/schema configuration.
Ensure duplicate-email handling remains correct under concurrent registration
by handling MongoDB duplicate-key errors as a conflict.

## 5. Approved Security Decisions

The following proposed defaults were approved at the architecture checkpoint:

1. **Token transport/storage:** Keep the signed access JWT in an `HttpOnly`,
   `SameSite=Lax` cookie; set `Secure` in production. Do not expose it to
   Angular JavaScript or persist it in local storage.
2. **Lifetime and logout:** Use an access token with a default 24-hour lifetime
   (configurable from 60 seconds to 24 hours) without refresh tokens or a
   server-side blacklist. The cookie lifetime matches the token. Logout clears
   the cookie and frontend state; a copied token remains valid until expiry.
   If immediate revocation is required, add a server-side session/revocation
   mechanism before implementation. The 24-hour default was explicitly
   requested after the original 15-minute limit proved too short for the
   desired user session.
3. **Cookie/CSRF boundary:** Deploy frontend and API as same-site origins, use
   an exact CORS origin allowlist with credentials, `SameSite=Lax`, and reject
   unsafe cross-origin requests unless their `Origin` is explicitly allowed.
   If deployment must be cross-site, add and test a CSRF-token mechanism and
   update cookie policy rather than weakening checks.
4. **JWT signing:** Use HS256 with a cryptographically random secret of at
   least 32 bytes supplied only through environment configuration; fail startup
   if it is absent or invalid.
5. **Password policy:** Require at least 8 characters, including uppercase,
   lowercase, and a number, and limit input to bcrypt's supported input length
   (72 UTF-8 bytes).
6. **Email identity:** Normalize by trimming and lowercasing; enforce uniqueness
   in MongoDB with a unique index.
7. **Development topology:** Connect to MongoDB Atlas with `MONGO_URI` supplied
   through the environment; keep the URI out of source, logs, tests, and
   committed examples. Keep frontend/API origins configurable and do not
   include production secrets or permissive production CORS defaults.
8. **Errors:** Use a stable JSON shape such as
   `{ statusCode, code, message, fieldErrors? }`; generic login error text and
   no stack traces or database details.

## 6. Environment Configuration

Backend configuration should cover at least `PORT`, `NODE_ENV`, `MONGO_URI`,
`JWT_SECRET`, `JWT_EXPIRES_IN`, and `FRONTEND_ORIGINS`. Frontend configuration
should identify the API base URL per environment. Validate backend settings at
startup; examples use placeholders only.

## 7. Testing Strategy

- **Backend unit tests:** Auth service, password hashing/verification, token
  configuration, DTO validation, and safe user projections.
- **Backend integration tests:** Registration, duplicate email, login
  success/failure, cookie behavior, protected profile, invalid/expired tokens,
  logout, CORS/origin rejection, and Mongoose schema/index behavior.
- **Frontend tests:** Reactive form validation, auth service, interceptor
  credentials behavior, guard resolution/redirects, unauthorized handling,
  dashboard data, and logout.
- Use an isolated MongoDB test database for integration tests. Never point
  tests at a production database or use production credentials.
- End-to-end validation connects to MongoDB Atlas using a privately configured
  test URI, starts the API and frontend independently, then exercises
  registration through logout.

## 8. Original Authentication Foundation Layout

```text
.
├── backend/
│   ├── src/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── database/
│   │   ├── common/
│   │   ├── config/
│   │   └── main.ts
│   ├── test/
│   └── .env.example
├── frontend/
│   └── src/app/
│       ├── core/
│       ├── auth/
│       ├── dashboard/
│       └── shared/
├── .specify/memory/constitution.md
├── specs/authentication-app/
│   ├── spec.md
│   ├── plan.md
│   └── tasks.md
└── README.md
```

## 9. Delivery and Validation Order

1. Bootstrap the independent NestJS and Angular workspaces and verify their
   baseline builds.
2. Implement the database module and Mongoose user schema; verify its unique
   index against an isolated test database.
3. Implement and test registration/login and protected API behavior before UI
   integration.
4. Implement the Angular forms, service, interceptor, guard, dashboard, and
   logout; run frontend tests.
5. Run end-to-end validation, review security and maintainability, and complete
   setup/API documentation.

Each task has a bounded result and validation check in `tasks.md`. The MongoDB
Atlas persistence amendment was requested by the user; use a privately
configured, rotated URI for database-backed validation.

## 10. Approval

The original plan was approved before implementation. The user subsequently
requested and approved replacing MySQL/TypeORM with MongoDB Atlas/Mongoose;
this amendment updates the persistence architecture, configuration, and
validation strategy while preserving the approved API and authentication
security decisions.
