import { expect, test } from "@playwright/test";
import { apiRequest, expectApiOk, expectApiStatus } from "./utils/api";
import { seedUsers } from "./utils/constants";
import { loginApi, loginByApi } from "./utils/auth";
import { assertLoadedOrBlocked } from "./utils/guards";
import { createIsolatedTeam } from "./utils/teams";
import { createMeeting, createProposal } from "./utils/workflows";
import { uniqueSuffix } from "./utils/users";

test.describe("deliverables, grading, and defense gate", () => {
  async function approveTeamProposal(request: any, leaderSession: any, suffix: string) {
    const admin = await loginApi(request, seedUsers.admin.email);
    const proposal = await createProposal(request, leaderSession, suffix);
    await expectApiOk(request, `/proposals/${proposal.id}/submit`, { method: "POST", token: leaderSession.token });
    await expectApiOk(request, `/proposals/${proposal.id}/review`, {
      method: "PATCH",
      token: admin.token,
      data: { decision: "APPROVED" },
    });
  }

  async function createSubmission(request: any, token: string, type = "SRS", phase = "REQUIREMENTS") {
    const result = await expectApiOk<any>(request, "/submissions", {
      method: "POST",
      token,
      multipart: {
        deliverableType: type,
        sdlcPhase: phase,
        title: `E2E ${type} upload`,
        notes: "Uploaded by Playwright E2E to verify deliverable handling.",
        file: { name: `${type.toLowerCase()}-e2e.txt`, mimeType: "text/plain", buffer: Buffer.from("GPMS E2E deliverable") },
      },
    });
    expect(result.data.status).toBe("PENDING");
    return result.data;
  }

  async function ensureTaFirstPassIfAssigned(request: any, team: any, submissionId: string) {
    const taEmail = team.ta?.email;
    if (!taEmail) return;
    const ta = await loginApi(request, taEmail);
    await expectApiStatus(request, `/submissions/${submissionId}/ta-review`, [200, 409], {
      method: "PATCH",
      token: ta.token,
      data: { recommendedGrade: 89, feedback: "E2E first-pass review before final defense grading." },
    });
  }

  async function createDeploymentSubmission(request: any, token: string, suffix: string) {
    const created = await expectApiOk<any>(request, "/submissions", {
      method: "POST",
      token,
      multipart: {
        deliverableType: "FINAL_REPORT",
        sdlcPhase: "DEPLOYMENT",
        title: `E2E defense-gate final report ${suffix}`,
        notes: "Fresh deployment submission created to verify defense meeting gating without relying on mutable seed state.",
        file: { name: `defense-gate-${suffix}.txt`, mimeType: "text/plain", buffer: Buffer.from("Fresh final report for defense gate E2E.") },
      },
    });
    return created.data;
  }

  test("leader uploads deliverable, reviewer requests revision, TA/Admin reviews, and final grade is recorded", async ({ page, request }, testInfo) => {
    const bundle = await createIsolatedTeam(request, testInfo);
    await approveTeamProposal(request, bundle.leaderSession, uniqueSuffix(testInfo));

    await expectApiStatus(request, "/submissions", 422, {
      method: "POST",
      token: bundle.leaderSession.token,
      multipart: { deliverableType: "SRS", sdlcPhase: "REQUIREMENTS" },
    });

    await expectApiStatus(request, "/submissions", 422, {
      method: "POST",
      token: bundle.leaderSession.token,
      multipart: {
        deliverableType: "SRS",
        sdlcPhase: "REQUIREMENTS",
        file: { name: "bad.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("bad") },
      },
    });

    const submission = await createSubmission(request, bundle.leaderSession.token);
    await expectApiStatus(request, `/submissions/${submission.id}/grade`, 403, {
      method: "PATCH",
      token: bundle.memberSession.token,
      data: { grade: 90, feedback: "not allowed" },
    });

    const admin = await loginApi(request, seedUsers.admin.email);
    const revision = await expectApiOk<any>(request, `/submissions/${submission.id}/request-revision`, {
      method: "PATCH",
      token: admin.token,
      data: { feedback: "Please include a clearer stakeholder section before final grading." },
    });
    expect(revision.data.status).toBe("REVISION_REQUIRED");

    const reviewed = await expectApiOk<any>(request, `/submissions/${submission.id}/ta-review`, {
      method: "PATCH",
      token: admin.token,
      data: { recommendedGrade: 88, feedback: "First-pass review is acceptable." },
    });
    expect(reviewed.data.status).toBe("UNDER_REVIEW");

    const missingCriterionName = await expectApiStatus(request, `/submissions/${submission.id}/grade`, 422, {
      method: "PATCH",
      token: admin.token,
      data: {
        grade: 90,
        feedback: "Final grade should reject rubric criteria without names.",
        rubric: [{ name: "", score: 5, maxScore: 10 }],
      },
    });
    expect(JSON.stringify(missingCriterionName.body)).toMatch(/Criterion name is required/i);

    const graded = await expectApiOk<any>(request, `/submissions/${submission.id}/grade`, {
      method: "PATCH",
      token: admin.token,
      data: { grade: 90, feedback: "Final grade approved after revision." },
    });
    expect(graded.data.status).toBe("APPROVED");
    expect(graded.data.grade).toBe(90);

    await expectApiOk(request, "/gamification/leaderboards", { token: admin.token });
    await loginByApi(page, request, bundle.leader.email, "/dashboard/submissions");
    await assertLoadedOrBlocked(page);
  });

  test("deployment/final deliverable cannot be graded until linked defense meeting is completed", async ({ request }, testInfo) => {
    const deploymentLeader = await loginApi(request, "student92@student.edu");
    const myTeam = await expectApiOk<any>(request, "/teams/my", { token: deploymentLeader.token });
    expect(myTeam.data.team.stage).toBe("DEPLOYMENT");

    const doctorEmail = myTeam.data.team.doctor?.email ?? seedUsers.doctor.email;
    const doctor = await loginApi(request, doctorEmail);
    const submission = await createDeploymentSubmission(request, deploymentLeader.token, uniqueSuffix(testInfo));
    await ensureTaFirstPassIfAssigned(request, myTeam.data.team, submission.id);

    await expectApiStatus(request, `/submissions/${submission.id}/grade`, 409, {
      method: "PATCH",
      token: doctor.token,
      data: { grade: 91, feedback: "Should be blocked until defense is complete." },
    });

    const meeting = await createMeeting(request, doctor, myTeam.data.team.id, "defense-gate");
    await expectApiOk(request, `/submissions/${submission.id}/defense`, {
      method: "PATCH",
      token: doctor.token,
      data: { meetingId: meeting.id },
    });

    await expectApiStatus(request, `/submissions/${submission.id}/grade`, 409, {
      method: "PATCH",
      token: doctor.token,
      data: { grade: 91, feedback: "Meeting exists but is not completed yet." },
    });

    await expectApiOk(request, `/meetings/${meeting.id}/complete`, { method: "POST", token: doctor.token });
    await ensureTaFirstPassIfAssigned(request, myTeam.data.team, submission.id);
    const graded = await expectApiOk<any>(request, `/submissions/${submission.id}/grade`, {
      method: "PATCH",
      token: doctor.token,
      data: { grade: 91, feedback: "Defense completed; final grade allowed." },
    });
    expect(graded.data.status).toBe("APPROVED");
  });

  test("bulk approval skips deployment submissions without completed defense", async ({ request }, testInfo) => {
    const deploymentLeader = await loginApi(request, "student96@student.edu");
    const myTeam = await expectApiOk<any>(request, "/teams/my", { token: deploymentLeader.token });
    const doctorEmail = myTeam.data.team.doctor?.email ?? seedUsers.doctor.email;
    const doctor = await loginApi(request, doctorEmail);
    const target = await createDeploymentSubmission(request, deploymentLeader.token, `${uniqueSuffix(testInfo)}-bulk`);
    await ensureTaFirstPassIfAssigned(request, myTeam.data.team, target.id);
    const bulk = await expectApiOk<any>(request, "/submissions/bulk-approve", {
      method: "POST",
      token: doctor.token,
      data: { submissionIds: [target.id], feedback: "Bulk approval should respect defense gate." },
    });
    expect(bulk.data.skipped.some((item: any) => item.id === target.id)).toBeTruthy();
  });

  test("submission lists, detail, comments, unlock, and bad IDs are guarded", async ({ request }, testInfo) => {
    const bundle = await createIsolatedTeam(request, testInfo);
    await approveTeamProposal(request, bundle.leaderSession, `${uniqueSuffix(testInfo)}-guards`);
    const submission = await createSubmission(request, bundle.leaderSession.token);
    const admin = await loginApi(request, seedUsers.admin.email);

    const detail = await expectApiOk<any>(request, `/submissions/${submission.id}`, { token: bundle.leaderSession.token });
    expect(detail.data.id).toBe(submission.id);

    await expectApiOk(request, "/submission-comments", {
      method: "POST",
      token: bundle.leaderSession.token,
      data: { submissionId: submission.id, content: "Comment from submitter for review thread." },
    });
    await expectApiOk(request, `/submissions/${submission.id}/grade`, {
      method: "PATCH",
      token: admin.token,
      data: { grade: 85, feedback: "Approved for unlock coverage." },
    });
    await expectApiOk(request, `/submissions/${submission.id}/unlock`, {
      method: "PATCH",
      token: admin.token,
      data: { reason: "E2E regrade coverage" },
    });
    await expectApiStatus(request, "/submissions/deleted-or-missing", 404, { token: admin.token });
    await expectApiStatus(request, "/submissions/advance-stage?teamId=deleted", [403, 404, 409], {
      method: "POST",
      token: bundle.memberSession.token,
    });
  });
});
