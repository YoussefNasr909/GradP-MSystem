import { getMySettingsService, updateMySettingsService } from "./settings.service.js";

export async function getMySettings(req, res) {
  const settings = await getMySettingsService(req.user);
  res.json({ ok: true, data: settings });
}

export async function updateMySettings(req, res) {
  const settings = await updateMySettingsService(req.user, req.validated.body);
  res.json({ ok: true, data: settings });
}
