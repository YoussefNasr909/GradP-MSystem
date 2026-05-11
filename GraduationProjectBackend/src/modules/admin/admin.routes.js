import { Router } from "express";
import { auth } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/role.middleware.js";
import { ROLES } from "../../common/constants/roles.js";
import { getSystemLogs, getUserActivity, getGradesOverview, getAnalytics, getTeamActivity } from "./admin.service.js";
import { streamTeamReportCardPdf } from "./admin.pdf.js";
import { prisma } from "../../loaders/dbLoader.js";

const router = Router();

router.use(auth);

// GET /admin/logs/system?page=1&limit=50&level=info&category=user&search=...
router.get("/logs/system", allowRoles(ROLES.ADMIN), async (req, res, next) => {
  try {
    const { page = "1", limit = "50", level, category, search } = req.query;
    const result = await getSystemLogs({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      level: level || undefined,
      category: category || undefined,
      search: search || undefined,
    });
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

// GET /admin/logs/activity?page=1&limit=50&search=...&role=doctor
router.get("/logs/activity", allowRoles(ROLES.ADMIN), async (req, res, next) => {
  try {
    const { page = "1", limit = "50", search, role } = req.query;
    const result = await getUserActivity({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search: search || undefined,
      role: role || undefined,
    });
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

// GET /admin/grades-overview?search=...&stage=DESIGN
// Visible to admin AND doctors (they need to see team grades).
router.get("/grades-overview", allowRoles(ROLES.ADMIN, ROLES.DOCTOR), async (req, res, next) => {
  try {
    const { search, stage } = req.query;
    const result = await getGradesOverview({
      search: search || undefined,
      stage: stage || undefined,
    });
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

// GET /admin/analytics — admin + doctor (powers both /analytics and /reports pages)
router.get("/analytics", allowRoles(ROLES.ADMIN, ROLES.DOCTOR), async (req, res, next) => {
  try {
    const result = await getAnalytics();
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

// GET /admin/teams/:teamId/activity — chronological feed
// Visibility: admin sees all; doctor/ta only their teams; leader/member only their own team.
router.get("/teams/:teamId/activity", async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const actor = req.user;

    // Authorisation
    if (actor.role !== "ADMIN") {
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { leaderId: true, doctorId: true, taId: true, members: { select: { userId: true } } },
      });
      if (!team) return res.status(404).json({ ok: false, code: "TEAM_NOT_FOUND", message: "Team not found" });
      const allowed =
        team.leaderId === actor.id ||
        team.doctorId === actor.id ||
        team.taId === actor.id ||
        team.members.some((m) => m.userId === actor.id);
      if (!allowed) return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "You can't view this team's activity" });
    }

    const events = await getTeamActivity(teamId, { limit: 80 });
    res.json({ ok: true, data: events });
  } catch (err) {
    next(err);
  }
});

// GET /admin/teams/:teamId/report-card.pdf — admin + doctor
router.get("/teams/:teamId/report-card.pdf", allowRoles(ROLES.ADMIN, ROLES.DOCTOR), async (req, res, next) => {
  try {
    await streamTeamReportCardPdf(req.params.teamId, res);
  } catch (err) {
    next(err);
  }
});

export default router;
