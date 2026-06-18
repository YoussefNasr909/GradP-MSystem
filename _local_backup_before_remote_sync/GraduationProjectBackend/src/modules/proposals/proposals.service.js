import { prisma } from "../../loaders/dbLoader.js";
import { AppError } from "../../common/errors/AppError.js";
import { ROLES } from "../../common/constants/roles.js";
import { notify } from "../../common/utils/notify.js";
import { findTeamByLeaderId, findTeamMemberByUserId } from "../teams/teams.repository.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

const proposalUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  avatarUrl: true,
};

const proposalSelect = {
  id: true,
  teamId: true,
  authoredByUserId: true,

  title: true,
  abstract: true,
  problemStatement: true,
  scope: true,
  methodology: true,
  timeline: true,
  objectives: true,
  technologies: true,
  deliverables: true,

  fileName: true,
  fileSize: true,
  fileType: true,
  fileUrl: true,

  status: true,
  feedback: true,
  reviewedByUserId: true,
  reviewedAt: true,
  submittedAt: true,

  version: true,
  revisionCount: true,

  createdAt: true,
  updatedAt: true,

  team:       { select: { id: true, name: true, stage: true, leaderId: true, doctorId: true, taId: true } },
  authoredBy: { select: proposalUserSelect },
  reviewedBy: { select: proposalUserSelect },
};

function fullName(u) {
  return `${u?.firstName ?? ""} ${u?.lastName ?? ""}`.trim();
}

function shape(proposal) {
  if (!proposal) return null;
  return {
    ...proposal,
    authoredBy: proposal.authoredBy ? { ...proposal.authoredBy, fullName: fullName(proposal.authoredBy) } : null,
    reviewedBy: proposal.reviewedBy ? { ...proposal.reviewedBy, fullName: fullName(proposal.reviewedBy) } : null,
  };
}

async function resolveLeaderTeam(actor) {
  if (actor.role !== ROLES.LEADER) return null;
  return findTeamByLeaderId(actor.id);
}

async function resolveVisibleTeamIds(actor) {
  if (actor.role === ROLES.ADMIN) return null; // all
  if (actor.role === ROLES.DOCTOR) {
    const teams = await prisma.team.findMany({ where: { doctorId: actor.id }, select: { id: true } });
    return teams.map((t) => t.id);
  }
  if (actor.role === ROLES.TA) {
    const teams = await prisma.team.findMany({ where: { taId: actor.id }, select: { id: true } });
    return teams.map((t) => t.id);
  }
  if (actor.role === ROLES.LEADER) {
    const team = await findTeamByLeaderId(actor.id);
    return team ? [team.id] : [];
  }
  if (actor.role === ROLES.STUDENT) {
    const m = await findTeamMemberByUserId(actor.id);
    return m?.team?.id ? [m.team.id] : [];
  }
  return [];
}

// ─── service methods ────────────────────────────────────────────────────────

export async function listProposalsService(actor, { teamId, status, search } = {}) {
  let visibleIds = await resolveVisibleTeamIds(actor);

  if (visibleIds !== null && visibleIds.length === 0) return [];

  if (teamId) {
    if (visibleIds !== null && !visibleIds.includes(teamId)) {
      throw new AppError("You cannot view this team's proposal.", 403, "PROPOSAL_FORBIDDEN");
    }
    visibleIds = [teamId];
  }

  const where = {
    ...(visibleIds ? { teamId: { in: visibleIds } } : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { title:    { contains: search, mode: "insensitive" } },
            { abstract: { contains: search, mode: "insensitive" } },
            { team: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const rows = await prisma.proposal.findMany({
    where,
    select: proposalSelect,
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });

  return rows.map(shape);
}

export async function getProposalService(actor, id) {
  const proposal = await prisma.proposal.findUnique({ where: { id }, select: proposalSelect });
  if (!proposal) throw new AppError("Proposal not found.", 404, "PROPOSAL_NOT_FOUND");

  const visibleIds = await resolveVisibleTeamIds(actor);
  if (visibleIds !== null && !visibleIds.includes(proposal.teamId)) {
    throw new AppError("You cannot view this proposal.", 403, "PROPOSAL_FORBIDDEN");
  }
  return shape(proposal);
}

export async function getMyProposalService(actor) {
  const team = await resolveLeaderTeam(actor) ?? (await findTeamMemberByUserId(actor.id))?.team ?? null;
  if (!team) throw new AppError("You don't belong to a team yet.", 403, "NO_TEAM");

  const proposal = await prisma.proposal.findUnique({ where: { teamId: team.id }, select: proposalSelect });
  return proposal ? shape(proposal) : null;
}

export async function createProposalService(actor, body) {
  if (actor.role !== ROLES.LEADER) {
    throw new AppError("Only the team leader can create the proposal.", 403, "PROPOSAL_CREATE_FORBIDDEN");
  }
  const team = await findTeamByLeaderId(actor.id);
  if (!team) throw new AppError("You must have a team before creating a proposal.", 403, "NO_TEAM");

  const existing = await prisma.proposal.findUnique({ where: { teamId: team.id }, select: { id: true } });
  if (existing) {
    throw new AppError("Your team already has a proposal. Update or submit it instead.", 409, "PROPOSAL_EXISTS");
  }

  const created = await prisma.proposal.create({
    data: {
      teamId: team.id,
      authoredByUserId: actor.id,
      title: body.title,
      abstract: body.abstract,
      problemStatement: body.problemStatement,
      scope: body.scope,
      methodology: body.methodology,
      timeline: body.timeline ?? null,
      objectives:   body.objectives,
      technologies: body.technologies,
      deliverables: body.deliverables,
      status: "DRAFT",
    },
    select: proposalSelect,
  });

  return shape(created);
}

export async function updateProposalService(actor, id, body) {
  const proposal = await prisma.proposal.findUnique({ where: { id }, select: { ...proposalSelect } });
  if (!proposal) throw new AppError("Proposal not found.", 404, "PROPOSAL_NOT_FOUND");

  // Only the team leader (author) can update — and only while editable
  if (actor.role !== ROLES.ADMIN) {
    if (actor.role !== ROLES.LEADER || proposal.team.leaderId !== actor.id) {
      throw new AppError("Only the team leader can edit the proposal.", 403, "PROPOSAL_EDIT_FORBIDDEN");
    }
  }

  // Approved proposals are immutable
  if (proposal.status === "APPROVED") {
    throw new AppError("Approved proposals cannot be edited.", 409, "PROPOSAL_IMMUTABLE");
  }

  const updated = await prisma.proposal.update({
    where: { id },
    data: {
      ...body,
      // If the doctor requested revisions, editing bumps revision count
      ...(proposal.status === "REVISION_REQUESTED"
        ? { revisionCount: { increment: 1 } }
        : {}),
    },
    select: proposalSelect,
  });

  return shape(updated);
}

export async function submitProposalService(actor, id) {
  const proposal = await prisma.proposal.findUnique({ where: { id }, select: proposalSelect });
  if (!proposal) throw new AppError("Proposal not found.", 404, "PROPOSAL_NOT_FOUND");

  if (actor.role !== ROLES.ADMIN) {
    if (actor.role !== ROLES.LEADER || proposal.team.leaderId !== actor.id) {
      throw new AppError("Only the team leader can submit the proposal.", 403, "PROPOSAL_SUBMIT_FORBIDDEN");
    }
  }

  if (proposal.status === "APPROVED") {
    throw new AppError("Proposal is already approved.", 409, "PROPOSAL_ALREADY_APPROVED");
  }
  if (proposal.status === "SUBMITTED" || proposal.status === "UNDER_REVIEW") {
    throw new AppError("Proposal is already submitted and awaiting review.", 409, "PROPOSAL_ALREADY_SUBMITTED");
  }

  const newVersion = proposal.status === "REVISION_REQUESTED" ? proposal.version + 1 : proposal.version;

  const updated = await prisma.proposal.update({
    where: { id },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
      version: newVersion,
    },
    select: proposalSelect,
  });

  // Notify the doctor (if assigned)
  if (proposal.team.doctorId) {
    await notify({
      userId: proposal.team.doctorId,
      type: "SUBMISSION_FEEDBACK",
      title: "Proposal Awaiting Review",
      message: `${fullName(actor)} submitted "${proposal.title}" for your review.`,
      actionUrl: `/dashboard/proposals/${proposal.id}`,
    });
  }

  return shape(updated);
}

export async function reviewProposalService(actor, id, { decision, feedback }) {
  if (actor.role !== ROLES.DOCTOR && actor.role !== ROLES.ADMIN) {
    throw new AppError("Only the team doctor can review proposals.", 403, "PROPOSAL_REVIEW_FORBIDDEN");
  }

  const proposal = await prisma.proposal.findUnique({ where: { id }, select: proposalSelect });
  if (!proposal) throw new AppError("Proposal not found.", 404, "PROPOSAL_NOT_FOUND");

  // Doctor must actually supervise this team
  if (actor.role === ROLES.DOCTOR && proposal.team.doctorId !== actor.id) {
    throw new AppError("You're not the doctor for this team.", 403, "PROPOSAL_NOT_YOUR_TEAM");
  }

  if (!["SUBMITTED", "UNDER_REVIEW"].includes(proposal.status)) {
    throw new AppError(`Cannot review a proposal in "${proposal.status}" state.`, 409, "PROPOSAL_BAD_STATE");
  }

  if (decision === "REVISION_REQUESTED" && (!feedback || feedback.length < 10)) {
    throw new AppError("Feedback is required (min 10 characters) when requesting revisions.", 422, "PROPOSAL_FEEDBACK_REQUIRED");
  }
  if (decision === "REJECTED" && (!feedback || feedback.length < 10)) {
    throw new AppError("Feedback is required (min 10 characters) when rejecting.", 422, "PROPOSAL_FEEDBACK_REQUIRED");
  }

  const updated = await prisma.proposal.update({
    where: { id },
    data: {
      status: decision,
      feedback: feedback ?? null,
      reviewedByUserId: actor.id,
      reviewedAt: new Date(),
    },
    select: proposalSelect,
  });

  // Notify the team leader of the decision
  if (proposal.team.leaderId) {
    const titleMap = {
      APPROVED:           "Proposal Approved",
      REJECTED:           "Proposal Rejected",
      REVISION_REQUESTED: "Proposal Needs Revision",
    };
    const messageMap = {
      APPROVED:           `Your proposal "${proposal.title}" has been approved by ${fullName(actor)}. You can now begin the SDLC.`,
      REJECTED:           `Your proposal "${proposal.title}" was rejected by ${fullName(actor)}.`,
      REVISION_REQUESTED: `${fullName(actor)} requested revisions on your proposal "${proposal.title}".`,
    };
    await notify({
      userId: proposal.team.leaderId,
      type: "SUBMISSION_FEEDBACK",
      title: titleMap[decision],
      message: messageMap[decision],
      actionUrl: `/dashboard/proposals/${proposal.id}`,
    });
  }

  return shape(updated);
}

export async function deleteProposalService(actor, id) {
  const proposal = await prisma.proposal.findUnique({ where: { id }, select: proposalSelect });
  if (!proposal) throw new AppError("Proposal not found.", 404, "PROPOSAL_NOT_FOUND");

  if (actor.role !== ROLES.ADMIN) {
    if (actor.role !== ROLES.LEADER || proposal.team.leaderId !== actor.id) {
      throw new AppError("Only the team leader can delete the proposal.", 403, "PROPOSAL_DELETE_FORBIDDEN");
    }
    if (proposal.status !== "DRAFT") {
      throw new AppError("You can only delete a proposal while it's still a draft.", 409, "PROPOSAL_NOT_DRAFT");
    }
  }

  await prisma.proposal.delete({ where: { id } });
  return { ok: true };
}
