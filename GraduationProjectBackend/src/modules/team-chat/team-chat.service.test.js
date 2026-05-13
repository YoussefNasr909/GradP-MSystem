import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../loaders/dbLoader.js";
import { sendTeamGroupMessageService, syncTeamGroupConversationForTeam } from "./team-chat.service.js";

function createSyncTx({ team, existingParticipants = [] }) {
  const calls = {
    findTeam: [],
    upsertConversation: [],
    findParticipants: [],
    createManyParticipants: [],
    deleteManyParticipants: [],
  };

  const tx = {
    team: {
      findUnique: async (args) => {
        calls.findTeam.push(args);
        return team;
      },
    },
    teamGroupConversation: {
      upsert: async (args) => {
        calls.upsertConversation.push(args);
        return { id: "conversation-1" };
      },
    },
    teamGroupConversationParticipant: {
      findMany: async (args) => {
        calls.findParticipants.push(args);
        return existingParticipants;
      },
      createMany: async (args) => {
        calls.createManyParticipants.push(args);
        return { count: args.data.length };
      },
      deleteMany: async (args) => {
        calls.deleteManyParticipants.push(args);
        return { count: args.where.userId.in.length };
      },
    },
  };

  return { tx, calls };
}

test("syncTeamGroupConversationForTeam creates the group chat and adds student participants", async () => {
  const { tx, calls } = createSyncTx({
    team: {
      id: "team-1",
      leader: { id: "leader-1", role: "LEADER" },
      members: [
        { userId: "student-1", user: { role: "STUDENT" } },
        { userId: "doctor-1", user: { role: "DOCTOR" } },
        { userId: "ta-1", user: { role: "TA" } },
      ],
    },
  });

  const conversationId = await syncTeamGroupConversationForTeam("team-1", tx);

  assert.equal(conversationId, "conversation-1");
  assert.deepEqual(calls.upsertConversation[0].create, { teamId: "team-1" });
  assert.deepEqual(calls.createManyParticipants[0], {
    data: [
      { conversationId: "conversation-1", userId: "leader-1" },
      { conversationId: "conversation-1", userId: "student-1" },
    ],
    skipDuplicates: true,
  });
  assert.equal(calls.deleteManyParticipants.length, 0);
});

test("syncTeamGroupConversationForTeam excludes assigned doctor and TA from group chat participants", async () => {
  const { tx, calls } = createSyncTx({
    team: {
      id: "team-1",
      leader: { id: "leader-1", role: "LEADER" },
      doctor: { id: "doctor-1", role: "DOCTOR" },
      ta: { id: "ta-1", role: "TA" },
      members: [{ userId: "student-1", user: { role: "STUDENT" } }],
    },
  });

  await syncTeamGroupConversationForTeam("team-1", tx);

  assert.deepEqual(calls.createManyParticipants[0], {
    data: [
      { conversationId: "conversation-1", userId: "leader-1" },
      { conversationId: "conversation-1", userId: "student-1" },
    ],
    skipDuplicates: true,
  });
});

test("syncTeamGroupConversationForTeam skips non-student users accidentally present as members", async () => {
  const { tx, calls } = createSyncTx({
    team: {
      id: "team-1",
      leader: { id: "leader-1", role: "LEADER" },
      doctor: null,
      ta: null,
      members: [
        { userId: "student-1", user: { role: "STUDENT" } },
        { userId: "doctor-1", user: { role: "DOCTOR" } },
        { userId: "ta-1", user: { role: "TA" } },
      ],
    },
  });

  await syncTeamGroupConversationForTeam("team-1", tx);

  assert.deepEqual(calls.createManyParticipants[0].data, [
    { conversationId: "conversation-1", userId: "leader-1" },
    { conversationId: "conversation-1", userId: "student-1" },
  ]);
});


test("syncTeamGroupConversationForTeam removes participants who are no longer student team members", async () => {
  const { tx, calls } = createSyncTx({
    team: {
      id: "team-1",
      leader: { id: "leader-1", role: "LEADER" },
      members: [{ userId: "student-1", user: { role: "STUDENT" } }],
    },
    existingParticipants: [
      { userId: "leader-1" },
      { userId: "doctor-1" },
    ],
  });

  await syncTeamGroupConversationForTeam("team-1", tx);

  assert.deepEqual(calls.createManyParticipants[0].data, [
    { conversationId: "conversation-1", userId: "student-1" },
  ]);
  assert.deepEqual(calls.deleteManyParticipants[0].where, {
    conversationId: "conversation-1",
    userId: { in: ["doctor-1"] },
  });
});

test("syncTeamGroupConversationForTeam skips missing teams", async () => {
  const { tx, calls } = createSyncTx({ team: null });

  const conversationId = await syncTeamGroupConversationForTeam("missing-team", tx);

  assert.equal(conversationId, null);
  assert.equal(calls.upsertConversation.length, 0);
});

test("sendTeamGroupMessageService supports file-only team messages", async () => {
  const actor = { id: "leader-1", role: "LEADER" };
  const createdMessage = {
    id: "message-1",
    conversationId: "conversation-1",
    senderId: actor.id,
    content: "",
    fileUrl: "/uploads/team-chat/stored-spec.pdf",
    fileName: "Spec.pdf",
    fileSize: 2048,
    fileType: "application/pdf",
    createdAt: new Date("2026-05-03T10:00:00.000Z"),
    updatedAt: new Date("2026-05-03T10:00:00.000Z"),
    sender: {
      id: actor.id,
      firstName: "Team",
      lastName: "Lead",
      email: "lead@example.com",
      role: "LEADER",
      academicId: "L1",
      avatarUrl: null,
      bio: null,
    },
  };
  const conversation = {
    id: "conversation-1",
    teamId: "team-1",
    team: { id: "team-1", name: "Team One" },
    participants: [{ userId: actor.id, joinedAt: new Date("2026-05-01T10:00:00.000Z"), clearedAt: null, lastSeenAt: null }],
    messages: [createdMessage],
    lastMessageAt: createdMessage.createdAt,
    createdAt: new Date("2026-05-01T10:00:00.000Z"),
    updatedAt: new Date("2026-05-03T10:00:00.000Z"),
  };
  const originalTransaction = prisma.$transaction;

  prisma.$transaction = async (callback) =>
    callback({
      team: {
        findUnique: async () => ({
          id: "team-1",
          leader: { id: actor.id, role: "LEADER" },
          members: [],
        }),
      },
      teamGroupConversation: {
        findUnique: async () => conversation,
        upsert: async () => ({ id: conversation.id }),
        update: async () => conversation,
      },
      teamGroupConversationParticipant: {
        findMany: async () => [{ userId: actor.id }],
        createMany: async () => ({ count: 0 }),
        deleteMany: async () => ({ count: 0 }),
        update: async () => ({ count: 1 }),
      },
      teamGroupMessage: {
        create: async (args) => {
          assert.deepEqual(args.data, {
            conversationId: conversation.id,
            senderId: actor.id,
            content: "",
            fileUrl: "/uploads/team-chat/stored-spec.pdf",
            fileName: "Spec.pdf",
            fileSize: 2048,
            fileType: "application/pdf",
          });
          return createdMessage;
        },
        count: async () => 0,
      },
    });

  try {
    const result = await sendTeamGroupMessageService(
      actor,
      conversation.id,
      { content: "" },
      {
        filename: "stored-spec.pdf",
        originalname: "Spec.pdf",
        size: 2048,
        mimetype: "application/pdf",
      },
    );

    assert.equal(result.message.content, "");
    assert.equal(result.message.fileUrl, "/uploads/team-chat/stored-spec.pdf");
    assert.equal(result.message.fileName, "Spec.pdf");
    assert.equal(result.message.fileSize, 2048);
    assert.equal(result.message.fileType, "application/pdf");
  } finally {
    prisma.$transaction = originalTransaction;
  }
});
