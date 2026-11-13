# Fixroa

Fixroa is an electronics repair marketplace with Customer, Shop, and Admin
portals. Current workflows include registration and approval, shop discovery,
repair requests and progress, quotations, dispute management, administration,
notifications, and Shop subscription payments. The stack is Angular, NestJS, MongoDB Atlas,
Mongoose, bcrypt, and JWT access cookies. The frontend and backend are
independently runnable.

## Requirements

- Node.js 20.19 or newer and npm.
- A MongoDB Atlas cluster and a database user with access to the application
  database.

## Local Setup

1. Copy `backend\.env.example` to `backend\.env`. Set `MONGO_URI` to your
   MongoDB Atlas connection string and replace the JWT secret placeholder.
   Include the target database name in the URI path, percent-encode special
   characters in credentials, keep the URI private, and do not commit it.
   Generate a JWT secret, for example:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
   ```

   In Atlas, allow network access only from the required application IPs and
   grant the database user only the privileges it needs.

   To seed 10 local test Shops (7 India locations and 3 US locations), use a
   development database only. From `backend\`, set a test password and confirm
   the operation before running the script:

   ```powershell
   $env:NODE_ENV = 'development'
   $env:SEED_DEMO_SHOPS_CONFIRM = 'YES'
   $env:DEMO_SHOP_PASSWORD = '<choose-a-test-password-of-at-least-8-characters>'
   npm run seed:demo-shops
   ```

   The script reads `MONGO_URI` from `backend\.env`, refuses to overwrite
   existing demo accounts, and marks the Shop subscription payment as simulated
   and approved for marketplace testing. It does not create Stripe charges or
   invoices. The initial batch uses `demo.shop01@example.test` through
   `demo.shop10@example.test`.

   To add another 100 Shops, keep the same development-only environment
   settings and run:

   ```powershell
   npm run seed:additional-demo-shops
   ```

   This adds `demo.shop11@example.test` through `demo.shop110@example.test`:
   60 India locations, 10 US locations outside California, 10 Canada, 10
   Australia, and 10 California. Both batches share the password supplied
   above. MongoDB transactions are required. The password must include
   uppercase and lowercase letters and a number, matching Shop registration
   rules.

   For shop subscription testing, rotate any Stripe key that has been shared,
   set the new test-mode `STRIPE_SECRET_KEY` only in `backend\.env`, then run
   Stripe CLI and set its `whsec_...` signing secret as
   `STRIPE_WEBHOOK_SECRET`. Forward events to
   `http://localhost:3000/api/payments/stripe/webhook`. Never place either key
   in frontend code, source control, or chat.

This switches the application persistence provider; it does not copy any
existing MySQL records. Export and migrate existing data separately if it must
be preserved.

2. Install dependencies for each application:

   ```powershell
   Set-Location backend
   npm ci
   Set-Location ..\frontend
   npm ci
   Set-Location ..
   ```

3. From the project root, start both the API and Angular frontend with one command:

   ```powershell
   npm start
   ```

4. Open <http://localhost:4200>. Swagger is available at
   <http://localhost:3000/api/docs>.

The development CORS/origin allowlist defaults to `http://localhost:4200` and
`http://localhost:3000`. Update `FRONTEND_ORIGINS` for another local topology.
Production deployments must use HTTPS and an explicit allowlist.

## Registration

The frontend provides account selection at `/auth/register`, customer
registration at `/auth/register/customer`, and a multi-step shop flow at
`/auth/register/shop`. Every customer and shop submission creates a user with
`pending_approval` account status and a separate pending registration request.
The user and request, along with in-app notifications for active Admin accounts,
are written in one MongoDB transaction. If no active Admin exists, the
registration is still saved as pending and an application warning is logged;
Admin notifications are skipped until an active Admin account is available.
MongoDB must support transactions.
Pending and declined users cannot sign in. Passwords are bcrypt-hashed, and
responses never include password data.

The legacy `/api/auth/register` endpoint remains available for compatibility,
but now submits an approval-required customer request rather than creating an
active account. Pending or declined Customers and Shops can sign in to their
restricted profile and notifications pages. Customer operational pages remain
unavailable until approval. Shop owners can resume required payment from their
profile; payment and Admin approval are both required for the Shop Portal.
Login uses backend registration, payment, and account status to route users
to the restricted profile or full portal.

Shop registration redirects to Stripe Checkout for a USD 29/month subscription.
Checkout uses a server-created subscription session; the secret key is only
loaded by the backend. Card details are collected on Stripe's hosted page and
are never stored by Fixroa. A Shop remains restricted until Stripe confirms
payment and an Admin approves the registration. Logged-in Shop owners can
resume payment from `/shop/payment`; Admin approval is blocked unless payment
has been verified. Registration submissions and Admin decisions are stored as
in-app notifications for Admins and applicants. Every portal header, including
the restricted Shop payment/profile pages, provides a notification bell and
unread count. Configure Firebase Web Push to deliver real-time browser alerts:
set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and
`FIREBASE_PRIVATE_KEY` in `backend/.env`, and set the public Firebase web
configuration plus the Web Push VAPID public key in both frontend environment
files. Firebase Admin credentials must remain backend-only; do not commit them.
Set the frontend `firebase` settings (`apiKey`, `authDomain`, `projectId`,
`messagingSenderId`, `appId`) and `firebaseVapidKey` from the Firebase Web App
and Cloud Messaging settings. Registration forms offer an optional push-alert
opt-in, so pending Customers and Shops can receive Admin decisions; signed-in
users can enable additional devices from the notification bell. When the app is
open, it also checks persisted notifications every five seconds so approval and
decline updates still appear if Firebase Web Push is not configured. Click
“Enable browser alerts” in the notification panel and allow browser permission
to show desktop notifications while the app is open. Firebase settings and a
registered device token are required for alerts when the app is closed.

The Firebase service-account key and other secret-like values previously
shared in chat must be revoked/rotated before they are configured. Keep the
replacement service-account key only in ignored local environment files or a
deployment secrets manager.

The application has separate customer (`/customer`), shop (`/shop`), and
administrator (`/admin`) portals. Login routes each account by its backend
authorization state. Frontend guards direct Shops to the appropriate page,
while backend guards require verified payment and approval for Shop dashboard
access.
There is no public admin registration. Admin accounts must be provisioned by a
trusted operator in MongoDB with `accountType: "admin"`,
`accountStatus: "active"`, and a bcrypt password hash.

Customers can edit an open repair request only until any shop submits a
quotation. They can update the appliance, brand/model, problem description,
preferred date, service type, selected shops, and photos. Shops selected after
an edit receive an update notification. Existing photos remain unless the
customer replaces or removes them. Customers can view uploaded request photos
in the repair-request list; the API returns those images only with the
authenticated customer's own requests.

## Post-repair disputes and rework

After confirming receipt, a Customer can raise a dispute from the repair detail
page if the device still has an issue. The assigned Shop can accept it for
reinspection or reject it with a reason and explanation. Reinspection findings
and evidence are recorded on the dispute. If extra work is chargeable, the Shop
must request itemized charges and wait for the Customer's approval before
starting rework.

The Shop records rework progress, work performed, replaced parts, and testing
results before asking the Customer to verify the device. The Customer can
confirm resolution or report that the issue remains. Only after Customer
confirmation can the Shop close the dispute. Admins can review and message on
cases and add private investigation notes, but do not decide, resolve, or close
them. Notifications use the existing persisted notification, socket, and
configured push infrastructure. Dispute status and history are separate from
the original repair job and payment; rework does not modify either. Evidence
accepts JPEG, PNG, WebP, or PDF files up to 500 KB each, with at most two files
per submission.

On startup, legacy repair jobs still marked `disputed` are copied into the
dispute center as open cases, including their original issue description and
timestamp. The original repair-job records are retained. Cases whose assigned
shop cannot be identified are left untouched and logged for follow-up.

## API

The table highlights common endpoints; it is not an exhaustive route inventory.
Swagger at `/api/docs` is the authoritative reference for the currently
implemented API.

| Method   | Path                                           | Purpose                                                                   |
| -------- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| `POST`   | `/api/auth/register`                           | Legacy customer registration submitted for approval                       |
| `POST`   | `/api/auth/register/customer`                  | Submit a customer registration for approval                               |
| `POST`   | `/api/auth/register/shop`                      | Submit a shop registration for approval                                   |
| `POST`   | `/api/auth/register/shop/checkout`             | Retry payment for a pending shop account                                  |
| `GET`    | `/api/auth/registration-status`                | Get the authenticated Shop registration and approval state                |
| `GET`    | `/api/shops/my-profile`                        | Get the authenticated Shop's restricted profile                           |
| `GET`    | `/api/shops/dashboard`                         | Get Shop portal data (paid and approved Shops only)                       |
| `POST`   | `/api/payments/checkout`                       | Create or resume authenticated Shop Checkout                              |
| `GET`    | `/api/payments/status`                         | Get the authenticated Shop payment status                                 |
| `POST`   | `/api/payments/stripe/confirm`                 | Confirm a Checkout session with Stripe                                    |
| `POST`   | `/api/payments/stripe/webhook`                 | Receive signed Stripe payment events                                      |
| `POST`   | `/api/auth/login`                              | Verify credentials and set the HttpOnly access cookie                     |
| `POST`   | `/api/auth/logout`                             | Clear the access cookie                                                   |
| `GET`    | `/api/users/me`                                | Return the authenticated user's safe profile                              |
| `GET`    | `/api/notifications/my`                        | List the authenticated user's notifications                               |
| `POST`   | `/api/notifications/device-token`              | Register a push token for the authenticated user                          |
| `DELETE` | `/api/notifications/device-token`              | Remove a push token from the authenticated user                           |
| `PATCH`  | `/api/notifications/:id/read`                  | Mark the authenticated user's notification as read                        |
| `GET`    | `/api/admin/users`                             | Search and paginate Customer and Shop accounts (admin only)               |
| `PATCH`  | `/api/admin/registration-requests/:id/approve` | Approve a pending Customer or Shop registration (admin only)              |
| `PATCH`  | `/api/admin/registration-requests/:id/decline` | Decline a pending registration with a reason (admin only)                 |
| `PATCH`  | `/api/customer/repair-requests/:id`            | Update an open customer request before any shop submits a quotation       |
| `POST`   | `/api/customer/disputes/repair/:repairRequestId`| Raise a dispute after receiving a repaired device                           |
| `GET`    | `/api/customer/disputes`                       | List the authenticated customer's disputes                                 |
| `GET`    | `/api/shop/disputes`                            | List disputes for the authenticated Shop                                   |
| `GET`    | `/api/admin/disputes`                           | Review disputes (admin only)                                               |
| `PATCH`  | `/api/shop/disputes/:id/accept`                | Accept a dispute for reinspection                                          |
| `PATCH`  | `/api/shop/disputes/:id/reject`                | Reject a dispute with a reason                                             |
| `POST`   | `/api/shop/disputes/:id/reinspection`           | Record findings and evidence                                              |
| `POST`   | `/api/shop/disputes/:id/additional-charges`     | Request itemized charge approval                                           |
| `PATCH`  | `/api/customer/disputes/:id/additional-charges/:chargeId/decision` | Approve or decline additional charges                     |
| `PATCH`  | `/api/shop/disputes/:id/start-rework`           | Start approved rework                                                     |
| `PATCH`  | `/api/shop/disputes/:id/complete-rework`        | Record completed and tested rework                                         |
| `PATCH`  | `/api/customer/disputes/:id/confirm-resolution` | Confirm the issue is resolved                                              |
| `PATCH`  | `/api/customer/disputes/:id/report-unresolved`  | Report that the issue remains                                              |
| `PATCH`  | `/api/shop/disputes/:id/close`                  | Close after customer confirmation                                          |
| `GET`    | `/api/admin/shops/pending`                     | List pending shop applications (admin only)                               |
| `PATCH`  | `/api/admin/shops/:id/approve`                 | Legacy approval route; blocks shops without verified registration payment |
| `PATCH`  | `/api/admin/shops/:id/reject`                  | Reject a shop application (admin only)                                    |

Successful JSON responses use a `{ "data": ... }` envelope. Errors use
`statusCode`, `code`, and `message`, with optional `fieldErrors`. Passwords and
tokens are never returned.

The JWT is kept in an `HttpOnly`, `SameSite=Lax` cookie for exactly 24 hours.
`JWT_EXPIRES_IN` must be `86400` seconds; the cookie lifetime matches the
token. Production cookies are `Secure`. Logout clears the cookie and client
state but does not revoke a copied stateless token before it expires. Immediate
revocation would require adding server-side session/revocation storage.

## Tests and Validation

Backend, from `backend\`:

```powershell
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build
npm run lint
```

Frontend, from `frontend\`:

```powershell
npm test -- --watch=false
npm run build
```

Backend tests use a local-only test MongoDB URI configured by
`backend\test\setup-env.ts`; they do not use Atlas credentials.

## Project Workflow

- Constitution: `.specify/memory/constitution.md`
- Authentication foundation requirements: `specs/authentication-app/spec.md`
- Authentication foundation architecture: `specs/authentication-app/plan.md`
- Authentication foundation tasks and their recorded validation status:
  `specs/authentication-app/tasks.md`

The authentication documents describe the original auth foundation, not the
complete current product or a current whole-project completion report. The
constitution contains durable engineering rules. New feature scope must be
explicitly approved and documented at an appropriate level; update the
relevant specification and task status when a feature has a maintained
specification.
