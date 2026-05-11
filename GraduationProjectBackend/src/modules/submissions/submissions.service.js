import { AppError } from "../../common/errors/AppError.js";
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

function normalizeRubric(rubric) {
  if (!Array.isArray(rubric)) return null;
  return rubric.map((item) => ({
    name: String(item.name),
    score: Number(item.score),
    maxScore: Number(item.maxScore),
  }));
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

  if (submission.status === "APPROVED") {
    throw new AppError("This submission is already finalized by the doctor.", 409, "SUBMISSION_ALREADY_APPROVED");
  }

  const normalizedRubric = normalizeRubric(rubric);

  const updated = await updateSubmission(submissionId, {
    taRecommendedGrade: recommendedGrade,
    taFeedback: feedback || null,
    taReviewedByUserId: actor.id,
    taReviewedAt: new Date(),
    status: "UNDER_REVIEW",
    ...(normalizedRubric ? { rubric: normalizedRubric } : {}),
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
export async function gradeSubmissionService(actor, submissionId, { grade, feedback, rubric, reason }) {
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

  // Defense-meeting gate for DEPLOYMENT-phase deliverables.
  // If a defense was scheduled but not yet COMPLETED, block grading.
  if (submission.sdlcPhase === "DEPLOYMENT" && submission.defenseMeetingId) {
    const meeting = await prisma.meeting.findUnique({
      where: { id: submission.defenseMeetingId },
      select: { status: true, startAt: true },
    });
    if (meeting && meeting.status !== "COMPLETED" && meeting.status !== "CANCELLED") {
      throw new AppError(
        "The defense meeting hasn't been marked complete yet. Update it first.",
        409,
        "SUBMISSION_DEFENSE_INCOMPLETE",
      );
    }
  }

  const normalizedRubric = normalizeRubric(rubric);

  // If this is a re-grade after an unlock (gradeHistory exists with at least
  // one entry from previous approval), append a new audit record now.
  const existingHistory = Array.isArray(submission.gradeHistory) ? submission.gradeHistory : [];
  const wasReGrade = existingHistory.length > 0;

  const updated = await updateSubmission(submissionId, {
    grade,
    feedback: feedback || null,
    status: "APPROVED",
    reviewedByUserId: actor.id,
    reviewedAt: new Date(),
    ...(normalizedRubric ? { rubric: normalizedRubric } : {}),
    ...(wasReGrade
      ? {
          gradeHistory: [
            ...existingHistory,
            {
              event: "regraded",
              previousGrade: submission.grade,
              newGrade: grade,
              reason: reason || null,
              by: actor.id,
              byName: buildFullName(actor),
              at: new Date().toISOString(),
            },
          ],
        }
      : {}),
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

  return toSubmissionResponse(updated);
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

  const updated = await updateSubmission(submissionId, {
    feedback,
    status: "REVISION_REQUIRED",
    reviewedByUserId: actor.id,
    reviewedAt: new Date(),
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
  const snapshot = {
    event: "unlocked",
    snapshotGrade: submission.grade,
    snapshotFeedback: submission.feedback,
    snapshotRubric: submission.rubric ?? null,
    snapshotReviewedBy: submission.reviewedBy?.fullName ?? null,
    snapshotReviewedAt: submission.reviewedAt,
    reason: reason.trim(),
    by: actor.id,
    byName: buildFullName(actor),
    at: new Date().toISOString(),
  };

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
export async function bulkApproveSubmissionsService(actor, { submissionIds, grade = 85, feedback }) {
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

      // Doctor must supervise the team (admin bypasses)
      if (actor.role !== ROLES.ADMIN) {
        const team = await prisma.team.findFirst({
          where: { id: sub.teamId, doctorId: actor.id },
          select: { id: true },
        });
        if (!team) { skipped.push({ id, reason: "Not your team" }); continue; }
      }

      // Bias toward TA's recommendation if it exists; otherwise use default
      const finalGrade = sub.taRecommendedGrade ?? grade;

      await updateSubmission(id, {
        grade: finalGrade,
        feedback: feedback || sub.taFeedback || "Bulk approved.",
        status: "APPROVED",
        reviewedByUserId: actor.id,
        reviewedAt: new Date(),
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
  if (actor.role !== ROLES.DOCTOR && actor.role !== ROLES.TA && actor.role !== ROLES.ADMIN) {
    throw new AppError("Only supervisors can schedule defense meetings.", 403, "DEFENSE_FORBIDDEN");
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
