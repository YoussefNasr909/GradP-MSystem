import { z } from "zod";
import { AppError } from "../../common/errors/AppError.js";
import { createResourceService, deleteResourceService, listResourcesService, updateResourceService } from "./resources.service.js";
import { parseUpsertResourceBody, resourceByIdSchema } from "./resources.schema.js";

function resolveBackendOrigin(req) {
  const apiUrl = process.env.API_URL?.trim();
  if (apiUrl) {
    return apiUrl.replace(/\/api\/v1\/?$/, "");
  }

  return `${req.protocol}://${req.get("host")}`;
}

function mapZodToValidationError(error) {
  if (error instanceof z.ZodError) {
    const firstIssue = error.issues?.[0];
    throw new AppError(firstIssue?.message ?? "Validation error", 422, "VALIDATION_ERROR");
  }

  throw error;
}

export async function listResources(req, res) {
  const result = await listResourcesService(req.user, req.validated.query);
  res.json({ ok: true, data: result });
}

export async function createResource(req, res) {
  try {
    const fileUrl = req.file ? `${resolveBackendOrigin(req)}/uploads/resources/${req.file.filename}` : "";
    const payload = parseUpsertResourceBody(req.body, { fileUrl });
    const result = await createResourceService(req.user, payload);
    res.status(201).json({ ok: true, data: result });
  } catch (error) {
    mapZodToValidationError(error);
  }
}

export async function updateResource(req, res) {
  try {
    const parsedRoute = resourceByIdSchema.parse({
      params: req.params,
      query: req.query,
      body: req.body,
    });

    const fileUrl = req.file ? `${resolveBackendOrigin(req)}/uploads/resources/${req.file.filename}` : "";
    const payload = parseUpsertResourceBody(req.body, { fileUrl, existingUrl: req.body?.existingUrl });
    const result = await updateResourceService(req.user, parsedRoute.params.id, payload);
    res.json({ ok: true, data: result });
  } catch (error) {
    mapZodToValidationError(error);
  }
}

export async function deleteResource(req, res) {
  try {
    const parsedRoute = resourceByIdSchema.parse({
      params: req.params,
      query: req.query,
      body: req.body,
    });
    const result = await deleteResourceService(req.user, parsedRoute.params.id);
    res.json({ ok: true, data: result });
  } catch (error) {
    mapZodToValidationError(error);
  }
}
