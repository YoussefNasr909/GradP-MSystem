import {
  listWeeklyReportsService,
  reviewWeeklyReportService,
  submitWeeklyReportService,
} from "./weekly-reports.service.js";

export async function listWeeklyReports(req, res) {
  const result = await listWeeklyReportsService(req.user, req.validated.query);
  res.json({ ok: true, data: result });
}

export async function submitWeeklyReport(req, res) {
  const result = await submitWeeklyReportService(req.user, req.validated.params.id, req.validated.body);
  res.json({ ok: true, data: result });
}

export async function reviewWeeklyReport(req, res) {
  const result = await reviewWeeklyReportService(req.user, req.validated.params.id, req.validated.body);
  res.json({ ok: true, data: result });
}
