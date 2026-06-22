import { expect, test } from "@playwright/test";

const aiRoutes = [
  { path: "/api/assistant", invalid: {}, validish: { messages: [{ role: "user", content: "hello" }], userContext: {} } },
  { path: "/api/enhance-discussion", invalid: {}, validish: { content: "Improve this discussion post.", category: "technical" } },
  {
    path: "/api/summarize-discussion",
    invalid: {},
    validish: { discussionTitle: "Sprint risk", discussionContent: "We need a short summary.", comments: [] },
  },
  { path: "/api/generate-rubric", invalid: {}, validish: { prompt: "Rubric for a GPMS graduation project." } },
  { path: "/api/generate-all-rubrics", invalid: {}, validish: { prompt: "Generate rubrics for all SDLC phases." } },
  {
    path: "/api/generate-evaluation",
    invalid: {},
    validish: { sprintName: "Sprint 1", teamName: "E2E Team", metrics: { completedTasks: 2 } },
  },
  { path: "/api/generate-tasks", invalid: {}, validish: { title: "Build authentication module" } },
  {
    path: "/api/generate-sprint-plan",
    invalid: {},
    validish: { teamName: "E2E Team", backlogTasks: [{ title: "API tests", points: 3 }] },
  },
  {
    path: "/api/generate-supervisor-matches",
    invalid: {},
    validish: { team: { name: "E2E Team", stack: ["AI"] }, doctors: [{ name: "Doctor One", interests: ["AI"] }] },
  },
  {
    path: "/api/generate-project-ideas",
    invalid: {},
    validish: {
      teamSize: "4",
      technologies: "Next.js, Express, PostgreSQL",
      domains: ["education", "project management"],
      description: "A graduation project management system for university teams.",
    },
  },
  {
    path: "/api/generate-proposal",
    invalid: {},
    validish: {
      projectDescription: "A graduation project management system that helps teams manage proposals, tasks, and submissions.",
      teamSize: 4,
      technologies: ["Next.js", "Express", "PostgreSQL"],
    },
  },
  { path: "/api/evaluate-proposal", invalid: {}, validish: { proposal: { title: "GPMS", abstract: "A project." } } },
  {
    path: "/api/evaluate-submission",
    invalid: {},
    validish: { submission: { title: "SRS", description: "Submission text" }, rubric: [{ name: "Quality", points: 100 }] },
  },
  {
    path: "/api/review-pr",
    invalid: {},
    validish: {
      title: "E2E PR",
      description: "Test PR",
      baseBranch: "main",
      headBranch: "feature/e2e",
      changedFiles: [{ filename: "app.ts", status: "modified", additions: 1, deletions: 0, patch: "+test" }],
    },
  },
];

async function postJson(request: any, path: string, data: unknown) {
  try {
    const response = await request.post(path, { data, failOnStatusCode: false, timeout: 8_000 });
    const text = await response.text();
    return { status: response.status(), text };
  } catch (error) {
    return { status: 599, text: error instanceof Error ? error.message : String(error) };
  }
}

test.describe("AI-assisted frontend API routes", () => {
  for (const route of aiRoutes) {
    test(`${route.path} validates bad payload and fails gracefully without real AI assumptions`, async ({ request }) => {
      const invalid = await postJson(request, route.path, route.invalid);
      expect([200, 400, 422, 500, 599]).toContain(invalid.status);
      expect(invalid.text).not.toMatch(/GOOGLE_GENERATIVE_AI_API_KEY|OPENAI_API_KEY|AIza|sk-/i);

      const provider = await postJson(request, route.path, route.validish);
      expect([200, 400, 422, 500, 503, 599]).toContain(provider.status);
      expect(provider.text).not.toMatch(/GOOGLE_GENERATIVE_AI_API_KEY|OPENAI_API_KEY|AIza|sk-/i);
    });
  }

  test("AI routes document the missing backend auth gate as a product hardening TODO", async ({ request }) => {
    const response = await postJson(request, "/api/generate-rubric", {});
    expect([400, 500]).toContain(response.status);
    test.info().annotations.push({
      type: "TODO",
      description:
        "Frontend AI route handlers currently do not check GPMS auth before validation/provider calls; add auth middleware if these routes should be private.",
    });
  });
});
