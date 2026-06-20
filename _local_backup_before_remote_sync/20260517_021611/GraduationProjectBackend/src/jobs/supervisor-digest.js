import cron from "node-cron";
import { prisma } from "../loaders/dbLoader.js";
import { sendNotificationEmail } from "../common/utils/mailer.js";
import { env } from "../config/env.js";
// Note: env.frontendUrl falls back to localhost:3000 if not set.

const ROLES = { DOCTOR: "DOCTOR", TA: "TA" };

/**
 * Builds the "what's waiting for you" digest payload for one supervisor.
 * Returns null if there's nothing to flag (we don't email empty digests).
 */
async function buildDigestForSupervisor(supervisor) {
  const supervisedTeamIds = await prisma.team
    .findMany({
      where: supervisor.role === ROLES.DOCTOR
        ? { doctorId: supervisor.id }
        : { taId: supervisor.id },
      select: { id: true },
    })
    .then((ts) => ts.map((t) => t.id));

  if (supervisedTeamIds.length === 0) return null;

  if (supervisor.role === ROLES.DOCTOR) {
    const [proposals, awaitingFinal, overdueDeadlines] = await Promise.all([
      prisma.proposal.count({
        where: { teamId: { in: supervisedTeamIds }, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      }),
      prisma.submission.count({
        where: { teamId: { in: supervisedTeamIds }, status: "UNDER_REVIEW" },
      }),
      prisma.teamDeliverableDeadline.count({
        where: { teamId: { in: supervisedTeamIds }, dueDate: { lt: new Date() } },
      }),
    ]);
    const totalActions = proposals + awaitingFinal;
    if (totalActions === 0) return null;

    const lines = [];
    if (proposals > 0)      lines.push(`<li><b>${proposals}</b> proposal${proposals === 1 ? "" : "s"} awaiting your review</li>`);
    if (awaitingFinal > 0)  lines.push(`<li><b>${awaitingFinal}</b> submission${awaitingFinal === 1 ? "" : "s"} TA-reviewed and waiting for your final grade</li>`);
    if (overdueDeadlines > 0) lines.push(`<li><b>${overdueDeadlines}</b> deadline${overdueDeadlines === 1 ? "" : "s"} now overdue</li>`);

    return {
      title: `Your weekly review queue — ${totalActions} action${totalActions === 1 ? "" : "s"}`,
      message: `<p>Hi ${supervisor.firstName},</p>
        <p>Here's what's waiting for you across your ${supervisedTeamIds.length} supervised team${supervisedTeamIds.length === 1 ? "" : "s"}:</p>
        <ul>${lines.join("")}</ul>`,
    };
  }

  // TA digest
  const [pendingReviews, prsToReview] = await Promise.all([
    prisma.submission.count({
      where: { teamId: { in: supervisedTeamIds }, status: "PENDING" },
    }),
    prisma.task.count({
      where: { teamId: { in: supervisedTeamIds }, status: "REVIEW" },
    }),
  ]);
  const totalActions = pendingReviews + prsToReview;
  if (totalActions === 0) return null;

  const lines = [];
  if (pendingReviews > 0) lines.push(`<li><b>${pendingReviews}</b> submission${pendingReviews === 1 ? "" : "s"} awaiting your first-pass review</li>`);
  if (prsToReview > 0)    lines.push(`<li><b>${prsToReview}</b> task${prsToReview === 1 ? "" : "s"} / PR${prsToReview === 1 ? "" : "s"} awaiting your code review</li>`);

  return {
    title: `Your weekly review queue — ${totalActions} action${totalActions === 1 ? "" : "s"}`,
    message: `<p>Hi ${supervisor.firstName},</p>
      <p>Here's what's waiting for you across your ${supervisedTeamIds.length} supervised team${supervisedTeamIds.length === 1 ? "" : "s"}:</p>
      <ul>${lines.join("")}</ul>`,
  };
}

/**
 * Runs the digest for every doctor and TA who has at least one supervised team.
 * Returns a summary of what was sent.
 */
export async function runSupervisorDigest() {
  const supervisors = await prisma.user.findMany({
    where: { role: { in: [ROLES.DOCTOR, ROLES.TA] }, accountStatus: "ACTIVE" },
    select: {
      id: true, role: true, firstName: true, lastName: true, email: true,
      settings: { select: { emailNotifications: true, weeklyDigest: true } },
    },
  });

  let sent = 0;
  let skipped = 0;
  for (const s of supervisors) {
    // Honor user preferences — only send if they opted in (or have no prefs yet)
    const wantsEmail  = s.settings?.emailNotifications !== false;
    const wantsDigest = s.settings?.weeklyDigest !== false;
    if (!wantsEmail || !wantsDigest) { skipped++; continue; }

    const payload = await buildDigestForSupervisor(s);
    if (!payload) { skipped++; continue; }

    try {
      await sendNotificationEmail({
        to: s.email,
        title: payload.title,
        message: payload.message,
        actionUrl: `${env.frontendUrl ?? "http://localhost:3000"}/dashboard`,
      });
      sent++;
    } catch (err) {
      console.warn(`[digest] failed to send to ${s.email}:`, err?.message);
      skipped++;
    }
  }

  console.log(`[digest] sent=${sent} skipped=${skipped} total=${supervisors.length}`);
  return { sent, skipped, total: supervisors.length };
}

let started = false;
/**
 * Wire up the cron schedule. Idempotent — safe to call multiple times.
 * Default: every Sunday at 09:00 server time (configurable via env).
 */
export function startSupervisorDigestCron() {
  if (started) return;
  started = true;

  const expression = process.env.SUPERVISOR_DIGEST_CRON || "0 9 * * 0"; // Sun 09:00

  if (!cron.validate(expression)) {
    console.warn(`[digest] invalid cron expression "${expression}" — digest not scheduled`);
    return;
  }

  cron.schedule(expression, () => {
    runSupervisorDigest().catch((err) => {
      console.error("[digest] run failed:", err);
    });
  });

  console.log(`[digest] supervisor digest scheduled at "${expression}"`);
}
