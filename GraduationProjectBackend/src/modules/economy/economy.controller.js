import {
  claimQuestService,
  equipRewardService,
  getCoinTransactionsService,
  getEconomyOverviewService,
  getMyQuestsService,
  getRewardsService,
  purchaseRewardService,
} from "./economy.service.js";

export async function getEconomyOverview(req, res) {
  const result = await getEconomyOverviewService(req.user);
  res.json({ ok: true, data: result });
}

export async function getMyQuests(req, res) {
  const result = await getMyQuestsService(req.user);
  res.json({ ok: true, data: result });
}

export async function claimQuest(req, res) {
  const result = await claimQuestService(req.user, req.validated.params.progressId);
  res.json({ ok: true, data: result });
}

export async function getRewards(req, res) {
  const result = await getRewardsService(req.user);
  res.json({ ok: true, data: result });
}

export async function purchaseReward(req, res) {
  const result = await purchaseRewardService(req.user, req.validated.params.rewardItemId);
  res.status(201).json({ ok: true, data: result });
}

export async function equipReward(req, res) {
  const result = await equipRewardService(
    req.user,
    req.validated.params.purchaseId,
    req.validated.body.equipped,
  );
  res.json({ ok: true, data: result });
}

export async function getCoinTransactions(req, res) {
  const result = await getCoinTransactionsService(req.user, req.validated.query);
  res.json({ ok: true, data: result });
}
