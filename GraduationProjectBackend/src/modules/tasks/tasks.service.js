import { AppError } from "../../common/errors/AppError.js";
import {
  buildGamificationIdempotencyKey,
  emitGamificationEvent,
} from "../gamification/gamification.emitter.js";
import { ROLES } from "../../common/constants/roles.js";
import { findTeamById, findTeamByLeaderId, findTeamMemberByUserId, listTeams } from "../teams/teams.repository.js";
import {
  bootstrapTaskGitHubArtifactsService,
  mergeTaskPullRequestService,
  openTaskGitHubPullRequestService,
  resyncTaskGitHubStateService,
  reviewTaskPullRequestService,
} from "../github/github.service.js";
import {
  createTask,
  countDraftTaskEvidence,
  createTaskEvidence,
  createTaskReview,
  deleteTaskEvidenceById,
  expireOverdueTasksByTeams,
  expireOverdueTasksByTeam,
  findTaskEvidenceById,
  findTaskById,
  listTaskEvidenceByTaskId,
  listTaskReviewsByTaskId,
  listTasksByTeam,
  listTasksByTeamIds,
  submitTaskForReviewById,
  toTaskReviewResponse,
  updateTaskById,
} from "./tasks.repository.js";
import { notify } from "../../common/utils/notify.js";

const VISIBLE_STATUS_ORDER = {
  TODO: 0,
  IN_PROGRESS: 1,
  REVIEW: 2,
  APPROVED: 3,
  DONE: 4,
};

const DEFAULT_GITHUB_TASK_TYPES = new Set(["CODE", "DOCUMENTATION", "DESIGN"]);

function normalizeText(value) {
  return String(value ?? "").trim();
}

function buildFullName(user) {
  return `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
}

function slugifyBranchSegment(value) {
  const normalized = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "task";
}

function encodeGitHubRef(value) {
  return normalizeText(value)
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function defaultIntegrationModeForTaskType(taskType = "OTHER") {
  return DEFAULT_GITHUB_TASK_TYPES.has(taskType) ? "GITHUB" : "MANUAL";
}

function parseDateBoundary(value, boundary = "start") {
  const normalized = normalizeText(value);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    throw new AppError("Use the date format YYYY-MM-DD.", 422, "INVALID_TASK_DATE");
  }

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);

  const date =
    boundary === "end"
      ? new Date(year, month - 1, day, 23, 59, 59, 999)
      : new Date(year, month - 1, day, 0, 0, 0, 0);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new AppError("Please provide a valid calendar date.", 422, "INVALID_TASK_DATE");
  }

  return date;
}

function normalizeStoryPoints(value, fallback = 3) {
  if (value === undefined || value === null || value === "") return fallback;
  const points = Number(value);

  if (!Number.isInteger(points) || points < 0 || points > 99) {
    throw new AppError("Story points must be a whole number between 0 and 99.", 422, "TASK_STORY_POINTS_INVALID");
  }

  return points;
}

function toTaskUserSummary(user) {
  if (!user) return null;

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: buildFullName(user),
    email: user.email,
    role: user.role,
    academicId: user.academicId ?? null,
    department: user.department ?? null,
    academicYear: user.academicYear ?? null,
    preferredTrack: user.preferredTrack ?? null,
    avatarUrl: user.avatarUrl ?? null,
    bio: user.bio ?? null,
    linkedinUrl: user.linkedinUrl ?? null,
    githubUsername: user.githubUsername ?? null,
    isEmailVerified: Boolean(user.isEmailVerified),
    accountStatus: user.accountStatus,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function normalizeVisibleStatus(status) {
  return status === "BACKLOG" ? "TODO" : status;
}

function isGpmsManagedTask(task) {
  return task.origin === "GPMS";
}

function isImportedGitHubTask(task) {
  return task.origin === "GITHUB_IMPORT";
}

function isRepoBackedTask(task) {
  return task.integrationMode === "GITHUB";
}

function isManualTask(task) {
  return !isRepoBackedTask(task);
}

function isTaskOverdue(task, now = new Date()) {
  return isGpmsManagedTask(task) && isManualTask(task) && task.status === "IN_PROGRESS" && task.dueDate && task.dueDate.getTime() < now.getTime();
}

function canManageTaskTeam(actor, team) {
  return actor.role === ROLES.ADMIN || team?.leader?.id === actor.id;
}

/**
 * Returns { canReview, reviewerRole } for the actor against the given team.
 *
 * Both the team's TA and the team's Leader can review tasks. Admin can too.
 * The leader is allowed to review tasks even when assigned to themselves —
 * "either approval moves the task forward" is the workflow, so we don't gate
 * self-review here.
 *
 * `reviewerRole` is the label we'll record on the TaskReview row (LEADER / TA /
 * ADMIN). When the same user holds multiple roles (e.g. admin is also leader),
 * we prefer the most specific team-level role.
 */
export function canReviewTaskTeam(actor, team) {
  if (!actor || !team) return { canReview: false, reviewerRole: null };
  if (team.leader?.id === actor.id) return { canReview: true, reviewerRole: "LEADER" };
  if (team.ta?.id === actor.id) return { canReview: true, reviewerRole: "TA" };
  if (actor.role === ROLES.ADMIN) return { canReview: true, reviewerRole: "ADMIN" };
  return { canReview: false, reviewerRole: null };
}

function canViewTaskTeam(actor, team) {
  if (!team) return false;
  if (canManageTaskTeam(actor, team)) return true;
  if (team.doctor?.id === actor.id || team.ta?.id === actor.id) return true;
  return team.members.some((member) => member.user.id === actor.id);
}

function canWriteRepoBackedTask(actor, task) {
  if (!isRepoBackedTask(task) || !isGpmsManagedTask(task)) return false;
  if (canManageTaskTeam(actor, task.team)) return true;
  return task.assigneeUserId === actor.id && actor.role === ROLES.STUDENT;
}

function getTeamRoster(team) {
  if (!team) return [];

  return [
    {
      id: team.leader.id,
      teamRole: "LEADER",
      user: team.leader,
    },
    ...team.members.map((member) => ({
      id: member.user.id,
      teamRole: "MEMBER",
      user: member.user,
    })),
  ];
}

function assertTaskExists(task) {
  if (!task) {
    throw new AppError("Task not found.", 404, "TASK_NOT_FOUND");
  }
}

function assertGpmsManagedTask(task) {
  if (!isGpmsManagedTask(task)) {
    throw new AppError(
      "Tasks imported from GitHub are read-only in GPMS. Update them from the GitHub workspace instead.",
      409,
      "TASK_MANAGED_BY_GITHUB_IMPORT",
    );
  }
}

function assertTaskAssignee(task, actor) {
  if (!task.assigneeUserId || task.assigneeUserId !== actor.id) {
    throw new AppError("Only the assigned member can perform this action.", 403, "TASK_ASSIGNEE_ONLY");
  }
}

function assertTaskManager(task, actor) {
  if (!canManageTaskTeam(actor, task.team)) {
    throw new AppError("Only the team leader or an admin can manage this task workflow.", 403, "TASK_MANAGER_ONLY");
  }
}

export function assertTaskReviewer(task, actor) {
  const { canReview, reviewerRole } = canReviewTaskTeam(actor, task?.team);
  if (!canReview) {
    throw new AppError("Only an assigned reviewer can review this task.", 403, "TASK_REVIEWER_ONLY");
  }
  return reviewerRole;
}

function assertActorCanViewTask(task, actor) {
  if (!canViewTaskTeam(actor, task.team)) {
    throw new AppError("You are not allowed to access this task.", 403, "TASK_VIEW_FORBIDDEN");
  }
}

function assertAssigneeBelongsToTeam(team, assigneeUserId) {
  const assignee = getTeamRoster(team).find((entry) => entry.user.id === assigneeUserId)?.user;
  if (!assignee) {
    throw new AppError("Choose a member from your current team.", 422, "TASK_ASSIGNEE_NOT_IN_TEAM");
  }

  return assignee;
}

async function resolveActorTeamContext(actor, requestedTeamId) {
  const normalizedRequestedTeamId = normalizeText(requestedTeamId) || null;

  if (actor.role === ROLES.ADMIN) {
    if (!normalizedRequestedTeamId) {
      throw new AppError("Admins must provide a teamId to access tasks.", 422, "TASK_TEAM_ID_REQUIRED");
    }

    const team = await findTeamById(normalizedRequestedTeamId);
    if (!team) {
      throw new AppError("Team not found.", 404, "TEAM_NOT_FOUND");
    }

    return { team, teamRole: "ADMIN" };
  }

  if (actor.role === ROLES.LEADER) {
    const team = await findTeamByLeaderId(actor.id);
    if (!team) {
      throw new AppError("Create a team first before managing tasks.", 409, "TEAM_REQUIRED");
    }

    if (normalizedRequestedTeamId && normalizedRequestedTeamId !== team.id) {
      throw new AppError("You can only access tasks for your own team.", 403, "TASK_TEAM_FORBIDDEN");
    }

    return { team, teamRole: "LEADER" };
  }

  if (actor.role === ROLES.STUDENT) {
    const membership = await findTeamMemberByUserId(actor.id);
    if (!membership?.team) {
      throw new AppError("Join a team first before accessing tasks.", 409, "TEAM_REQUIRED");
    }

    if (normalizedRequestedTeamId && normalizedRequestedTeamId !== membership.team.id) {
      throw new AppError("You can only access tasks for your own team.", 403, "TASK_TEAM_FORBIDDEN");
    }

    return { team: membership.team, teamRole: "MEMBER" };
  }

  if (actor.role === ROLES.DOCTOR || actor.role === ROLES.TA) {
    if (!normalizedRequestedTeamId) {
      throw new AppError("Provide a teamId to load tasks for this team.", 422, "TASK_TEAM_ID_REQUIRED");
    }

    const team = await findTeamById(normalizedRequestedTeamId);
    if (!team) {
      throw new AppError("Team not found.", 404, "TEAM_NOT_FOUND");
    }

    if (team.doctor?.id !== actor.id && team.ta?.id !== actor.id) {
      throw new AppError("You are not assigned to this team.", 403, "TASK_TEAM_FORBIDDEN");
    }

    return { team, teamRole: actor.role };
  }

  throw new AppError("This role is not supported for task access.", 403, "TASK_ROLE_UNSUPPORTED");
}

async function resolveActorTaskListTeamIds(actor, requestedTeamId) {
  const normalizedRequestedTeamId = normalizeText(requestedTeamId) || null;

  if (normalizedRequestedTeamId) {
    const { team } = await resolveActorTeamContext(actor, normalizedRequestedTeamId);
    return [team.id];
  }

  if (actor.role === ROLES.DOCTOR || actor.role === ROLES.TA || actor.role === ROLES.ADMIN) {
    const teams = await listTeams(
      actor.role === ROLES.DOCTOR
        ? { doctorId: actor.id }
        : actor.role === ROLES.TA
          ? { taId: actor.id }
          : {},
    );
    return teams.map((team) => team.id);
  }

  const { team } = await resolveActorTeamContext(actor, normalizedRequestedTeamId);
  return [team.id];
}

function compareTasks(left, right) {
  const leftStatus = VISIBLE_STATUS_ORDER[normalizeVisibleStatus(left.status)] ?? 99;
  const rightStatus = VISIBLE_STATUS_ORDER[normalizeVisibleStatus(right.status)] ?? 99;

  if (leftStatus !== rightStatus) {
    return leftStatus - rightStatus;
  }

  const leftEnd = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
  const rightEnd = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER;

  if (leftEnd !== rightEnd) {
    return leftEnd - rightEnd;
  }

  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

function buildGitHubReviewGate(task) {
  if (!isRepoBackedTask(task)) return null;

  const hasIssue = Boolean(task.githubIssueNumber && task.githubIssueUrl);
  const hasBranch = Boolean(normalizeText(task.githubBranchName));
  const hasOpenPullRequest = Boolean(task.githubPullRequestNumber && normalizeText(task.githubPullRequestState).toLowerCase() === "open");
  const hasCommits = Number(task.githubCommitCount ?? 0) > 0;
  const missing = [];

  if (!hasIssue) missing.push("linked_issue");
  if (!hasBranch) missing.push("linked_branch");
  if (!hasOpenPullRequest) missing.push("open_pull_request");
  if (!hasCommits) missing.push("branch_commits");

  return {
    ready: missing.length === 0,
    hasIssue,
    hasBranch,
    hasOpenPullRequest,
    hasCommits,
    missing,
  };
}

function buildGitHubState(task) {
  if (!isRepoBackedTask(task)) return null;

  const repository = task.team?.githubRepository ?? null;
  const repoUrl = repository?.repoUrl ?? null;
  const branchName = normalizeText(task.githubBranchName || task.githubPullRequestHead);
  const defaultBranch = normalizeText(task.githubPullRequestBase || repository?.defaultBranch);
  const branchUrl = repoUrl && branchName ? `${repoUrl}/tree/${encodeGitHubRef(branchName)}` : null;
  const compareUrl = repoUrl && branchName && defaultBranch
    ? `${repoUrl}/compare/${encodeGitHubRef(defaultBranch)}...${encodeGitHubRef(branchName)}`
    : null;
  const reviewGate = buildGitHubReviewGate(task);

  return {
    repository: repository
      ? {
          id: repository.id,
          fullName: repository.fullName,
          repoUrl: repository.repoUrl,
          defaultBranch: repository.defaultBranch,
          connectionStatus: repository.connectionStatus,
        }
      : null,
    issue: {
      id: task.githubIssueId ?? null,
      number: task.githubIssueNumber ?? null,
      url: task.githubIssueUrl ?? null,
      state: task.githubIssueState ?? null,
    },
    branch: {
      name: branchName || null,
      url: branchUrl,
      compareUrl,
      suggestedName:
        task.githubIssueNumber && !branchName
          ? `task/${task.githubIssueNumber}-${slugifyBranchSegment(task.title)}`
          : null,
    },
    pullRequest: {
      id: task.githubPullRequestId ?? null,
      number: task.githubPullRequestNumber ?? null,
      url: task.githubPullRequestUrl ?? null,
      state: task.githubPullRequestState ?? null,
      base: task.githubPullRequestBase ?? null,
      head: task.githubPullRequestHead ?? null,
      mergedAt: task.githubPullRequestMergedAt ?? null,
    },
    latestCommit: {
      sha: task.githubLatestCommitSha ?? null,
      shortSha: task.githubLatestCommitSha ? task.githubLatestCommitSha.slice(0, 7) : null,
      url: task.githubLatestCommitUrl ?? null,
    },
    commitCount: Number(task.githubCommitCount ?? 0),
    lastSyncedAt: task.lastSyncedAt ?? null,
    reviewGate,
  };
}

export function buildManualReviewGate(task) {
  if (!isManualTask(task)) return null;

  const evidence = Array.isArray(task.submissionEvidence) ? task.submissionEvidence : [];
  const draftEvidenceCount = evidence.filter((item) => !item.submittedAt).length;
  const submittedEvidenceCount = evidence.filter((item) => item.submittedAt).length;
  const missing = draftEvidenceCount > 0 ? [] : ["manual_evidence"];

  return {
    ready: missing.length === 0,
    draftEvidenceCount,
    submittedEvidenceCount,
    missing,
  };
}

function toTaskResponse(task, actor) {
  const visibleStatus = normalizeVisibleStatus(task.status);
  const isAwaitingAcceptance = isGpmsManagedTask(task) && visibleStatus === "TODO" && !task.acceptedAt;
  const isAssignee = task.assigneeUserId === actor.id;
  const canManage = canManageTaskTeam(actor, task.team);
  const { canReview, reviewerRole: actorReviewerRole } = canReviewTaskTeam(actor, task.team);
  const hasPastEndDate = Boolean(task.dueDate) && new Date(task.dueDate).getTime() < Date.now();
  const github = buildGitHubState(task);
  const reviewGate = github?.reviewGate ?? null;
  const manualReviewGate = buildManualReviewGate(task);
  const canRejectGitHubApprovedTask = isRepoBackedTask(task) && visibleStatus === "APPROVED" && !task.githubPullRequestMergedAt;

  return {
    id: task.id,
    team: {
      id: task.team.id,
      name: task.team.name,
    },
    taskType: task.taskType,
    integrationMode: task.integrationMode,
    origin: task.origin,
    title: task.title,
    description: task.description ?? "",
    status: visibleStatus,
    rawStatus: task.status,
    priority: task.priority,
    sprintId: task.sprintId ?? null,
    storyPoints: Number(task.storyPoints ?? 0),
    actualPoints: task.actualPoints ?? null,
    unplanned: Boolean(task.unplanned),
    startDate: task.startDate ?? null,
    endDate: task.dueDate ?? null,
    acceptedAt: task.acceptedAt ?? null,
    submittedForReviewAt: task.submittedForReviewAt ?? null,
    reviewedAt: task.reviewedAt ?? null,
    reviewFeedback: task.reviewComment ?? task.reviewFeedback ?? null,
    reviewComment: task.reviewComment ?? null,
    reviewDecision: task.reviewDecision ?? null,
    reviewSnapshot: task.reviewSnapshot ?? null,
    syncedFromGithub: Boolean(task.syncedFromGithub),
    githubIssueNumber: task.githubIssueNumber ?? null,
    githubIssueUrl: task.githubIssueUrl ?? null,
    labels: task.labels ?? [],
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    assignee: toTaskUserSummary(task.assignee),
    createdBy: toTaskUserSummary(task.createdBy),
    reviewedBy: toTaskUserSummary(task.reviewedBy),
    awaitingAcceptance: isAwaitingAcceptance,
    isPastEndDate: hasPastEndDate,
    github,
    manualReviewGate,
    actorReviewerRole,
    reviews: Array.isArray(task.reviews)
      ? task.reviews.map((review) => ({
          id: review.id,
          reviewerRole: review.reviewerRole,
          decision: review.decision,
          comment: review.comment ?? null,
          createdAt: review.createdAt ? review.createdAt.toISOString() : null,
          reviewer: toTaskUserSummary(review.reviewer),
        }))
      : [],
    permissions: {
      canAccept: isGpmsManagedTask(task) && isAssignee && task.status === "TODO" && !task.acceptedAt && !hasPastEndDate,
      canSubmitForReview:
        isGpmsManagedTask(task) &&
        isAssignee &&
        task.status === "IN_PROGRESS" &&
        (isRepoBackedTask(task) ? Boolean(reviewGate?.ready) : Boolean(manualReviewGate?.ready)),
      // canApprove: primary review while in REVIEW, OR supplementary review on
      // an already-approved/done task. Supplementary path lets the second
      // reviewer (leader or TA) leave their own review after the first
      // approval closed the task.
      canApprove:
        isGpmsManagedTask(task) &&
        canReview &&
        (task.status === "REVIEW" || task.status === "DONE" || (task.status === "APPROVED" && isRepoBackedTask(task))),
      canReject:
        isGpmsManagedTask(task) &&
        canReview &&
        (task.status === "REVIEW" || canRejectGitHubApprovedTask || task.status === "DONE" || task.status === "APPROVED"),
      canEdit: isGpmsManagedTask(task) && canManage,
      canBootstrapGithub: canWriteRepoBackedTask(actor, task) && !task.githubIssueNumber,
      canOpenPullRequest:
        canWriteRepoBackedTask(actor, task) &&
        Boolean(normalizeText(task.githubBranchName)) &&
        !task.githubPullRequestNumber,
      canResyncGithub: isRepoBackedTask(task) && canViewTaskTeam(actor, task.team),
    },
  };
}

async function refreshTaskWorkflowState(task) {
  if (!task || !isTaskOverdue(task)) {
    return task;
  }

  const updated = await updateTaskById(task.id, {
    status: "TODO",
    acceptedAt: null,
    submittedForReviewAt: null,
    reviewedAt: null,
    reviewedByUserId: null,
    reviewFeedback: null,
    reviewComment: null,
    reviewDecision: null,
    reviewSnapshot: null,
  });

  return updated;
}

function buildUpdatedDateRange(task, payload) {
  const nextStartDate = payload.startDate !== undefined ? parseDateBoundary(payload.startDate, "start") : task.startDate;
  const nextEndDate = payload.endDate !== undefined ? parseDateBoundary(payload.endDate, "end") : task.dueDate;

  if (nextStartDate && nextEndDate && nextEndDate.getTime() < nextStartDate.getTime()) {
    throw new AppError("End date must be on or after the start date.", 422, "TASK_DATE_RANGE_INVALID");
  }

  return {
    nextStartDate,
    nextEndDate,
  };
}

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function formatScheduleDate(value) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function assertTaskDatesFitAssignedSprint(task, nextStartDate, nextEndDate) {
  if (!task.sprintId || !task.sprint) return;

  if (!nextStartDate || !nextEndDate) {
    throw new AppError(
      `"${task.title}" needs both a start date and an end date while it is assigned to "${task.sprint.name}".`,
      422,
      "TASK_SPRINT_DATES_REQUIRED"
    );
  }

  const taskStart = startOfDay(nextStartDate);
  const taskEnd = endOfDay(nextEndDate);
  const sprintStart = startOfDay(task.sprint.startDate);
  const sprintEnd = endOfDay(task.sprint.endDate);

  if (taskStart.getTime() < sprintStart.getTime()) {
    throw new AppError(
      `"${task.title}" starts on ${formatScheduleDate(taskStart)}, before "${task.sprint.name}" starts on ${formatScheduleDate(sprintStart)}.`,
      422,
      "TASK_START_BEFORE_SPRINT"
    );
  }

  if (taskEnd.getTime() > sprintEnd.getTime()) {
    throw new AppError(
      `"${task.title}" ends on ${formatScheduleDate(taskEnd)}, after "${task.sprint.name}" ends on ${formatScheduleDate(sprintEnd)}.`,
      422,
      "TASK_END_AFTER_SPRINT"
    );
  }
}

function buildReviewSnapshot(task, actor, overrides = {}) {
  return {
    actorId: actor.id,
    actorRole: actor.role,
    reviewedAt: new Date().toISOString(),
    taskStatus: task.status,
    githubIssueNumber: task.githubIssueNumber ?? null,
    githubPullRequestNumber: task.githubPullRequestNumber ?? null,
    githubPullRequestState: task.githubPullRequestState ?? null,
    githubCommitCount: Number(task.githubCommitCount ?? 0),
    ...overrides,
  };
}

function computeTaskTimelinessTier(task, completedAt = new Date()) {
  if (!task?.dueDate) return "onTime";

  const due = new Date(task.dueDate);
  const completed = new Date(completedAt);
  const lateMs = completed.getTime() - due.getTime();
  if (lateMs <= 0) return "onTime";

  const hoursLate = lateMs / (1000 * 60 * 60);
  if (hoursLate <= 24) return "lt24h";
  if (hoursLate <= 72) return "lt3d";
  if (hoursLate <= 168) return "lt7d";
  return "gt7d";
}

function computeTaskEvidenceLevel(task, merged) {
  if (task?.integrationMode === "GITHUB") {
    if (merged || task?.githubPullRequestNumber || task?.githubPullRequestUrl) {
      return "repoBackedWithPR";
    }
    return "repoBackedNoPR";
  }

  return "manual";
}

export function shouldMergeApprovedTaskPullRequest(payload = {}) {
  return payload.mergePullRequest === true;
}

export const RESUBMISSION_COMMENT_MIN_LENGTH = 10;

/**
 * Last gate before a reviewer's text hits the DB. Throws 422 with one of:
 *   - TASK_REVIEW_COMMENT_REQUIRED  (empty / whitespace / non-string)
 *   - TASK_REVIEW_COMMENT_TOO_SHORT (under RESUBMISSION_COMMENT_MIN_LENGTH)
 *
 * Defence in depth: Zod at the route layer enforces `string`. But if a non-
 * string somehow slips through (object → "[object Object]" coerces to a
 * 15-char string and would silently pass the length gate), we reject it
 * here as REQUIRED rather than treating it as valid feedback.
 */
export function assertReviewCommentMeetsMinimum(reviewComment) {
  if (reviewComment !== null && reviewComment !== undefined && typeof reviewComment !== "string") {
    throw new AppError("Add review comments before requesting changes.", 422, "TASK_REVIEW_COMMENT_REQUIRED");
  }
  const normalized = normalizeText(reviewComment);
  if (!normalized) {
    throw new AppError("Add review comments before requesting changes.", 422, "TASK_REVIEW_COMMENT_REQUIRED");
  }
  if (normalized.length < RESUBMISSION_COMMENT_MIN_LENGTH) {
    throw new AppError(
      `Review comment must be at least ${RESUBMISSION_COMMENT_MIN_LENGTH} characters so the student knows what to fix.`,
      422,
      "TASK_REVIEW_COMMENT_TOO_SHORT",
    );
  }
  return normalized;
}

export function buildTaskResubmissionUpdate(task, actor, reviewComment) {
  const normalizedReviewComment = assertReviewCommentMeetsMinimum(reviewComment);

  return {
    status: "TODO",
    acceptedAt: null,
    submittedForReviewAt: null,
    reviewedAt: new Date(),
    reviewedByUserId: actor.id,
    reviewFeedback: normalizedReviewComment,
    reviewComment: normalizedReviewComment,
    reviewDecision: "CHANGES_REQUESTED",
    reviewSnapshot: buildReviewSnapshot(task, actor, {
      requestedChanges: true,
    }),
  };
}

function buildMissingGitHubReviewEvidenceMessage(task) {
  const reviewGate = buildGitHubReviewGate(task);
  const messages = {
    linked_issue: "link the GitHub issue",
    linked_branch: "create the GitHub branch",
    open_pull_request: "open a pull request",
    branch_commits: "push at least one commit on the task branch",
  };
  const missing = reviewGate?.missing ?? [];
  const details = missing.map((item) => messages[item] ?? item);

  return `This repo-backed task cannot move to review yet. Please ${details.join(", ")} first.`;
}

function buildMissingManualReviewEvidenceMessage() {
  return "This manual task cannot move to review yet. Upload at least one file or add one evidence link first.";
}

export function assertManualTaskHasDraftEvidence(draftEvidenceCount) {
  if (Number(draftEvidenceCount ?? 0) < 1) {
    throw new AppError(buildMissingManualReviewEvidenceMessage(), 409, "TASK_MANUAL_EVIDENCE_REQUIRED");
  }
}

export async function listTasksService(actor, filters) {
  const teamIds = await resolveActorTaskListTeamIds(actor, filters.teamId);
  if (teamIds.length === 0) return [];

  if (teamIds.length === 1) {
    await expireOverdueTasksByTeam(teamIds[0]);
  } else {
    await expireOverdueTasksByTeams(teamIds);
  }

  const normalizedSearch = normalizeText(filters.search).toLowerCase();
  const tasks = teamIds.length === 1 ? await listTasksByTeam(teamIds[0]) : await listTasksByTeamIds(teamIds);

  return tasks
    .filter((task) => {
      if (filters.priority && task.priority !== filters.priority) return false;
      if (filters.status && normalizeVisibleStatus(task.status) !== filters.status) return false;
      if (filters.taskType && task.taskType !== filters.taskType) return false;
      if (filters.integrationMode && task.integrationMode !== filters.integrationMode) return false;

      if (!normalizedSearch) return true;

      const haystack = `${task.title} ${task.description ?? ""}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    })
    .sort(compareTasks)
    .map((task) => {
      try {
        return toTaskResponse(task, actor);
      } catch (err) {
        console.error("Error in toTaskResponse for task:", task.id, err);
        throw err;
      }
    });
}

export async function createTaskService(actor, payload) {
  const { team } = await resolveActorTeamContext(actor, payload.teamId);

  if (!canManageTaskTeam(actor, team)) {
    throw new AppError("Only the team leader or an admin can create tasks.", 403, "TASK_CREATE_FORBIDDEN");
  }

  const assignee = assertAssigneeBelongsToTeam(team, payload.assigneeUserId);
  const startDate = parseDateBoundary(payload.startDate, "start");
  const endDate = parseDateBoundary(payload.endDate, "end");

  if (endDate.getTime() < startDate.getTime()) {
    throw new AppError("End date must be on or after the start date.", 422, "TASK_DATE_RANGE_INVALID");
  }

  const taskType = payload.taskType ?? "OTHER";
  const integrationMode = payload.integrationMode ?? defaultIntegrationModeForTaskType(taskType);
  const task = await createTask({
    teamId: team.id,
    taskType,
    integrationMode,
    origin: "GPMS",
    title: normalizeText(payload.title),
    description: normalizeText(payload.description) || null,
    priority: payload.priority,
    storyPoints: normalizeStoryPoints(payload.storyPoints),
    status: "TODO",
    assigneeUserId: assignee.id,
    createdByUserId: actor.id,
    startDate,
    dueDate: endDate,
    labels: [],
    syncedFromGithub: false,
    githubCommitCount: 0,
  });

  // Notify the assignee they have a new task (skip if leader assigned to themselves)
  if (assignee.id !== actor.id) {
    await notify({
      userId: assignee.id,
      type: "TASK_ASSIGNED",
      title: "New Task Assigned",
      message: `You have been assigned the task "${normalizeText(payload.title)}" in team "${team.name}".`,
      actionUrl: "/dashboard/tasks",
    });
  }

  return toTaskResponse(task, actor);
}

export async function updateTaskService(actor, taskId, payload) {
  let task = await findTaskById(taskId);
  assertTaskExists(task);
  task = await refreshTaskWorkflowState(task);
  assertActorCanViewTask(task, actor);
  assertGpmsManagedTask(task);
  assertTaskManager(task, actor);

  const { nextStartDate, nextEndDate } = buildUpdatedDateRange(task, payload);
  if (payload.startDate !== undefined || payload.endDate !== undefined) {
    assertTaskDatesFitAssignedSprint(task, nextStartDate, nextEndDate);
  }

  const updateData = {};
  let shouldResetWorkflow = false;

  if (payload.title !== undefined) updateData.title = normalizeText(payload.title);
  if (payload.description !== undefined) updateData.description = normalizeText(payload.description) || null;
  if (payload.priority !== undefined) updateData.priority = payload.priority;
  if (payload.storyPoints !== undefined) updateData.storyPoints = normalizeStoryPoints(payload.storyPoints, task.storyPoints);
  if (payload.actualPoints !== undefined) updateData.actualPoints = payload.actualPoints === null ? null : normalizeStoryPoints(payload.actualPoints, task.actualPoints ?? task.storyPoints);
  if (payload.unplanned !== undefined) updateData.unplanned = Boolean(payload.unplanned);
  if (payload.taskType !== undefined) updateData.taskType = payload.taskType;

  if (payload.integrationMode !== undefined) {
    updateData.integrationMode = payload.integrationMode;
    shouldResetWorkflow = payload.integrationMode !== task.integrationMode;
  }

  if (payload.assigneeUserId !== undefined) {
    const nextAssignee = assertAssigneeBelongsToTeam(task.team, payload.assigneeUserId);
    updateData.assigneeUserId = nextAssignee.id;
    shouldResetWorkflow = shouldResetWorkflow || nextAssignee.id !== task.assigneeUserId;
  }

  if (payload.startDate !== undefined) {
    updateData.startDate = nextStartDate;
    shouldResetWorkflow = true;
  }

  if (payload.endDate !== undefined) {
    updateData.dueDate = nextEndDate;
    shouldResetWorkflow = true;
  }

  if (shouldResetWorkflow && task.status !== "DONE") {
    updateData.status = "TODO";
    updateData.acceptedAt = null;
    updateData.submittedForReviewAt = null;
    updateData.reviewedAt = null;
    updateData.reviewedByUserId = null;
    updateData.reviewFeedback = null;
    updateData.reviewComment = null;
    updateData.reviewDecision = null;
    updateData.reviewSnapshot = null;
  }

  const updated = await updateTaskById(task.id, updateData);
  return toTaskResponse(updated, actor);
}

export async function acceptTaskService(actor, taskId) {
  let task = await findTaskById(taskId);
  assertTaskExists(task);
  task = await refreshTaskWorkflowState(task);
  assertActorCanViewTask(task, actor);
  assertGpmsManagedTask(task);
  assertTaskAssignee(task, actor);

  if (task.status !== "TODO" || task.acceptedAt) {
    throw new AppError("Only tasks waiting in To Do can be accepted.", 409, "TASK_NOT_WAITING_FOR_ACCEPTANCE");
  }

  if (task.dueDate && new Date(task.dueDate).getTime() < Date.now()) {
    throw new AppError(
      "This task has already passed its end date. Ask the team leader to update the task schedule first.",
      409,
      "TASK_END_DATE_PASSED",
    );
  }

  const isResubmissionRestart = task.reviewDecision === "CHANGES_REQUESTED";
  const updated = await updateTaskById(task.id, {
    status: "IN_PROGRESS",
    acceptedAt: new Date(),
    ...(isResubmissionRestart
      ? {}
      : {
          reviewFeedback: null,
          reviewComment: null,
          reviewDecision: null,
        }),
  });

  return toTaskResponse(updated, actor);
}

function assertManualEvidenceWriteAllowed(task, actor) {
  assertGpmsManagedTask(task);
  assertTaskAssignee(task, actor);

  if (!isManualTask(task)) {
    throw new AppError("Only manual tasks can use manual submission evidence.", 409, "TASK_EVIDENCE_MANUAL_ONLY");
  }

  // The assignee (student OR leader) may upload evidence on their own task.
  // assertTaskAssignee above guarantees `actor.id === task.assigneeUserId`,
  // so we just gate on the role being one of the two allowed assignee roles.
  if (actor.role !== ROLES.STUDENT && actor.role !== ROLES.LEADER) {
    throw new AppError("Only the assigned team member can add task submission evidence.", 403, "TASK_EVIDENCE_ASSIGNEE_ONLY");
  }

  if (task.status !== "IN_PROGRESS") {
    throw new AppError("Evidence can be added only while the task is in progress.", 409, "TASK_EVIDENCE_TASK_NOT_IN_PROGRESS");
  }
}

function normalizeEvidenceTitle(value, fallback = "Task evidence") {
  const normalized = normalizeText(value);
  const fallbackTitle = normalizeText(fallback) || "Task evidence";
  return (normalized || fallbackTitle).slice(0, 160);
}

async function resolveTaskForEvidence(actor, taskId) {
  let task = await findTaskById(taskId);
  assertTaskExists(task);
  task = await refreshTaskWorkflowState(task);
  assertActorCanViewTask(task, actor);
  return task;
}

export async function listTaskEvidenceService(actor, taskId) {
  const task = await resolveTaskForEvidence(actor, taskId);
  assertGpmsManagedTask(task);
  return listTaskEvidenceByTaskId(task.id);
}

export async function createTaskEvidenceFileService(actor, taskId, payload) {
  const task = await resolveTaskForEvidence(actor, taskId);
  assertManualEvidenceWriteAllowed(task, actor);

  return createTaskEvidence({
    taskId: task.id,
    teamId: task.teamId,
    uploadedByUserId: actor.id,
    type: "FILE",
    title: normalizeEvidenceTitle(payload.title, payload.fileName),
    url: payload.url,
    fileName: payload.fileName ?? null,
    fileSize: payload.fileSize ?? null,
    fileType: payload.fileType ?? null,
  });
}

export async function createTaskEvidenceLinkService(actor, taskId, payload) {
  const task = await resolveTaskForEvidence(actor, taskId);
  assertManualEvidenceWriteAllowed(task, actor);

  return createTaskEvidence({
    taskId: task.id,
    teamId: task.teamId,
    uploadedByUserId: actor.id,
    type: "LINK",
    title: normalizeEvidenceTitle(payload.title, payload.url),
    url: payload.url,
    fileName: null,
    fileSize: null,
    fileType: null,
  });
}

export async function deleteTaskEvidenceService(actor, taskId, evidenceId) {
  const task = await resolveTaskForEvidence(actor, taskId);
  assertManualEvidenceWriteAllowed(task, actor);

  const evidence = await findTaskEvidenceById(evidenceId);
  if (!evidence || evidence.taskId !== task.id) {
    throw new AppError("Evidence not found.", 404, "TASK_EVIDENCE_NOT_FOUND");
  }

  if (evidence.uploadedBy?.id !== actor.id) {
    throw new AppError("You can delete only evidence you uploaded.", 403, "TASK_EVIDENCE_DELETE_FORBIDDEN");
  }

  if (evidence.submittedAt) {
    throw new AppError("Submitted evidence is locked and cannot be deleted.", 409, "TASK_EVIDENCE_ALREADY_SUBMITTED");
  }

  return deleteTaskEvidenceById(evidence.id);
}

export async function submitTaskForReviewService(actor, taskId) {
  let task = await findTaskById(taskId);
  assertTaskExists(task);
  task = await refreshTaskWorkflowState(task);
  assertActorCanViewTask(task, actor);
  assertGpmsManagedTask(task);
  assertTaskAssignee(task, actor);

  if (task.status !== "IN_PROGRESS") {
    throw new AppError("Only tasks in progress can be submitted for review.", 409, "TASK_NOT_IN_PROGRESS");
  }

  if (isRepoBackedTask(task)) {
    task = await resyncTaskGitHubStateService(actor, task.id);
    if (!buildGitHubReviewGate(task)?.ready) {
      throw new AppError(buildMissingGitHubReviewEvidenceMessage(task), 409, "TASK_GITHUB_REVIEW_REQUIREMENTS_NOT_MET");
    }
  } else {
    const draftEvidenceCount = await countDraftTaskEvidence(task.id);
    assertManualTaskHasDraftEvidence(draftEvidenceCount);
  }

  const submittedAt = new Date();
  const updated = await submitTaskForReviewById(task.id, {
    status: "REVIEW",
    submittedForReviewAt: submittedAt,
    reviewFeedback: null,
    reviewComment: null,
    reviewDecision: null,
  }, {
    lockManualEvidence: isManualTask(task),
    submittedAt,
  });

  // Notify the assigned TA that a task needs review.
  if (task.team?.ta?.id && task.team.ta.id !== actor.id) {
    await notify({
      userId: task.team.ta.id,
      type: "TASK_REVIEWED",
      title: "Task Ready for Review",
      message: `"${task.title}" has been submitted for review by ${buildFullName(actor)}.`,
      actionUrl: "/dashboard/reviews",
    });
  }

  return toTaskResponse(updated, actor);
}

/**
 * Notify the team-side counterpart reviewer about a review just submitted.
 * If a LEADER reviewed, notify the TA (and vice versa) so they know there's
 * already feedback on the task. The recipient can still leave their own
 * follow-up review even if the task is already approved/done.
 */
async function notifyCounterpartReviewer(task, actor, reviewerRole, decision, reviewComment) {
  const isApproved = decision === "APPROVED";
  const verb = isApproved ? "approved" : "requested resubmission on";
  const actorName = buildFullName(actor);
  const baseMessage = `${actorName} (${reviewerRole === "LEADER" ? "Team Leader" : "TA"}) ${verb} "${task.title}".${
    reviewComment ? ` Note: "${reviewComment}".` : ""
  }`;

  // LEADER reviewed → notify TA. TA reviewed → notify LEADER. ADMIN reviewed → notify both.
  const recipients = [];
  if (reviewerRole === "LEADER" && task.team?.ta?.id && task.team.ta.id !== actor.id) {
    recipients.push(task.team.ta.id);
  } else if (reviewerRole === "TA" && task.team?.leader?.id && task.team.leader.id !== actor.id) {
    recipients.push(task.team.leader.id);
  } else if (reviewerRole === "ADMIN") {
    if (task.team?.leader?.id && task.team.leader.id !== actor.id) recipients.push(task.team.leader.id);
    if (task.team?.ta?.id && task.team.ta.id !== actor.id) recipients.push(task.team.ta.id);
  }

  for (const userId of recipients) {
    await notify({
      userId,
      type: "TASK_REVIEWED",
      title: isApproved ? "Task Approved by Counterpart" : "Resubmission Requested by Counterpart",
      message: `${baseMessage} You can still leave your own follow-up review.`,
      actionUrl: "/dashboard/reviews",
    });
  }
}

export async function approveTaskService(actor, taskId, payload = {}) {
  let task = await findTaskById(taskId);
  assertTaskExists(task);
  task = await refreshTaskWorkflowState(task);
  assertActorCanViewTask(task, actor);
  assertGpmsManagedTask(task);
  const reviewerRole = assertTaskReviewer(task, actor);

  // Allow either:
  //  - a primary review while task is in REVIEW (closes the task)
  //  - a supplementary review on an already-approved/done task (audit-only)
  const isPrimaryReview = task.status === "REVIEW";
  const isSupplementaryReview =
    task.status === "DONE" || (task.status === "APPROVED" && isRepoBackedTask(task));

  if (!isPrimaryReview && !isSupplementaryReview) {
    throw new AppError("This task is not open for review.", 409, "TASK_NOT_REVIEWABLE");
  }

  const reviewComment = normalizeText(payload.reviewComment) || null;
  let merged = false;
  let updatedTask = task;

  if (isPrimaryReview) {
    // The first APPROVED review closes the task. Run the full GitHub-merge / status-transition flow.
    if (isRepoBackedTask(task)) {
      task = await resyncTaskGitHubStateService(actor, task.id);
      if (!buildGitHubReviewGate(task)?.ready) {
        throw new AppError(buildMissingGitHubReviewEvidenceMessage(task), 409, "TASK_GITHUB_REVIEW_REQUIREMENTS_NOT_MET");
      }

      await reviewTaskPullRequestService(actor, task.id, {
        event: "APPROVE",
        body: reviewComment || undefined,
      });

      if (shouldMergeApprovedTaskPullRequest(payload)) {
        await mergeTaskPullRequestService(actor, task.id, {
          mergeMethod: payload.mergeMethod,
        });
        merged = true;
      }

      task = await resyncTaskGitHubStateService(actor, task.id);
      if (task.githubPullRequestMergedAt) {
        merged = true;
      }
    }

    updatedTask = await updateTaskById(task.id, {
      status: merged ? "DONE" : isRepoBackedTask(task) ? "APPROVED" : "DONE",
      reviewedAt: new Date(),
      reviewedByUserId: actor.id,
      reviewFeedback: reviewComment,
      reviewComment,
      reviewDecision: "APPROVED",
      reviewSnapshot: buildReviewSnapshot(task, actor, {
        reviewerRole,
        mergeRequested: shouldMergeApprovedTaskPullRequest(payload),
        mergeMethod: payload.mergeMethod ?? null,
        merged,
      }),
    });
  }
  // For supplementary reviews we deliberately leave the task's pointer fields
  // and status alone — the TaskReview row below is the only record.

  await createTaskReview({
    taskId: task.id,
    reviewerUserId: actor.id,
    reviewerRole,
    decision: "APPROVED",
    comment: reviewComment,
    snapshot: buildReviewSnapshot(task, actor, {
      reviewerRole,
      supplementary: !isPrimaryReview,
      merged: isPrimaryReview ? merged : undefined,
    }),
  });

  // Notify the assignee (student) — they care about every review on their task.
  if (task.assigneeUserId && task.assigneeUserId !== actor.id) {
    await notify({
      userId: task.assigneeUserId,
      type: "TASK_APPROVED",
      title: isPrimaryReview ? "Task Approved" : "Additional Review: Approved",
      message: `${buildFullName(actor)} (${
        reviewerRole === "LEADER" ? "Team Leader" : reviewerRole === "TA" ? "TA" : "Admin"
      }) approved your task "${task.title}"${reviewComment ? `: "${reviewComment}"` : "."}`,
      actionUrl: "/dashboard/tasks",
    });
  }

  // Gamification: emit TASK_APPROVED event
  emitGamificationEvent({
    eventType: "TASK_APPROVED",
    sourceType: "Task",
    sourceId: updatedTask.id,
    idempotencyKey: buildGamificationIdempotencyKey(
      "TASK_APPROVED",
      updatedTask.id,
      (updatedTask.reviewedAt ?? new Date()).toISOString(),
    ),
    teamId: task.teamId ?? task.team?.id ?? null,
    actorUserId: actor.id,
    payload: {
      taskType: task.taskType,
      assigneeUserId: task.assigneeUserId,
      approvedByUserId: actor.id,
      reviewerRole,
      integrationMode: task.integrationMode,
      priority: task.priority,
      storyPoints: Number(task.storyPoints ?? 0),
      actualPoints: task.actualPoints ?? null,
      createdAt: task.createdAt?.toISOString?.() ?? null,
      acceptedAt: task.acceptedAt?.toISOString?.() ?? null,
      submittedForReviewAt:
        updatedTask.submittedForReviewAt?.toISOString?.() ??
        task.submittedForReviewAt?.toISOString?.() ??
        null,
      reviewedAt: updatedTask.reviewedAt?.toISOString?.() ?? null,
      timeliness: computeTaskTimelinessTier(
        task,
        updatedTask.submittedForReviewAt ?? task.submittedForReviewAt ?? updatedTask.reviewedAt ?? new Date(),
      ),
      evidenceLevel: computeTaskEvidenceLevel(task, merged),
      merged,
    },
  });

  // Notify the other team reviewer so they see a second opinion is available.
  await notifyCounterpartReviewer(task, actor, reviewerRole, "APPROVED", reviewComment);

  return toTaskResponse(updatedTask, actor);
}

export async function rejectTaskService(actor, taskId, payload) {
  let task = await findTaskById(taskId);
  assertTaskExists(task);
  task = await refreshTaskWorkflowState(task);
  assertActorCanViewTask(task, actor);
  assertGpmsManagedTask(task);
  const reviewerRole = assertTaskReviewer(task, actor);

  // Reject is the inverse of approve:
  //  - Primary "request resubmission" while task is in REVIEW (sends back to TODO)
  //  - Supplementary concern on an already-approved/done task (audit-only)
  const isPrimaryReview =
    task.status === "REVIEW" || (isRepoBackedTask(task) && task.status === "APPROVED");
  const isSupplementaryReview = !isPrimaryReview && (task.status === "DONE" || task.status === "APPROVED");

  if (!isPrimaryReview && !isSupplementaryReview) {
    throw new AppError("This task is not open for review.", 409, "TASK_NOT_REVIEWABLE");
  }

  // Enforce a 10-char minimum so "no" / "bad" can't be a resubmission reason —
  // the student needs something actionable to work from.
  const reviewComment = assertReviewCommentMeetsMinimum(payload.reviewComment);

  let updatedTask = task;

  if (isPrimaryReview) {
    const resubmissionUpdate = buildTaskResubmissionUpdate(task, actor, reviewComment);

    if (isRepoBackedTask(task) && task.githubPullRequestNumber) {
      await reviewTaskPullRequestService(actor, task.id, {
        event: "REQUEST_CHANGES",
        body: reviewComment,
      });
      task = await resyncTaskGitHubStateService(actor, task.id);
      Object.assign(resubmissionUpdate, buildTaskResubmissionUpdate(task, actor, reviewComment));
    }

    // Tag the snapshot with reviewerRole so the audit/history shows who closed the task.
    resubmissionUpdate.reviewSnapshot = buildReviewSnapshot(task, actor, {
      reviewerRole,
      requestedChanges: true,
    });

    updatedTask = await updateTaskById(task.id, resubmissionUpdate);
  }

  await createTaskReview({
    taskId: task.id,
    reviewerUserId: actor.id,
    reviewerRole,
    decision: "CHANGES_REQUESTED",
    comment: reviewComment,
    snapshot: buildReviewSnapshot(task, actor, {
      reviewerRole,
      supplementary: !isPrimaryReview,
      requestedChanges: true,
    }),
  });

  // Notify the assignee — every "request resubmission" is something they need to see.
  if (task.assigneeUserId && task.assigneeUserId !== actor.id) {
    await notify({
      userId: task.assigneeUserId,
      type: "TASK_CHANGES_REQUESTED",
      title: isPrimaryReview ? "Resubmission Requested" : "Additional Review: Changes Requested",
      message: `${buildFullName(actor)} (${
        reviewerRole === "LEADER" ? "Team Leader" : reviewerRole === "TA" ? "TA" : "Admin"
      }) requested changes on "${task.title}": "${reviewComment}".`,
      actionUrl: "/dashboard/tasks",
    });
  }

  if (isPrimaryReview) {
    // Gamification: only real workflow reopens reverse previously awarded task XP.
    emitGamificationEvent({
      eventType: "TASK_REOPENED",
      sourceType: "Task",
      sourceId: updatedTask.id,
      idempotencyKey: buildGamificationIdempotencyKey(
        "TASK_REOPENED",
        updatedTask.id,
        (updatedTask.reviewedAt ?? new Date()).toISOString(),
      ),
      teamId: task.teamId ?? task.team?.id ?? null,
      actorUserId: actor.id,
      payload: {
        taskType: task.taskType,
        assigneeUserId: task.assigneeUserId,
        previousStatus: task.status,
      },
    });
  }

  // Notify the counterpart reviewer.
  await notifyCounterpartReviewer(task, actor, reviewerRole, "CHANGES_REQUESTED", reviewComment);

  return toTaskResponse(updatedTask, actor);
}

export async function listTaskReviewsService(actor, taskId) {
  let task = await findTaskById(taskId);
  assertTaskExists(task);
  task = await refreshTaskWorkflowState(task);
  assertActorCanViewTask(task, actor);

  const reviews = await listTaskReviewsByTaskId(task.id);
  return reviews.map(toTaskReviewResponse);
}

export async function bootstrapTaskGithubService(actor, taskId) {
  let task = await findTaskById(taskId);
  assertTaskExists(task);
  assertActorCanViewTask(task, actor);
  assertGpmsManagedTask(task);

  if (!isRepoBackedTask(task)) {
    throw new AppError("Only repo-backed tasks can bootstrap GitHub artifacts.", 409, "TASK_GITHUB_NOT_ENABLED");
  }

  if (!canWriteRepoBackedTask(actor, task)) {
    throw new AppError("Only the team leader or assigned member can prepare GitHub artifacts for this task.", 403, "TASK_GITHUB_WRITE_FORBIDDEN");
  }

  task = await bootstrapTaskGitHubArtifactsService(actor, task.id);
  return toTaskResponse(task, actor);
}

export async function openTaskPullRequestService(actor, taskId, payload = {}) {
  let task = await findTaskById(taskId);
  assertTaskExists(task);
  assertActorCanViewTask(task, actor);
  assertGpmsManagedTask(task);

  if (!isRepoBackedTask(task)) {
    throw new AppError("Only repo-backed tasks can open a GitHub pull request.", 409, "TASK_GITHUB_NOT_ENABLED");
  }

  if (!canWriteRepoBackedTask(actor, task)) {
    throw new AppError("Only the team leader or assigned member can open a pull request for this task.", 403, "TASK_GITHUB_WRITE_FORBIDDEN");
  }

  task = await openTaskGitHubPullRequestService(actor, task.id, payload);
  return toTaskResponse(task, actor);
}

export async function resyncTaskGithubService(actor, taskId) {
  let task = await findTaskById(taskId);
  assertTaskExists(task);
  assertActorCanViewTask(task, actor);

  if (!isRepoBackedTask(task)) {
    throw new AppError("This task does not use GitHub tracking.", 409, "TASK_GITHUB_NOT_ENABLED");
  }

  task = await resyncTaskGitHubStateService(actor, task.id);
  return toTaskResponse(task, actor);
}
