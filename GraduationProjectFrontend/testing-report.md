# Frontend E2E Testing Report

## Objective

Add a complete Playwright E2E suite for the local Next.js frontend, verify the app against the local backend, and confirm that the React duplicate-key warning no longer appears.

## Environment

- OS/shell: Windows, PowerShell
- Frontend: `GraduationProjectFrontend`
- Backend: `GraduationProjectBackend`
- Frontend URL: `http://localhost:3000`
- Backend API URL: `http://localhost:4000/api/v1`
- Node: `v22.18.0`
- npm: `10.9.3`
- Playwright: `1.51.1`
- Browser project used for full suite: `chromium`
- Mobile project: `mobile-chromium` with Pixel 7 viewport

## Setup Changes

- Added Playwright config in `playwright.config.ts`.
- Added E2E npm scripts:
  - `npm run e2e`
  - `npm run e2e:chromium`
  - `npm run e2e:auth`
  - `npm run e2e:lifecycle`
  - `npm run e2e:report`
- Added `@playwright/test`.
- Added ignored generated artifacts:
  - `playwright-report/`
  - `test-results/`
  - `blob-report/`
  - `e2e/.auth/`

## Duplicate Key Warning

- Causing file: `app/page.tsx`
- Warning: `Encountered two children with the same key, Account-Open Dashboard`
- Exact reason: footer link keys were generated from `${group.title}-${link.label}`. In the `Account` footer group, both account links can display as `Open Dashboard` for an authenticated ready user, so both rendered children received the same key: `Account-Open Dashboard`.
- Fix applied: added stable `id` fields to footer link data and changed the mapped key to `${group.title}-${link.id}`.
- Verification: opened `/` under `npm run dev` with Playwright and filtered browser console messages for duplicate-key text. Result: `keyWarningCount=0`.

## E2E Test Files

- `e2e/auth.spec.ts`: login page, invalid login, UI login/logout, protected-route redirects, role landing dashboards.
- `e2e/dashboard.spec.ts`: role dashboards, profile/account areas, admin management areas.
- `e2e/navigation-smoke.spec.ts`: role-based route matrix for admin, doctor, TA, leader, and student.
- `e2e/role-access.spec.ts`: logged-out protection, student/admin/supervisor route boundaries.
- `e2e/teams.spec.ts`: student team area, leader team area, team list/detail, admin-only team access.
- `e2e/proposals.spec.ts`: proposal list, supervisor review states, new proposal validation, admin-only proposal paths.
- `e2e/tasks-sprints.spec.ts`: task board, sprints, time tracker.
- `e2e/calendar-meetings.spec.ts`: calendar and meetings.
- `e2e/chat.spec.ts`: chat, search/input behavior, discussions, admin discussion boundary.
- `e2e/announcements-github-risk.spec.ts`: announcements, risk management, GitHub workspace.
- `e2e/graduation-lifecycle.spec.ts`: full local lifecycle using `abdelrahman.naser958@gmail.com` as a verified student leader, including team creation, doctor/TA assignment, proposal approval, manual task completion, SDLC submissions, defense meetings, final grading, and advancement to maintenance.
- `e2e/responsive.spec.ts`: mobile login, dashboard navigation, mobile team page.

## Command Results

- Backend `npm install`: passed; npm reported 1 high severity audit item.
- Backend `npm test`: passed; 257 passed, 15 skipped, 0 failed.
- Frontend `npm install`: passed; npm reported 7 audit items.
- Frontend `npm run lint`: passed.
- Frontend `npm run type-check`: passed.
- Frontend `npm run build`: passed; Next.js 16.2.6 generated 59 static pages.
- Frontend `npm run dev`: passed; dev server ready on `http://localhost:3000`, `GET /` returned 200.
- Focused `npx playwright test e2e/graduation-lifecycle.spec.ts --project=chromium`: passed; 1 passed.
- Focused `npx playwright test e2e/auth.spec.ts --project=chromium`: passed; 13 passed.
- Focused `npx playwright test e2e/teams.spec.ts --project=chromium`: passed; 4 passed.
- Focused `npx playwright test e2e/navigation-smoke.spec.ts --project=chromium`: passed; 96 passed.
- Full `npx playwright test --project=chromium`: passed; 141 passed.
- Mobile `npx playwright test --project=mobile-chromium`: passed; 3 passed.

## Bugs Found And Fixed

- Fixed duplicate React footer key on the landing page by replacing mutable display-label keys with stable link ids.
- Fixed E2E selector ambiguity where labels/buttons with the same text caused strict-mode failures.
- Fixed route-access assertions to handle login redirects and access-denied states reliably.
- Split navigation smoke coverage into one test per role/route so failures are isolated and the full route matrix can complete.

## Notes

- The local `next dev` server became memory-heavy under the full route matrix and dropped port `3000` during an earlier run. The final full Chromium and mobile E2E runs were executed against `next start` from the production build for stability. Afterward, `npm run dev` was started again and `/` was verified with `GET / 200`.
- `npx playwright install chromium` timed out against the CDN in this environment, but a compatible local browser was available and all Playwright runs completed successfully.
- Generated Playwright reports and artifacts are ignored by git.

## Readiness

The frontend is ready for manual review. Static checks, production build, backend tests, full Chromium E2E, mobile E2E, and duplicate-key warning verification all passed.
