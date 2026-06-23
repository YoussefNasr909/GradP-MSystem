import {
  getMyOverviewService,
  getMyHistoryService,
  getMyBadgesService,
  getTeamSummaryService,
  getTeamHistoryService,
  getLeaderboardsService,
} from "./gamification.service.js";
import { processPendingEvents } from "./gamification.processor.js";

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

export async function getLeaderboards(req, res) {
  const result = await getLeaderboardsService(req.user, req.validated.query);
  res.json({ ok: true, data: result });
}

export async function processEvents(req, res) {
  const result = await processPendingEvents(req.validated?.body ?? {});
  res.json({ ok: true, data: result });
}
