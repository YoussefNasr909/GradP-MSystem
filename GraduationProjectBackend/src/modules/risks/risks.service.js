import { AppError } from "../../common/errors/AppError.js";
import { ROLES } from "../../common/constants/roles.js";
import { notify } from "../../common/utils/notify.js";
import { findTeamById, findTeamByLeaderId, findTeamMemberByUserId } from "../teams/teams.repository.js";
import { createRisk, findRiskById, listRisks, updateRiskById } from "./risks.repository.js";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function buildFullName(user) {
  return `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
}

function toUserSummary(user) {
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

function assertRiskExists(risk) {
  if (!risk) {
    throw new AppError("Risk not found.", 404, "RISK_NOT_FOUND");
  }
}

function isTeamLeader(actor, team) {
  return team?.leader?.id === actor.id;
}

function isTeamMember(actor, team) {
  return team?.members?.some((member) => member.user.id === actor.id);
}

function isAssignedSupervisor(actor, team) {
  return team?.doctor?.id === actor.id || team?.ta?.id === actor.id;
}

function isAssignedDoctor(actor, team) {
  return team?.doctor?.id === actor.id;
}

function isAssignedTa(actor, team) {
  return team?.ta?.id === actor.id;
}

function canViewRisk(actor, risk) {
  if (!risk?.team) return false;
  if (actor.role === ROLES.ADMIN) return true;
  if (isTeamLeader(actor, risk.team)) return true;
  if (isAssignedSupervisor(actor, risk.team)) return true;
  if (actor.role === ROLES.STUDENT) return risk.monitorUserId === actor.id;
  return false;
}

function canManageRisk(actor, team) {
  return actor.role === ROLES.ADMIN || isTeamLeader(actor, team);
}

function canEditRiskDetails(actor, risk) {
  if (actor.role === ROLES.ADMIN) return true;
  if (!isTeamLeader(actor, risk.team)) return false;

  return risk.approvalStatus !== "APPROVED" && risk.status !== "RESOLVED";
}

/**
 * Risk approval authority:
 *   - ADMIN can always approve (platform-wide authority — bypasses the team
 *     check on purpose so admins can step in when a team has no supervisor).
 *   - For a risk that has been resolved (the leader marked it "RESOLVED" and is
 *     asking the supervisor to confirm closure), only the team's assigned
 *     DOCTOR signs off.
 *   - For an open risk (the leader is asking to enroll it into monitoring),
 *     the team's assigned TA approves the monitoring plan.
 * Anyone else (including a doctor on a risk that isn't RESOLVED, or a TA on a
 * resolved risk) gets a 403 from `assertCanApproveRisk` upstream.
 */
export function canApproveRisk(actor, risk) {
  if (!actor || !risk) return false;
  if (actor.role === ROLES.ADMIN) return true;
  // Non-admin reviewers always need a team to compare against.
  if (!risk.team) return false;
  if (risk.status === "RESOLVED") return isAssignedDoctor(actor, risk.team);
  return isAssignedTa(actor, risk.team);
}

function isProposalApproved(team) {
  return team?.proposal?.status === "APPROVED";
}

function canMonitorRisk(actor, risk) {
  return actor.role === ROLES.ADMIN || risk.monitorUserId === actor.id;
}

function assertActorCanViewRisk(actor, risk) {
  if (!canViewRisk(actor, risk)) {
    throw new AppError("You are not allowed to access this risk.", 403, "RISK_VIEW_FORBIDDEN");
  }
}

function assertMonitorBelongsToTeam(team, monitorUserId) {
  if (!monitorUserId) return null;

  const monitor = getTeamRoster(team).find((entry) => entry.user.id === monitorUserId)?.user;
  if (!monitor) {
    throw new AppError("Choose a monitor from the current team.", 422, "RISK_MONITOR_NOT_IN_TEAM");
  }

  return monitor;
}

async function resolveActorRiskTeamContext(actor, requestedTeamId) {
  const normalizedTeamId = normalizeText(requestedTeamId) || null;

  if (actor.role === ROLES.ADMIN) {
    if (!normalizedTeamId) return { team: null, where: {} };
    const team = await findTeamById(normalizedTeamId);
    if (!team) throw new AppError("Team not found.", 404, "TEAM_NOT_FOUND");
    return { team, where: { teamId: team.id } };
  }

  if (actor.role === ROLES.LEADER) {
    const team = await findTeamByLeaderId(actor.id);
    if (!team) throw new AppError("Create a team first before managing risks.", 409, "TEAM_REQUIRED");
    if (normalizedTeamId && normalizedTeamId !== team.id) {
      throw new AppError("You can only access risks for your own team.", 403, "RISK_TEAM_FORBIDDEN");
    }
    return { team, where: { teamId: team.id } };
  }

  if (actor.role === ROLES.STUDENT) {
    const membership = await findTeamMemberByUserId(actor.id);
    if (!membership?.team) throw new AppError("Join a team first before accessing risks.", 409, "TEAM_REQUIRED");
    if (normalizedTeamId && normalizedTeamId !== membership.team.id) {
      throw new AppError("You can only access risks for your own team.", 403, "RISK_TEAM_FORBIDDEN");
    }
    return { team: membership.team, where: { teamId: membership.team.id, monitorUserId: actor.id } };
  }

  if (actor.role === ROLES.DOCTOR || actor.role === ROLES.TA) {
    if (normalizedTeamId) {
      const team = await findTeamById(normalizedTeamId);
      if (!team) throw new AppError("Team not found.", 404, "TEAM_NOT_FOUND");
      if (!isAssignedSupervisor(actor, team)) {
        throw new AppError("You are not assigned to this team.", 403, "RISK_TEAM_FORBIDDEN");
      }
      return { team, where: { teamId: team.id } };
    }

    return {
      team: null,
      where: actor.role === ROLES.DOCTOR ? { team: { doctorId: actor.id } } : { team: { taId: actor.id } },
    };
  }

  throw new AppError("This role is not supported for risk access.", 403, "RISK_ROLE_UNSUPPORTED");
}

function toRiskResponse(risk, actor) {
  const canEditDetails = canEditRiskDetails(actor, risk);
  const proposalApproved = isProposalApproved(risk.team);
  const canApprove = canApproveRisk(actor, risk) && proposalApproved;
  const canMonitor = canMonitorRisk(actor, risk) && risk.approvalStatus === "APPROVED" && risk.status !== "RESOLVED";

  return {
    id: risk.id,
    team: {
      id: risk.team.id,
      name: risk.team.name,
    },
    proposalStatus: risk.team.proposal?.status ?? null,
    isPreliminary: !proposalApproved,
    title: risk.title,
    description: risk.description,
    category: risk.category,
    chance: risk.chance,
    impact: risk.impact,
    severity: risk.severity ?? null,
    status: risk.status,
    approvalStatus: risk.approvalStatus,
    mitigation: risk.mitigation ?? "",
    monitoringNotes: risk.monitoringNotes ?? "",
    resolutionNotes: risk.resolutionNotes ?? "",
    approvalNote: risk.approvalNote ?? "",
    approvedAt: risk.approvedAt ?? null,
    createdAt: risk.createdAt,
    updatedAt: risk.updatedAt,
    createdBy: toUserSummary(risk.createdBy),
    monitor: toUserSummary(risk.monitor),
    approvedBy: toUserSummary(risk.approvedBy),
    permissions: {
      canEdit: canEditDetails,
      canMonitor,
      canApprove,
      canRequestRevision: canApprove,
    },
  };
}

export async function listRisksService(actor, filters = {}) {
  const { where } = await resolveActorRiskTeamContext(actor, filters.teamId);
  const risks = await listRisks({
    ...where,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.approvalStatus ? { approvalStatus: filters.approvalStatus } : {}),
    ...(filters.severity ? { severity: filters.severity } : {}),
  });

  return risks.filter((risk) => canViewRisk(actor, risk)).map((risk) => toRiskResponse(risk, actor));
}

export async function createRiskService(actor, payload) {
  if (actor.role !== ROLES.LEADER && actor.role !== ROLES.ADMIN) {
    throw new AppError("Only the team leader can log risks.", 403, "RISK_CREATE_FORBIDDEN");
  }

  const { team } = await resolveActorRiskTeamContext(actor, payload.teamId);
  if (!team) {
    throw new AppError("Choose a team before logging a risk.", 422, "RISK_TEAM_REQUIRED");
  }

  if (!canManageRisk(actor, team)) {
    throw new AppError("You are not allowed to log risks for this team.", 403, "RISK_CREATE_FORBIDDEN");
  }

  const fallbackMonitor = team.leader;
  const monitor = assertMonitorBelongsToTeam(team, payload.monitorUserId || fallbackMonitor.id);

  const risk = await createRisk({
    teamId: team.id,
    title: normalizeText(payload.title),
    description: normalizeText(payload.description),
    category: normalizeText(payload.category),
    chance: payload.chance,
    impact: payload.impact,
    mitigation: normalizeText(payload.mitigation) || null,
    monitorUserId: monitor?.id ?? null,
    createdByUserId: actor.id,
    approvalStatus: "PENDING",
    status: "OPEN",
  });

  const supervisorIds = [team.ta?.id].filter(Boolean);
  await Promise.all(
    supervisorIds.map((userId) =>
      notify({
        userId,
        type: "SYSTEM",
        title: "Risk Awaiting Approval",
        message: `Team "${team.name}" logged a risk that needs TA approval before monitoring starts: "${risk.title}".`,
        actionUrl: "/dashboard/risk-management",
      }),
    ),
  );

  if (monitor?.id && monitor.id !== actor.id) {
    await notify({
      userId: monitor.id,
      type: "SYSTEM",
      title: "Risk Monitoring Assigned",
      message: `You have been assigned to monitor "${risk.title}" for team "${team.name}".`,
      actionUrl: "/dashboard/risk-management",
    });
  }

  return toRiskResponse(risk, actor);
}

export async function updateRiskService(actor, riskId, payload) {
  const risk = await findRiskById(riskId);
  assertRiskExists(risk);
  assertActorCanViewRisk(actor, risk);

  const canManage = canEditRiskDetails(actor, risk);
  const canMonitor = canMonitorRisk(actor, risk);
  if (!canManage && !canMonitor) {
    throw new AppError("Only the team leader or assigned monitor can update this risk.", 403, "RISK_UPDATE_FORBIDDEN");
  }

  if (!canManage && (risk.approvalStatus !== "APPROVED" || risk.status === "RESOLVED")) {
    throw new AppError("Assigned monitors can update risks after TA approval while the risk is in monitoring.", 403, "RISK_MONITORING_INACTIVE");
  }

  const updateData = {};
  const monitorOnlyFields = new Set(["chance", "status", "monitoringNotes", "resolutionNotes"]);
  const changedFields = Object.keys(payload);

  if (!canManage && changedFields.some((field) => !monitorOnlyFields.has(field))) {
    throw new AppError("Assigned monitors can only update chance, status, and monitoring notes.", 403, "RISK_MONITOR_UPDATE_FORBIDDEN");
  }

  let requiresReapproval = false;
  const approvalSensitiveFields = new Set(["title", "description", "category", "impact", "mitigation"]);
  const finalStatus = payload.status ?? risk.status;
  const submitsResolutionForReview =
    finalStatus === "RESOLVED" &&
    (payload.status !== undefined || payload.resolutionNotes !== undefined) &&
    (risk.status !== "RESOLVED" || risk.approvalStatus !== "PENDING");

  if (payload.status === "MONITORING" && risk.approvalStatus !== "APPROVED") {
    throw new AppError("A risk can only move to monitoring after TA approval.", 422, "RISK_MONITORING_REQUIRES_APPROVAL");
  }

  if (payload.status === "RESOLVED" && risk.approvalStatus !== "APPROVED") {
    throw new AppError("Only approved risks can be submitted for resolution review.", 422, "RISK_RESOLUTION_REQUIRES_APPROVAL");
  }

  if (payload.title !== undefined) updateData.title = normalizeText(payload.title);
  if (payload.description !== undefined) updateData.description = normalizeText(payload.description);
  if (payload.category !== undefined) updateData.category = normalizeText(payload.category);
  if (payload.chance !== undefined) updateData.chance = payload.chance;
  if (payload.impact !== undefined) updateData.impact = payload.impact;
  if (payload.status !== undefined) updateData.status = payload.status;
  if (payload.mitigation !== undefined) updateData.mitigation = normalizeText(payload.mitigation) || null;
  if (payload.monitoringNotes !== undefined) updateData.monitoringNotes = normalizeText(payload.monitoringNotes) || null;
  if (payload.resolutionNotes !== undefined) updateData.resolutionNotes = normalizeText(payload.resolutionNotes) || null;

  if (payload.monitorUserId !== undefined) {
    const monitor = payload.monitorUserId ? assertMonitorBelongsToTeam(risk.team, payload.monitorUserId) : null;
    updateData.monitorUserId = monitor?.id ?? null;
  }

  requiresReapproval = canManage && changedFields.some((field) => approvalSensitiveFields.has(field));
  if (requiresReapproval) {
    updateData.approvalStatus = "PENDING";
    updateData.severity = null;
    updateData.approvedByUserId = null;
    updateData.approvedAt = null;
    updateData.approvalNote = null;
    if (risk.status !== "RESOLVED") updateData.status = "OPEN";
  }

  if (finalStatus === "RESOLVED" && !normalizeText(payload.resolutionNotes ?? risk.resolutionNotes)) {
    throw new AppError("Add resolution notes before marking a risk as resolved.", 422, "RISK_RESOLUTION_NOTE_REQUIRED");
  }

  if (submitsResolutionForReview) {
    updateData.approvalStatus = "PENDING";
    updateData.approvedByUserId = null;
    updateData.approvedAt = null;
    updateData.approvalNote = null;
  }

  const updated = await updateRiskById(risk.id, updateData);

  if (payload.monitorUserId !== undefined && updated.monitorUserId && updated.monitorUserId !== risk.monitorUserId) {
    await notify({
      userId: updated.monitorUserId,
      type: "SYSTEM",
      title: "Risk Monitoring Assigned",
      message: `You have been assigned to monitor "${updated.title}" for team "${updated.team.name}".`,
      actionUrl: "/dashboard/risk-management",
    });
  }

  if (submitsResolutionForReview) {
    const supervisorIds = [risk.team.doctor?.id].filter(Boolean);
    await Promise.all(
      supervisorIds.map((userId) =>
        notify({
          userId,
          type: "SYSTEM",
          title: "Risk Resolution Needs Review",
          message: `Team "${risk.team.name}" marked "${risk.title}" as resolved and needs supervisor review.`,
          actionUrl: "/dashboard/risk-management",
        }),
      ),
    );
  }

  return toRiskResponse(updated, actor);
}

export async function approveRiskService(actor, riskId, payload) {
  const risk = await findRiskById(riskId);
  assertRiskExists(risk);
  assertActorCanViewRisk(actor, risk);

  if (!canApproveRisk(actor, risk)) {
    throw new AppError(
      risk.status === "RESOLVED" ? "Only the assigned supervisor can confirm this risk is resolved." : "Only the assigned TA can approve this risk.",
      403,
      "RISK_APPROVE_FORBIDDEN",
    );
  }

  if (!isProposalApproved(risk.team)) {
    throw new AppError(
      "Risk approval is locked until the team's proposal is approved.",
      423,
      "RISK_PROPOSAL_APPROVAL_REQUIRED",
    );
  }

  if (risk.status !== "RESOLVED" && !payload.severity) {
    throw new AppError("Set a severity before approving this risk.", 422, "RISK_SEVERITY_REQUIRED");
  }

  const updated = await updateRiskById(risk.id, {
    severity: payload.severity ?? risk.severity,
    status: risk.status === "OPEN" ? "MONITORING" : risk.status,
    approvalStatus: "APPROVED",
    approvedByUserId: actor.id,
    approvedAt: new Date(),
    approvalNote: normalizeText(payload.approvalNote) || null,
  });

  await notify({
    userId: risk.team.leader.id,
    type: "SYSTEM",
    title: risk.status === "RESOLVED" ? "Risk Resolution Approved" : "Risk Approved",
    message:
      risk.status === "RESOLVED"
        ? `A supervisor confirmed that "${risk.title}" is resolved.`
        : `"${risk.title}" was approved with ${payload.severity.toLowerCase()} severity.`,
    actionUrl: "/dashboard/risk-management",
  });

  if (risk.monitorUserId && risk.monitorUserId !== risk.team.leader.id) {
    await notify({
      userId: risk.monitorUserId,
      type: "SYSTEM",
      title: risk.status === "RESOLVED" ? "Risk Resolution Approved" : "Risk Approved",
      message:
        risk.status === "RESOLVED"
          ? `A supervisor confirmed that "${risk.title}" is resolved.`
          : `"${risk.title}" is approved and ready for monitoring.`,
      actionUrl: "/dashboard/risk-management",
    });
  }

  return toRiskResponse(updated, actor);
}

export async function requestRiskRevisionService(actor, riskId, payload) {
  const risk = await findRiskById(riskId);
  assertRiskExists(risk);
  assertActorCanViewRisk(actor, risk);
  const isResolutionReview = risk.status === "RESOLVED";

  if (!canApproveRisk(actor, risk)) {
    throw new AppError(
      risk.status === "RESOLVED" ? "Only the assigned supervisor can keep this risk in monitoring." : "Only the assigned TA can request risk revisions.",
      403,
      "RISK_REVISION_FORBIDDEN",
    );
  }

  const updated = await updateRiskById(risk.id, {
    approvalStatus: isResolutionReview ? "APPROVED" : "REVISION_REQUESTED",
    ...(isResolutionReview ? { status: "MONITORING" } : {}),
    severity: isResolutionReview ? risk.severity : null,
    approvedByUserId: isResolutionReview ? risk.approvedByUserId : actor.id,
    approvedAt: isResolutionReview ? risk.approvedAt : null,
    approvalNote: normalizeText(payload.approvalNote),
  });

  await notify({
    userId: risk.team.leader.id,
    type: "SYSTEM",
    title: risk.status === "RESOLVED" ? "Risk Resolution Needs More Work" : "Risk Needs Revision",
    message:
      risk.status === "RESOLVED"
        ? `The supervisor did not confirm "${risk.title}" as resolved. Keep monitoring it and update the notes.`
        : `The TA requested changes to "${risk.title}".`,
    actionUrl: "/dashboard/risk-management",
  });

  return toRiskResponse(updated, actor);
}
