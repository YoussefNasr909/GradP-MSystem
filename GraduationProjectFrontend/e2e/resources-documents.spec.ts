import { expect, test } from "@playwright/test";
import { expectApiOk, expectApiStatus } from "./utils/api";
import { seedUsers } from "./utils/constants";
import { loginApi, loginByApi } from "./utils/auth";
import { assertLoadedOrBlocked } from "./utils/guards";
import { createTeamWithAcceptedMember } from "./utils/teams";
import { uniqueSuffix } from "./utils/users";

test.describe("resources and team documents", () => {
  test("doctor/TA uploads resource, students can view, and owner can edit/delete", async ({ page, request }, testInfo) => {
    const bundle = await createTeamWithAcceptedMember(request, testInfo);
    const doctor = await loginApi(request, seedUsers.doctor.email);
    const doctorMe = await expectApiOk<any>(request, "/auth/me", { token: doctor.token });
    const supervisorRequest = await expectApiOk<any>(request, `/teams/${bundle.team.id}/supervisor-requests`, {
      method: "POST",
      token: bundle.leaderSession.token,
      data: {
        supervisorId: doctorMe.data.id,
        projectName: bundle.team.name,
        projectDescription: "Assigning the resource author to make resource visibility deterministic.",
        technologies: ["Next.js"],
      },
    });
    await expectApiOk(request, `/teams/supervisor-requests/${supervisorRequest.data.id}/accept`, {
      method: "POST",
      token: doctor.token,
    });
    const suffix = uniqueSuffix(testInfo);

    await expectApiStatus(request, "/resources", 422, {
      method: "POST",
      token: doctor.token,
      multipart: {
        title: "Bad",
        description: "bad",
        category: "documentation",
        type: "file",
        file: { name: "bad.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("bad") },
      },
    });

    const resource = await expectApiOk<any>(request, "/resources", {
      method: "POST",
      token: doctor.token,
      multipart: {
        title: `E2E Resource ${suffix}`,
        description: "A useful resource uploaded by a supervisor for students.",
        category: "documentation",
        type: "file",
        tags: JSON.stringify(["e2e", "qa"]),
        file: { name: "resource.txt", mimeType: "text/plain", buffer: Buffer.from("resource body") },
      },
    });
    expect(resource.data.url).toMatch(/uploads\/resources/i);

    const resources = await expectApiOk<any[]>(request, `/resources?search=${encodeURIComponent(resource.data.title)}`, {
      token: bundle.memberSession.token,
    });
    expect(resources.data.some((item: any) => item.id === resource.data.id)).toBeTruthy();

    const edited = await expectApiOk<any>(request, `/resources/${resource.data.id}`, {
      method: "PATCH",
      token: doctor.token,
      multipart: {
        title: `${resource.data.title} Updated`,
        description: "Updated resource description for E2E.",
        category: "tutorial",
        type: "link",
        url: "https://example.com/resource",
        tags: JSON.stringify(["updated"]),
      },
    });
    expect(edited.data.type).toBe("link");

    await expectApiStatus(request, `/resources/${resource.data.id}`, 403, {
      method: "DELETE",
      token: bundle.memberSession.token,
    });
    await expectApiOk(request, `/resources/${resource.data.id}`, { method: "DELETE", token: doctor.token });

    await loginByApi(page, request, seedUsers.doctor.email, "/dashboard/resources");
    await assertLoadedOrBlocked(page);
  });

  test("leader uploads team document, member can see, member cannot delete, and non-team user cannot list it", async ({ page, request }, testInfo) => {
    const bundle = await createTeamWithAcceptedMember(request, testInfo);
    const outsider = await createTeamWithAcceptedMember(request, testInfo);
    const suffix = uniqueSuffix(testInfo);

    const document = await expectApiOk<any>(request, "/documents", {
      method: "POST",
      token: bundle.leaderSession.token,
      multipart: {
        title: `E2E Team Document ${suffix}`,
        description: "Team-private document uploaded for document workflow coverage.",
        category: "documentation",
        tags: JSON.stringify(["e2e"]),
        file: { name: "team-document.txt", mimeType: "text/plain", buffer: Buffer.from("team private document") },
      },
    });
    expect(document.data.teamId).toBe(bundle.team.id);

    const memberList = await expectApiOk<any[]>(request, `/documents?teamId=${bundle.team.id}&search=${encodeURIComponent(document.data.title)}`, {
      token: bundle.memberSession.token,
    });
    expect(memberList.data.some((item: any) => item.id === document.data.id)).toBeTruthy();

    await expectApiStatus(request, `/documents?teamId=${bundle.team.id}&search=${encodeURIComponent(document.data.title)}`, 403, {
      token: outsider.memberSession.token,
    });

    await expectApiStatus(request, `/documents/${document.data.id}`, 403, {
      method: "DELETE",
      token: bundle.memberSession.token,
    });

    await expectApiOk(request, `/documents/${document.data.id}`, {
      method: "PATCH",
      token: bundle.leaderSession.token,
      multipart: {
        title: `${document.data.title} Updated`,
        description: "Updated team-private document.",
        category: "other",
        tags: JSON.stringify(["updated"]),
        file: { name: "updated-document.txt", mimeType: "text/plain", buffer: Buffer.from("updated") },
      },
    });

    await expectApiOk(request, `/documents/${document.data.id}`, { method: "DELETE", token: bundle.leaderSession.token });
    const afterDelete = await expectApiOk<any[]>(request, `/documents?teamId=${bundle.team.id}&search=${encodeURIComponent(document.data.title)}`, {
      token: bundle.leaderSession.token,
    });
    expect(afterDelete.data.some((item: any) => item.id === document.data.id)).toBeFalsy();

    await loginByApi(page, request, bundle.leader.email, "/dashboard/files");
    await assertLoadedOrBlocked(page);
  });
});
