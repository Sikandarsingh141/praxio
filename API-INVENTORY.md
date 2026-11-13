# Fixora Backend API Inventory

Generated from NestJS controller decorators in `backend/src` on 2026-11-13. The global prefix is `/api`. There are 127 route-handler declarations; identical URL patterns with different verbs or role-specific controllers are listed separately. This is a source inventory, not evidence that each endpoint has been exercised.

| Method | Route | Controller |
|---|---|---|
| GET | `/api/admin/dashboard/overview` | `admin.controller.ts` |
| GET | `/api/admin/disputes` | `disputes.controller.ts` |
| GET | `/api/admin/disputes/:id` | `disputes.controller.ts` |
| GET | `/api/admin/disputes/:id/attachments/:fileId` | `disputes.controller.ts` |
| PATCH | `/api/admin/disputes/:id/close` | `disputes.controller.ts` |
| POST | `/api/admin/disputes/:id/internal-notes` | `disputes.controller.ts` |
| POST | `/api/admin/disputes/:id/messages` | `disputes.controller.ts` |
| POST | `/api/admin/disputes/:id/resolution` | `disputes.controller.ts` |
| PATCH | `/api/admin/disputes/:id/resolve` | `disputes.controller.ts` |
| PATCH | `/api/admin/disputes/:id/status` | `disputes.controller.ts` |
| PATCH | `/api/admin/registration-requests/:id/approve` | `admin.controller.ts` |
| PATCH | `/api/admin/registration-requests/:id/decline` | `admin.controller.ts` |
| GET | `/api/admin/repair-jobs` | `admin.controller.ts` |
| GET | `/api/admin/repair-reviews` | `admin.controller.ts` |
| PATCH | `/api/admin/shops/:id/approve` | `admin.controller.ts` |
| PATCH | `/api/admin/shops/:id/reject` | `admin.controller.ts` |
| GET | `/api/admin/shops/pending` | `admin.controller.ts` |
| GET | `/api/admin/users` | `admin.controller.ts` |
| GET | `/api/admin/users/:id` | `admin.controller.ts` |
| GET | `/api/admin/users/:id/activity` | `admin.controller.ts` |
| PATCH | `/api/admin/users/:id/status` | `admin.controller.ts` |
| GET | `/api/admin/users/statistics` | `admin.controller.ts` |
| GET | `/api/auth/addresses` | `auth.controller.ts` |
| POST | `/api/auth/login` | `auth.controller.ts` |
| POST | `/api/auth/logout` | `auth.controller.ts` |
| POST | `/api/auth/register` | `auth.controller.ts` |
| POST | `/api/auth/register/customer` | `auth.controller.ts` |
| POST | `/api/auth/register/shop` | `auth.controller.ts` |
| POST | `/api/auth/register/shop/checkout` | `auth.controller.ts` |
| GET | `/api/auth/registration-status` | `auth.controller.ts` |
| GET | `/api/chat/conversations` | `chat.controller.ts` |
| POST | `/api/chat/conversations` | `chat.controller.ts` |
| GET | `/api/chat/conversations/:id` | `chat.controller.ts` |
| PATCH | `/api/chat/conversations/:id/archive` | `chat.controller.ts` |
| POST | `/api/chat/conversations/:id/attachments` | `chat.controller.ts` |
| GET | `/api/chat/conversations/:id/attachments/:fileId/download` | `chat.controller.ts` |
| GET | `/api/chat/conversations/:id/messages` | `chat.controller.ts` |
| POST | `/api/chat/conversations/:id/messages` | `chat.controller.ts` |
| GET | `/api/chat/conversations/:id/messages/around/:messageId` | `chat.controller.ts` |
| PATCH | `/api/chat/conversations/:id/read` | `chat.controller.ts` |
| GET | `/api/chat/conversations/:id/search` | `chat.controller.ts` |
| GET | `/api/chat/eligible` | `chat.controller.ts` |
| DELETE | `/api/chat/messages/:id` | `chat.controller.ts` |
| PATCH | `/api/chat/messages/:id` | `chat.controller.ts` |
| GET | `/api/chat/unread-count` | `chat.controller.ts` |
| GET | `/api/customer/addresses` | `customer-portal.controller.ts` |
| GET | `/api/customer/disputes` | `disputes.controller.ts` |
| GET | `/api/customer/disputes/:id` | `disputes.controller.ts` |
| PATCH | `/api/customer/disputes/:id/additional-charges/:chargeId/decision` | `disputes.controller.ts` |
| GET | `/api/customer/disputes/:id/attachments/:fileId` | `disputes.controller.ts` |
| PATCH | `/api/customer/disputes/:id/confirm-resolution` | `disputes.controller.ts` |
| POST | `/api/customer/disputes/:id/messages` | `disputes.controller.ts` |
| PATCH | `/api/customer/disputes/:id/report-unresolved` | `disputes.controller.ts` |
| POST | `/api/customer/disputes/:id/resolution` | `disputes.controller.ts` |
| PATCH | `/api/customer/disputes/:id/resolution/decision` | `disputes.controller.ts` |
| PATCH | `/api/customer/disputes/:id/resolve` | `disputes.controller.ts` |
| POST | `/api/customer/disputes/repair/:repairRequestId` | `disputes.controller.ts` |
| GET | `/api/customer/quotations` | `customer-portal.controller.ts` |
| PATCH | `/api/customer/quotations/:id/status` | `customer-portal.controller.ts` |
| GET | `/api/customer/repair-requests` | `customer-portal.controller.ts` |
| POST | `/api/customer/repair-requests` | `customer-portal.controller.ts` |
| GET | `/api/customer/repair-requests/:id` | `customer-portal.controller.ts` |
| PATCH | `/api/customer/repair-requests/:id` | `customer-portal.controller.ts` |
| PATCH | `/api/customer/repair-requests/:id/cancel` | `customer-portal.controller.ts` |
| PATCH | `/api/customer/repair-requests/:id/additional-charges/:chargeId/accept` | `repair-workflow.controller.ts` |
| PATCH | `/api/customer/repair-requests/:id/additional-charges/:chargeId/decline` | `repair-workflow.controller.ts` |
| PATCH | `/api/customer/repair-requests/:id/confirm-pickup` | `customer-portal.controller.ts` |
| PATCH | `/api/customer/repair-requests/:id/inspection/approve` | `repair-workflow.controller.ts` |
| PATCH | `/api/customer/repair-requests/:id/inspection/decline` | `repair-workflow.controller.ts` |
| POST | `/api/customer/repair-requests/:id/report-issue` | `customer-portal.controller.ts` |
| POST | `/api/customer/repair-requests/:id/reviews` | `customer-portal.controller.ts` |
| GET | `/api/customer/shop-requests` | `customer-portal.controller.ts` |
| POST | `/api/customer/shop-requests/:id/quotation` | `customer-portal.controller.ts` |
| GET | `/api/customer/shops` | `customer-portal.controller.ts` |
| GET | `/api/customer/shops/:id` | `customer-portal.controller.ts` |
| GET | `/api/health` | `app.controller.ts` |
| PATCH | `/api/notifications/:id/read` | `notifications.controller.ts` |
| DELETE | `/api/notifications/device-token` | `notifications.controller.ts` |
| POST | `/api/notifications/device-token` | `notifications.controller.ts` |
| GET | `/api/notifications/my` | `notifications.controller.ts` |
| PATCH | `/api/notifications/read-all` | `notifications.controller.ts` |
| POST | `/api/payments/checkout` | `stripe-payments.controller.ts` |
| GET | `/api/payments/invoices` | `stripe-payments.controller.ts` |
| GET | `/api/payments/status` | `stripe-payments.controller.ts` |
| POST | `/api/payments/stripe/confirm` | `stripe-payments.controller.ts` |
| POST | `/api/payments/stripe/webhook` | `stripe-payments.controller.ts` |
| GET | `/api/shop/dashboard/overview` | `shop-dashboard.controller.ts` |
| GET | `/api/shop/disputes` | `disputes.controller.ts` |
| GET | `/api/shop/disputes/:id` | `disputes.controller.ts` |
| PATCH | `/api/shop/disputes/:id/accept` | `disputes.controller.ts` |
| POST | `/api/shop/disputes/:id/additional-charges` | `disputes.controller.ts` |
| GET | `/api/shop/disputes/:id/attachments/:fileId` | `disputes.controller.ts` |
| PATCH | `/api/shop/disputes/:id/close` | `disputes.controller.ts` |
| PATCH | `/api/shop/disputes/:id/complete-rework` | `disputes.controller.ts` |
| POST | `/api/shop/disputes/:id/messages` | `disputes.controller.ts` |
| POST | `/api/shop/disputes/:id/progress` | `disputes.controller.ts` |
| POST | `/api/shop/disputes/:id/reinspection` | `disputes.controller.ts` |
| PATCH | `/api/shop/disputes/:id/reinspection/start` | `disputes.controller.ts` |
| PATCH | `/api/shop/disputes/:id/reject` | `disputes.controller.ts` |
| POST | `/api/shop/disputes/:id/resolution` | `disputes.controller.ts` |
| PATCH | `/api/shop/disputes/:id/resolution/decision` | `disputes.controller.ts` |
| PATCH | `/api/shop/disputes/:id/resolve` | `disputes.controller.ts` |
| POST | `/api/shop/disputes/:id/response` | `disputes.controller.ts` |
| PATCH | `/api/shop/disputes/:id/start-rework` | `disputes.controller.ts` |
| GET | `/api/shop/quotations` | `shop-quotations.controller.ts` |
| GET | `/api/shop/quotations/reviews` | `shop-quotations.controller.ts` |
| GET | `/api/shop/repair-requests` | `shop-repair-requests.controller.ts` |
| GET | `/api/shop/repair-requests/:id` | `shop-repair-requests.controller.ts` |
| POST | `/api/shop/repair-requests/:id/additional-charges` | `repair-workflow.controller.ts` |
| PATCH | `/api/shop/repair-requests/:id/complete-repair` | `shop-repair-requests.controller.ts` |
| POST | `/api/shop/repair-requests/:id/decline` | `shop-repair-requests.controller.ts` |
| GET | `/api/shop/repair-requests/:id/directions` | `shop-repair-requests.controller.ts` |
| PATCH | `/api/shop/repair-requests/:id/hold-repair` | `shop-repair-requests.controller.ts` |
| POST | `/api/shop/repair-requests/:id/inspection-report` | `repair-workflow.controller.ts` |
| POST | `/api/shop/repair-requests/:id/quotation` | `shop-repair-requests.controller.ts` |
| PATCH | `/api/shop/repair-requests/:id/ready-for-pickup` | `shop-repair-requests.controller.ts` |
| POST | `/api/shop/repair-requests/:id/start-inspection` | `repair-workflow.controller.ts` |
| PATCH | `/api/shop/repair-requests/:id/start-repair` | `shop-repair-requests.controller.ts` |
| POST | `/api/shop/repair-requests/:id/start-repair` | `repair-workflow.controller.ts` |
| GET | `/api/shops/dashboard` | `shop-profile.controller.ts` |
| GET | `/api/shops/my-profile` | `shop-profile.controller.ts` |
| PATCH | `/api/shops/my-profile/business-details` | `shop-profile.controller.ts` |
| POST | `/api/shops/my-profile-image` | `shop-profile.controller.ts` |
| GET | `/api/users/me` | `profile.controller.ts` |
| PATCH | `/api/users/me/password` | `profile.controller.ts` |
| PATCH | `/api/users/me/profile` | `profile.controller.ts` |
| POST | `/api/users/me/profile-image` | `profile.controller.ts` |

## Integrations and persistence

- MongoDB/Mongoose stores users, registration requests, repair requests/quotations, disputes, notifications, chat conversations/messages/attachments, subscription invoices, and Admin audit logs.
- JWT authentication is carried in an HttpOnly cookie; role and Shop payment/approval guards gate portal APIs.
- Stripe handles Shop subscription checkout/status/confirmation and the signed webhook.
- Socket.IO supports chat/notification events; Firebase Admin/Web Push is optional.
- Shop lookup can use the Photon geocoder; Google Maps settings are optional.

