import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../loaders/dbLoader.js";
import { searchChatUsersService, sendChatMessageService } from "./chat.service.js";

function patchPrismaForSearch({ teamMembers = [], users = [], teams = [] }) {
  const originals = {
    teamMemberFindUnique: prisma.teamMember.findUnique,
    teamFindMany: prisma.team.findMany,
    directChatConversationFindMany: prisma.directChatConversation.findMany,
    userFindMany: prisma.user.findMany,
  };

  prisma.teamMember.findUnique = async () => ({
    team: {
      id: "team-1",
      name: "Team One",
      leader: { id: "leader-1", firstName: "Team", lastName: "Lead", email: "lead@example.com", role: "LEADER", academicId: "L1", avatarUrl: null, bio: null },
      members: teamMembers.map((user) => ({ user })),
    },
  });
  prisma.team.findMany = async () => teams;
  prisma.directChatConversation.findMany = async () => [];
  prisma.user.findMany = async () => users;

  return () => {
    prisma.teamMember.findUnique = originals.teamMemberFindUnique;
    prisma.team.findMany = originals.teamFindMany;
    prisma.directChatConversation.findMany = originals.directChatConversationFindMany;
    prisma.user.findMany = originals.userFindMany;
  };
}

function patchPrismaForForbiddenSend({ recipient }) {
  const originals = {
    teamMemberFindUnique: prisma.teamMember.findUnique,
    userFindUnique: prisma.user.findUnique,
  };

  prisma.teamMember.findUnique = async () => ({
    team: {
      id: "team-1",
      name: "Team One",
      leader: { id: "leader-1", firstName: "Team", lastName: "Lead", email: "lead@example.com", role: "LEADER", academicId: "L1", avatarUrl: null, bio: null },
      members: [],
    },
  });
  prisma.user.findUnique = async () => recipient;

  return () => {
    prisma.teamMember.findUnique = originals.teamMemberFindUnique;
    prisma.user.findUnique = originals.userFindUnique;
  };
}

test("searchChatUsersService hides private accounts from chat search", async () => {
  const privateUser = {
    id: "student-private",
    firstName: "Alex",
    lastName: "Private",
    email: "alex.private@example.com",
    role: "STUDENT",
    academicId: "S1",
    avatarUrl: null,
    bio: null,
    accountStatus: "ACTIVE",
    isEmailVerified: true,
    settings: { profileVisibility: "PRIVATE" },
  };
  const restore = patchPrismaForSearch({
    teamMembers: [privateUser],
    users: [privateUser],
  });

  try {
    const results = await searchChatUsersService({ id: "student-actor", role: "STUDENT" }, "alex");
    assert.deepEqual(results, []);
  } finally {
    restore();
  }
});

test("searchChatUsersService only shows team-only accounts to allowed team contacts", async () => {
  const teamOnlyUser = {
    id: "student-team-only",
    firstName: "Alex",
    lastName: "Team",
    email: "alex.team@example.com",
    role: "STUDENT",
    academicId: "S2",
    avatarUrl: null,
    bio: null,
    accountStatus: "ACTIVE",
    isEmailVerified: true,
    settings: { profileVisibility: "TEAM_ONLY" },
  };

  let restore = patchPrismaForSearch({
    teamMembers: [teamOnlyUser],
    users: [teamOnlyUser],
  });

  try {
    const visibleResults = await searchChatUsersService({ id: "student-actor", role: "STUDENT" }, "alex");
    assert.equal(visibleResults.length, 1);
    assert.equal(visibleResults[0].user.id, teamOnlyUser.id);
  } finally {
    restore();
  }

  restore = patchPrismaForSearch({
    teamMembers: [],
    users: [teamOnlyUser],
  });

  try {
    const hiddenResults = await searchChatUsersService({ id: "student-actor", role: "STUDENT" }, "alex");
    assert.deepEqual(hiddenResults, []);
  } finally {
    restore();
  }
});

test("searchChatUsersService shows support accounts to students", async () => {
  const supportUser = {
    id: "support-1",
    firstName: "Sam",
    lastName: "Support",
    email: "support@example.com",
    role: "SUPPORT",
    academicId: "SUPPORT-1",
    avatarUrl: null,
    bio: null,
    accountStatus: "ACTIVE",
    isEmailVerified: true,
    settings: { profileVisibility: "PRIVATE" },
  };
  const restore = patchPrismaForSearch({
    teamMembers: [],
    users: [supportUser],
  });

  try {
    const results = await searchChatUsersService({ id: "student-actor", role: "STUDENT" }, "support");
    assert.equal(results.length, 1);
    assert.equal(results[0].user.id, supportUser.id);
    assert.equal(results[0].relation, "SUPPORT_DIRECT");
  } finally {
    restore();
  }
});

test("searchChatUsersService shows admins to supervisors", async () => {
  const adminUser = {
    id: "admin-1",
    firstName: "Alex",
    lastName: "Admin",
    email: "alex.admin@example.com",
    role: "ADMIN",
    academicId: "A1",
    avatarUrl: null,
    bio: null,
    accountStatus: "ACTIVE",
    isEmailVerified: true,
    settings: { profileVisibility: "PUBLIC" },
  };
  const restore = patchPrismaForSearch({
    teams: [],
    users: [adminUser],
  });

  try {
    const results = await searchChatUsersService({ id: "doctor-actor", role: "DOCTOR" }, "admin");
    assert.equal(results.length, 1);
    assert.equal(results[0].user.id, adminUser.id);
    assert.equal(results[0].relation, "ADMIN_DIRECT");
  } finally {
    restore();
  }
});

test("searchChatUsersService lets admins discover active users", async () => {
  const studentUser = {
    id: "student-1",
    firstName: "Alex",
    lastName: "Student",
    email: "alex.student@example.com",
    role: "STUDENT",
    academicId: "S1",
    avatarUrl: null,
    bio: null,
    accountStatus: "ACTIVE",
    isEmailVerified: true,
    settings: { profileVisibility: "PUBLIC" },
  };
  const restore = patchPrismaForSearch({
    users: [studentUser],
  });

  try {
    const results = await searchChatUsersService({ id: "admin-actor", role: "ADMIN" }, "alex");
    assert.equal(results.length, 1);
    assert.equal(results[0].user.id, studentUser.id);
    assert.equal(results[0].relation, "ADMIN_DIRECT");
  } finally {
    restore();
  }
});

test("searchChatUsersService lets support discover active users", async () => {
  const studentUser = {
    id: "student-1",
    firstName: "Alex",
    lastName: "Student",
    email: "alex.student@example.com",
    role: "STUDENT",
    academicId: "S1",
    avatarUrl: null,
    bio: null,
    accountStatus: "ACTIVE",
    isEmailVerified: true,
    settings: { profileVisibility: "PRIVATE" },
  };
  const restore = patchPrismaForSearch({
    users: [studentUser],
  });

  try {
    const results = await searchChatUsersService({ id: "support-actor", role: "SUPPORT" }, "alex");
    assert.equal(results.length, 1);
    assert.equal(results[0].user.id, studentUser.id);
    assert.equal(results[0].relation, "SUPPORT_DIRECT");
  } finally {
    restore();
  }
});

test("sendChatMessageService prevents students from replying to admins", async () => {
  const restore = patchPrismaForForbiddenSend({
    recipient: {
      id: "admin-1",
      firstName: "Alex",
      lastName: "Admin",
      email: "alex.admin@example.com",
      role: "ADMIN",
      academicId: "A1",
      avatarUrl: null,
      bio: null,
    },
  });

  try {
    await assert.rejects(
      () =>
        sendChatMessageService(
          { id: "student-actor", role: "STUDENT" },
          { recipientId: "admin-1", content: "Can I reply?" },
        ),
      (error) => {
        assert.equal(error.code, "CHAT_RECIPIENT_FORBIDDEN");
        assert.equal(error.statusCode, 403);
        return true;
      },
    );
  } finally {
    restore();
  }
});
