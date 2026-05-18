import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function buildGamificationIdempotencyKey(...parts) {
  return parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(":");
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function toIso(value) {
  return value?.toISOString?.() ?? null;
}

async function eventExists(tx, { eventType, sourceType, sourceId }) {
  const existing = await tx.gamificationEvent.findFirst({
    where: { eventType, sourceType, sourceId },
    select: { id: true },
  });
  return Boolean(existing);
}

async function createEventIfMissing(tx, event) {
  if (await eventExists(tx, event)) {
    return { created: false, skippedReason: "existing-event" };
  }

  await tx.gamificationEvent.upsert({
    where: { idempotencyKey: event.idempotencyKey },
    update: {},
    create: {
      eventType: event.eventType,
      sourceType: event.sourceType,
      sourceId: event.sourceId,
      teamId: event.teamId ?? null,
      actorUserId: event.actorUserId ?? null,
      payload: event.payload ?? null,
      idempotencyKey: event.idempotencyKey,
      status: "PENDING",
      occurredAt: event.occurredAt ?? new Date(),
    },
  });

  return { created: true };
}

export function buildTaskApprovedEvent(task) {
  const occurredAt = task.reviewedAt ?? task.updatedAt ?? task.createdAt;
  return {
    eventType: "TASK_APPROVED",
    sourceType: "Task",
    sourceId: task.id,
    teamId: task.teamId,
    actorUserId: task.reviewedByUserId,
    occurredAt,
    idempotencyKey: buildGamificationIdempotencyKey("TASK_APPROVED", "Task", task.id, toIso(occurredAt)),
    payload: {
      taskType: task.taskType,
      assigneeUserId: task.assigneeUserId,
      approvedByUserId: task.reviewedByUserId,
      reviewerRole: null,
      integrationMode: task.integrationMode,
      priority: task.priority,
      storyPoints: Number(task.storyPoints ?? 0),
      actualPoints: task.actualPoints ?? null,
      createdAt: toIso(task.createdAt),
      acceptedAt: toIso(task.acceptedAt),
      submittedForReviewAt: toIso(task.submittedForReviewAt),
      reviewedAt: toIso(task.reviewedAt),
      timeliness: task.dueDate && task.submittedForReviewAt && task.submittedForReviewAt > task.dueDate ? "late" : "onTime",
      evidenceLevel: task.integrationMode === "GITHUB" ? "githubLinked" : "manualEvidence",
      merged: Boolean(task.githubPullRequestMergedAt),
    },
  };
}

export function buildSubmissionApprovedEvent(submission) {
  const occurredAt = submission.reviewedAt ?? submission.updatedAt ?? submission.createdAt;
  return {
    eventType: "SUBMISSION_APPROVED",
    sourceType: "Submission",
    sourceId: submission.id,
    teamId: submission.teamId,
    actorUserId: submission.reviewedByUserId,
    occurredAt,
    idempotencyKey: buildGamificationIdempotencyKey(
      "SUBMISSION_APPROVED",
      "Submission",
      submission.id,
      `v${submission.version ?? 1}`,
    ),
    payload: {
      deliverableType: submission.deliverableType,
      sdlcPhase: submission.sdlcPhase,
      grade: submission.grade,
      version: submission.version ?? 1,
      submittedByUserId: submission.submittedByUserId,
      backfilled: true,
    },
  };
}

export function buildReleaseCreatedEvent(submission) {
  const repository = submission.team?.githubRepository;
  if (!repository || !submission.githubReleaseId) return null;

  const occurredAt = submission.submittedAt ?? submission.createdAt;
  return {
    eventType: "GITHUB_RELEASE_CREATED",
    sourceType: "GitHubTeamRepository",
    sourceId: `${repository.id}:release:${submission.githubReleaseId}`,
    teamId: submission.teamId,
    actorUserId: submission.team?.leaderId ?? submission.submittedByUserId ?? null,
    occurredAt,
    idempotencyKey: buildGamificationIdempotencyKey(
      "GITHUB_RELEASE_CREATED",
      "GitHubTeamRepository",
      repository.id,
      `release:${submission.githubReleaseId}`,
    ),
    payload: {
      releaseId: submission.githubReleaseId,
      tagName: submission.githubReleaseTag,
      repositoryId: repository.id,
      teamId: submission.teamId,
      requireSubmissionOrMilestone: true,
      submissionId: submission.id,
      backfilled: true,
    },
  };
}

export async function buildHistoricalGamificationEvents(client = prisma) {
  const [tasks, submissions, releaseSubmissions] = await Promise.all([
    client.task.findMany({
      where: {
        status: { in: ["APPROVED", "DONE"] },
        reviewedAt: { not: null },
        reviewDecision: "APPROVED",
      },
      select: {
        id: true,
        teamId: true,
        taskType: true,
        integrationMode: true,
        priority: true,
        storyPoints: true,
        actualPoints: true,
        assigneeUserId: true,
        reviewedByUserId: true,
        createdAt: true,
        acceptedAt: true,
        submittedForReviewAt: true,
        reviewedAt: true,
        dueDate: true,
        updatedAt: true,
        githubPullRequestMergedAt: true,
      },
    }),
    client.submission.findMany({
      where: {
        status: "APPROVED",
        reviewedAt: { not: null },
        grade: { not: null },
      },
      select: {
        id: true,
        teamId: true,
        deliverableType: true,
        sdlcPhase: true,
        grade: true,
        version: true,
        submittedByUserId: true,
        reviewedByUserId: true,
        reviewedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    client.submission.findMany({
      where: {
        githubReleaseId: { not: null },
      },
      select: {
        id: true,
        teamId: true,
        submittedByUserId: true,
        submittedAt: true,
        createdAt: true,
        githubReleaseId: true,
        githubReleaseTag: true,
        team: {
          select: {
            leaderId: true,
            githubRepository: { select: { id: true } },
          },
        },
      },
    }),
  ]);

  return [
    ...tasks.map(buildTaskApprovedEvent),
    ...submissions.map(buildSubmissionApprovedEvent),
    ...releaseSubmissions.map(buildReleaseCreatedEvent).filter(Boolean),
  ];
}

export async function backfillGamificationEvents({ write = false } = {}) {
  const events = await buildHistoricalGamificationEvents(prisma);
  const summary = {
    candidates: events.length,
    created: 0,
    skipped: 0,
    dryRun: !write,
  };

  if (!write) return summary;

  await prisma.$transaction(async (tx) => {
    for (const event of events) {
      const result = await createEventIfMissing(tx, event);
      if (result.created) {
        summary.created += 1;
      } else {
        summary.skipped += 1;
      }
    }
  });

  return summary;
}

async function main() {
  try {
    const write = hasFlag("--write");
    const summary = await backfillGamificationEvents({ write });
    console.log(JSON.stringify(summary, null, 2));
    if (!write) {
      console.log("Dry run only. Re-run with --write to create missing PENDING events.");
    }
  } catch (error) {
    console.error("Failed to backfill gamification events:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
