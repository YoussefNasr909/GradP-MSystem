import { Router } from "express";
import { auth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  claimQuest,
  equipReward,
  getCoinTransactions,
  getEconomyOverview,
  getMyQuests,
  getRewards,
  purchaseReward,
} from "./economy.controller.js";
import {
  claimQuestSchema,
  equipRewardSchema,
  getCoinTransactionsSchema,
  getEconomyOverviewSchema,
  getMyQuestsSchema,
  getRewardsSchema,
  purchaseRewardSchema,
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

export default router;
