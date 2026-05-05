import { Router } from "express";
import { auth } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/role.middleware.js";
import { ROLES } from "../../common/constants/roles.js";
import { getSystemLogs, getUserActivity } from "./admin.service.js";

const router = Router();

router.use(auth);
router.use(allowRoles(ROLES.ADMIN));

// GET /admin/logs/system?page=1&limit=50&level=info&category=user&search=...
router.get("/logs/system", async (req, res, next) => {
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
router.get("/logs/activity", async (req, res, next) => {
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

export default router;
