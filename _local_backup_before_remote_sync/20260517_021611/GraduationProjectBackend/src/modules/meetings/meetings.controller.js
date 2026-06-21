import {
  approveMeetingService,
  cancelMeetingService,
  completeMeetingService,
  createMeetingService,
  declineMeetingService,
  deleteMeetingService,
  getMeetingService,
  listMeetingsService,
  respondMeetingService,
  syncMeetingService,
  updateMeetingService,
} from "./meetings.service.js";

export async function listMeetings(req, res) {
  const data = await listMeetingsService(req.user, req.validated?.query || req.query);
  res.json({ ok: true, data });
}

export async function getMeeting(req, res) {
  const data = await getMeetingService(req.user, req.validated.params.id);
  res.json({ ok: true, data });
}

export async function createMeeting(req, res) {
  const data = await createMeetingService(req.user, req.validated.body);
  res.status(201).json({ ok: true, data });
}

export async function updateMeeting(req, res) {
  const data = await updateMeetingService(req.user, req.validated.params.id, req.validated.body);
  res.json({ ok: true, data });
}

export async function approveMeeting(req, res) {
  const data = await approveMeetingService(req.user, req.validated.params.id);
  res.json({ ok: true, data });
}

export async function declineMeeting(req, res) {
  const data = await declineMeetingService(req.user, req.validated.params.id, req.validated.body);
  res.json({ ok: true, data });
}

export async function respondMeeting(req, res) {
  const data = await respondMeetingService(req.user, req.validated.params.id, req.validated.body);
  res.json({ ok: true, data });
}

export async function cancelMeeting(req, res) {
  const data = await cancelMeetingService(req.user, req.validated.params.id);
  res.json({ ok: true, data });
}

export async function completeMeeting(req, res) {
  const data = await completeMeetingService(req.user, req.validated.params.id);
  res.json({ ok: true, data });
}

export async function deleteMeeting(req, res) {
  const data = await deleteMeetingService(req.user, req.validated.params.id);
  res.json({ ok: true, data });
}

export async function syncMeeting(req, res) {
  const data = await syncMeetingService(req.user, req.validated.params.id);
  res.json({ ok: true, data });
}
