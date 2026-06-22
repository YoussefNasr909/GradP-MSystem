import { expect, test } from "@playwright/test";
import { expectApiOk, expectApiStatus } from "./utils/api";
import { seedUsers } from "./utils/constants";
import { loginApi, loginByApi } from "./utils/auth";
import { assertLoadedBlockedOrBlankTodo } from "./utils/guards";
import { createIsolatedTeam, createTeamWithAcceptedMember } from "./utils/teams";
import { createProposal, proposalPayload } from "./utils/workflows";
import { uniqueSuffix } from "./utils/users";

test.describe("proposal workflows", () => {
  async function assignSeedDoctor(request: any, teamId: string, leaderToken: string) {
    const doctor = await loginApi(request, seedUsers.doctor.email);
    const doctorProfile = await expectApiOk<any>(request, "/auth/me", { token: doctor.token });
    const supervisorRequest = await expectApiOk<any>(request, `/teams/${teamId}/supervisor-requests`, {
      method: "POST",
      token: leaderToken,
      data: {
        supervisorId: doctorProfile.data.id,
        projectName: "E2E Proposal Supervision",
        projectDescription: "Enough detail to assign the doctor before proposal review.",
        technologies: ["Next.js", "Express"],
      },
    });
    await expectApiOk(request, `/teams/supervisor-requests/${supervisorRequest.data.id}/accept`, {
      method: "POST",
      token: doctor.token,
    });
    return doctor;
  }

  test("leader creates, edits, submits, and assigned doctor requests changes before resubmission", async ({ page, request }, testInfo) => {
    const bundle = await createIsolatedTeam(request, testInfo);
    const suffix = uniqueSuffix(testInfo);
    const doctor = await assignSeedDoctor(request, bundle.team.id, bundle.leaderSession.token);

    await expectApiStatus(request, "/proposals", 422, {
      method: "POST",
      token: bundle.leaderSession.token,
      data: { title: "" },
    });

    const proposal = await createProposal(request, bundle.leaderSession, suffix);
    const edited = await expectApiOk<any>(request, `/proposals/${proposal.id}`, {
      method: "PATCH",
      token: bundle.leaderSession.token,
      data: { scope: "Updated E2E scope with enough detail to validate proposal editing." },
    });
    expect(edited.data.scope).toContain("Updated E2E scope");

    const submitted = await expectApiOk<any>(request, `/proposals/${proposal.id}/submit`, {
      method: "POST",
      token: bundle.leaderSession.token,
    });
    expect(submitted.data.status).toBe("SUBMITTED");

    const revision = await expectApiOk<any>(request, `/proposals/${proposal.id}/review`, {
      method: "PATCH",
      token: doctor.token,
      data: { decision: "REVISION_REQUESTED", feedback: "Please add clearer methodology and measurable testing criteria." },
    });
    expect(revision.data.status).toBe("REVISION_REQUESTED");

    await expectApiOk(request, `/proposals/${proposal.id}`, {
      method: "PATCH",
      token: bundle.leaderSession.token,
      data: { methodology: "Updated methodology with automation, weekly review, and evaluation checkpoints." },
    });
    const resubmitted = await expectApiOk<any>(request, `/proposals/${proposal.id}/submit`, {
      method: "POST",
      token: bundle.leaderSession.token,
    });
    expect(resubmitted.data.status).toBe("SUBMITTED");
    const supervisorFilteredList = await expectApiOk<any[]>(request, `/proposals?teamId=${bundle.team.id}`, {
      token: doctor.token,
    });
    expect(supervisorFilteredList.data.some((item: any) => item.id === proposal.id)).toBeTruthy();

    await loginByApi(page, request, bundle.leader.email, `/dashboard/proposals/${proposal.id}`);
    await assertLoadedBlockedOrBlankTodo(page, `/dashboard/proposals/${proposal.id}`, [
      /proposal|updated|submitted|revision/i,
    ]);
  });

  test("doctor approve/reject permissions and wrong-doctor restriction are enforced", async ({ request }, testInfo) => {
    const approveBundle = await createIsolatedTeam(request, testInfo);
    const doctor = await assignSeedDoctor(request, approveBundle.team.id, approveBundle.leaderSession.token);
    const proposal = await createProposal(request, approveBundle.leaderSession, `${uniqueSuffix(testInfo)}-approve`);
    await expectApiOk(request, `/proposals/${proposal.id}/submit`, {
      method: "POST",
      token: approveBundle.leaderSession.token,
    });

    await expectApiStatus(request, `/proposals/${proposal.id}/review`, 403, {
      method: "PATCH",
      token: approveBundle.memberSession.token,
      data: { decision: "APPROVED" },
    });

    const wrongDoctor = await loginApi(request, "doctor1@university.edu");
    await expectApiStatus(request, `/proposals/${proposal.id}/review`, 403, {
      method: "PATCH",
      token: wrongDoctor.token,
      data: { decision: "APPROVED" },
    });

    const approved = await expectApiOk<any>(request, `/proposals/${proposal.id}/review`, {
      method: "PATCH",
      token: doctor.token,
      data: { decision: "APPROVED" },
    });
    expect(approved.data.status).toBe("APPROVED");
  });

  test("member status view, non-leader edit block, and admin override are covered", async ({ page, request }, testInfo) => {
    const bundle = await createTeamWithAcceptedMember(request, testInfo);
    const proposal = await createProposal(request, bundle.leaderSession, uniqueSuffix(testInfo));

    await expectApiStatus(request, "/proposals", 403, {
      method: "POST",
      token: bundle.memberSession.token,
      data: proposalPayload("bad-member"),
    });
    await expectApiStatus(request, `/proposals/${proposal.id}`, 403, {
      method: "PATCH",
      token: bundle.memberSession.token,
      data: { title: "Member should not edit" },
    });

    const memberView = await expectApiOk<any>(request, `/proposals/${proposal.id}`, { token: bundle.memberSession.token });
    expect(memberView.data.status).toBe("DRAFT");

    const admin = await loginApi(request, seedUsers.admin.email);
    const adminEdit = await expectApiOk<any>(request, `/proposals/${proposal.id}`, {
      method: "PATCH",
      token: admin.token,
      data: { title: "Admin Override Proposal Title" },
    });
    expect(adminEdit.data.title).toBe("Admin Override Proposal Title");

    await loginByApi(page, request, bundle.leader.email, "/dashboard/proposals/new");
    await assertLoadedBlockedOrBlankTodo(page, "/dashboard/proposals/new");
    await page.goto(`/dashboard/proposals/${proposal.id}/edit`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await assertLoadedBlockedOrBlankTodo(page, `/dashboard/proposals/${proposal.id}/edit`);
  });

  test("dynamic proposal routes handle missing records cleanly", async ({ page, request }) => {
    await loginByApi(page, request, seedUsers.leader.email, "/dashboard/proposals/not-a-real-proposal");
    await assertLoadedBlockedOrBlankTodo(page, "/dashboard/proposals/not-a-real-proposal");
    await page.goto("/dashboard/proposals/not-a-real-proposal/edit", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await assertLoadedBlockedOrBlankTodo(page, "/dashboard/proposals/not-a-real-proposal/edit");
  });
});
