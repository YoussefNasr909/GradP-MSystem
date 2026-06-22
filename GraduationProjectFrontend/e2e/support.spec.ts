import { expect, test } from "@playwright/test";
import { expectApiOk, expectApiStatus } from "./utils/api";
import { loginApi, loginByApi } from "./utils/auth";
import { assertLoadedOrBlocked } from "./utils/guards";
import { adminSession, createUser, ensureSupportUser, uniqueSuffix } from "./utils/users";

test.describe("support ticket workflows", () => {
  test("student creates ticket with validation/attachments, support replies, user replies, and ticket closes/reopens", async ({ page, request }, testInfo) => {
    const admin = await adminSession(request);
    const student = await createUser(request, admin.token, "STUDENT", `${uniqueSuffix(testInfo)}-support-student`);
    const support = await ensureSupportUser(request, uniqueSuffix(testInfo));
    const studentSession = await loginApi(request, student.email, student.password);
    const supportSession = await loginApi(request, support.email, support.password);

    await expectApiStatus(request, "/support/tickets", 422, {
      method: "POST",
      token: studentSession.token,
      multipart: { subject: "", description: "" },
    });
    await expectApiStatus(request, "/support/tickets", 422, {
      method: "POST",
      token: studentSession.token,
      multipart: {
        subject: "Bad attachment",
        description: "Invalid attachment type should be blocked.",
        category: "TECHNICAL",
        priority: "MEDIUM",
        files: { name: "bad.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("bad") },
      },
    });

    const ticket = await expectApiOk<any>(request, "/support/tickets", {
      method: "POST",
      token: studentSession.token,
      multipart: {
        subject: "E2E support issue",
        description: "The dashboard needs help from support.",
        category: "TECHNICAL",
        priority: "HIGH",
        files: { name: "support.txt", mimeType: "text/plain", buffer: Buffer.from("support attachment") },
      },
    });
    expect(ticket.data.status).toBe("OPEN");

    const summary = await expectApiOk<any>(request, "/support/summary", { token: supportSession.token });
    expect(JSON.stringify(summary.data)).toMatch(/open|ticket|queue|total/i);
    const agents = await expectApiOk<any[]>(request, "/support/agents", { token: supportSession.token });
    expect(agents.data.some((agent: any) => agent.id === support.id)).toBeTruthy();

    await expectApiOk(request, `/support/tickets/${ticket.data.id}`, {
      method: "PATCH",
      token: supportSession.token,
      data: { assignedSupportUserId: support.id, status: "IN_PROGRESS" },
    });
    await expectApiOk(request, `/support/tickets/${ticket.data.id}/messages`, {
      method: "POST",
      token: supportSession.token,
      data: { body: "Public support reply from E2E.", visibility: "PUBLIC" },
    });
    await expectApiOk(request, `/support/tickets/${ticket.data.id}/messages`, {
      method: "POST",
      token: supportSession.token,
      data: { body: "Internal private note for staff only.", visibility: "INTERNAL" },
    });
    await expectApiOk(request, `/support/tickets/${ticket.data.id}/messages`, {
      method: "POST",
      token: studentSession.token,
      data: { body: "User follow-up reply." },
    });

    const supportDetail = await expectApiOk<any>(request, `/support/tickets/${ticket.data.id}`, { token: supportSession.token });
    expect(supportDetail.data.messages.some((message: any) => message.visibility === "INTERNAL")).toBeTruthy();
    const studentDetail = await expectApiOk<any>(request, `/support/tickets/${ticket.data.id}`, { token: studentSession.token });
    expect(studentDetail.data.messages.some((message: any) => message.visibility === "INTERNAL")).toBeFalsy();

    const closed = await expectApiOk<any>(request, `/support/tickets/${ticket.data.id}`, {
      method: "PATCH",
      token: supportSession.token,
      data: { status: "CLOSED" },
    });
    expect(closed.data.status).toBe("CLOSED");
    const reopened = await expectApiOk<any>(request, `/support/tickets/${ticket.data.id}/reopen`, {
      method: "POST",
      token: studentSession.token,
      data: { body: "Still need help." },
    });
    expect(reopened.data.status).toBe("OPEN");

    await loginByApi(page, request, support.email, "/dashboard/support");
    await assertLoadedOrBlocked(page);
  });

  test("quick-chat, bulk update, saved replies CRUD, and ticket access permissions are covered", async ({ request }, testInfo) => {
    const admin = await adminSession(request);
    const student = await createUser(request, admin.token, "STUDENT", `${uniqueSuffix(testInfo)}-support-owner`);
    const outsider = await createUser(request, admin.token, "STUDENT", `${uniqueSuffix(testInfo)}-support-outsider`);
    const support = await ensureSupportUser(request, uniqueSuffix(testInfo));
    const studentSession = await loginApi(request, student.email, student.password);
    const outsiderSession = await loginApi(request, outsider.email, outsider.password);
    const supportSession = await loginApi(request, support.email, support.password);

    const ticket = await expectApiOk<any>(request, "/support/tickets/quick-chat", {
      method: "POST",
      token: studentSession.token,
      data: { content: "Quick chat ticket body.", subject: "Quick chat", category: "GENERAL", priority: "LOW" },
    });
    expect(ticket.data.source).toBe("CHAT");

    await expectApiStatus(request, `/support/tickets/${ticket.data.id}`, 403, { token: outsiderSession.token });

    await expectApiOk(request, "/support/tickets/bulk", {
      method: "PATCH",
      token: supportSession.token,
      data: { ticketIds: [ticket.data.id], priority: "URGENT", assignedSupportUserId: support.id },
    });

    const saved = await expectApiOk<any>(request, "/support/saved-replies", {
      method: "POST",
      token: supportSession.token,
      data: { title: "E2E reply", body: "Thanks, we are checking this.", category: "GENERAL" },
    });
    expect(saved.data.title).toBe("E2E reply");
    await expectApiOk(request, `/support/saved-replies/${saved.data.id}`, {
      method: "PATCH",
      token: supportSession.token,
      data: { body: "Updated saved reply.", isActive: true },
    });
    await expectApiOk(request, `/support/saved-replies/${saved.data.id}`, {
      method: "DELETE",
      token: supportSession.token,
    });

    await expectApiStatus(request, "/support/saved-replies", 403, {
      method: "POST",
      token: studentSession.token,
      data: { title: "Bad", body: "Students cannot create saved replies." },
    });
  });
});
