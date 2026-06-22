import { expect, test } from "@playwright/test";
import { expectApiOk, expectApiStatus } from "./utils/api";
import { seedUsers } from "./utils/constants";
import { loginApi, loginByApi } from "./utils/auth";
import { assertLoadedOrBlocked } from "./utils/guards";
import { createTeamWithAcceptedMember } from "./utils/teams";
import { createProposal } from "./utils/workflows";
import { uniqueSuffix } from "./utils/users";

test.describe("risk management and announcements", () => {
  test("leader creates risk, validation blocks empty risk, and supervisor/admin approval/revision paths work", async ({ page, request }, testInfo) => {
    const bundle = await createTeamWithAcceptedMember(request, testInfo);
    const admin = await loginApi(request, seedUsers.admin.email);

    await expectApiStatus(request, "/risks", 422, {
      method: "POST",
      token: bundle.leaderSession.token,
      data: { title: "" },
    });
    await expectApiStatus(request, "/risks", 403, {
      method: "POST",
      token: bundle.memberSession.token,
      data: {
        teamId: bundle.team.id,
        title: "Member risk",
        description: "Member should not create leader-only risks.",
        category: "Scope",
        chance: "MEDIUM",
        impact: "HIGH",
      },
    });

    const risk = await expectApiOk<any>(request, "/risks", {
      method: "POST",
      token: bundle.leaderSession.token,
      data: {
        teamId: bundle.team.id,
        title: `E2E Risk ${uniqueSuffix(testInfo)}`,
        description: "Potential schedule delay because of integration complexity.",
        category: "Schedule",
        chance: "MEDIUM",
        impact: "HIGH",
        mitigation: "Split work into smaller verified milestones.",
      },
    });
    expect(risk.data.approvalStatus).toBe("PENDING");

    const revision = await expectApiOk<any>(request, `/risks/${risk.data.id}/request-revision`, {
      method: "POST",
      token: admin.token,
      data: { approvalNote: "Add a clearer mitigation owner." },
    });
    expect(revision.data.approvalStatus).toBe("REVISION_REQUESTED");

    const updated = await expectApiOk<any>(request, `/risks/${risk.data.id}`, {
      method: "PATCH",
      token: bundle.leaderSession.token,
      data: { mitigation: "Leader owns mitigation and checks it weekly." },
    });
    expect(updated.data.mitigation).toContain("Leader owns mitigation");

    await expectApiStatus(request, `/risks/${risk.data.id}/approve`, [409, 423], {
      method: "POST",
      token: admin.token,
      data: { severity: "HIGH", approvalNote: "Risk approval should wait for proposal approval." },
    });

    const proposal = await createProposal(request, bundle.leaderSession, `${uniqueSuffix(testInfo)}-risk-gate`);
    await expectApiOk(request, `/proposals/${proposal.id}/submit`, { method: "POST", token: bundle.leaderSession.token });
    await expectApiOk(request, `/proposals/${proposal.id}/review`, {
      method: "PATCH",
      token: admin.token,
      data: { decision: "APPROVED" },
    });

    const approved = await expectApiOk<any>(request, `/risks/${risk.data.id}/approve`, {
      method: "POST",
      token: admin.token,
      data: { severity: "HIGH", approvalNote: "Approved for monitoring." },
    });
    expect(approved.data.approvalStatus).toBe("APPROVED");

    const monitored = await expectApiOk<any>(request, `/risks/${risk.data.id}`, {
      method: "PATCH",
      token: bundle.leaderSession.token,
      data: { status: "MONITORING", monitoringNotes: "Monitoring after approval." },
    });
    expect(monitored.data.status).toBe("MONITORING");

    await loginByApi(page, request, bundle.leader.email, "/dashboard/risk-management");
    await assertLoadedOrBlocked(page);
  });

  test("announcements support audience modes, preview counts, pin/update/delete, and permission checks", async ({ page, request }, testInfo) => {
    const admin = await loginApi(request, seedUsers.admin.email);
    const student = await loginApi(request, seedUsers.studentNoTeam.email);

    for (const audience of ["all", "byStage", "overdue", "needsProposalApproval"]) {
      const preview = await expectApiOk<any>(request, `/announcements/audience-preview?audience=${audience}&audienceParam=REQUIREMENTS`, {
        token: admin.token,
      });
      expect(preview.data).toBeTruthy();
      expect(JSON.stringify(preview.data)).not.toMatch(/passwordHash|twoFactorSecret|refresh_token/i);
    }

    await expectApiStatus(request, "/announcements", 403, {
      method: "POST",
      token: student.token,
      data: { title: "Bad", content: "Students cannot create global announcements.", audience: "all" },
    });

    const announcement = await expectApiOk<any>(request, "/announcements", {
      method: "POST",
      token: admin.token,
      data: {
        title: `E2E Announcement ${uniqueSuffix(testInfo)}`,
        content: "Pinned announcement for E2E audience coverage.",
        audience: "all",
        pinned: true,
      },
    });
    expect(announcement.data.pinned).toBeTruthy();

    const edited = await expectApiOk<any>(request, `/announcements/${announcement.data.id}`, {
      method: "PATCH",
      token: admin.token,
      data: { content: "Updated announcement content.", pinned: false },
    });
    expect(edited.data.pinned).toBeFalsy();

    await expectApiOk(request, `/announcements/${announcement.data.id}`, {
      method: "DELETE",
      token: admin.token,
    });

    await loginByApi(page, request, seedUsers.admin.email, "/dashboard/announcements");
    await assertLoadedOrBlocked(page);
  });
});
