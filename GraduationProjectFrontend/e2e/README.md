# GPMS E2E + API QA Suite

Run Playwright commands from `GraduationProjectFrontend`. Run the required validation order from the repository root.

## Required Validation Order

```bash
cd GraduationProjectBackend && npm test
cd GraduationProjectFrontend && npm run lint
cd GraduationProjectFrontend && npm run type-check
cd GraduationProjectFrontend && npx playwright test e2e/auth.spec.ts --project=chromium
cd GraduationProjectFrontend && npx playwright test e2e/teams.spec.ts --project=chromium
cd GraduationProjectFrontend && npx playwright test
```

## Playwright Commands

Run the full suite:

```bash
npx playwright test
```

Run one spec:

```bash
npx playwright test e2e/teams.spec.ts --project=chromium
```

Run one browser project:

```bash
npx playwright test --project=chromium
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

## Reports And Artifacts

- Playwright HTML report is enabled in `playwright.config.ts`.
- Trace, screenshots, and videos are retained on failure.
- Retries run only in CI. Local runs use zero retries for easier debugging.
- The default stateful E2E/API suite runs on Chromium to avoid cross-browser collisions against one database.
- Set `E2E_ALL_BROWSERS=true` to include Firefox and WebKit desktop projects.
- Desktop projects ignore `responsive.spec.ts`.
- Mobile Chrome and Mobile Safari run only `responsive.spec.ts`.

## Backend/API URLs

- Browser UI tests use the frontend normally.
- Playwright API helpers call `http://127.0.0.1:4000/api/v1` directly by default.
- Backend health check: `http://127.0.0.1:4000/health`.
- API ping: `http://127.0.0.1:4000/api/v1/ping`.

## Database Safety

Run backend `npm run e2e:prepare` only against a test/e2e database. The script aborts unless `DATABASE_URL` looks test-safe, or `E2E_ALLOW_DB_RESET=true` is paired with `E2E_CONFIRM_DB_RESET=<databaseName>`.

Do not run database reset while another backend process is connected to the same database.
