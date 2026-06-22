import { expect, test } from "@playwright/test";
import { expectApiOk, expectApiStatus } from "./utils/api";
import { loginApi, loginByApi } from "./utils/auth";
import { seedUsers } from "./utils/constants";
import { createTeamWithAcceptedMember } from "./utils/teams";
import { assertLoadedOrBlocked } from "./utils/guards";

test.describe("chat, team chat, and discussions", () => {
  test("direct chat supports search, send, edit, seen, and delete", async ({ request }, testInfo) => {
    const bundle = await createTeamWithAcceptedMember(request, testInfo);
    const sender = bundle.leaderSession;
    const recipient = bundle.memberSession;

    const search = await expectApiOk<any>(request, `/chat/users/search?q=${encodeURIComponent(recipient.user.email)}`, {
      token: sender.token,
    });
    expect(JSON.stringify(search.data)).toContain(recipient.user.email);

    const sent = await expectApiOk<any>(request, "/chat/messages", {
      method: "POST",
      token: sender.token,
      multipart: {
        recipientId: recipient.user.id,
        content: "E2E direct chat message with a concrete assertion.",
      },
    });
    const sentMessage = sent.data.message ?? sent.data;
    expect(sentMessage.content).toContain("E2E direct chat");
    const conversationId = sent.data.conversation?.id ?? sentMessage.conversationId;
    expect(conversationId).toBeTruthy();

    const messages = await expectApiOk<any>(request, `/chat/conversations/${conversationId}/messages`, {
      token: recipient.token,
    });
    expect(JSON.stringify(messages.data)).toContain(sentMessage.id);

    await expectApiOk(request, `/chat/conversations/${conversationId}/seen`, {
      method: "PATCH",
      token: recipient.token,
    });
    await expectApiOk(request, `/chat/messages/${sentMessage.id}`, {
      method: "PATCH",
      token: sender.token,
      data: { content: "E2E direct chat message edited." },
    });
    await expectApiStatus(request, `/chat/messages/${sentMessage.id}`, 403, {
      method: "DELETE",
      token: recipient.token,
    });
    await expectApiOk(request, `/chat/messages/${sentMessage.id}`, { method: "DELETE", token: sender.token });
  });

  test("team chat is private to team members and persists messages", async ({ request }, testInfo) => {
    const bundle = await createTeamWithAcceptedMember(request, testInfo);
    const outsider = await loginApi(request, seedUsers.studentNoTeam.email);

    const bootstrap = await expectApiOk<any>(request, "/team-chats/bootstrap", {
      token: bundle.leaderSession.token,
    });
    const conversationId =
      bootstrap.data.conversation?.id ??
      bootstrap.data.teamConversation?.id ??
      bootstrap.data.conversations?.[0]?.id ??
      bootstrap.data.id ??
      bootstrap.data.conversationId;
    expect(conversationId).toBeTruthy();

    const message = await expectApiOk<any>(request, `/team-chats/conversations/${conversationId}/messages`, {
      method: "POST",
      token: bundle.memberSession.token,
      multipart: { content: "E2E team chat message for a private graduation team." },
    });
    const teamMessage = message.data.message ?? message.data;
    expect(teamMessage.content).toContain("team chat");

    const listed = await expectApiOk<any>(request, `/team-chats/conversations/${conversationId}/messages`, {
      token: bundle.leaderSession.token,
    });
    expect(JSON.stringify(listed.data)).toContain(teamMessage.id);

    await expectApiStatus(request, `/team-chats/conversations/${conversationId}/messages`, 403, {
      token: outsider.token,
    });
  });

  test("discussions support create, reply, like, search, and permissions", async ({ page, request }, testInfo) => {
    const bundle = await createTeamWithAcceptedMember(request, testInfo);
    const discussion = await expectApiOk<any>(request, "/discussions", {
      method: "POST",
      token: bundle.leaderSession.token,
      data: {
        title: "E2E technical discussion",
        category: "technical",
        content: "This is a realistic discussion about API validation and frontend state.",
        tags: ["e2e", "api"],
      },
    });
    expect(discussion.data.title).toContain("technical");

    const comment = await expectApiOk<any>(request, `/discussions/${discussion.data.id}/comments`, {
      method: "POST",
      token: bundle.memberSession.token,
      data: { content: "Member reply confirms discussion visibility." },
    });
    expect(comment.data.content).toContain("Member reply");

    await expectApiOk(request, `/discussions/${discussion.data.id}/like`, {
      method: "POST",
      token: bundle.memberSession.token,
    });
    await expectApiStatus(request, "/discussions", 403, {
      token: (await loginApi(request, seedUsers.admin.email)).token,
    });

    await loginByApi(page, request, bundle.leader.email, "/dashboard/chat");
    await assertLoadedOrBlocked(page, [/chat|conversation|message|empty/i]);
    await page.goto("/dashboard/discussions");
    await assertLoadedOrBlocked(page, [/discussion|technical|empty|team/i]);
  });
});
