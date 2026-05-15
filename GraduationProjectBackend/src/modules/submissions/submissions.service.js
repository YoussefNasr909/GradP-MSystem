import { AppError } from "../../common/errors/AppError.js";
import {
  buildGamificationIdempotencyKey,
  emitGamificationEvent,
} from "../gamification/gamification.emitter.js";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { ROLES } from "../../common/constants/roles.js";
import { prisma } from "../../loaders/dbLoader.js";
import {
  findSubmissionById,
  listSubmissionsByFilter,
  createSubmission,
  updateSubmission,
  deleteSubmissionById,
  listSubmissionsByTeamAndPhase,
  getLatestVersionForDeliverable,
} from "./submissions.repository.js";
import { findTeamByLeaderId, findTeamMemberByUserId } from "../teams/teams.repository.js";
import { notify } from "../../common/utils/notify.js";

// SDLC phase → required/optional deliverables mapping
const SDLC_PHASE_DELIVERABLES = {
  REQUIREMENTS: {
    required: ["SRS"],
    optional: [],
    label: "Requirements Analysis",
    order: 0,
    description: "Gather, analyze, and document comprehensive project requirements",
  },
  DESIGN: {
    required: ["UML"],
    optional: [],
    label: "System Design",
    order: 1,
    description: "Design system architecture, database schema, and user interfaces",
  },
  IMPLEMENTATION: {
    required: ["CODE"],
    optional: ["PROTOTYPE"],
    label: "Implementation & Development",
    order: 2,
    description: "Develop the system following design specifications",
  },
  TESTING: {
    required: ["TEST_PLAN"],
    optional: [],
    label: "Testing & Quality Assurance",
    order: 3,
    description: "Comprehensive testing to verify functionality and quality",
  },
  DEPLOYMENT: {
    required: ["FINAL_REPORT", "PRESENTATION"],
    optional: [],
    label: "Deployment & Release",
    order: 4,
    description: "Deploy the system and produce final deliverables",
  },
  MAINTENANCE: {
    required: [],
    optional: [],
    label: "Maintenance & Support",
    order: 5,
    description: "Ongoing monitoring, bug fixes, and enhancements",
  },
};

// Which SDLC phase each deliverable type belongs to
const DELIVERABLE_TO_PHASE = {
  SRS: "REQUIREMENTS",
  UML: "DESIGN",
  PROTOTYPE: "IMPLEMENTATION",
  CODE: "IMPLEMENTATION",
  TEST_PLAN: "TESTING",
  FINAL_REPORT: "DEPLOYMENT",
  PRESENTATION: "DEPLOYMENT",
};

const STAGE_ORDER = [
  "REQUIREMENTS",
  "DESIGN",
  "IMPLEMENTATION",
  "TESTING",
  "DEPLOYMENT",
  "MAINTENANCE",
];

function buildFullName(user) {
  return `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
}

async function hashUploadedSubmissionFile(file) {
  if (!file?.path) return null;

  const buffer = await fs.readFile(file.path);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function normalizeSubmissionText(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export async function hashUploadedSubmissionText(file) {
  if (!file?.path) return null;

  const name = String(file.originalname ?? "").toLowerCase();
  const isTextFile = file.mimetype === "text/plain" || name.endsWith(".txt");
  if (!isTextFile) return null;

  const text = await fs.readFile(file.path, "utf8");
  const normalized = normalizeSubmissionText(text);
  if (!normalized) return null;
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export function buildContentFingerprint({ fileHash, deliverableType, sdlcPhase, fileSize }) {
  if (!fileHash) return null;

  return crypto
    .createHash("sha256")
    .update([fileHash, deliverableType, sdlcPhase, fileSize ?? ""].join(":"))
    .digest("hex");
}

function toSubmissionResponse(submission) {
  return {
    ...submission,
    submittedBy: submission.submittedBy
      ? { ...submission.submittedBy, fullName: buildFullName(submission.submittedBy) }
      : null,
    reviewedBy: submission.reviewedBy
      ? { ...submission.reviewedBy, fullName: buildFullName(submission.reviewedBy) }
      : null,
    taReviewedBy: submission.taReviewedBy
      ? { ...submission.taReviewedBy, fullName: buildFullName(submission.taReviewedBy) }
      : null,
  };
}

export function normalizeRubric(rubric) {
  if (!Array.isArray(rubric)) return null;
  return rubric.map((item) => {
    const normalized = {
      name: String(item.name),
      score: Number(item.score),
      maxScore: Number(item.maxScore),
    };
    if (normalized.score > normalized.maxScore) {
      throw new AppError(
        `"${normalized.name}" score cannot exceed its max score.`,
        422,
        "RUBRIC_SCORE_EXCEEDS_MAX",
      );
    }
    return normalized;
  });
}

export function getRubricScaledScore(rubric) {
  const normalized = normalizeRubric(rubric);
  if (!normalized || normalized.length === 0) return null;
  const total = normalized.reduce((sum, item) => sum + item.score, 0);
  const possible = normalized.reduce((sum, item) => sum + item.maxScore, 0);
  return possible > 0 ? Math.round((total / possible) * 100) : null;
}

export function assertRubricGradeMatches({ grade, rubric, overrideReason }) {
  const rubricScore = getRubricScaledScore(rubric);
  if (rubricScore === null || rubricScore === grade) return rubricScore;

  if (!overrideReason || overrideReason.trim().length < 5) {
    throw new AppError(
      `Final grade (${grade}/100) differs from the rubric total (${rubricScore}/100). Provide an override reason.`,
      422,
      "RUBRIC_OVERRIDE_REASON_REQUIRED",
    );
  }

  return rubricScore;
}

function appendGradeHistory(submission, event) {
  const existing = Array.isArray(submission.gradeHistory) ? submission.gradeHistory : [];
  return [...existing, event];
}

function buildHistoryEvent(actor, event, details = {}) {
  return {
    event,
    by: actor.id,
    byName: buildFullName(actor),
    byRole: actor.role,
    at: new Date().toISOString(),
    ...details,
  };
}

export function getLatestPhaseSubmission(submissions = []) {
  if (!Array.isArray(submissions) || submissions.length === 0) {
    return null;
  }

  return [...submissions].sort((a, b) => {
    const aTime = new Date(a.submittedAt ?? a.createdAt ?? 0).getTime();
    const bTime = new Date(b.submittedAt ?? b.createdAt ?? 0).getTime();
    return bTime - aTime;
  })[0];
}

export function assertPhaseSubmissionGate(phaseSubmissions = [], deliverableType, sdlcPhase) {
  const latestSubmission = getLatestPhaseSubmission(phaseSubmissions);

  if (!latestSubmission) {
    return;
  }

  if (latestSubmission.status === "PENDING") {
    throw new AppError(
      `A ${sdlcPhase} deliverable is still pending review. Wait for approval before submitting another deliverable in this phase.`,
      409,
      "SUBMISSION_PHASE_REVIEW_PENDING",
    );
  }

  if (
    latestSubmission.status === "REVISION_REQUIRED" &&
    latestSubmission.deliverableType !== deliverableType
  ) {
    throw new AppError(
      `Revise the ${latestSubmission.deliverableType} deliverable before submitting another deliverable in this phase.`,
      409,
      "SUBMISSION_PHASE_LOCKED_BY_REVISION",
    );
  }
}

async function resolveActorTeam(actor) {
  if (actor.role === ROLES.LEADER) {
    return findTeamByLeaderId(actor.id);
  }
  if (actor.role === ROLES.STUDENT) {
    const membership = await findTeamMemberByUserId(actor.id);
    return membership?.team ?? null;
  }
  return null;
}

async function resolveVisibleTeamIds(actor) {
  if (actor.role === ROLES.LEADER) {
    const team = await findTeamByLeaderId(actor.id);
    return team ? [team.id] : [];
  }
  if (actor.role === ROLES.STUDENT) {
    const membership = await findTeamMemberByUserId(actor.id);
    return membership?.team?.id ? [membership.team.id] : [];
  }
  if (actor.role === ROLES.DOCTOR) {
    const teams = await prisma.team.findMany({ where: { doctorId: actor.id }, select: { id: true } });
    return teams.map((t) => t.id);
  }
  if (actor.role === ROLES.TA) {
    const teams = await prisma.team.findMany({ where: { taId: actor.id }, select: { id: true } });
    return teams.map((t) => t.id);
  }
  if (actor.role === ROLES.ADMIN) return null; // null = all teams
  return [];
}

export async function listSubmissionsService(actor, query) {
  let visibleTeamIds = await resolveVisibleTeamIds(actor);

  if (visibleTeamIds !== null && visibleTeamIds.length === 0) {
    return [];
  }

  if (query.teamId) {
    if (visibleTeamIds !== null && !visibleTeamIds.includes(query.teamId)) {
      throw new AppError("You do not have access to this team's submissions.", 403, "SUBMISSIONS_FORBIDDEN");
    }
    visibleTeamIds = [query.teamId];
  }

  const submissions = await listSubmissionsByFilter({
    teamIds: visibleTeamIds,
    sdlcPhase: query.sdlcPhase,
    deliverableType: query.deliverableType,
    status: query.status,
  });

  return submissions.map(toSubmissionResponse);
}

export async function createSubmissionService(actor, payload, file) {
  if (actor.role !== ROLES.LEADER) {
    throw new AppError("Only the team leader can submit deliverables.", 403, "SUBMISSION_CREATE_FORBIDDEN");
  }

  const team = await findTeamByLeaderId(actor.id);
  if (!team) {
    throw new AppError("You must have a team to submit deliverables.", 403, "NO_TEAM");
  }

  const { deliverableType, sdlcPhase, title, notes, deadline, fileUrl } = payload;

  // Validate deliverable belongs to the claimed SDLC phase
  const expectedPhase = DELIVERABLE_TO_PHASE[deliverableType];
  if (expectedPhase && expectedPhase !== sdlcPhase) {
    throw new AppError(
      `"${deliverableType}" belongs to the "${expectedPhase}" phase, not "${sdlcPhase}".`,
      422,
      "SUBMISSION_PHASE_MISMATCH",
    );
  }

  const phaseSubmissions = await listSubmissionsByTeamAndPhase(team.id, sdlcPhase);
  assertPhaseSubmissionGate(phaseSubmissions, deliverableType, sdlcPhase);

  const latestVersion = await getLatestVersionForDeliverable(team.id, deliverableType);
  const version = latestVersion + 1;
  const isLate = deadline ? new Date() > new Date(deadline) : false;
  const fileHash = await hashUploadedSubmissionFile(file);
  const normalizedTextHash = await hashUploadedSubmissionText(file);
  const contentFingerprint = buildContentFingerprint({
    fileHash,
    deliverableType,
    sdlcPhase,
    fileSize: file?.size,
  });

  const data = {
    teamId: team.id,
    deliverableType,
    sdlcPhase,
    sourceType: "MANUAL_UPLOAD",
    title: title || null,
    notes: notes || null,
    status: "PENDING",
    version,
    late: isLate,
    deadline: deadline ? new Date(deadline) : null,
    submittedByUserId: actor.id,
    submittedAt: new Date(),
    fileHash,
    normalizedTextHash,
    contentFingerprint,
    ...(file && {
      fileName: file.originalname,
      fileSize: file.size,
      fileType: (file.originalname || "").split(".").pop()?.toUpperCase() || "FILE",
      fileUrl,
    }),
  };

  const submission = await createSubmission(data);

  // Notify the team's TA (or doctor as fallback) that a new submission is ready
  // for first-pass review. This is the loop-closing notification that was
  // previously missing — supervisors no longer have to manually check.
  const reviewerUserId = team.taId ?? team.doctorId ?? null;
  if (reviewerUserId) {
    await notify({
      userId: reviewerUserId,
      type: "SUBMISSION_FEEDBACK",
      title: "New Submission to Review",
      message: `${buildFullName(actor)} submitted "${deliverableType}" for ${team.name}. ${team.taId ? "Please run a first-pass review." : "Please review and grade."}`,
      actionUrl: "/dashboard/submissions",
    });
  }

  return toSubmissionResponse(submission);
}

export async function getSubmissionService(actor, submissionId) {
  const submission = await findSubmissionById(submissionId);
  if (!submission) {
    throw new AppError("Submission not found.", 404, "SUBMISSION_NOT_FOUND");
  }

  const visibleTeamIds = await resolveVisibleTeamIds(actor);
  if (visibleTeamIds !== null && !visibleTeamIds.includes(submission.teamId)) {
    throw new AppError("You do not have access to this submission.", 403, "SUBMISSION_FORBIDDEN");
  }

  return toSubmissionResponse(submission);
}

async function assertSupervisorForTeam(actor, teamId) {
  if (actor.role === ROLES.ADMIN) return;
  const team = await prisma.team.findFirst({
    where: { id: teamId, OR: [{ doctorId: actor.id }, { taId: actor.id }] },
  });
  if (!team) {
    throw new AppError("You are not a supervisor for this team.", 403, "SUBMISSION_SUPERVISOR_FORBIDDEN");
  }
}

/**
 * TA first-pass review.
 * TA submits a *recommendation* \u2014 grade is NOT final.
 * Status moves to UNDER_REVIEW so the doctor knows to finalize.
 */
export async function taReviewSubmissionService(actor, submissionId, { recommendedGrade, feedback, rubric }) {
  if (actor.role !== ROLES.TA && actor.role !== ROLES.ADMIN) {
    throw new AppError("Only the team TA can submit a first-pass review.", 403, "SUBMISSION_TA_REVIEW_FORBIDDEN");
  }

  const submission = await findSubmissionById(submissionId);
  if (!submission) {
    throw new AppError("Submission not found.", 404, "SUBMISSION_NOT_FOUND");
  }

  await assertSupervisorForTeam(actor, submission.teamId);

  if (!["PENDING", "REVISION_REQUIRED"].includes(submission.status)) {
    throw new AppError(
      "TA first-pass review is only available for pending submissions or revised submissions.",
      409,
      "SUBMISSION_TA_REVIEW_BAD_STATE",
    );
  }

  const normalizedRubric = normalizeRubric(rubric);

  const updated = await updateSubmission(submissionId, {
    taRecommendedGrade: recommendedGrade,
    taFeedback: feedback || null,
    taReviewedByUserId: actor.id,
    taReviewedAt: new Date(),
    status: "UNDER_REVIEW",
    ...(normalizedRubric ? { rubric: normalizedRubric } : {}),
    gradeHistory: appendGradeHistory(
      submission,
      buildHistoryEvent(actor, "ta_reviewed", {
        recommendedGrade,
        feedback: feedback || null,
        rubric: normalizedRubric,
      }),
    ),
  });

  // Notify the doctor that a TA recommendation is ready
  const team = await prisma.team.findUnique({
    where: { id: submission.teamId },
    select: { doctorId: true },
  });
  if (team?.doctorId) {
    await notify({
      userId: team.doctorId,
      type: "SUBMISSION_FEEDBACK",
      title: "TA Review Ready for Final Grade",
      message: `${buildFullName(actor)} reviewed "${submission.deliverableType}" and recommended ${recommendedGrade}/100. Awaiting your final grade.`,
      actionUrl: "/dashboard/submissions",
    });
  }

  // Also let the submitter know review is in progress
  const submitterUserId = submission.submittedByUserId ?? submission.submittedBy?.id ?? null;
  if (submitterUserId) {
    await notify({
      userId: submitterUserId,
      type: "SUBMISSION_FEEDBACK",
      title: "Submission Under Review",
      message: `Your "${submission.deliverableType}" submission has been reviewed by the TA and is awaiting the doctor's final grade.`,
      actionUrl: "/dashboard/submissions",
    });
  }

  return toSubmissionResponse(updated);
}

/**
 * Doctor final grade.
 * Doctor sets the authoritative grade and approves the submission.
 *
 * If the submission was previously APPROVED and is being re-graded (after
 * an unlock), the prior state is pushed onto Submission.gradeHistory as an
 * audit trail entry.
 */
export async function gradeSubmissionService(actor, submissionId, { grade, feedback, rubric, reason, overrideReason }) {
  if (actor.role !== ROLES.DOCTOR && actor.role !== ROLES.ADMIN) {
    throw new AppError("Only the team doctor can finalize the grade.", 403, "SUBMISSION_GRADE_FORBIDDEN");
  }

  const submission = await findSubmissionById(submissionId);
  if (!submission) {
    throw new AppError("Submission not found.", 404, "SUBMISSION_NOT_FOUND");
  }

  await assertSupervisorForTeam(actor, submission.teamId);

  if (submission.status === "APPROVED") {
    throw new AppError("This submission is already approved. Unlock it first to re-grade.", 409, "SUBMISSION_ALREADY_APPROVED");
  }

  const team = await prisma.team.findUnique({
    where: { id: submission.teamId },
    select: { taId: true },
  });
  const hasAssignedTa = Boolean(team?.taId);
  const hasTaRecommendation = submission.taRecommendedGrade !== null && submission.taRecommendedGrade !== undefined;
  if (hasAssignedTa && (submission.status !== "UNDER_REVIEW" || !hasTaRecommendation)) {
    throw new AppError(
      "This team has a TA assigned. The TA must submit a first-pass recommendation before the doctor finalizes the grade.",
      409,
      "SUBMISSION_TA_REVIEW_REQUIRED",
    );
  }

  if (submission.sdlcPhase === "DEPLOYMENT") {
    if (!submission.defenseMeetingId) {
      throw new AppError(
        "Link a completed defense meeting before finalizing deployment deliverables.",
        409,
        "SUBMISSION_DEFENSE_REQUIRED",
      );
    }
    const meeting = await prisma.meeting.findUnique({
      where: { id: submission.defenseMeetingId },
      select: { status: true },
    });
    if (!meeting || meeting.status !== "COMPLETED") {
      throw new AppError(
        "The linked defense meeting must be marked completed before final grading.",
        409,
        "SUBMISSION_DEFENSE_INCOMPLETE",
      );
    }
  }

  const normalizedRubric = normalizeRubric(rubric);
  const finalOverrideReason = overrideReason || reason || null;
  const rubricScore = assertRubricGradeMatches({ grade, rubric: normalizedRubric, overrideReason: finalOverrideReason });

  const existingHistory = Array.isArray(submission.gradeHistory) ? submission.gradeHistory : [];
  const wasReGrade = existingHistory.some((entry) => entry?.event === "unlocked") || submission.grade !== null;
  const historyEvent = buildHistoryEvent(actor, wasReGrade ? "regraded" : "finalized", {
    previousGrade: submission.grade,
    newGrade: grade,
    feedback: feedback || null,
    rubric: normalizedRubric,
    rubricScore,
    overrideReason: finalOverrideReason,
    taRecommendedGrade: submission.taRecommendedGrade ?? null,
    noTaAssigned: !hasAssignedTa,
  });

  const updated = await updateSubmission(submissionId, {
    grade,
    feedback: feedback || null,
    status: "APPROVED",
    reviewedByUserId: actor.id,
    reviewedAt: new Date(),
    ...(normalizedRubric ? { rubric: normalizedRubric } : {}),
    gradeHistory: [...existingHistory, historyEvent],
  });

  // Notify the submitter their submission was graded
  const submitterUserId = submission.submittedByUserId ?? submission.submittedBy?.id ?? null;
  if (submitterUserId) {
    const gradeText = ` \u2014 Grade: ${grade}/100`;
    await notify({
      userId: submitterUserId,
      type: "SUBMISSION_GRADED",
      title: "Submission Graded",
      message: `Your "${submission.deliverableType}" submission has been approved by ${buildFullName(actor)}${gradeText}.`,
      actionUrl: "/dashboard/submissions",
    });
  } else {
    console.warn(`[notify] gradeSubmission: could not resolve submitter userId for submission ${submissionId}`);
  }

  // Close the loop with the TA who first-pass reviewed (if any).
  // Their work isn't invisible \u2014 they hear back when the doctor finalizes.
  const taReviewerId = submission.taReviewedByUserId ?? submission.taReviewedBy?.id ?? null;
  if (taReviewerId && taReviewerId !== actor.id) {
    const matchedRec = submission.taRecommendedGrade !== null && submission.taRecommendedGrade !== undefined
      ? ` (you recommended ${submission.taRecommendedGrade})`
      : "";
    await notify({
      userId: taReviewerId,
      type: "SUBMISSION_GRADED",
      title: "Your Review Was Finalized",
      message: `${buildFullName(actor)} finalized "${submission.deliverableType}" at ${grade}/100${matchedRec}.`,
      actionUrl: "/dashboard/submissions",
    });
  }

  // Auto-suggest stage advance: if this approval was the last required
  // deliverable for the team's current phase, nudge the leader.
  await maybeNudgeStageAdvance(submission.teamId, submission.sdlcPhase);

  // Gamification: emit SUBMISSION_APPROVED event
  emitGamificationEvent({
    eventType: "SUBMISSION_APPROVED",
    sourceType: "Submission",
    sourceId: submissionId,
    idempotencyKey: buildGamificationIdempotencyKey(
      "SUBMISSION_APPROVED",
      submissionId,
      `v${submission.version ?? 1}`,
      updated.reviewedAt.toISOString(),
    ),
    teamId: submission.teamId,
    actorUserId: actor.id,
    payload: {
      deliverableType: submission.deliverableType,
      sdlcPhase: submission.sdlcPhase,
      grade,
      version: submission.version ?? 1,
      submittedByUserId: submission.submittedByUserId ?? submission.submittedBy?.id ?? null,
    },
  });

  return toSubmissionResponse(updated);
}

/**
 * Internal helper. Called after a doctor finalizes a submission grade —
 * checks whether all required deliverables in the team's current phase are
 * now APPROVED, and if so notifies the leader they can advance the stage.
 *
 * Silent if anything is missing / the team has already advanced. Errors are
 * swallowed because this is a notification courtesy, never the critical path.
 */
async function maybeNudgeStageAdvance(teamId, approvedPhase) {
  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, stage: true, leaderId: true },
    });
    if (!team) return;
    // Only nudge if the approved submission was for the team's CURRENT phase.
    // (Doctors can also approve back-fills from earlier phases — we ignore those.)
    if (team.stage !== approvedPhase) return;

    const config = SDLC_PHASE_DELIVERABLES[team.stage];
    if (!config || config.required.length === 0) return;

    // Are all required deliverables for this phase now APPROVED?
    const approved = await prisma.submission.findMany({
      where: {
        teamId,
        sdlcPhase: team.stage,
        status: "APPROVED",
        deliverableType: { in: config.required },
      },
      select: { deliverableType: true },
    });
    const approvedSet = new Set(approved.map((s) => s.deliverableType));
    const allDone = config.required.every((d) => approvedSet.has(d));
    if (!allDone) return;

    const currentIdx = STAGE_ORDER.indexOf(team.stage);
    const nextStage = STAGE_ORDER[currentIdx + 1];
    if (!nextStage) return; // Already in final stage

    // Avoid notification spam: don't nudge twice in a row.
    // We check whether the leader already has an unread "ready to advance" notification.
    const existing = await prisma.notification.findFirst({
      where: {
        userId: team.leaderId,
        type: "SYSTEM",
        read: false,
        title: { startsWith: "Ready to advance" },
      },
      select: { id: true },
    });
    if (existing) return;

    await notify({
      userId: team.leaderId,
      type: "SYSTEM",
      title: `Ready to advance to ${nextStage}`,
      message: `All required deliverables for ${team.stage} have been approved. You can advance your project to the ${nextStage} phase from the Submissions page.`,
      actionUrl: "/dashboard/submissions",
    });
  } catch (err) {
    // Best-effort: never let a notification failure block a grade save.
    console.warn(`[notify] maybeNudgeStageAdvance failed for team ${teamId}:`, err?.message);
  }
}

export async function requestRevisionService(actor, submissionId, { feedback }) {
  if (actor.role !== ROLES.DOCTOR && actor.role !== ROLES.TA && actor.role !== ROLES.ADMIN) {
    throw new AppError("Only supervisors can request revisions.", 403, "SUBMISSION_REVISION_FORBIDDEN");
  }

  const submission = await findSubmissionById(submissionId);
  if (!submission) {
    throw new AppError("Submission not found.", 404, "SUBMISSION_NOT_FOUND");
  }

  await assertSupervisorForTeam(actor, submission.teamId);

  if (submission.status === "APPROVED") {
    throw new AppError("Cannot request revision on an approved submission.", 409, "SUBMISSION_ALREADY_APPROVED");
  }

  const revisionData =
    actor.role === ROLES.TA
      ? {
          taFeedback: feedback,
          taReviewedByUserId: actor.id,
          taReviewedAt: new Date(),
        }
      : {
          feedback,
          reviewedByUserId: actor.id,
          reviewedAt: new Date(),
        };

  const updated = await updateSubmission(submissionId, {
    ...revisionData,
    status: "REVISION_REQUIRED",
    gradeHistory: appendGradeHistory(
      submission,
      buildHistoryEvent(actor, "revision_requested", { feedback }),
    ),
  });

  // Notify the submitter that changes are needed
  const submitterUserId = submission.submittedByUserId ?? submission.submittedBy?.id ?? null;
  if (submitterUserId) {
    await notify({
      userId: submitterUserId,
      type: "SUBMISSION_FEEDBACK",
      title: "Revision Requested",
      message: `${buildFullName(actor)} has requested revisions on your "${submission.deliverableType}" submission: "${feedback}".`,
      actionUrl: "/dashboard/submissions",
    });
  } else {
    console.warn(`[notify] requestRevision: could not resolve submitter userId for submission ${submissionId}`);
  }

  return toSubmissionResponse(updated);
}

export async function deleteSubmissionService(actor, submissionId) {
  if (actor.role !== ROLES.LEADER && actor.role !== ROLES.ADMIN) {
    throw new AppError("Only the team leader can delete submissions.", 403, "SUBMISSION_DELETE_FORBIDDEN");
  }

  const submission = await findSubmissionById(submissionId);
  if (!submission) {
    throw new AppError("Submission not found.", 404, "SUBMISSION_NOT_FOUND");
  }

  if (actor.role === ROLES.LEADER) {
    const team = await findTeamByLeaderId(actor.id);
    if (!team || team.id !== submission.teamId) {
      throw new AppError("You can only delete your own team's submissions.", 403, "SUBMISSION_DELETE_FORBIDDEN");
    }
  }

  if (submission.status === "APPROVED") {
    throw new AppError("Cannot delete an approved submission.", 409, "SUBMISSION_APPROVED_IMMUTABLE");
  }

  return deleteSubmissionById(submissionId);
}

export async function getSDLCSummaryService(actor, query) {
  let teamId = query.teamId;

  if (!teamId) {
    const team = await resolveActorTeam(actor);
    if (team) {
      teamId = team.id;
    } else if (actor.role === ROLES.DOCTOR) {
      const teams = await prisma.team.findMany({ where: { doctorId: actor.id }, select: { id: true } });
      if (teams.length === 1) teamId = teams[0].id;
    } else if (actor.role === ROLES.TA) {
      const teams = await prisma.team.findMany({ where: { taId: actor.id }, select: { id: true } });
      if (teams.length === 1) teamId = teams[0].id;
    }
  }

  if (!teamId) {
    throw new AppError("teamId is required.", 422, "TEAM_ID_REQUIRED");
  }

  const visibleTeamIds = await resolveVisibleTeamIds(actor);
  if (visibleTeamIds !== null && !visibleTeamIds.includes(teamId)) {
    throw new AppError("You do not have access to this team's SDLC data.", 403, "SDLC_FORBIDDEN");
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, stage: true },
  });

  if (!team) {
    throw new AppError("Team not found.", 404, "TEAM_NOT_FOUND");
  }

  const currentStageIndex = STAGE_ORDER.indexOf(team.stage);

  const phases = await Promise.all(
    Object.entries(SDLC_PHASE_DELIVERABLES).map(async ([phase, config]) => {
      const submissions = await listSubmissionsByTeamAndPhase(teamId, phase);
      const approvedTypes = new Set(
        submissions.filter((s) => s.status === "APPROVED").map((s) => s.deliverableType),
      );

      const requiredApproved = config.required.filter((d) => approvedTypes.has(d)).length;
      const requiredComplete = config.required.every((d) => approvedTypes.has(d));

      let progress;
      if (config.required.length === 0) {
        progress = 100;
      } else {
        progress = Math.round((requiredApproved / config.required.length) * 100);
      }

      const stageIndex = STAGE_ORDER.indexOf(phase);
      let status;
      if (stageIndex < currentStageIndex) {
        status = "completed";
      } else if (stageIndex === currentStageIndex) {
        status = requiredComplete ? "completed" : "in-progress";
      } else {
        status = "upcoming";
      }

      return {
        phase,
        label: config.label,
        description: config.description,
        order: config.order,
        status,
        progress,
        requiredDeliverables: config.required,
        optionalDeliverables: config.optional,
        requiredComplete,
        submissions: submissions.map(toSubmissionResponse),
        canAdvance: stageIndex === currentStageIndex && requiredComplete && stageIndex < STAGE_ORDER.length - 1,
      };
    }),
  );

  const currentPhaseData = phases.find((p) => p.phase === team.stage) || null;
  const overallProgress = Math.round(phases.reduce((acc, p) => acc + p.progress, 0) / phases.length);
  const nextStage = STAGE_ORDER[currentStageIndex + 1] ?? null;

  return {
    team: { id: team.id, name: team.name, stage: team.stage },
    currentPhase: currentPhaseData,
    overallProgress,
    phases,
    canAdvanceStage: currentPhaseData?.canAdvance ?? false,
    nextStage,
  };
}

export async function advanceStageService(actor, query) {
  if (actor.role !== ROLES.LEADER && actor.role !== ROLES.ADMIN) {
    throw new AppError("Only the team leader can advance the project stage.", 403, "ADVANCE_STAGE_FORBIDDEN");
  }

  let team;
  if (actor.role === ROLES.LEADER) {
    team = await findTeamByLeaderId(actor.id);
    if (!team) throw new AppError("You do not have a team.", 403, "NO_TEAM");
  } else {
    if (!query.teamId) throw new AppError("teamId is required.", 422, "TEAM_ID_REQUIRED");
    team = await prisma.team.findUnique({ where: { id: query.teamId } });
    if (!team) throw new AppError("Team not found.", 404, "TEAM_NOT_FOUND");
  }

  const currentIndex = STAGE_ORDER.indexOf(team.stage);
  if (currentIndex === STAGE_ORDER.length - 1) {
    throw new AppError("Team is already in the final SDLC stage.", 409, "ALREADY_FINAL_STAGE");
  }

  const currentConfig = SDLC_PHASE_DELIVERABLES[team.stage];
  if (currentConfig.required.length > 0) {
    const approved = await prisma.submission.findMany({
      where: {
        teamId: team.id,
        sdlcPhase: team.stage,
        status: "APPROVED",
        deliverableType: { in: currentConfig.required },
      },
      select: { deliverableType: true },
    });
    const approvedTypes = new Set(approved.map((s) => s.deliverableType));
    const missing = currentConfig.required.filter((d) => !approvedTypes.has(d));

    if (missing.length > 0) {
      throw new AppError(
        `Cannot advance. The following deliverables must be approved first: ${missing.join(", ")}.`,
        422,
        "REQUIRED_DELIVERABLES_NOT_APPROVED",
      );
    }
  }

  const nextStage = STAGE_ORDER[currentIndex + 1];
  const updated = await prisma.team.update({
    where: { id: team.id },
    data: { stage: nextStage },
    select: { id: true, name: true, stage: true },
  });

  // Notify the leader + all team members about the stage change
  const fullTeam = await prisma.team.findUnique({
    where: { id: team.id },
    select: {
      leaderId: true,
      members: { select: { userId: true } },
    },
  });

  if (fullTeam) {
    const memberUserIds = fullTeam.members.map((m) => m.userId);
    const allUserIds = [fullTeam.leaderId, ...memberUserIds];

    await Promise.all(
      allUserIds.map((userId) =>
        notify({
          userId,
          type: "SYSTEM",
          title: "Project Stage Advanced",
          message: `Your team's project has moved to the "${nextStage}" phase. Time to focus on the next deliverables!`,
          actionUrl: "/dashboard/submissions",
        }),
      ),
    );
  }
  // Gamification: emit TEAM_STAGE_ADVANCED event
  emitGamificationEvent({
    eventType: "TEAM_STAGE_ADVANCED",
    sourceType: "Team",
    sourceId: team.id,
    idempotencyKey: buildGamificationIdempotencyKey(
      "TEAM_STAGE_ADVANCED",
      team.id,
      nextStage,
    ),
    teamId: team.id,
    actorUserId: actor.id,
    payload: {
      previousStage: team.stage,
      newStage: nextStage,
      transitionKey: `${team.stage}->${nextStage}`,
    },
  });

  return {
    team: updated,
    previousStage: team.stage,
    newStage: nextStage,
    message: `Project advanced to ${nextStage} stage.`,
  };
}

/**
 * Unlock an APPROVED submission so the doctor can revise the grade.
 * Pushes the current state onto gradeHistory before reverting status.
 */
export async function unlockSubmissionService(actor, submissionId, { reason }) {
  if (actor.role !== ROLES.DOCTOR && actor.role !== ROLES.ADMIN) {
    throw new AppError("Only the team doctor can unlock a submission.", 403, "SUBMISSION_UNLOCK_FORBIDDEN");
  }

  const submission = await findSubmissionById(submissionId);
  if (!submission) {
    throw new AppError("Submission not found.", 404, "SUBMISSION_NOT_FOUND");
  }

  await assertSupervisorForTeam(actor, submission.teamId);

  if (submission.status !== "APPROVED") {
    throw new AppError("Only approved submissions can be unlocked.", 409, "SUBMISSION_NOT_APPROVED");
  }

  if (!reason || reason.trim().length < 5) {
    throw new AppError("Provide a reason (min 5 characters) for unlocking the grade.", 422, "UNLOCK_REASON_REQUIRED");
  }

  // Snapshot the current grade state for the audit trail
  const existingHistory = Array.isArray(submission.gradeHistory) ? submission.gradeHistory : [];
  const snapshot = buildHistoryEvent(actor, "unlocked", {
    snapshotGrade: submission.grade,
    snapshotFeedback: submission.feedback,
    snapshotRubric: submission.rubric ?? null,
    snapshotReviewedBy: submission.reviewedBy?.fullName ?? null,
    snapshotReviewedAt: submission.reviewedAt,
    reason: reason.trim(),
  });

  const updated = await updateSubmission(submissionId, {
    status: "UNDER_REVIEW",
    gradeHistory: [...existingHistory, snapshot],
  });

  // Notify the submitter + TA that the grade is being revised
  const submitterUserId = submission.submittedByUserId ?? submission.submittedBy?.id ?? null;
  if (submitterUserId) {
    await notify({
      userId: submitterUserId,
      type: "SUBMISSION_FEEDBACK",
      title: "Grade Under Revision",
      message: `${buildFullName(actor)} unlocked the "${submission.deliverableType}" grade for revision. Reason: ${reason.trim()}`,
      actionUrl: "/dashboard/submissions",
    });
  }
  const taReviewerId = submission.taReviewedByUserId ?? null;
  if (taReviewerId && taReviewerId !== actor.id) {
    await notify({
      userId: taReviewerId,
      type: "SUBMISSION_FEEDBACK",
      title: "Submission Grade Reopened",
      message: `${buildFullName(actor)} reopened "${submission.deliverableType}" for re-grading.`,
      actionUrl: "/dashboard/submissions",
    });
  }

  return toSubmissionResponse(updated);
}

/**
 * Bulk approve multiple submissions in one call.
 * Doctor + Admin only. Skips items where the actor isn't a supervisor.
 * Returns { approved: [...ids], skipped: [{id, reason}] }.
 */
export async function bulkApproveSubmissionsService(actor, { submissionIds, feedback }) {
  if (actor.role !== ROLES.DOCTOR && actor.role !== ROLES.ADMIN) {
    throw new AppError("Only the team doctor can bulk approve submissions.", 403, "BULK_GRADE_FORBIDDEN");
  }
  if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
    throw new AppError("Provide at least one submission id.", 422, "BULK_GRADE_EMPTY");
  }
  if (submissionIds.length > 50) {
    throw new AppError("Cannot bulk approve more than 50 submissions at once.", 422, "BULK_GRADE_TOO_MANY");
  }

  const approved = [];
  const skipped = [];
  for (const id of submissionIds) {
    try {
      const sub = await findSubmissionById(id);
      if (!sub) { skipped.push({ id, reason: "Not found" }); continue; }
      if (sub.status === "APPROVED") { skipped.push({ id, reason: "Already approved" }); continue; }
      if (sub.status !== "UNDER_REVIEW") { skipped.push({ id, reason: "Awaiting TA first-pass review" }); continue; }
      if (sub.taRecommendedGrade === null || sub.taRecommendedGrade === undefined) {
        skipped.push({ id, reason: "Missing TA recommendation" });
        continue;
      }

      // Doctor must supervise the team (admin bypasses)
      if (actor.role !== ROLES.ADMIN) {
        const team = await prisma.team.findFirst({
          where: { id: sub.teamId, doctorId: actor.id },
          select: { id: true },
        });
        if (!team) { skipped.push({ id, reason: "Not your team" }); continue; }
      }

      if (sub.sdlcPhase === "DEPLOYMENT") {
        if (!sub.defenseMeetingId) { skipped.push({ id, reason: "Defense meeting required" }); continue; }
        const meeting = await prisma.meeting.findUnique({
          where: { id: sub.defenseMeetingId },
          select: { status: true },
        });
        if (!meeting || meeting.status !== "COMPLETED") {
          skipped.push({ id, reason: "Defense meeting incomplete" });
          continue;
        }
      }

      const finalGrade = sub.taRecommendedGrade;

      await updateSubmission(id, {
        grade: finalGrade,
        feedback: feedback || sub.taFeedback || "Bulk approved.",
        status: "APPROVED",
        reviewedByUserId: actor.id,
        reviewedAt: new Date(),
        gradeHistory: appendGradeHistory(
          sub,
          buildHistoryEvent(actor, "bulk_finalized", {
            newGrade: finalGrade,
            feedback: feedback || sub.taFeedback || "Bulk approved.",
            taRecommendedGrade: sub.taRecommendedGrade,
          }),
        ),
      });

      // Notify submitter + TA
      const submitterUserId = sub.submittedByUserId ?? sub.submittedBy?.id ?? null;
      if (submitterUserId) {
        await notify({
          userId: submitterUserId,
          type: "SUBMISSION_GRADED",
          title: "Submission Graded",
          message: `Your "${sub.deliverableType}" submission was approved at ${finalGrade}/100.`,
          actionUrl: "/dashboard/submissions",
        });
      }
      const taReviewerId = sub.taReviewedByUserId ?? null;
      if (taReviewerId && taReviewerId !== actor.id) {
        await notify({
          userId: taReviewerId,
          type: "SUBMISSION_GRADED",
          title: "Your Review Was Finalized",
          message: `${buildFullName(actor)} approved "${sub.deliverableType}" (bulk action).`,
          actionUrl: "/dashboard/submissions",
        });
      }

      // Gamification: emit SUBMISSION_APPROVED for each bulk-approved submission
      emitGamificationEvent({
        eventType: "SUBMISSION_APPROVED",
        sourceType: "Submission",
        sourceId: id,
        idempotencyKey: buildGamificationIdempotencyKey(
          "SUBMISSION_APPROVED",
          id,
          `v${sub.version ?? 1}`,
          "bulk",
        ),
        teamId: sub.teamId,
        actorUserId: actor.id,
        payload: {
          deliverableType: sub.deliverableType,
          sdlcPhase: sub.sdlcPhase,
          grade: finalGrade,
          version: sub.version ?? 1,
          submittedByUserId: sub.submittedByUserId ?? sub.submittedBy?.id ?? null,
          bulk: true,
        },
      });

      approved.push(id);
    } catch (err) {
      skipped.push({ id, reason: err?.message || "Error" });
    }
  }

  return { approved, skipped };
}

/**
 * Link or unlink a defense meeting on a DEPLOYMENT-phase submission.
 * Used for FINAL_REPORT / PRESENTATION deliverables.
 */
export async function attachDefenseMeetingService(actor, submissionId, { meetingId }) {
  if (actor.role !== ROLES.DOCTOR && actor.role !== ROLES.ADMIN) {
    throw new AppError("Only the team doctor can link defense meetings for final evaluation.", 403, "DEFENSE_FORBIDDEN");
  }

  const submission = await findSubmissionById(submissionId);
  if (!submission) throw new AppError("Submission not found.", 404, "SUBMISSION_NOT_FOUND");

  if (submission.sdlcPhase !== "DEPLOYMENT") {
    throw new AppError("Defense meetings only apply to DEPLOYMENT-phase deliverables.", 422, "DEFENSE_NOT_APPLICABLE");
  }

  await assertSupervisorForTeam(actor, submission.teamId);

  if (meetingId) {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true, teamId: true },
    });
    if (!meeting) throw new AppError("Meeting not found.", 404, "MEETING_NOT_FOUND");
    if (meeting.teamId !== submission.teamId) {
      throw new AppError("The meeting belongs to a different team.", 422, "DEFENSE_TEAM_MISMATCH");
    }
  }

  const updated = await updateSubmission(submissionId, {
    defenseMeetingId: meetingId || null,
  });

  return toSubmissionResponse(updated);
}
