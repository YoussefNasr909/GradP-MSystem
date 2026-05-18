import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const shouldSkip = !testDatabaseUrl || testDatabaseUrl === process.env.DATABASE_URL;

test(
  "gamification outbox is idempotent against an isolated test database",
  { skip: shouldSkip },
  async () => {
    const prisma = new PrismaClient({
      datasources: {
        db: { url: testDatabaseUrl },
      },
    });
    const idempotencyKey = `integration:TASK_APPROVED:${Date.now()}`;

    try {
      const first = await prisma.gamificationEvent.upsert({
        where: { idempotencyKey },
        update: {},
        create: {
          eventType: "TASK_APPROVED",
          sourceType: "Task",
          sourceId: `integration-task-${Date.now()}`,
          idempotencyKey,
          status: "PENDING",
          payload: { integrationTest: true },
        },
      });
      const second = await prisma.gamificationEvent.upsert({
        where: { idempotencyKey },
        update: {},
        create: {
          eventType: "TASK_APPROVED",
          sourceType: "Task",
          sourceId: "should-not-be-created",
          idempotencyKey,
          status: "PENDING",
        },
      });

      assert.equal(second.id, first.id);
      assert.equal(second.sourceId, first.sourceId);
    } finally {
      await prisma.gamificationEvent.deleteMany({ where: { idempotencyKey } });
      await prisma.$disconnect();
    }
  },
);
