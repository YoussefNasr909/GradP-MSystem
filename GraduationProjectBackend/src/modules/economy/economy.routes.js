import { Router } from "express";
import { ROLES } from "../../common/constants/roles.js";
import { auth } from "../../middlewares/auth.middleware.js";
import { allowRoles } from "../../middlewares/role.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  claimQuest,
  createAdminQuest,
  createAdminReward,
  equipReward,
  getAdminQuests,
  getAdminRewards,
  getCoinTransactions,
  getEconomyOverview,
  getMyQuests,
  getRewards,
  purchaseReward,
  updateAdminQuest,
  updateAdminReward,
} from "./economy.controller.js";
import {
  claimQuestSchema,
  equipRewardSchema,
  getAdminQuestsSchema,
  getAdminRewardsSchema,
  getCoinTransactionsSchema,
  getEconomyOverviewSchema,
  getMyQuestsSchema,
  getRewardsSchema,
  purchaseRewardSchema,
  saveAdminQuestSchema,
  saveAdminRewardSchema,
} from "./economy.schema.js";

const router = Router();

router.use(auth);

router.get("/me", validate(getEconomyOverviewSchema), getEconomyOverview);
router.get("/quests", validate(getMyQuestsSchema), getMyQuests);
router.post("/quests/:progressId/claim", validate(claimQuestSchema), claimQuest);
router.get("/rewards", validate(getRewardsSchema), getRewards);
router.post("/rewards/:rewardItemId/purchase", validate(purchaseRewardSchema), purchaseReward);
router.patch("/purchases/:purchaseId/equip", validate(equipRewardSchema), equipReward);
router.get("/transactions", validate(getCoinTransactionsSchema), getCoinTransactions);

router.get(
  "/admin/quests",
  allowRoles(ROLES.ADMIN, ROLES.DOCTOR, ROLES.TA),
  validate(getAdminQuestsSchema),
  getAdminQuests,
);
router.post(
  "/admin/quests",
  allowRoles(ROLES.ADMIN),
  validate(saveAdminQuestSchema),
  createAdminQuest,
);
router.patch(
  "/admin/quests/:questId",
  allowRoles(ROLES.ADMIN),
  validate(saveAdminQuestSchema),
  updateAdminQuest,
);
router.get(
  "/admin/rewards",
  allowRoles(ROLES.ADMIN, ROLES.DOCTOR, ROLES.TA),
  validate(getAdminRewardsSchema),
  getAdminRewards,
);
router.post(
  "/admin/rewards",
  allowRoles(ROLES.ADMIN),
  validate(saveAdminRewardSchema),
  createAdminReward,
);
router.patch(
  "/admin/rewards/:rewardItemId",
  allowRoles(ROLES.ADMIN),
  validate(saveAdminRewardSchema),
  updateAdminReward,
);

export default router;
