# Fixora Playwright QA Plan

## Phase 1: Application map

### Roles and access

- **Customer:** profile, shop discovery, repair request and quotation workflow, repair tracking, dispute workflow, notifications, and chat. New customer registrations are pending Admin approval; portal operations are guarded until approval.
- **Shop:** registration and payment, restricted profile/payment pages, and (after payment and Admin approval) repair requests, quotations, repair workflow, disputes, reviews, chat, and notifications.
- **Admin:** overview, user search/details/status, registration approval/decline, repair monitoring/reviews, disputes, profile, and notifications. Admin accounts are provisioned; public Admin registration is not exposed.

### Frontend routes and feature areas

- Authentication: `/auth/login`, `/auth/register`, `/auth/register/customer`, `/auth/register/shop`, shop payment success/cancel routes.
- Customer: `/customer` dashboard; `/customer/profile`; `/customer/shops` and `/customer/shops/:id`; repair requests (active, completed, detail); quotations; disputes (list, detail, new); messages.
- Shop: `/shop` dashboard; profile/payment; repair requests (active, completed, detail); quotations; disputes (list/detail); messages; reviews.
- Admin: `/admin` overview; profile; users/list/detail; repair jobs/list/detail; disputes/list/detail.
- Shared UI: customer/shop/admin layouts, notification center, chat center, dispute center, profile/shop editors, maps, pagination, filtering, image/file uploads, and confirmation dialogs.

### Backend/API areas and integrations

- Authentication/profile: registration, address suggestions, login/logout, registration status, profile/password/image updates, shop profile/business details/image.
- Customer/shop operations: shop search/details, repair request create/edit/cancel/list/detail, quotations, repair inspection/approval/charges/progress/completion, dashboard/reviews.
- Admin operations: overview, users/statistics/activity/status, registration request decisions, pending shops, repair jobs/reviews.
- Notifications: list, read/read-all, device token registration/removal; WebSocket updates and optional Firebase Web Push.
- Chat: eligible users, conversations, message history/search/around, send/edit/delete, attachment upload/download, read/archive; Socket.IO gateway.
- Disputes: customer/shop/admin views, evidence, responses/messages/internal notes, resolution proposals/decisions, reinspection, additional charges, rework progress/completion, customer verification, and closure.
- Payments: Stripe Checkout, payment confirmation/status, and signed webhook processing for shop subscriptions.
- Infrastructure: NestJS REST API, Swagger, MongoDB/Mongoose, JWT HttpOnly cookie, CORS/origin checks, Angular frontend, Maps/Photon geocoding, Stripe, Firebase, Socket.IO.

### Data model and business dependencies

- MongoDB collections include users (embedded shop details and coordinates), registration requests, repair requests (shop responses, estimates, inspection, charges, job events, photos and verification), repair disputes (messages, status history, evidence, rework and resolution), notifications, chat conversations/messages/attachments, subscription invoices, and Admin audit logs.
- A Customer or Shop registration creates a pending user and a registration request. Shop access also depends on verified subscription payment; Admin approval is separately required.
- Customer repair requests can be edited only before a Shop quotation exists. Shops respond with quotations; Customer decisions and subsequent repair states drive the repair lifecycle.
- A dispute follows the post-repair issue path and is distinct from the underlying repair/payment record. Shop rework and Customer confirmation precede closure; Admin may investigate and message but does not resolve the case.
- Data-changing journeys were run against this only Fixora environment after the user authorized them. Test-created records use the `QA-E2E-` prefix; existing Customer and Shop profiles were not edited or deleted. The configured backend URI resolves to MongoDB Atlas, and startup performs a legacy dispute migration.
- Exact endpoint/method inventory: [API-INVENTORY.md](./API-INVENTORY.md), generated from all NestJS controller decorators. The inventory contains 127 route-handler declarations and is not a claim that each has been executed.

## Phased test plan

1. **Map and setup:** verify runtime/dependencies, review guards and service endpoints, identify safe isolated DB and test accounts, configure Chromium and local URLs, launch, confirm health and route accessibility.
2. **Read-only exploration:** visit public/auth routes and role-gated routes without submitting forms; inspect responsive layouts, console/network errors, API calls, screenshots, and page-level accessibility.
3. **Authentication and registration:** required/invalid/duplicate inputs, pending approval behavior, login/logout, guarded routes, profile/password/image flows. Use only approved test accounts/data.
4. **Customer journeys:** shop discovery/search/filter/detail/map; repair request create/edit/cancel/history; quotations and approval; inspection and charges; progress, pickup/verification, notifications and messages.
5. **Shop journeys:** registration/profile/payment state; request response/quotation; inspection/report/charges; repair progress/completion; disputes/rework; reviews, notifications and chat.
6. **Admin journeys:** login/authorization; overview, search/filter/pagination/details; approve/decline and lifecycle status; repair monitoring/review; dispute investigation and audit behavior.
7. **Cross-role synchronization:** verify each approved Customer → Shop → Customer → Admin state transition against UI and API/database-backed reads using isolated test records.
8. **Negative, UI, API, performance/security checks:** validation, authorization, invalid transitions/files, network/server handling, viewport coverage, broken assets, console errors, request timing and exposure checks. Avoid destructive actions and load/security stress against production.
9. **Fix and regression:** fix only reproducible defects in scope, rerun failed cases plus affected flows, collect trace/screenshots, generate HTML Playwright report and final evidence-based QA report.

## Execution status and gating

- Runtime commands in project: root `npm start` runs backend `start:dev` plus frontend `start`; standalone commands are `npm --prefix backend run start:dev` and `npm --prefix frontend start`.
- Root package declares `@playwright/test` 1.65.0 and `npm run test:e2e`. `playwright.config.ts` preserves the existing project, reporters and server setup, sets `headless: false`, and explicitly selects Playwright's regular `chrome.exe` executable.
- Node.js v20.19.1, npm 10.8.2 and Playwright 1.65.0 were verified. The Angular frontend is serving on `localhost:4200`.
- The local frontend and API returned HTTP 200 for the login route, `/api/health`, and `/api/docs-json`. The backend URI uses Atlas; the user confirmed this is the only Fixora environment and authorized QA changes. Playwright created only records tagged `QA-E2E-`; existing Customer and Shop profiles were not edited or deleted.
- Latest headed Chromium run passed 14/14 Playwright tests, including all five role logins, 32 role-route checks, and a Customer → Shop → Customer → Admin repair journey through inspection approval, plus Customer cancellation and Shop visibility synchronization. See [QA report](./QA-REPORT.md) for the remaining scope and findings.
- Shop repair detail emitted two directions API requests during its initial load; both returned 502. A regression assertion verified quotation reload does not add another directions request. The provider/configuration cause and the two initial requests still need investigation.
- Approved role credentials were supplied and used through transient environment variables; they are not embedded in this plan or test source. One repair workflow was tested with tagged data across Customer, Shop and Admin through inspection approval.
- Customer cancellation was implemented and exercised end-to-end with a separate QA-tagged request. The request changed to Cancelled for the Customer and disappeared from the Shop's active request list.
