import { prisma } from "../../loaders/dbLoader.js";
import { env } from "../../config/env.js";

export function buildGamificationIdempotencyKey(...parts) {
  return parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(":");
}

/**
 * Emit a gamification event to the outbox table.
 *
 * This is best-effort and fire-and-forget: it must never block or fail the
 * calling service. Phase 3 only records pending outbox events; awarding XP is
 * handled later by the explicit processor/worker flow.
 *
 * @param {object} params
 * @param {string} params.eventType - GamificationEventType enum value
 * @param {string} params.sourceType - e.g. "Task", "Submission", "Team"
 * @param {string} params.sourceId - ID of the source record
 * @param {string} params.idempotencyKey - unique key to prevent duplicate events
 * @param {string} [params.teamId] - optional team context
 * @param {string} [params.actorUserId] - user who triggered the event
 * @param {object} [params.payload] - additional event-specific data
 */
export async function emitGamificationEvent({
  eventType,
  sourceType,
  sourceId,
  idempotencyKey,
  teamId = null,
  actorUserId = null,
  payload = null,
}) {
  if (!env.gamificationEnabled) {
    return null;
  }

  try {
    return await prisma.gamificationEvent.upsert({
      where: { idempotencyKey },
      update: {},
      create: {
        eventType,
        sourceType,
        sourceId,
        idempotencyKey,
        teamId,
        actorUserId,
        payload,
        status: "PENDING",
        occurredAt: new Date(),
      },
    });
  } catch (err) {
    // Gamification must never break the academic workflow critical path.
    console.warn(
      `[gamification] Failed to emit ${eventType} event (key=${idempotencyKey}):`,
      err?.message,
    );
    return null;
  }
}
