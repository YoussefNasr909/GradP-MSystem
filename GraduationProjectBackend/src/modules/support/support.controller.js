import {
  addSupportTicketMessageService,
  bulkUpdateSupportTicketsService,
  createSupportSavedReplyService,
  createSupportTicketService,
  deleteSupportSavedReplyService,
  getSupportSummaryService,
  getSupportTicketService,
  listSupportAgentsService,
  listSupportSavedRepliesService,
  listSupportTicketsService,
  quickChatSupportTicketService,
  reopenSupportTicketService,
  updateSupportSavedReplyService,
  updateSupportTicketService,
} from "./support.service.js";

export async function listSupportAgents(req, res) {
  const result = await listSupportAgentsService(req.user);
  res.json({ ok: true, data: result });
}

export async function listSupportTickets(req, res) {
  const result = await listSupportTicketsService(req.user, req.validated.query);
  res.json({ ok: true, data: result });
}

export async function listSupportSavedReplies(req, res) {
  const result = await listSupportSavedRepliesService(req.user, req.validated.query);
  res.json({ ok: true, data: result });
}

export async function createSupportSavedReply(req, res) {
  const result = await createSupportSavedReplyService(req.user, req.validated.body);
  res.status(201).json({ ok: true, data: result });
}

export async function updateSupportSavedReply(req, res) {
  const result = await updateSupportSavedReplyService(req.user, req.validated.params.id, req.validated.body);
  res.json({ ok: true, data: result });
}

export async function deleteSupportSavedReply(req, res) {
  const result = await deleteSupportSavedReplyService(req.user, req.validated.params.id);
  res.json({ ok: true, data: result });
}

export async function getSupportSummary(req, res) {
  const result = await getSupportSummaryService(req.user);
  res.json({ ok: true, data: result });
}

export async function createSupportTicket(req, res) {
  const result = await createSupportTicketService(req.user, req.validated.body, req.files ?? []);
  res.status(201).json({ ok: true, data: result });
}

export async function quickChatSupportTicket(req, res) {
  const result = await quickChatSupportTicketService(req.user, req.validated.body);
  res.status(201).json({ ok: true, data: result });
}

export async function getSupportTicket(req, res) {
  const result = await getSupportTicketService(req.user, req.validated.params.id);
  res.json({ ok: true, data: result });
}

export async function addSupportTicketMessage(req, res) {
  const result = await addSupportTicketMessageService(req.user, req.validated.params.id, req.validated.body, req.files ?? []);
  res.status(201).json({ ok: true, data: result });
}

export async function updateSupportTicket(req, res) {
  const result = await updateSupportTicketService(req.user, req.validated.params.id, req.validated.body);
  res.json({ ok: true, data: result });
}

export async function bulkUpdateSupportTickets(req, res) {
  const result = await bulkUpdateSupportTicketsService(req.user, req.validated.body);
  res.json({ ok: true, data: result });
}

export async function reopenSupportTicket(req, res) {
  const result = await reopenSupportTicketService(req.user, req.validated.params.id, req.validated.body);
  res.json({ ok: true, data: result });
}
