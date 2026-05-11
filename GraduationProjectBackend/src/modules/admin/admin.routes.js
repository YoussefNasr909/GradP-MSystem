import { Router } from "express";
import { auth } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/role.middleware.js";
import { ROLES } from "../../common/constants/roles.js";
import { getSystemLogs, getUserActivity, getGradesOverview, getAnalytics } from "./admin.service.js";

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

export default router;
