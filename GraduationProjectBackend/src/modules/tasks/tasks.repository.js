import { prisma } from "../../loaders/dbLoader.js";
import { teamUserSelect } from "../teams/teams.repository.js";

const taskTeamSelect = {
  id: true,
  name: true,
  leader: { select: teamUserSelect },
  doctor: { select: teamUserSelect },
  ta: { select: teamUserSelect },
  members: {
    orderBy: { joinedAt: "asc" },
    select: {
      id: true,
      joinedAt: true,
      user: { select: teamUserSelect },
    },
  },
  githubRepository: {
    select: {
      id: true,
      fullName: true,
      repoUrl: true,
      defaultBranch: true,
      connectionStatus: true,
    },
  },
};

export const taskEvidenceSelect = {
  id: true,
  taskId: true,
  teamId: true,
  type: true,
  title: true,
  url: true,
  fileName: true,
  fileSize: true,
  fileType: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
  uploadedByUserId: true,
  uploadedBy: { select: teamUserSelect },
};

export const taskSelect = {
  id: true,
  teamId: true,
  sprintId: true,
  taskType: true,
  integrationMode: true,
  origin: true,
  githubIssueId: true,
  githubIssueNumber: true,
  githubIssueUrl: true,
  githubIssueState: true,
  githubBranchName: true,
  githubPullRequestId: true,
  githubPullRequestNumber: true,
  githubPullRequestUrl: true,
  githubPullRequestState: true,
  githubPullRequestBase: true,
  githubPullRequestHead: true,
  githubPullRequestMergedAt: true,
  githubLatestCommitSha: true,
  githubLatestCommitUrl: true,
  githubCommitCount: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  storyPoints: true,
  actualPoints: true,
  unplanned: true,
  assigneeUserId: true,
  createdByUserId: true,
  reviewedByUserId: true,
  labels: true,
  startDate: true,
  dueDate: true,
  acceptedAt: true,
  submittedForReviewAt: true,
  reviewedAt: true,
  reviewFeedback: true,
  reviewComment: true,
  reviewDecision: true,
  reviewSnapshot: true,
  syncedFromGithub: true,
  lastSyncedAt: true,
  createdAt: true,
  updatedAt: true,
  assignee: { select: teamUserSelect },
  createdBy: { select: teamUserSelect },
  reviewedBy: { select: teamUserSelect },
  submissionEvidence: {
    select: {
      submittedAt: true,
    },
  },
  reviews: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      reviewerRole: true,
      decision: true,
      comment: true,
      createdAt: true,
      reviewer: { select: teamUserSelect },
    },
  },
  sprint: {
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      status: true,
    },
  },
  team: { select: taskTeamSelect },
};

function buildFullName(user) {
  return `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
}

export function toTaskEvidenceResponse(evidence) {
  return {
    id: evidence.id,
    taskId: evidence.taskId,
    teamId: evidence.teamId,
    type: evidence.type,
    title: evidence.title,
    url: evidence.url,
    fileName: evidence.fileName ?? null,
    fileSize: evidence.fileSize ?? null,
    fileType: evidence.fileType ?? null,
    submittedAt: evidence.submittedAt ? evidence.submittedAt.toISOString() : null,
    createdAt: evidence.createdAt ? evidence.createdAt.toISOString() : null,
    updatedAt: evidence.updatedAt ? evidence.updatedAt.toISOString() : null,
    uploadedBy: evidence.uploadedBy
      ? {
          ...evidence.uploadedBy,
          fullName: buildFullName(evidence.uploadedBy),
        }
      : null,
  };
}

export function listTasksByTeam(teamId, tx = prisma) {
  return tx.task.findMany({
    where: { teamId },
    orderBy: [{ createdAt: "desc" }],
    select: taskSelect,
  });
}

export function listTasksByTeamIds(teamIds, tx = prisma) {
  return tx.task.findMany({
    where: { teamId: { in: teamIds } },
    orderBy: [{ createdAt: "desc" }],
    select: taskSelect,
  });
}

export function listRepoBackedTasksByTeam(teamId, tx = prisma) {
  return tx.task.findMany({
    where: {
      teamId,
      integrationMode: "GITHUB",
    },
    orderBy: [{ updatedAt: "desc" }],
    select: taskSelect,
  });
}

export function findTaskById(id, tx = prisma) {
  return tx.task.findUnique({
    where: { id },
    select: taskSelect,
  });
}

export function findTaskByGitHubIssueNumber(teamId, githubIssueNumber, tx = prisma) {
  return tx.task.findUnique({
    where: {
      teamId_githubIssueNumber: {
        teamId,
        githubIssueNumber,
      },
    },
    select: taskSelect,
  });
}

export function findTaskByGitHubBranchName(teamId, githubBranchName, tx = prisma) {
  return tx.task.findFirst({
    where: {
      teamId,
      githubBranchName,
    },
    select: taskSelect,
  });
}

export function findTaskByGitHubPullRequestNumber(teamId, githubPullRequestNumber, tx = prisma) {
  return tx.task.findFirst({
    where: {
      teamId,
      githubPullRequestNumber,
    },
    select: taskSelect,
  });
}

export function createTask(data, tx = prisma) {
  return tx.task.create({
    data,
    select: taskSelect,
  });
}

export function updateTaskById(id, data, tx = prisma) {
  return tx.task.update({
    where: { id },
    data,
    select: taskSelect,
  });
}

export function listTaskEvidenceByTaskId(taskId, tx = prisma) {
  return tx.taskSubmissionEvidence
    .findMany({
      where: { taskId },
      orderBy: [{ submittedAt: "asc" }, { createdAt: "desc" }],
      select: taskEvidenceSelect,
    })
    .then((items) => items.map(toTaskEvidenceResponse));
}

export function countDraftTaskEvidence(taskId, tx = prisma) {
  return tx.taskSubmissionEvidence.count({
    where: {
      taskId,
      submittedAt: null,
    },
  });
}

export function createTaskEvidence(data, tx = prisma) {
  return tx.taskSubmissionEvidence
    .create({
      data,
      select: taskEvidenceSelect,
    })
    .then(toTaskEvidenceResponse);
}

export function findTaskEvidenceById(id, tx = prisma) {
  return tx.taskSubmissionEvidence
    .findUnique({
      where: { id },
      select: taskEvidenceSelect,
    })
    .then((item) => (item ? toTaskEvidenceResponse(item) : null));
}

export function deleteTaskEvidenceById(id, tx = prisma) {
  return tx.taskSubmissionEvidence
    .delete({
      where: { id },
      select: taskEvidenceSelect,
    })
    .then(toTaskEvidenceResponse);
}

export function submitTaskForReviewById(id, data, { lockManualEvidence = false, submittedAt = new Date() } = {}) {
  if (!lockManualEvidence) {
    return updateTaskById(id, data);
  }

  return prisma.$transaction(async (tx) => {
    await tx.taskSubmissionEvidence.updateMany({
      where: {
        taskId: id,
        submittedAt: null,
      },
      data: {
        submittedAt,
      },
    });

    return tx.task.update({
      where: { id },
      data,
      select: taskSelect,
    });
  });
}

export function expireOverdueTasksByTeam(teamId, now = new Date(), tx = prisma) {
  return tx.task.updateMany({
    where: {
      teamId,
      integrationMode: "MANUAL",
      origin: "GPMS",
      status: "IN_PROGRESS",
      dueDate: {
        lt: now,
      },
    },
    data: {
      status: "TODO",
      acceptedAt: null,
      submittedForReviewAt: null,
    },
  });
}

export function expireOverdueTasksByTeams(teamIds, now = new Date(), tx = prisma) {
  return tx.task.updateMany({
    where: {
      teamId: { in: teamIds },
      integrationMode: "MANUAL",
      origin: "GPMS",
      status: "IN_PROGRESS",
      dueDate: {
        lt: now,
      },
    },
    data: {
      status: "TODO",
      acceptedAt: null,
      submittedForReviewAt: null,
    },
  });
}

/* ── TaskReview helpers ─────────────────────────────────────────────────── */

const taskReviewSelect = {
  id: true,
  taskId: true,
  reviewerRole: true,
  decision: true,
  comment: true,
  snapshot: true,
  createdAt: true,
  reviewer: { select: teamUserSelect },
};

export function toTaskReviewResponse(review) {
  return {
    id: review.id,
    taskId: review.taskId,
    reviewerRole: review.reviewerRole,
    decision: review.decision,
    comment: review.comment ?? null,
    snapshot: review.snapshot ?? null,
    createdAt: review.createdAt ? review.createdAt.toISOString() : null,
    reviewer: review.reviewer
      ? {
          ...review.reviewer,
          fullName: buildFullName(review.reviewer),
        }
      : null,
  };
}

export function createTaskReview(data, tx = prisma) {
  return tx.taskReview.create({
    data,
    select: taskReviewSelect,
  });
}

export function listTaskReviewsByTaskId(taskId, tx = prisma) {
  return tx.taskReview.findMany({
    where: { taskId },
    orderBy: { createdAt: "desc" },
    select: taskReviewSelect,
  });
}
