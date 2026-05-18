import { Prisma } from "@prisma/client";
import { AppError } from "../../common/errors/AppError.js";
import { ROLES } from "../../common/constants/roles.js";
import { prisma } from "../../loaders/dbLoader.js";
import { teamUserSelect, findTeamById, findTeamByLeaderId, findTeamMemberByUserId } from "../teams/teams.repository.js";
import {
  buildGamificationIdempotencyKey,
  emitGamificationEvent,
} from "../gamification/gamification.emitter.js";
import { calculateXp } from "../gamification/gamification.rules-engine.js";

const TASK_STATUS_ORDER = {
  BACKLOG: 0,
  TODO: 1,
  IN_PROGRESS: 2,
  REVIEW: 3,
  APPROVED: 4,
  DONE: 5,
};

const SPRINT_ORDER = {
  ACTIVE: 0,
  PLANNED: 1,
  COMPLETED: 2,
};

// WARNING: These task XP estimates mirror the gamification rules defined in
// prisma/seed.js. If you update rule multipliers or base XP in the seed,
// ensure you update these estimates to match.
const TASK_XP_RULE_ESTIMATES = {
  CODE: {
    baseXp: 80,
    multipliers: {
      difficulty: { LOW: 0.8, MEDIUM: 1.0, HIGH: 1.25, CRITICAL: 1.5 },
      evidence: { repoBackedWithPR: 1.15, repoBackedNoPR: 1.0, manual: 0.5 },
    },
  },
  DOCUMENTATION: {
    baseXp: 60,
    multipliers: {
      difficulty: { LOW: 0.8, MEDIUM: 1.0, HIGH: 1.25, CRITICAL: 1.5 },
    },
  },
  DESIGN: {
    baseXp: 70,
    multipliers: {
      difficulty: { LOW: 0.8, MEDIUM: 1.0, HIGH: 1.25, CRITICAL: 1.5 },
    },
  },
  RESEARCH: {
    baseXp: 50,
    multipliers: {
      difficulty: { LOW: 0.8, MEDIUM: 1.0, HIGH: 1.25, CRITICAL: 1.5 },
    },
  },
  MEETING: {
    baseXp: 20,
    multipliers: {},
  },
  PRESENTATION: {
    baseXp: 60,
    multipliers: {
      difficulty: { LOW: 0.8, MEDIUM: 1.0, HIGH: 1.25, CRITICAL: 1.5 },
    },
  },
  OTHER: {
    baseXp: 30,
    multipliers: {
      difficulty: { LOW: 0.8, MEDIUM: 1.0, HIGH: 1.25, CRITICAL: 1.5 },
    },
  },
};

const sprintTaskSelect = {
  id: true,
  teamId: true,
  sprintId: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  taskType: true,
  integrationMode: true,
  origin: true,
  labels: true,
  storyPoints: true,
  actualPoints: true,
  unplanned: true,
  startDate: true,
  dueDate: true,
  acceptedAt: true,
  submittedForReviewAt: true,
  reviewedAt: true,
  githubIssueNumber: true,
  githubIssueUrl: true,
  githubPullRequestNumber: true,
  githubPullRequestUrl: true,
  createdAt: true,
  updatedAt: true,
  assignee: { select: teamUserSelect },
  createdBy: { select: teamUserSelect },
};

const sprintSelect = {
  id: true,
  teamId: true,
  name: true,
  goal: true,
  startDate: true,
  endDate: true,
  status: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: teamUserSelect },
  tasks: {
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    select: sprintTaskSelect,
  },
};

function normalizeText(value) {
  return String(value ?? "").trim();
}

function isUniqueConstraintError(error) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function mapSprintPersistenceError(error) {
  if (isUniqueConstraintError(error)) {
    throw new AppError("A sprint with this name already exists for this team.", 409, "SPRINT_NAME_EXISTS");
  }

  throw error;
}

function buildFullName(user) {
  return `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
}

function toUserSummary(user) {
  if (!user) return null;

  return {
    ...user,
    fullName: buildFullName(user),
  };
}

function normalizeVisibleStatus(status) {
  return status === "BACKLOG" ? "TODO" : status;
}

function parseDateBoundary(value, boundary = "start") {
  const normalized = normalizeText(value);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    throw new AppError("Use the date format YYYY-MM-DD.", 422, "INVALID_SPRINT_DATE");
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
    throw new AppError("Please provide a valid calendar date.", 422, "INVALID_SPRINT_DATE");
  }

  return date;
}

function normalizePoints(value, fallback = 3) {
  if (value === undefined || value === null || value === "") return fallback;
  const points = Number(value);

  if (!Number.isInteger(points) || points < 0 || points > 99) {
    throw new AppError("Story points must be a whole number between 0 and 99.", 422, "SPRINT_POINTS_INVALID");
  }

  return points;
}

function compareTasks(left, right) {
  const statusDelta = (TASK_STATUS_ORDER[left.status] ?? 99) - (TASK_STATUS_ORDER[right.status] ?? 99);
  if (statusDelta !== 0) return statusDelta;

  const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
  const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
  if (leftDue !== rightDue) return leftDue - rightDue;

  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

function compareSprints(left, right) {
  const statusDelta = (SPRINT_ORDER[left.status] ?? 99) - (SPRINT_ORDER[right.status] ?? 99);
  if (statusDelta !== 0) return statusDelta;

  if (left.status === "COMPLETED" && right.status === "COMPLETED") {
    return new Date(right.endDate).getTime() - new Date(left.endDate).getTime();
  }

  return new Date(left.startDate).getTime() - new Date(right.startDate).getTime();
}

function canManageTeam(actor, team) {
  return actor.role === ROLES.ADMIN || team?.leader?.id === actor.id;
}

function canViewTeam(actor, team) {
  if (!team) return false;
  if (canManageTeam(actor, team)) return true;
  if (team.doctor?.id === actor.id || team.ta?.id === actor.id) return true;
  return team.members.some((member) => member.user.id === actor.id);
}

async function resolveActorTeamContext(actor, requestedTeamId) {
  const normalizedRequestedTeamId = normalizeText(requestedTeamId) || null;

  if (actor.role === ROLES.ADMIN) {
    if (!normalizedRequestedTeamId) {
      throw new AppError("Admins must provide a teamId to access sprints.", 422, "SPRINT_TEAM_ID_REQUIRED");
    }
    const team = await findTeamById(normalizedRequestedTeamId);
    if (!team) throw new AppError("Team not found.", 404, "TEAM_NOT_FOUND");
    return { team, teamRole: "ADMIN", canManage: true };
  }

  if (actor.role === ROLES.LEADER) {
    const team = await findTeamByLeaderId(actor.id);
    if (!team) throw new AppError("Create a team first before managing sprints.", 409, "TEAM_REQUIRED");
    if (normalizedRequestedTeamId && normalizedRequestedTeamId !== team.id) {
      throw new AppError("You can only access sprints for your own team.", 403, "SPRINT_TEAM_FORBIDDEN");
    }
    return { team, teamRole: "LEADER", canManage: true };
  }

  if (actor.role === ROLES.STUDENT) {
    const membership = await findTeamMemberByUserId(actor.id);
    if (!membership?.team) throw new AppError("Join a team first before accessing sprints.", 409, "TEAM_REQUIRED");
    if (normalizedRequestedTeamId && normalizedRequestedTeamId !== membership.team.id) {
      throw new AppError("You can only access sprints for your own team.", 403, "SPRINT_TEAM_FORBIDDEN");
    }
    return { team: membership.team, teamRole: "MEMBER", canManage: false };
  }

  if (actor.role === ROLES.DOCTOR || actor.role === ROLES.TA) {
    if (!normalizedRequestedTeamId) {
      throw new AppError("Provide a teamId to load sprints for this team.", 422, "SPRINT_TEAM_ID_REQUIRED");
    }
    const team = await findTeamById(normalizedRequestedTeamId);
    if (!team) throw new AppError("Team not found.", 404, "TEAM_NOT_FOUND");
    if (team.doctor?.id !== actor.id && team.ta?.id !== actor.id) {
      throw new AppError("You are not assigned to this team.", 403, "SPRINT_TEAM_FORBIDDEN");
    }
    return { team, teamRole: actor.role, canManage: false };
  }

  throw new AppError("This role is not supported for sprint access.", 403, "SPRINT_ROLE_UNSUPPORTED");
}

async function resolveSprintForActor(actor, sprintId) {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    select: {
      ...sprintSelect,
      team: {
        select: {
          id: true,
          name: true,
          leader: { select: teamUserSelect },
          doctor: { select: teamUserSelect },
          ta: { select: teamUserSelect },
          members: {
            select: {
              id: true,
              joinedAt: true,
              user: { select: teamUserSelect },
            },
          },
        },
      },
    },
  });

  if (!sprint) throw new AppError("Sprint not found.", 404, "SPRINT_NOT_FOUND");
  if (!canViewTeam(actor, sprint.team)) {
    throw new AppError("You are not allowed to access this sprint.", 403, "SPRINT_VIEW_FORBIDDEN");
  }

  return sprint;
}

function assertCanManage(actor, team) {
  if (!canManageTeam(actor, team)) {
    throw new AppError("Only the team leader or an admin can manage sprints.", 403, "SPRINT_MANAGER_ONLY");
  }
}

function assertDateRange(startDate, endDate) {
  if (endDate.getTime() < startDate.getTime()) {
    throw new AppError("End date must be on or after the start date.", 422, "SPRINT_DATE_RANGE_INVALID");
  }
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

function assertTaskFitsSprintWindow(task, sprint, nextWindow = {}) {
  if (!task.startDate || !task.dueDate) {
    throw new AppError(
      `"${task.title}" needs both a start date and an end date before it can be added to a sprint.`,
      422,
      "SPRINT_TASK_DATES_REQUIRED"
    );
  }

  const taskStart = startOfDay(task.startDate);
  const taskEnd = endOfDay(task.dueDate);
  const sprintStart = startOfDay(nextWindow.startDate ?? sprint.startDate);
  const sprintEnd = endOfDay(nextWindow.endDate ?? sprint.endDate);

  if (taskStart.getTime() < sprintStart.getTime()) {
    throw new AppError(
      `"${task.title}" starts on ${formatScheduleDate(taskStart)}, before "${sprint.name}" starts on ${formatScheduleDate(sprintStart)}.`,
      422,
      "SPRINT_TASK_START_BEFORE_SPRINT"
    );
  }

  if (taskEnd.getTime() > sprintEnd.getTime()) {
    throw new AppError(
      `"${task.title}" ends on ${formatScheduleDate(taskEnd)}, after "${sprint.name}" ends on ${formatScheduleDate(sprintEnd)}.`,
      422,
      "SPRINT_TASK_END_AFTER_SPRINT"
    );
  }
}

function assertSprintTasksFitWindow(sprint, startDate, endDate) {
  for (const task of sprint.tasks ?? []) {
    assertTaskFitsSprintWindow(task, sprint, { startDate, endDate });
  }
}

function buildDateRange(startDate, endDate) {
  const dates = [];
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);
  const final = new Date(endDate);
  final.setHours(0, 0, 0, 0);

  while (cursor.getTime() <= final.getTime() && dates.length < 120) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function getTaskPoints(task) {
  return Number(task.storyPoints ?? 0);
}

function getCompletedPoints(task) {
  if (normalizeVisibleStatus(task.status) !== "DONE") return 0;
  return Number(task.actualPoints ?? task.storyPoints ?? 0);
}

function isTaskPastDue(task) {
  return Boolean(task.dueDate) && normalizeVisibleStatus(task.status) !== "DONE" && new Date(task.dueDate).getTime() < Date.now();
}

function getTaskEvidenceLevel(task) {
  if (task.integrationMode !== "GITHUB") return "manual";
  if (task.githubPullRequestNumber || task.githubPullRequestUrl) return "repoBackedWithPR";
  return "repoBackedNoPR";
}

function buildTaskGamificationImpact(task) {
  const taskType = task.taskType ?? "OTHER";
  const estimateRule = TASK_XP_RULE_ESTIMATES[taskType] ?? TASK_XP_RULE_ESTIMATES.OTHER;
  const payload = {
    taskType,
    priority: task.priority,
    storyPoints: Number(task.storyPoints ?? 0),
    actualPoints: task.actualPoints ?? null,
    evidenceLevel: getTaskEvidenceLevel(task),
  };
  const { amount, breakdown } = calculateXp(
    {
      baseXp: estimateRule.baseXp,
      multipliers: estimateRule.multipliers,
    },
    payload,
  );

  return {
    eventType: "TASK_APPROVED",
    baseXp: estimateRule.baseXp,
    estimatedXp: amount,
    effortPoints: Number(payload.actualPoints ?? payload.storyPoints),
    effortMultiplier: breakdown.effortMultiplier ?? 1,
    priorityMultiplier: breakdown.difficultyMultiplier ?? 1,
    evidenceMultiplier: breakdown.evidenceMultiplier ?? 1,
    eligible: Number(payload.storyPoints) >= 1,
  };
}

function toSprintTaskResponse(task) {
  return {
    id: task.id,
    teamId: task.teamId,
    sprintId: task.sprintId ?? null,
    title: task.title,
    description: task.description ?? "",
    status: normalizeVisibleStatus(task.status),
    rawStatus: task.status,
    priority: task.priority,
    taskType: task.taskType,
    integrationMode: task.integrationMode,
    origin: task.origin,
    labels: task.labels ?? [],
    storyPoints: getTaskPoints(task),
    actualPoints: task.actualPoints ?? null,
    unplanned: Boolean(task.unplanned),
    startDate: task.startDate ?? null,
    endDate: task.dueDate ?? null,
    acceptedAt: task.acceptedAt ?? null,
    submittedForReviewAt: task.submittedForReviewAt ?? null,
    reviewedAt: task.reviewedAt ?? null,
    githubIssueNumber: task.githubIssueNumber ?? null,
    githubIssueUrl: task.githubIssueUrl ?? null,
    githubPullRequestNumber: task.githubPullRequestNumber ?? null,
    githubPullRequestUrl: task.githubPullRequestUrl ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    assignee: toUserSummary(task.assignee),
    createdBy: toUserSummary(task.createdBy),
    isPastEndDate: isTaskPastDue(task),
    gamificationImpact: buildTaskGamificationImpact(task),
  };
}

function buildSprintStats(tasks) {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => normalizeVisibleStatus(task.status) === "DONE").length;
  const totalStoryPoints = tasks.reduce((sum, task) => sum + getTaskPoints(task), 0);
  const completedStoryPoints = tasks.reduce((sum, task) => sum + getCompletedPoints(task), 0);
  const unplannedTasks = tasks.filter((task) => task.unplanned).length;
  const unplannedStoryPoints = tasks.filter((task) => task.unplanned).reduce((sum, task) => sum + getTaskPoints(task), 0);

  return {
    totalTasks,
    completedTasks,
    totalStoryPoints,
    completedStoryPoints,
    unplannedTasks,
    unplannedStoryPoints,
    progress: totalStoryPoints > 0 ? Math.min(100, Math.round((completedStoryPoints / totalStoryPoints) * 100)) : 0,
  };
}

function sprintCompletionMultiplier(progress) {
  if (progress >= 90) return 1.25;
  if (progress >= 80) return 1.0;
  if (progress >= 70) return 0.7;
  if (progress >= 60) return 0.4;
  return 0;
}

function buildSprintGamificationImpact(stats, status) {
  const baseTeamXp = 120;
  const completionMultiplier = sprintCompletionMultiplier(stats.progress);
  return {
    eventType: "SPRINT_COMPLETED",
    baseTeamXp,
    completionMultiplier,
    estimatedTeamXp: Math.round(baseTeamXp * completionMultiplier),
    eligible: status === "ACTIVE" || status === "COMPLETED",
  };
}

function buildSprintCompletedGamificationPayload(sprint) {
  const stats = buildSprintStats(sprint.tasks ?? []);
  return {
    sprintId: sprint.id,
    sprintName: sprint.name,
    completedAt: sprint.completedAt?.toISOString?.() ?? new Date().toISOString(),
    totalTasks: stats.totalTasks,
    completedTasks: stats.completedTasks,
    totalStoryPoints: stats.totalStoryPoints,
    completedStoryPoints: stats.completedStoryPoints,
    unplannedTasks: stats.unplannedTasks,
    unplannedStoryPoints: stats.unplannedStoryPoints,
    completionPercent: stats.progress,
    grade: stats.progress,
  };
}

function emitSprintCompletedGamificationEvent(sprint, actor) {
  emitGamificationEvent({
    eventType: "SPRINT_COMPLETED",
    sourceType: "Sprint",
    sourceId: sprint.id,
    idempotencyKey: buildGamificationIdempotencyKey("SPRINT_COMPLETED", "Sprint", sprint.id),
    teamId: sprint.teamId,
    actorUserId: actor.id,
    payload: buildSprintCompletedGamificationPayload(sprint),
  });
}

function toSprintResponse(sprint) {
  const tasks = [...(sprint.tasks ?? [])].sort(compareTasks).map(toSprintTaskResponse);
  const stats = buildSprintStats(sprint.tasks ?? []);

  return {
    id: sprint.id,
    teamId: sprint.teamId,
    name: sprint.name,
    goal: sprint.goal ?? "",
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    status: sprint.status,
    completedAt: sprint.completedAt ?? null,
    createdAt: sprint.createdAt,
    updatedAt: sprint.updatedAt,
    createdBy: toUserSummary(sprint.createdBy),
    tasks,
    stats,
    gamificationImpact: buildSprintGamificationImpact(stats, sprint.status),
  };
}

function buildBurndown(sprint) {
  if (!sprint) return [];
  const tasks = sprint.tasks ?? [];
  const total = tasks.reduce((sum, task) => sum + getTaskPoints(task), 0);
  const dates = buildDateRange(sprint.startDate, sprint.endDate);
  const denominator = Math.max(dates.length - 1, 1);

  return dates.map((date, index) => {
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    const completedByDay = tasks
      .filter((task) => normalizeVisibleStatus(task.status) === "DONE")
      .filter((task) => {
        const finishedAt = task.reviewedAt ?? task.updatedAt;
        return finishedAt && new Date(finishedAt).getTime() <= dayEnd.getTime();
      })
      .reduce((sum, task) => sum + getCompletedPoints(task), 0);

    return {
      date: date.toISOString(),
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      ideal: Math.max(0, Math.round(total - (total * index) / denominator)),
      remaining: Math.max(0, total - completedByDay),
    };
  });
}

function buildBoardMetrics(sprints, backlogTasks) {
  const allSprintTasks = sprints.flatMap((sprint) => sprint.tasks ?? []);
  const allTasks = [...allSprintTasks, ...backlogTasks];
  const activeSprint = sprints.find((sprint) => sprint.status === "ACTIVE") ?? null;
  const statusDistribution = ["TODO", "IN_PROGRESS", "REVIEW", "APPROVED", "DONE"].map((status) => ({
    status,
    count: allTasks.filter((task) => normalizeVisibleStatus(task.status) === status).length,
    storyPoints: allTasks
      .filter((task) => normalizeVisibleStatus(task.status) === status)
      .reduce((sum, task) => sum + getTaskPoints(task), 0),
  }));

  return {
    totalTasks: allTasks.length,
    backlogCount: backlogTasks.length,
    backlogStoryPoints: backlogTasks.reduce((sum, task) => sum + getTaskPoints(task), 0),
    activeSprintId: activeSprint?.id ?? null,
    activeSprintName: activeSprint?.name ?? null,
    activeProgress: activeSprint ? buildSprintStats(activeSprint.tasks ?? []).progress : 0,
    overdueTasks: allTasks.filter(isTaskPastDue).length,
    statusDistribution,
    velocity: sprints
      .filter((sprint) => sprint.status === "COMPLETED" || sprint.status === "ACTIVE")
      .sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime())
      .map((sprint) => {
        const stats = buildSprintStats(sprint.tasks ?? []);
        return {
          sprintId: sprint.id,
          name: sprint.name,
          status: sprint.status,
          completedStoryPoints: stats.completedStoryPoints,
          totalStoryPoints: stats.totalStoryPoints,
          completedTasks: stats.completedTasks,
          totalTasks: stats.totalTasks,
        };
      }),
    plannedVsUnplanned: sprints.map((sprint) => {
      const tasks = sprint.tasks ?? [];
      const planned = tasks.filter((task) => !task.unplanned).reduce((sum, task) => sum + getTaskPoints(task), 0);
      const unplanned = tasks.filter((task) => task.unplanned).reduce((sum, task) => sum + getTaskPoints(task), 0);

      return {
        sprintId: sprint.id,
        name: sprint.name,
        planned,
        unplanned,
      };
    }),
    burndown: buildBurndown(activeSprint),
  };
}

export async function listSprintsBoardService(actor, filters = {}) {
  const { team, teamRole, canManage } = await resolveActorTeamContext(actor, filters.teamId);
  const [sprints, backlogTasks] = await Promise.all([
    prisma.sprint.findMany({
      where: { teamId: team.id },
      orderBy: [{ startDate: "asc" }],
      select: sprintSelect,
    }),
    prisma.task.findMany({
      where: { teamId: team.id, sprintId: null },
      orderBy: [{ createdAt: "desc" }],
      select: sprintTaskSelect,
    }),
  ]);

  const sortedSprints = [...sprints].sort(compareSprints);
  const sortedBacklog = [...backlogTasks].sort(compareTasks);

  return {
    team: {
      id: team.id,
      name: team.name,
      teamRole,
    },
    sprints: sortedSprints.map(toSprintResponse),
    backlogTasks: sortedBacklog.map(toSprintTaskResponse),
    metrics: buildBoardMetrics(sortedSprints, sortedBacklog),
    permissions: {
      canManage,
    },
  };
}

export async function createSprintService(actor, payload) {
  const { team } = await resolveActorTeamContext(actor, payload.teamId);
  assertCanManage(actor, team);

  if (payload.status === "COMPLETED") {
    throw new AppError("Create a sprint as planned or active, then complete it when the work is done.", 422, "SPRINT_CREATE_COMPLETED_INVALID");
  }

  const startDate = parseDateBoundary(payload.startDate, "start");
  const endDate = parseDateBoundary(payload.endDate, "end");
  assertDateRange(startDate, endDate);

  if (payload.status === "ACTIVE") {
    const activeSprint = await prisma.sprint.findFirst({
      where: { teamId: team.id, status: "ACTIVE" },
      select: { id: true, name: true },
    });
    if (activeSprint) {
      throw new AppError(`Complete "${activeSprint.name}" before starting another active sprint.`, 409, "ACTIVE_SPRINT_EXISTS");
    }
  }

  try {
    const sprint = await prisma.sprint.create({
      data: {
        teamId: team.id,
        name: normalizeText(payload.name),
        goal: normalizeText(payload.goal) || null,
        startDate,
        endDate,
        status: payload.status ?? "PLANNED",
        createdByUserId: actor.id,
      },
      select: sprintSelect,
    });

    return toSprintResponse(sprint);
  } catch (error) {
    mapSprintPersistenceError(error);
  }
}

export async function updateSprintService(actor, sprintId, payload) {
  const sprint = await resolveSprintForActor(actor, sprintId);
  assertCanManage(actor, sprint.team);

  const startDate = payload.startDate !== undefined ? parseDateBoundary(payload.startDate, "start") : sprint.startDate;
  const endDate = payload.endDate !== undefined ? parseDateBoundary(payload.endDate, "end") : sprint.endDate;
  assertDateRange(startDate, endDate);

  if (payload.startDate !== undefined || payload.endDate !== undefined) {
    assertSprintTasksFitWindow(sprint, startDate, endDate);
  }

  if (sprint.status === "COMPLETED" && payload.status !== undefined && payload.status !== "COMPLETED") {
    throw new AppError("Completed sprints cannot be reopened.", 409, "SPRINT_ALREADY_COMPLETED");
  }

  if (payload.status === "COMPLETED" && sprint.status !== "ACTIVE" && sprint.status !== "COMPLETED") {
    throw new AppError("Start the sprint before completing it.", 409, "SPRINT_NOT_ACTIVE");
  }

  if (payload.status === "ACTIVE" && sprint.status !== "ACTIVE") {
    const activeSprint = await prisma.sprint.findFirst({
      where: { teamId: sprint.teamId, status: "ACTIVE", id: { not: sprint.id } },
      select: { id: true, name: true },
    });
    if (activeSprint) {
      throw new AppError(`Complete "${activeSprint.name}" before starting another active sprint.`, 409, "ACTIVE_SPRINT_EXISTS");
    }
  }

  try {
    const updated = await prisma.sprint.update({
      where: { id: sprint.id },
      data: {
        ...(payload.name !== undefined ? { name: normalizeText(payload.name) } : {}),
        ...(payload.goal !== undefined ? { goal: normalizeText(payload.goal) || null } : {}),
        ...(payload.startDate !== undefined ? { startDate } : {}),
        ...(payload.endDate !== undefined ? { endDate } : {}),
        ...(payload.status !== undefined
          ? { status: payload.status, completedAt: payload.status === "COMPLETED" ? new Date() : null }
          : {}),
      },
      select: sprintSelect,
    });

    if (sprint.status !== "COMPLETED" && updated.status === "COMPLETED") {
      emitSprintCompletedGamificationEvent(updated, actor);
    }

    return toSprintResponse(updated);
  } catch (error) {
    mapSprintPersistenceError(error);
  }
}

export async function startSprintService(actor, sprintId) {
  const sprint = await resolveSprintForActor(actor, sprintId);
  assertCanManage(actor, sprint.team);

  if (sprint.status === "COMPLETED") {
    throw new AppError("Completed sprints cannot be restarted.", 409, "SPRINT_ALREADY_COMPLETED");
  }

  const activeSprint = await prisma.sprint.findFirst({
    where: { teamId: sprint.teamId, status: "ACTIVE", id: { not: sprint.id } },
    select: { id: true, name: true },
  });
  if (activeSprint) {
    throw new AppError(`Complete "${activeSprint.name}" before starting another active sprint.`, 409, "ACTIVE_SPRINT_EXISTS");
  }

  const updated = await prisma.sprint.update({
    where: { id: sprint.id },
    data: { status: "ACTIVE", completedAt: null },
    select: sprintSelect,
  });

  return toSprintResponse(updated);
}

export async function completeSprintService(actor, sprintId) {
  const sprint = await resolveSprintForActor(actor, sprintId);
  assertCanManage(actor, sprint.team);

  if (sprint.status === "COMPLETED") {
    throw new AppError("This sprint is already completed.", 409, "SPRINT_ALREADY_COMPLETED");
  }

  if (sprint.status !== "ACTIVE") {
    throw new AppError("Start the sprint before completing it.", 409, "SPRINT_NOT_ACTIVE");
  }

  const updated = await prisma.sprint.update({
    where: { id: sprint.id },
    data: { status: "COMPLETED", completedAt: new Date() },
    select: sprintSelect,
  });

  emitSprintCompletedGamificationEvent(updated, actor);

  return toSprintResponse(updated);
}

export async function deleteSprintService(actor, sprintId) {
  const sprint = await resolveSprintForActor(actor, sprintId);
  assertCanManage(actor, sprint.team);

  await prisma.$transaction([
    prisma.task.updateMany({
      where: { sprintId: sprint.id },
      data: { sprintId: null, unplanned: false },
    }),
    prisma.sprint.delete({
      where: { id: sprint.id },
    }),
  ]);

  return {
    id: sprint.id,
    teamId: sprint.teamId,
    name: sprint.name,
    releasedTasks: sprint.tasks?.length ?? 0,
  };
}

export async function assignTaskToSprintService(actor, sprintId, taskId, payload = {}) {
  const sprint = await resolveSprintForActor(actor, sprintId);
  assertCanManage(actor, sprint.team);

  if (sprint.status === "COMPLETED") {
    throw new AppError("Move tasks only into planned or active sprints.", 409, "SPRINT_COMPLETED");
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: sprintTaskSelect,
  });
  if (!task) throw new AppError("Task not found.", 404, "TASK_NOT_FOUND");
  if (task.teamId !== sprint.teamId) {
    throw new AppError("This task belongs to another team.", 403, "SPRINT_TASK_TEAM_MISMATCH");
  }
  assertTaskFitsSprintWindow(task, sprint);

  const updated = await prisma.task.update({
    where: { id: task.id },
    data: {
      sprintId: sprint.id,
      ...(payload.storyPoints !== undefined ? { storyPoints: normalizePoints(payload.storyPoints, task.storyPoints) } : {}),
      ...(payload.actualPoints !== undefined
        ? { actualPoints: payload.actualPoints === null ? null : normalizePoints(payload.actualPoints, task.actualPoints ?? task.storyPoints) }
        : {}),
      ...(payload.unplanned !== undefined ? { unplanned: Boolean(payload.unplanned) } : {}),
    },
    select: sprintTaskSelect,
  });

  return toSprintTaskResponse(updated);
}

export async function moveTaskToBacklogService(actor, taskId) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      ...sprintTaskSelect,
      team: {
        select: {
          id: true,
          name: true,
          leader: { select: teamUserSelect },
          doctor: { select: teamUserSelect },
          ta: { select: teamUserSelect },
          members: {
            select: {
              id: true,
              joinedAt: true,
              user: { select: teamUserSelect },
            },
          },
        },
      },
    },
  });

  if (!task) throw new AppError("Task not found.", 404, "TASK_NOT_FOUND");
  assertCanManage(actor, task.team);

  const updated = await prisma.task.update({
    where: { id: task.id },
    data: { sprintId: null, unplanned: false },
    select: sprintTaskSelect,
  });

  return toSprintTaskResponse(updated);
}

export async function updateSprintTaskService(actor, taskId, payload = {}) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      ...sprintTaskSelect,
      team: {
        select: {
          id: true,
          name: true,
          leader: { select: teamUserSelect },
          doctor: { select: teamUserSelect },
          ta: { select: teamUserSelect },
          members: {
            select: {
              id: true,
              joinedAt: true,
              user: { select: teamUserSelect },
            },
          },
        },
      },
    },
  });

  if (!task) throw new AppError("Task not found.", 404, "TASK_NOT_FOUND");
  assertCanManage(actor, task.team);

  const updated = await prisma.task.update({
    where: { id: task.id },
    data: {
      ...(payload.storyPoints !== undefined ? { storyPoints: normalizePoints(payload.storyPoints, task.storyPoints) } : {}),
      ...(payload.actualPoints !== undefined
        ? { actualPoints: payload.actualPoints === null ? null : normalizePoints(payload.actualPoints, task.actualPoints ?? task.storyPoints) }
        : {}),
      ...(payload.unplanned !== undefined ? { unplanned: Boolean(payload.unplanned) } : {}),
    },
    select: sprintTaskSelect,
  });

  return toSprintTaskResponse(updated);
}
