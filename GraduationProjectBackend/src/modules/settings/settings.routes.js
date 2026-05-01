import { Router } from "express";
import { auth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { getMySettings, updateMySettings } from "./settings.controller.js";
import { getMySettingsSchema, updateMySettingsSchema } from "./settings.schema.js";

const router = Router();

router.use(auth);
router.get("/me", validate(getMySettingsSchema), getMySettings);
router.patch("/me", validate(updateMySettingsSchema), updateMySettings);

export default router;
