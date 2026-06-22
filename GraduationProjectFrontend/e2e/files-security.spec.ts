import { expect, test } from "@playwright/test";
import { expectApiOk, expectApiStatus } from "./utils/api";
import { BACKEND_ORIGIN, seedUsers } from "./utils/constants";
import { loginApi } from "./utils/auth";
import { createTeamWithAcceptedMember } from "./utils/teams";
import { uniqueSuffix } from "./utils/users";

test.describe("file and upload security", () => {
  test("allowed and rejected file types are explicit across upload surfaces", async ({ request }, testInfo) => {
    const doctor = await loginApi(request, seedUsers.doctor.email);
    const resource = await expectApiOk<any>(request, "/resources", {
      method: "POST",
      token: doctor.token,
      multipart: {
        title: `Security Resource ${uniqueSuffix(testInfo)}`,
        description: "File security resource.",
        category: "documentation",
        type: "file",
        file: { name: "allowed.txt", mimeType: "text/plain", buffer: Buffer.from("allowed") },
      },
    });
    expect(resource.data.url).toMatch(/\/uploads\/resources\//);

    await expectApiStatus(request, "/resources", 422, {
      method: "POST",
      token: doctor.token,
      multipart: {
        title: "Invalid Resource",
        description: "Invalid type check.",
        category: "documentation",
        type: "file",
        file: { name: "invalid.sh", mimeType: "application/x-sh", buffer: Buffer.from("bad") },
      },
    });
  });

  test("private team documents are hidden from unauthorized API lists and deleted metadata disappears", async ({ request }, testInfo) => {
    const bundle = await createTeamWithAcceptedMember(request, testInfo);
    const outsider = await createTeamWithAcceptedMember(request, testInfo);
    const document = await expectApiOk<any>(request, "/documents", {
      method: "POST",
      token: bundle.leaderSession.token,
      multipart: {
        title: `Private Security Document ${uniqueSuffix(testInfo)}`,
        description: "Private document metadata should not leak through API lists.",
        category: "documentation",
        file: { name: "private.txt", mimeType: "text/plain", buffer: Buffer.from("private") },
      },
    });

    await expectApiStatus(request, `/documents?teamId=${bundle.team.id}&search=${encodeURIComponent(document.data.title)}`, 403, {
      token: outsider.memberSession.token,
    });

    await expectApiOk(request, `/documents/${document.data.id}`, { method: "DELETE", token: bundle.leaderSession.token });
    const ownerList = await expectApiOk<any[]>(request, `/documents?teamId=${bundle.team.id}&search=${encodeURIComponent(document.data.title)}`, {
      token: bundle.leaderSession.token,
    });
    expect(ownerList.data).toHaveLength(0);
  });

  test("path traversal under /uploads is rejected or 404, and public upload behavior is documented", async ({ request }) => {
    const traversal = await request.get(`${BACKEND_ORIGIN}/uploads/documents/../../.env`, { failOnStatusCode: false });
    expect([400, 403, 404]).toContain(traversal.status());
    const body = await traversal.text();
    expect(body).not.toMatch(/DATABASE_URL|JWT_SECRET|password/i);

    test.info().annotations.push({
      type: "SECURITY_NOTE",
      description:
        "Express serves /uploads statically. Tests assert private metadata is hidden through APIs and traversal is blocked; direct known URLs may be public if that is the product rule.",
    });
  });
});
