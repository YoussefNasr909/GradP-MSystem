import {
  listProposalsService,
  getProposalService,
  getMyProposalService,
  createProposalService,
  updateProposalService,
  submitProposalService,
  reviewProposalService,
  deleteProposalService,
} from "./proposals.service.js";

export async function listProposals(req, res) {
  const result = await listProposalsService(req.user, req.validated.query);
  res.json({ ok: true, data: result });
}

export async function getMyProposal(req, res) {
  const result = await getMyProposalService(req.user);
  res.json({ ok: true, data: result });
}

export async function getProposal(req, res) {
  const result = await getProposalService(req.user, req.validated.params.id);
  res.json({ ok: true, data: result });
}

export async function createProposal(req, res) {
  const result = await createProposalService(req.user, req.validated.body);
  res.status(201).json({ ok: true, data: result });
}

export async function updateProposal(req, res) {
  const result = await updateProposalService(req.user, req.validated.params.id, req.validated.body);
  res.json({ ok: true, data: result });
}

export async function submitProposal(req, res) {
  const result = await submitProposalService(req.user, req.validated.params.id);
  res.json({ ok: true, data: result });
}

export async function reviewProposal(req, res) {
  const result = await reviewProposalService(req.user, req.validated.params.id, req.validated.body);
  res.json({ ok: true, data: result });
}

export async function deleteProposal(req, res) {
  const result = await deleteProposalService(req.user, req.validated.params.id);
  res.json({ ok: true, data: result });
}
