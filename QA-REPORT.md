# Fixora QA Report

**Run date:** 2026-11-13  
**QA status:** Partial coverage; latest regression suites passed, but substantial feature areas remain untested.  
**Browser:** Playwright 1.65.0 with headed regular Chromium (`chrome.exe`).  
**Frontend/API:** `http://localhost:4200` / `http://localhost:3000`.

## Test totals

- **Feature areas mapped:** 11 (authentication/registration, Customer, Shop, Admin, repair lifecycle, disputes/rework, chat, notifications, payments, maps/geocoding, data/auth infrastructure).
- **Backend route handlers inventoried:** 127 NestJS controller declarations. This is the endpoint inventory, not a claim that all 127 were called.
- **Playwright cases:** 14 passed, 0 failed in the latest full headed-Chromium run.
- **Frontend unit cases:** 166 passed, 0 failed.
- **Backend unit cases:** 203 passed, 0 failed across 21 suites.
- **Combined automated cases across those suites:** 383 passed, 0 failed.
- **Blocked cases:** 0 in the latest run. Broad feature coverage is still pending; untested items below are not counted as blocked or passed.
- **Role access:** all five supplied accounts logged in; 32 role-specific page navigations passed. Nine unauthenticated role URLs redirected to login.

## Executed end-to-end coverage

The main cross-role journey ran in Chromium against the live local frontend/API: Customer found a Shop, created a QA-tagged repair request, the Shop submitted a quotation and inspection report, the Customer accepted the quotation and inspection estimate, and Admin search displayed the resulting repair record. A second QA-tagged request was cancelled by the Customer; the UI showed **Cancelled**, the API returned HTTP 200, and the request disappeared from the Shop's active request list.

Additional browser cases covered empty and malformed login inputs, empty Customer registration validation without submitting it, registration entry screens, unauthenticated route protection, all five authenticated role portals, narrow mobile login layout, tablet Customer registration layout, and visible Chromium startup/navigation. Browser response and console errors were observed for the exercised journeys.

## Results and evidence

| Area | Result | Evidence |
|---|---|---|
| Node.js, npm, Playwright | Available; versions verified earlier in setup | Playwright configuration and successful suites |
| Frontend/backend startup | Frontend already used port 4200; NestJS started successfully in watch mode | Backend log showed successful startup and MongoDB module initialization |
| API health | Passed, HTTP 200 `{"status":"ok"}` | Read-only `GET /api/health` |
| Swagger/OpenAPI document | Passed, HTTP 200 | Read-only `GET /api/docs-json`; source route inventory has 127 declarations |
| Login, malformed/empty inputs | Passed for tested cases | Playwright HTML report |
| Authenticated role page access | Passed for 5/5 accounts and 32 page navigations | Playwright HTML report |
| Route guards | Passed for 9 unauthenticated role URLs | Playwright HTML report |
| Customer → Shop → Customer → Admin repair workflow | Passed through inspection approval | [Customer accepted](</C:/Sikandar Singh/Project/adlc-project/artifacts/QA-E2E-20261113085658-customer-accepted.png>), [Shop quotation](</C:/Sikandar Singh/Project/adlc-project/artifacts/QA-E2E-20261113085658-shop-quotation.png>), [Admin record](</C:/Sikandar Singh/Project/adlc-project/artifacts/QA-E2E-20261113085658-admin-visible.png>) |
| Customer cancellation | Passed; Customer and Shop views synchronized | [Cancelled request evidence](</C:/Sikandar Singh/Project/adlc-project/artifacts/QA-E2E-20261113085658-CANCEL-customer-cancelled.png>) |
| Mobile/tablet layout | Passed for the tested login and registration pages at 390px and 768px | [Mobile login](</C:/Sikandar Singh/Project/adlc-project/artifacts/phase2-login-mobile.png>), [tablet registration](</C:/Sikandar Singh/Project/adlc-project/artifacts/phase2-register-tablet.png>) |
| Shop driving directions integration | Failed integration; fallback UI rendered | [Directions error visible in Shop repair detail](</C:/Sikandar Singh/Project/adlc-project/artifacts/QA-E2E-20261113085658-directions-error.png>) |
| Backend unit tests | Passed, 203 tests / 21 suites | Jest run |
| Frontend unit tests | Passed, 166 tests | Angular/Karma run |
| Full E2E report | 14/14 passed on latest run | [Playwright HTML report](</C:/Sikandar Singh/Project/adlc-project/playwright-report/index.html>) |

## Findings and fixes

### Medium — directions provider returns HTTP 502 (pending)

The Shop repair detail page received HTTP 502 from the driving-directions endpoint. Chromium showed the route error and the Google Maps directions fallback. The provider/API-key/network cause is not established. A component input comparison and request-key guard were added to avoid another directions request on equivalent inputs; the lifecycle regression verifies quotation submission/reload adds no further request. The initial directions failure remains unresolved.

### Customer cancellation — feature added and verified

The Customer could not cancel an open request even though `cancelled` existed in request state handling. Added an authenticated cancellation endpoint, atomic open/unquoted transition, shop notifications, Customer confirmation UI, and a restriction against cancellation after a quotation/decision exists. The complete cancellation journey was executed against newly created QA data. A follow-up guard mismatch was also corrected so the UI hides cancellation after a rejected quotation, matching the backend.

### Other test maintenance

Corrected stale Shop dashboard unit-test expectations to match the current page. Added a unit test for cancellation eligibility. Frontend tests pass at 166/166 after these changes.

## Bug counts

- **Critical:** 0 confirmed.
- **High:** 0 confirmed.
- **Medium pending:** 1 (driving-directions integration HTTP 502; cause unknown).
- **Low pending:** 0 confirmed.
- **Fixed in this work:** missing Customer request cancellation and its UI/backend eligibility mismatch; redundant route reload behavior guard; stale Shop dashboard spec; cancellation eligibility unit coverage.

## Scope not yet exercised end-to-end

These mapped features are not declared passed: Customer/Shop registration submission and Admin approval, password reset (no in-app route was found), profile editing and file uploads, full Shop service/pricing/profile management, quotation rejection and other repair status transitions, completion/payment flows, Customer/Shop messaging, disputes and rework, reviews, notification read/device-token actions, Admin activation/deactivation and registration decisions, pagination/filter combinations, invalid upload and session-expiry cases, network/server failure injection, and broad responsive checks across every route. Some navigation entries are explicitly marked Coming Soon/disabled (Customer settings/addresses, Shop technicians, selected Admin settings/reviews). “Remember me” is rendered but was not verified through a persistent-session journey.

No destructive security or load tests were run. Security coverage was limited to login and unauthenticated route/API guard behavior exercised by this suite. The suite did not call every route in the 127-handler inventory or audit every database relationship.

## Data and environment note

The backend loaded a MongoDB Atlas connection from its configuration, and the user identified this as the only Fixora environment and authorized QA data changes. Test writes were limited to new `QA-E2E-` repair requests and associated quotation/inspection/cancellation workflow records; no existing Customer or Shop profile was edited or deleted. The QA records remain in the connected database under that prefix. Confirm the Atlas URI is the intended local-only database before any further mutation; the environment name alone cannot prove it is isolated from production.

## Artifacts

- [Phase 1 project map and phased plan](</C:/Sikandar Singh/Project/adlc-project/QA-E2E-TEST-PLAN.md>)
- [NestJS API inventory](</C:/Sikandar Singh/Project/adlc-project/API-INVENTORY.md>)
- [Playwright HTML report](</C:/Sikandar Singh/Project/adlc-project/playwright-report/index.html>)
- [Playwright configuration](</C:/Sikandar Singh/Project/adlc-project/playwright.config.ts>)
- [Role access test](</C:/Sikandar Singh/Project/adlc-project/e2e/role-readonly.spec.ts>)
- [Customer/Shop/Admin repair lifecycle test](</C:/Sikandar Singh/Project/adlc-project/e2e/repair-lifecycle.spec.ts>)
- [Safe exploration tests](</C:/Sikandar Singh/Project/adlc-project/e2e/safe-exploration.spec.ts>)
- [Visible Chromium test](</C:/Sikandar Singh/Project/adlc-project/e2e/visible-browser.spec.ts>)
- [Visible browser login screenshot](</C:/Sikandar Singh/Project/adlc-project/artifacts/visible-chromium-login.png>)
