import {
  getMyOverviewService,
  getMyHistoryService,
  getMyBadgesService,
  getTeamSummaryService,
  getTeamHistoryService,
  getLeaderboardsService,
  getRulesService,
  getAdminCasesService,
  resolveAdminCaseService,
  getAdminAdjustmentsService,
  createAdminAdjustmentService,
  reviewAdminAdjustmentService,
  getAdminAuditLogsService,
  generateAdminLeaderboardSnapshotsService,
} from "./gamification.service.js";
import { processPendingEvents } from "./gamification.processor.js";

// ─── Student / User endpoints ────────────────────────────────

export async function getMyOverview(req, res) {
  const result = await getMyOverviewService(req.user);
  res.json({ ok: true, data: result });
}

export async function getMyHistory(req, res) {
  const result = await getMyHistoryService(req.user, req.validated.query);
  res.json({ ok: true, data: result });
}

export async function getMyBadges(req, res) {
  const result = await getMyBadgesService(req.user);
  res.json({ ok: true, data: result });
}

// ─── Team endpoints ──────────────────────────────────────────

export async function getTeamSummary(req, res) {
  const result = await getTeamSummaryService(req.user, req.validated.params.teamId);
  res.json({ ok: true, data: result });
}

export async function getTeamHistory(req, res) {
  const result = await getTeamHistoryService(
    req.user,
    req.validated.params.teamId,
    req.validated.query,
  );
  res.json({ ok: true, data: result });
}

// ─── Leaderboards ────────────────────────────────────────────

export async function getLeaderboards(req, res) {
  const result = await getLeaderboardsService(req.user, req.validated.query);
  res.json({ ok: true, data: result });
}

// ─── Rules ───────────────────────────────────────────────────

export async function getRules(req, res) {
  const result = await getRulesService(req.user, req.validated.query);
  res.json({ ok: true, data: result });
}

// ─── Admin endpoints ─────────────────────────────────────────

export async function getAdminCases(req, res) {
  const result = await getAdminCasesService(req.user, req.validated.query);
  res.json({ ok: true, data: result });
}

export async function resolveAdminCase(req, res) {
  const result = await resolveAdminCaseService(
    req.user,
    req.validated.params.caseId,
    req.validated.body,
  );
  res.json({ ok: true, data: result });
}

export async function getAdminAdjustments(req, res) {
  const result = await getAdminAdjustmentsService(req.user, req.validated.query);
  res.json({ ok: true, data: result });
}

export async function createAdminAdjustment(req, res) {
  const result = await createAdminAdjustmentService(req.user, req.validated.body);
  res.status(201).json({ ok: true, data: result });
}

export async function reviewAdminAdjustment(req, res) {
  const result = await reviewAdminAdjustmentService(
    req.user,
    req.validated.params.adjustmentId,
    req.validated.body,
  );
  res.json({ ok: true, data: result });
}

export async function getAdminAuditLogs(req, res) {
  const result = await getAdminAuditLogsService(req.user, req.validated.query);
  res.json({ ok: true, data: result });
}

export async function generateLeaderboardSnapshots(req, res) {
  const result = await generateAdminLeaderboardSnapshotsService(req.user, req.validated.body);
  res.json({ ok: true, data: result });
}

// ─── Processor trigger (Admin only) ──────────────────────────

export async function processEvents(req, res) {
  const result = await processPendingEvents(req.validated?.body ?? {});
  res.json({ ok: true, data: result });
}
