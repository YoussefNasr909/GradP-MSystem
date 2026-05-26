import test from "node:test";
import assert from "node:assert/strict";

import { prisma } from "../../loaders/dbLoader.js";
import {
  bulkUpdateSupportTicketsService,
  createSupportTicketService,
  getSupportTicketService,
  listSupportSavedRepliesService,
  listSupportTicketsService,
  updateSupportTicketService,
} from "./support.service.js";

const now = new Date("2026-05-22T10:00:00.000Z");

const requester = {
  id: "student-1",
  firstName: "Sara",
  lastName: "Student",
  email: "sara@example.com",
  role: "STUDENT",
  academicId: "20260001",
  avatarUrl: null,
  accountStatus: "ACTIVE",
};

const supportUser = {
  id: "support-1",
  firstName: "Sam",
  lastName: "Support",
  email: "support@example.com",
  role: "SUPPORT",
  academicId: "SUPPORT-001",
  avatarUrl: null,
  accountStatus: "ACTIVE",
};

function makeTicket(overrides = {}) {
  return {
    id: "ticket-1",
    ticketNumber: "TKT-001",
    requesterUserId: requester.id,
    assignedSupportUserId: supportUser.id,
    source: "FORM",
    subject: "Need help uploading",
    category: "TECHNICAL",
    priority: "HIGH",
    status: "OPEN",
    tags: [],
    firstResponseDueAt: new Date("2026-05-22T14:00:00.000Z"),
    nextResponseDueAt: new Date("2026-05-22T14:00:00.000Z"),
    firstSupportResponseAt: null,
    snoozedUntil: null,
    requester,
    assignedSupport: supportUser,
    messages: [
      {
        id: "message-public",
        ticketId: "ticket-1",
        author: requester,
        visibility: "PUBLIC",
        body: "The upload fails.",
        attachments: [],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "message-internal",
        ticketId: "ticket-1",
        author: supportUser,
        visibility: "INTERNAL",
        body: "Check storage quota.",
        attachments: [],
        createdAt: now,
        updatedAt: now,
      },
    ],
    attachments: [],
    activities: [
      {
        id: "activity-created",
        ticketId: "ticket-1",
        actor: requester,
        type: "CREATED",
        fromValue: null,
        toValue: "OPEN",
        metadata: null,
        createdAt: now,
      },
      {
        id: "activity-note",
        ticketId: "ticket-1",
        actor: supportUser,
        type: "INTERNAL_NOTE_ADDED",
        fromValue: null,
        toValue: null,
        metadata: null,
        createdAt: now,
      },
    ],
    lastActivityAt: now,
    resolvedAt: null,
    closedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function patchSupportTicket(overrides) {
  const originals = {
    count: prisma.supportTicket.count,
    findMany: prisma.supportTicket.findMany,
    findUnique: prisma.supportTicket.findUnique,
  };

  if (overrides.count) prisma.supportTicket.count = overrides.count;
  if (overrides.findMany) prisma.supportTicket.findMany = overrides.findMany;
  if (overrides.findUnique) prisma.supportTicket.findUnique = overrides.findUnique;

  return () => {
    prisma.supportTicket.count = originals.count;
    prisma.supportTicket.findMany = originals.findMany;
    prisma.supportTicket.findUnique = originals.findUnique;
  };
}

test("requesters can read their own ticket but internal notes stay hidden", async () => {
  const restore = patchSupportTicket({
    findUnique: async () => makeTicket(),
  });

  try {
    const ticket = await getSupportTicketService({ id: requester.id, role: "STUDENT" }, "ticket-1");

    assert.equal(ticket.id, "ticket-1");
    assert.deepEqual(ticket.messages.map((message) => message.visibility), ["PUBLIC"]);
    assert.equal(ticket.counts.internalNotes, 0);
    assert.equal(ticket.activities.some((activity) => activity.type === "INTERNAL_NOTE_ADDED"), false);
  } finally {
    restore();
  }
});

test("requesters cannot read another user's support ticket", async () => {
  const restore = patchSupportTicket({
    findUnique: async () => makeTicket(),
  });

  try {
    await assert.rejects(
      () => getSupportTicketService({ id: "student-2", role: "STUDENT" }, "ticket-1"),
      (error) => {
        assert.equal(error.code, "SUPPORT_TICKET_FORBIDDEN");
        assert.equal(error.statusCode, 403);
        return true;
      },
    );
  } finally {
    restore();
  }
});

test("support staff can list the queue with assignment filters", async () => {
  let capturedWhere = null;
  const restore = patchSupportTicket({
    count: async ({ where }) => {
      capturedWhere = where;
      return 1;
    },
    findMany: async () => [makeTicket()],
  });

  try {
    const result = await listSupportTicketsService(
      { id: supportUser.id, role: "SUPPORT" },
      { page: 1, limit: 20, assignedTo: "me", status: "OPEN" },
    );

    assert.equal(capturedWhere.assignedSupportUserId, supportUser.id);
    assert.equal(capturedWhere.status, "OPEN");
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].counts.internalNotes, 1);
    assert.equal(result.items[0].sla.state, "OVERDUE");
  } finally {
    restore();
  }
});

test("support staff can keep resolved tickets out of the active queue", async () => {
  let capturedWhere = null;
  const restore = patchSupportTicket({
    count: async ({ where }) => {
      capturedWhere = where;
      return 0;
    },
    findMany: async () => [],
  });

  try {
    await listSupportTicketsService(
      { id: supportUser.id, role: "SUPPORT" },
      { page: 1, limit: 20, statusGroup: "active" },
    );

    assert.deepEqual(capturedWhere.status, { notIn: ["RESOLVED", "CLOSED"] });
  } finally {
    restore();
  }
});

test("support accounts cannot submit requester tickets", async () => {
  await assert.rejects(
    () =>
      createSupportTicketService(
        { id: supportUser.id, role: "SUPPORT" },
        {
          subject: "I need help",
          description: "This should be blocked.",
          category: "GENERAL",
          priority: "MEDIUM",
        },
      ),
    (error) => {
      assert.equal(error.code, "SUPPORT_REQUESTER_FORBIDDEN");
      assert.equal(error.statusCode, 403);
      return true;
    },
  );
});

test("only support accounts can patch ticket workflow fields", async () => {
  await assert.rejects(
    () => updateSupportTicketService({ id: requester.id, role: "STUDENT" }, "ticket-1", { status: "IN_PROGRESS" }),
    (error) => {
      assert.equal(error.code, "SUPPORT_STAFF_ONLY");
      assert.equal(error.statusCode, 403);
      return true;
    },
  );

  await assert.rejects(
    () => updateSupportTicketService({ id: "admin-1", role: "ADMIN" }, "ticket-1", { status: "IN_PROGRESS" }),
    (error) => {
      assert.equal(error.code, "SUPPORT_STAFF_ONLY");
      assert.equal(error.statusCode, 403);
      return true;
    },
  );
});

test("only support accounts can bulk update tickets", async () => {
  await assert.rejects(
    () => bulkUpdateSupportTicketsService({ id: requester.id, role: "STUDENT" }, { ticketIds: ["ticket-1"], status: "IN_PROGRESS" }),
    (error) => {
      assert.equal(error.code, "SUPPORT_STAFF_ONLY");
      assert.equal(error.statusCode, 403);
      return true;
    },
  );
});

test("support staff can list active saved replies", async () => {
  const originalFindMany = prisma.supportSavedReply.findMany;
  let capturedWhere = null;
  prisma.supportSavedReply.findMany = async ({ where }) => {
    capturedWhere = where;
    return [
      {
        id: "saved-1",
        title: "Ask for screenshot",
        body: "Could you attach a screenshot so we can check this faster?",
        category: "TECHNICAL",
        usageCount: 3,
        isActive: true,
        createdBy: supportUser,
        createdAt: now,
        updatedAt: now,
      },
    ];
  };

  try {
    const replies = await listSupportSavedRepliesService({ id: supportUser.id, role: "SUPPORT" }, {});

    assert.deepEqual(capturedWhere, { isActive: true });
    assert.equal(replies.length, 1);
    assert.equal(replies[0].title, "Ask for screenshot");
    assert.equal(replies[0].createdBy.fullName, "Sam Support");
  } finally {
    prisma.supportSavedReply.findMany = originalFindMany;
  }
});

test("admins list only tickets they requested", async () => {
  let capturedWhere = null;
  const restore = patchSupportTicket({
    count: async ({ where }) => {
      capturedWhere = where;
      return 0;
    },
    findMany: async () => [],
  });

  try {
    const result = await listSupportTicketsService({ id: "admin-1", role: "ADMIN" }, { page: 1, limit: 20 });

    assert.equal(capturedWhere.requesterUserId, "admin-1");
    assert.equal(result.items.length, 0);
  } finally {
    restore();
  }
});
