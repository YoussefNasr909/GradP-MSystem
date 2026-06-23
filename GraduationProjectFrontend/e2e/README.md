# GPMS E2E + API QA Suite

Run Playwright commands from `GraduationProjectFrontend`. Run the required validation order from the repository root.

## Required Validation Order

```bash
cd GraduationProjectBackend && npm test
cd GraduationProjectFrontend && npm run lint
cd GraduationProjectFrontend && npm run type-check
cd GraduationProjectFrontend && npm run test:unit
cd GraduationProjectFrontend && npm run build
cd GraduationProjectFrontend && npx playwright test e2e/auth.spec.ts --project=chromium
cd GraduationProjectFrontend && npx playwright test e2e/teams.spec.ts --project=chromium
cd GraduationProjectFrontend && npm run test:a11y
cd GraduationProjectFrontend && npx playwright test
```

Run the frontend maximum-QA gate without the full E2E suite:

```bash
npm run test:qa
```

`test:qa` runs lint, type-check, frontend unit tests, production build, and accessibility smoke tests.

## Unit And Component Tests

Run focused frontend unit/component tests:

```bash
npm run test:unit
```

Run unit/component tests in watch mode:

```bash
npm run test:unit:watch
```

Current unit coverage focuses on:

- profile-completion gating logic
- team display/role/stage formatting helpers
- fallback-state component behavior for link, back, and retry actions

These tests use Vitest, Testing Library, Jest DOM matchers, and jsdom. API-dependent component tests should mock requests with MSW instead of requiring the backend.

## Playwright Commands

Run the full suite:

```bash
npx playwright test
```

Run one spec:

```bash
npx playwright test e2e/teams.spec.ts --project=chromium
```

Run the full graduation lifecycle journey ported from the Abdoninho branch:

```bash
npm run test:e2e:local -- e2e/graduation-lifecycle.spec.ts --project=chromium --reporter=line
```

Run one browser project:

```bash
npx playwright test --project=chromium
```

On this Windows local machine, if the raw Playwright `webServer` cleanup hangs after tests finish, run the same command through the local no-webserver runner. It starts/stops backend and frontend explicitly:

```bash
npm run test:e2e:local -- e2e/auth.spec.ts --project=chromium --reporter=line
npm run test:e2e:local -- --project=chromium --reporter=line
```

Run all desktop browser projects explicitly:

```bash
$env:E2E_ALL_BROWSERS="true"; npx playwright test
```

Run in headed mode:

```bash
npx playwright test e2e/auth.spec.ts --project=chromium --headed
```

Debug mode:

```bash
npx playwright test --debug
```

Open the HTML report:

```bash
npx playwright show-report
```

Run accessibility smoke checks:

```bash
npm run test:a11y
```

Run performance smoke checks:

```bash
npx playwright test e2e/performance-smoke.spec.ts --project=chromium
```

## Reports And Artifacts

- Playwright HTML report is enabled in `playwright.config.ts`.
- Trace, screenshots, and videos are retained on failure.
- Retries run only in CI. Local runs use zero retries for easier debugging.
- The default stateful E2E/API suite runs on Chromium to avoid cross-browser collisions against one database.
- Set `E2E_ALL_BROWSERS=true` to include Firefox and WebKit desktop projects.
- Desktop projects ignore `responsive.spec.ts`.
- Mobile Chrome and Mobile Safari run only `responsive.spec.ts`.
- `accessibility.spec.ts` uses axe and fails only on serious/critical WCAG violations.
- `performance-smoke.spec.ts` is a usability budget check, not a load/stress test.

## Backend/API URLs

- Browser UI tests use the frontend normally.
- Playwright API helpers call `http://127.0.0.1:4000/api/v1` directly by default.
- Backend health check: `http://127.0.0.1:4000/health`.
- API ping: `http://127.0.0.1:4000/api/v1/ping`.

## Database Safety

Run backend `npm run e2e:prepare` only against a test/e2e database. The script aborts unless `DATABASE_URL` looks test-safe, or `E2E_ALLOW_DB_RESET=true` is paired with `E2E_CONFIRM_DB_RESET=<databaseName>`.

Do not run database reset while another backend process is connected to the same database.

## Manual UAT Checklist For Discussion Day

- Log in as Admin, Doctor, TA, Leader, Member, and Student(no team).
- Confirm the landing page, login page, and register page look correct on desktop and mobile.
- Create or open a team, invite/join a member, and verify member visibility.
- Submit or open a proposal and verify Doctor review status is visible to the team.
- Submit or open a deliverable and verify reviewer feedback/grading state.
- Open admin logs/reports/PDF pages and verify non-admin users are blocked.
- Check notifications, support, GitHub/version-control, and supervisor-toolkit pages do not crash.
- Confirm final demo data is clean and no test-only users or draft records are visible in the defense demo account.
