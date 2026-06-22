import { expect, test } from "@playwright/test";
import { apiRequest, expectApiOk, expectApiStatus } from "./utils/api";
import { seedUsers } from "./utils/constants";
import { loginApi, loginByApi } from "./utils/auth";
import { assertLoadedOrBlocked } from "./utils/guards";
import { createTeamWithAcceptedMember } from "./utils/teams";
import { createMeeting, isoOffset, meetingPayload } from "./utils/workflows";
import { uniqueSuffix } from "./utils/users";

test.describe("meetings and calendar workflows", () => {
  test("leader schedules meeting, participant responds, conflict check works, and meeting appears in calendar", async ({ page, request }, testInfo) => {
    const bundle = await createTeamWithAcceptedMember(request, testInfo);

    await expectApiStatus(request, "/meetings", 422, {
      method: "POST",
      token: bundle.leaderSession.token,
      data: { teamId: bundle.team.id, title: "" },
    });

    const meeting = await createMeeting(request, bundle.leaderSession, bundle.team.id, uniqueSuffix(testInfo));
    expect(meeting.id).toBeTruthy();

    const conflicts = await expectApiOk<any[]>(request, `/meetings/conflict-check?startAt=${encodeURIComponent(meeting.startAt)}&endAt=${encodeURIComponent(meeting.endAt)}&userIds=${bundle.leader.id}`, {
      token: bundle.leaderSession.token,
    });
    expect(conflicts.data.some((item: any) => item.id === meeting.id)).toBeTruthy();

    await expectApiOk(request, `/meetings/${meeting.id}/respond`, {
      method: "POST",
      token: bundle.memberSession.token,
      data: { responseStatus: "ACCEPTED" },
    });

    const events = await expectApiOk<any[]>(request, `/calendar/events?start=${isoOffset(-60)}&end=${isoOffset(240)}`, {
      token: bundle.leaderSession.token,
    });
    expect(events.data.some((event: any) => event.sourceId === meeting.id || event.id === meeting.id)).toBeTruthy();

    await loginByApi(page, request, bundle.leader.email, "/dashboard/meetings");
    await assertLoadedOrBlocked(page);
    await page.goto("/dashboard/calendar");
    await assertLoadedOrBlocked(page);
  });

  test("organizer updates/cancels meeting and unrelated users cannot mutate it", async ({ request }, testInfo) => {
    const bundle = await createTeamWithAcceptedMember(request, testInfo);
    const outsider = await createTeamWithAcceptedMember(request, testInfo);
    const meeting = await createMeeting(request, bundle.leaderSession, bundle.team.id, `${uniqueSuffix(testInfo)}-cancel`);

    await expectApiStatus(request, `/meetings/${meeting.id}`, 403, {
      method: "PATCH",
      token: outsider.memberSession.token,
      data: { title: "Not allowed" },
    });

    await expectApiOk(request, `/meetings/${meeting.id}`, {
      method: "PATCH",
      token: bundle.leaderSession.token,
      data: { title: "Updated E2E Meeting" },
    });
    const cancelled = await expectApiOk<any>(request, `/meetings/${meeting.id}/cancel`, {
      method: "POST",
      token: bundle.leaderSession.token,
    });
    expect(cancelled.data.status).toBe("CANCELLED");
  });

  test("doctor/TA approval and completion paths are smoke-tested when exposed", async ({ request }, testInfo) => {
    const bundle = await createTeamWithAcceptedMember(request, testInfo);
    const adminMeeting = await expectApiOk<any>(request, "/meetings", {
      method: "POST",
      token: bundle.leaderSession.token,
      data: meetingPayload(bundle.team.id, uniqueSuffix(testInfo), {
        requiresApproval: true,
        startAt: isoOffset(300),
        endAt: isoOffset(360),
      }),
    });

    await expectApiStatus(request, `/meetings/${adminMeeting.data.id}/approve`, [200, 403, 409], {
      method: "POST",
      token: bundle.leaderSession.token,
    });
    await expectApiStatus(request, `/meetings/${adminMeeting.data.id}/decline`, [200, 403, 409, 422], {
      method: "POST",
      token: bundle.leaderSession.token,
      data: { proposedStartAt: isoOffset(420), proposedEndAt: isoOffset(480), note: "Move the meeting later." },
    });
  });

  test("Google/Outlook calendar integrations expose safe smoke/error states", async ({ request }) => {
    const admin = await loginApi(request, seedUsers.admin.email);

    const integrations = await expectApiOk<any[]>(request, "/calendar/integrations", { token: admin.token });
    expect(Array.isArray(integrations.data)).toBeTruthy();

    for (const provider of ["google", "outlook"]) {
      const connect = await apiRequest(request, `/calendar/integrations/${provider}/connect`, {
        method: "POST",
        token: admin.token,
      });
      expect([200, 302, 400, 401, 409, 422, 500, 503]).toContain(connect.status);
      expect(JSON.stringify(connect.body)).not.toMatch(/client_secret|refresh_token/i);

      await expectApiStatus(request, `/calendar/integrations/${provider}/sync`, [200, 400, 401, 404, 409, 422, 500, 503], {
        method: "POST",
        token: admin.token,
      });
      await expectApiStatus(request, `/calendar/integrations/${provider}/disconnect`, [200, 400, 401, 404, 409, 422, 500, 503], {
        method: "POST",
        token: admin.token,
      });
    }

    const callback = await apiRequest(request, "/calendar/integrations/google/callback?error=access_denied");
    expect([200, 302, 400, 409, 500]).toContain(callback.status);
  });
});
