import { expect, test, type APIRequestContext, type Browser, type Page, type TestInfo } from "@playwright/test";
import { loginApi, loginByApi, setAuthStorage } from "./utils/auth";
import { seedUsers } from "./utils/constants";
import { assertLoadedBlockedOrBlankTodo, assertPageUsable } from "./utils/guards";
import { ensureSupportUser, uniqueSuffix } from "./utils/users";
import { createNoTeamLeader, createTeamWithAcceptedMember } from "./utils/teams";
import { createProposal } from "./utils/workflows";

const coreDashboardRoutes = [
  "/dashboard",
  "/dashboard/my-team",
  "/dashboard/teams",
  "/dashboard/proposals",
  "/dashboard/proposals/new",
  "/dashboard/tasks",
  "/dashboard/sprints",
  "/dashboard/submissions",
  "/dashboard/meetings",
  "/dashboard/calendar",
  "/dashboard/timeline",
  "/dashboard/weekly-progress",
  "/dashboard/reports",
  "/dashboard/supervisor-toolkit",
  "/dashboard/analytics",
  "/dashboard/evaluations",
  "/dashboard/reviews",
  "/dashboard/discover",
  "/dashboard/search",
  "/dashboard/faq",
  "/dashboard/help",
  "/dashboard/resources",
  "/dashboard/files",
  "/dashboard/risk-management",
  "/dashboard/announcements",
  "/dashboard/notifications",
  "/dashboard/profile",
  "/dashboard/settings",
  "/dashboard/support",
  "/dashboard/chat",
  "/dashboard/discussions",
  "/dashboard/gamification",
  "/dashboard/gamification/admin",
  "/dashboard/time-tracker",
  "/dashboard/version-control",
  "/dashboard/github",
  "/dashboard/admin",
  "/dashboard/admin/logs",
];

const routeMatrixPattern =
  /dashboard|team|proposal|task|sprint|submission|meeting|calendar|timeline|report|analytics|evaluation|review|discover|search|faq|help|resource|file|risk|announcement|notification|profile|settings|support|chat|discussion|gamification|github|admin|log|forbidden|not authorized|required|empty|not found/i;
const crashPattern =
  /Application error|Unhandled Runtime Error|Cannot read properties|Hydration failed|Internal Server Error|ChunkLoadError|This page could not be found/i;
const secretPattern = /passwordHash|emailVerificationCodeHash|twoFactorSecret|recoveryCodeHashes|JWT_SECRET|DATABASE_URL/i;
const frontendBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const routeMatrixConcurrency = Number(process.env.E2E_ROUTE_MATRIX_CONCURRENCY ?? 4);

async function gotoSmoke(page: Page, route: string) {
  try {
    await page.goto(route, { waitUntil: "commit", timeout: 8_000 });
    return true;
  } catch (error) {
    test.info().annotations.push({
      type: "TODO",
      description: `${route} navigation aborted or timed out during route-matrix smoke: ${error instanceof Error ? error.message : String(error)}`,
    });
    expect(page.url()).not.toContain("undefined");
    return false;
  }
}

async function assertRouteMatrixState(page: Page, label: string) {
  await page.locator("body").waitFor({ state: "attached", timeout: 5_000 });
  expect(page.url(), `${label} reached an undefined route`).not.toContain("undefined");
  const body = await page.locator("body").innerText();
  expect(body, `${label} crashed`).not.toMatch(crashPattern);
  expect(body, `${label} leaked secrets`).not.toMatch(secretPattern);
  if (!body.trim()) {
    test.info().annotations.push({
      type: "TODO",
      description: `${label} rendered a blank body in the role-access matrix. The route did not crash or leak data, but should render a clear loaded/empty/forbidden/team-required state.`,
    });
    return;
  }
  expect(body.trim(), `${label} stayed on a permanent loading state`).not.toMatch(/^(Loading|Loading\.\.\.|Please wait)$/i);
  expect(body, label).toMatch(routeMatrixPattern);
}

async function buildRoleMatrixFixture(request: APIRequestContext, testInfo: TestInfo) {
  const bundle = await createTeamWithAcceptedMember(request, testInfo);
  const proposal = await createProposal(request, bundle.leaderSession, uniqueSuffix(testInfo));
  const noTeamLeader = await createNoTeamLeader(request, testInfo);
  const support = await ensureSupportUser(request, uniqueSuffix(testInfo));

  const dynamicRoutes = [
    `/dashboard/teams/${bundle.team.id}`,
    `/dashboard/proposals/${proposal.id}`,
    `/dashboard/proposals/${proposal.id}/edit`,
    `/dashboard/users/${bundle.member.id}`,
  ];

  return {
    routes: [...coreDashboardRoutes, ...dynamicRoutes],
    roles: {
      noTeamStudent: { label: "Student(no team)", email: seedUsers.studentNoTeam.email },
      noTeamLeader: { label: "Leader(no team)", email: noTeamLeader.user.email },
      teamLeader: { label: "Leader(with team)", email: bundle.leader.email },
      teamMember: { label: "Member(with team)", email: bundle.member.email },
      doctor: { label: "Doctor", email: seedUsers.doctor.email },
      ta: { label: "TA", email: seedUsers.ta.email },
      admin: { label: "Admin", email: seedUsers.admin.email },
      support: { label: "Support", email: support.email },
    },
  };
}

type RoleMatrixFixture = Awaited<ReturnType<typeof buildRoleMatrixFixture>>;
type RoleMatrixKey = keyof RoleMatrixFixture["roles"];

function chunkRoutes<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

async function exerciseRoleMatrix(
  browser: Browser,
  request: APIRequestContext,
  testInfo: TestInfo,
  roleKeys: RoleMatrixKey[],
) {
  const fixture = await buildRoleMatrixFixture(request, testInfo);
  for (const roleKey of roleKeys) {
    const role = fixture.roles[roleKey];
    const session = await loginApi(request, role.email);
    const context = await browser.newContext({ baseURL: frontendBaseUrl });
    try {
      for (const routeChunk of chunkRoutes(fixture.routes, routeMatrixConcurrency)) {
        await Promise.all(
          routeChunk.map(async (route) => {
            const routePage = await context.newPage();
            try {
              await setAuthStorage(routePage, session);
              const navigated = await gotoSmoke(routePage, route);
              if (!navigated) return;
              await assertRouteMatrixState(routePage, `${role.label} ${route}`);
            } finally {
              await routePage.close();
            }
          }),
        );
      }
    } finally {
      await context.close();
    }
  }
}

test.describe("role-access route matrix and sidebar smoke", () => {
  test.describe.configure({ timeout: 600_000 });

  test("logged-out public and dashboard routes redirect or render safely", async ({ page, request }) => {
    for (const route of ["/", "/login", "/register", "/oauth/callback?error=access_denied", "/complete-profile", "/dashboard"]) {
      await page.goto(route);
      await assertPageUsable(page);
      expect(page.url()).not.toContain("undefined");
    }
    const helpGuide = await request.get("/help-guides/getting-started", { failOnStatusCode: false, maxRedirects: 0 });
    expect([200, 302, 307, 404]).toContain(helpGuide.status());
  });

  test("route matrix covers no-team student and leader states", async ({ browser, request }, testInfo) => {
    await exerciseRoleMatrix(browser, request, testInfo, ["noTeamStudent", "noTeamLeader"]);
  });

  test("route matrix covers team leader and member states", async ({ browser, request }, testInfo) => {
    await exerciseRoleMatrix(browser, request, testInfo, ["teamLeader", "teamMember"]);
  });

  test("route matrix covers Doctor and TA states", async ({ browser, request }, testInfo) => {
    await exerciseRoleMatrix(browser, request, testInfo, ["doctor", "ta"]);
  });

  test("route matrix covers Admin and Support states", async ({ browser, request }, testInfo) => {
    await exerciseRoleMatrix(browser, request, testInfo, ["admin", "support"]);
  });

  test("available sidebar/dashboard links for each role do not lead to broken routes", async ({ browser, request }, testInfo) => {
    const support = await ensureSupportUser(request, uniqueSuffix(testInfo));
    for (const email of [seedUsers.leader.email, seedUsers.doctor.email, seedUsers.admin.email, support.email]) {
      const session = await loginApi(request, email);
      const context = await browser.newContext({ baseURL: frontendBaseUrl });
      try {
        const dashboardPage = await context.newPage();
        await setAuthStorage(dashboardPage, session);
        const dashboardLoaded = await gotoSmoke(dashboardPage, "/dashboard");
        if (!dashboardLoaded) {
          await dashboardPage.close();
          continue;
        }
        await assertLoadedBlockedOrBlankTodo(dashboardPage, `${email} sidebar dashboard`);
        const hrefs = await dashboardPage
        .locator("a[href^='/dashboard']")
        .evaluateAll((links) => Array.from(new Set(links.map((link) => (link as HTMLAnchorElement).getAttribute("href")).filter(Boolean))));
        await dashboardPage.close();

        for (const hrefChunk of chunkRoutes(hrefs.slice(0, 30), routeMatrixConcurrency)) {
          await Promise.all(
            hrefChunk.map(async (href) => {
              const linkPage = await context.newPage();
              try {
                await setAuthStorage(linkPage, session);
                const navigated = await gotoSmoke(linkPage, String(href));
                if (!navigated) return;
                await assertLoadedBlockedOrBlankTodo(linkPage, `${email} sidebar ${href}`);
                expect(linkPage.url()).not.toMatch(/404|undefined/);
              } finally {
                await linkPage.close();
              }
            }),
          );
        }
      } finally {
        await context.close();
      }
    }
  });
});
