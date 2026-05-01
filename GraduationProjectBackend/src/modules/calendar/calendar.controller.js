import {
  disconnectCalendarIntegrationService,
  getCalendarConnectUrlService,
  handleGoogleCalendarCallbackService,
  handleMicrosoftCalendarCallbackService,
  listCalendarEventsService,
  listCalendarIntegrationsService,
  syncCalendarProviderService,
} from "./calendar.service.js";

export async function listCalendarEvents(req, res) {
  const data = await listCalendarEventsService(req.user, req.validated?.query || req.query);
  res.json({ ok: true, data });
}

export async function listCalendarIntegrations(req, res) {
  const data = await listCalendarIntegrationsService(req.user);
  res.json({ ok: true, data });
}

export async function connectGoogleCalendar(req, res) {
  const data = { url: getCalendarConnectUrlService(req.user, "GOOGLE") };
  res.json({ ok: true, data });
}

export async function connectOutlookCalendar(req, res) {
  const data = { url: getCalendarConnectUrlService(req.user, "OUTLOOK") };
  res.json({ ok: true, data });
}

export async function googleCalendarCallback(req, res) {
  try {
    const redirectUrl = await handleGoogleCalendarCallbackService(req.query.code, req.query.state);
    res.redirect(redirectUrl);
  } catch (error) {
    const message = encodeURIComponent(error?.message || "Google Calendar connection failed.");
    res.redirect(`${(process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "")}/dashboard/calendar?provider=google&status=error&message=${message}`);
  }
}

export async function outlookCalendarCallback(req, res) {
  try {
    const redirectUrl = await handleMicrosoftCalendarCallbackService(req.query.code, req.query.state);
    res.redirect(redirectUrl);
  } catch (error) {
    const message = encodeURIComponent(error?.message || "Outlook Calendar connection failed.");
    res.redirect(`${(process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "")}/dashboard/calendar?provider=outlook&status=error&message=${message}`);
  }
}

export async function disconnectCalendarIntegration(req, res) {
  const data = await disconnectCalendarIntegrationService(req.user, req.validated.params.provider.toUpperCase());
  res.json({ ok: true, data });
}

export async function syncCalendarProvider(req, res) {
  const data = await syncCalendarProviderService(req.user, req.validated.params.provider, req.validated.body || {});
  res.json({ ok: true, data });
}
