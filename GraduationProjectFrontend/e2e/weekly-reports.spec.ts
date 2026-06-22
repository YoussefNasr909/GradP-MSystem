import { expect, test } from "@playwright/test";
import { expectApiOk, expectApiStatus, expectUnauthorizedWithoutToken } from "./utils/api";
import { loginApi, loginByApi } from "./utils/auth";
import { assertLoadedOrBlocked, assertPageUsable } from "./utils/guards";
import { seedUsers } from "./utils/constants";

async function firstEditableReport(request: any, leaderToken: string) {
  const list = await expectApiOk<any>(request, "/weekly-reports?status=DRAFT&limit=20", { token: leaderToken });
  return list.data.items?.[0] ?? null;
}

async function reviewerForReport(request: any, report: any) {
  const doctorEmail = report?.team?.doctor?.email;
  const taEmail = report?.team?.ta?.email;
  if (doctorEmail) return loginApi(request, doctorEmail);
  if (taEmail) return loginApi(request, taEmail);
  return loginApi(request, seedUsers.admin.email);
}

test.describe("weekly reports workflow", () => {
  test("student submits, receives requested changes, resubmits, and supervisor approves", async ({ request }) => {
    const leader = await loginApi(request, seedUsers.leader.email);
    const report = await firstEditableReport(request, leader.token);
    test.skip(
      !report,
      "TODO: no weekly-report create endpoint exists; this workflow needs seeded/generated draft weekly reports.",
    );

    await expectApiStatus(request, `/weekly-reports/${report.id}/submit`, 422, {
      method: "POST",
      token: leader.token,
      data: { summaryFinal: "" },
    });

    const submitted = await expectApiOk<any>(request, `/weekly-reports/${report.id}/submit`, {
      method: "POST",
      token: leader.token,
      data: {
        summaryFinal:
          "This week the team completed implementation checkpoints, documented blockers, and prepared the next review package.",
      },
    });
    expect(submitted.data.status).toBe("SUBMITTED");
    expect(submitted.data.isSubmitted).toBe(true);

    const reviewer = await reviewerForReport(request, submitted.data);
    const changes = await expectApiOk<any>(request, `/weekly-reports/${report.id}/review`, {
      method: "POST",
      token: reviewer.token,
      data: { decision: "CHANGES_REQUESTED", reviewComment: "Add measurable proof for completed tasks." },
    });
    expect(changes.data.status).toBe("CHANGES_REQUESTED");
    expect(changes.data.reviewComment).toContain("measurable");

    const resubmitted = await expectApiOk<any>(request, `/weekly-reports/${report.id}/submit`, {
      method: "POST",
      token: leader.token,
      data: {
        summaryFinal:
          "Resubmitted weekly report with measurable task proof, linked review notes, and clearer next-week ownership.",
      },
    });
    expect(resubmitted.data.status).toBe("SUBMITTED");

    const approved = await expectApiOk<any>(request, `/weekly-reports/${report.id}/review`, {
      method: "POST",
      token: reviewer.token,
      data: { decision: "APPROVED", reviewComment: "Approved for weekly progress tracking." },
    });
    expect(approved.data.status).toBe("APPROVED");
  });

  test("unauthorized and wrong-role weekly report access is blocked", async ({ request }) => {
    const leader = await loginApi(request, seedUsers.leader.email);
    const list = await expectApiOk<any>(request, "/weekly-reports?limit=5", { token: leader.token });
    const report = list.data.items?.[0];
    test.skip(!report, "TODO: weekly report negative checks require at least one seeded/generated report.");

    await expectUnauthorizedWithoutToken(request, "/weekly-reports");

    const noTeamStudent = await loginApi(request, seedUsers.studentNoTeam.email);
    await expectApiStatus(request, `/weekly-reports?teamId=${report.teamId}`, 403, { token: noTeamStudent.token });
    await expectApiStatus(request, `/weekly-reports/${report.id}/review`, 403, {
      method: "POST",
      token: noTeamStudent.token,
      data: { decision: "APPROVED" },
    });
  });

  test("weekly progress and reports pages load or show an honest empty state", async ({ page, request }) => {
    await loginByApi(page, request, seedUsers.leader.email, "/dashboard/weekly-progress");
    await assertLoadedOrBlocked(page, [/weekly progress|sprint|report|empty|no weekly/i]);

    await page.goto("/dashboard/reports");
    await assertPageUsable(page);
    await assertLoadedOrBlocked(page, [/reports|analytics|grades|empty|forbidden/i]);
  });
});
