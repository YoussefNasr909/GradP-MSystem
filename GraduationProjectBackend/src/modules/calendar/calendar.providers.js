import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { AppError } from "../../common/errors/AppError.js";
import { decryptSecret, encryptSecret } from "../../common/utils/crypto.js";
import { prisma } from "../../loaders/dbLoader.js";

const GOOGLE_AUTH_SCOPES = ["openid", "email", "profile", "https://www.googleapis.com/auth/calendar"].join(" ");
const MICROSOFT_AUTH_SCOPES = ["openid", "profile", "email", "offline_access", "User.Read", "Calendars.ReadWrite"].join(" ");

const createOAuthState = (userId, provider) =>
  jwt.sign({ sub: userId, provider, purpose: "calendar-connect" }, env.jwtSecret, { expiresIn: "10m" });

const assertRequired = (value, message, code) => {
  if (!value || !String(value).trim()) throw new AppError(message, 500, code);
  return String(value).trim();
};

const assertAbsoluteUrl = (value, message, code) => {
  const url = assertRequired(value, message, code);
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("invalid protocol");
    return parsed.toString();
  } catch {
    throw new AppError(message, 500, code);
  }
};

export function verifyCalendarOAuthState(state, provider) {
  try {
    const payload = jwt.verify(String(state || ""), env.jwtSecret);
    if (payload?.purpose !== "calendar-connect" || payload?.provider !== provider || !payload?.sub) {
      throw new AppError("Invalid calendar OAuth state.", 400, "INVALID_CALENDAR_OAUTH_STATE");
    }
    return String(payload.sub);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Invalid calendar OAuth state.", 400, "INVALID_CALENDAR_OAUTH_STATE");
  }
}

export function getGoogleCalendarAuthUrl(userId) {
  const state = createOAuthState(userId, "GOOGLE");
  const clientId = assertRequired(env.googleCalendarClientId, "Missing GOOGLE_CALENDAR_CLIENT_ID in backend .env", "GOOGLE_CALENDAR_CLIENT_ID_MISSING");
  const redirectUri = assertAbsoluteUrl(env.googleCalendarRedirectUri, "GOOGLE_CALENDAR_REDIRECT_URI must be an absolute URL", "GOOGLE_CALENDAR_REDIRECT_URI_INVALID");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_AUTH_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function getMicrosoftCalendarAuthUrl(userId) {
  const state = createOAuthState(userId, "OUTLOOK");
  const clientId = assertRequired(env.microsoftClientId, "Missing MICROSOFT_CLIENT_ID in backend .env", "MICROSOFT_CLIENT_ID_MISSING");
  const tenantId = assertRequired(env.microsoftTenantId, "Missing MICROSOFT_TENANT_ID in backend .env", "MICROSOFT_TENANT_ID_MISSING");
  const redirectUri = assertAbsoluteUrl(env.microsoftRedirectUri, "MICROSOFT_REDIRECT_URI must be an absolute URL", "MICROSOFT_REDIRECT_URI_INVALID");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    response_mode: "query",
    scope: MICROSOFT_AUTH_SCOPES,
    state,
  });
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

async function postForm(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = await res.json();
  if (!res.ok) throw new AppError(json?.error_description || json?.error?.message || "Provider OAuth failed.", 400, "CALENDAR_OAUTH_FAILED");
  return json;
}

async function fetchJson(url, accessToken, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new AppError(json?.error?.message || json?.error_description || "Calendar provider request failed.", res.status, "CALENDAR_PROVIDER_ERROR");
  return json;
}

const tokenExpiryFromSeconds = (expiresIn) => (!expiresIn ? null : new Date(Date.now() + Math.max(0, Number(expiresIn) - 60) * 1000));

export async function exchangeGoogleCalendarCode(code) {
  const token = await postForm("https://oauth2.googleapis.com/token", {
    code: String(code),
    client_id: assertRequired(env.googleCalendarClientId, "Missing GOOGLE_CALENDAR_CLIENT_ID in backend .env", "GOOGLE_CALENDAR_CLIENT_ID_MISSING"),
    client_secret: assertRequired(env.googleCalendarClientSecret, "Missing GOOGLE_CALENDAR_CLIENT_SECRET in backend .env", "GOOGLE_CALENDAR_CLIENT_SECRET_MISSING"),
    redirect_uri: assertAbsoluteUrl(env.googleCalendarRedirectUri, "GOOGLE_CALENDAR_REDIRECT_URI must be an absolute URL", "GOOGLE_CALENDAR_REDIRECT_URI_INVALID"),
    grant_type: "authorization_code",
  });
  const profile = await fetchJson("https://www.googleapis.com/oauth2/v3/userinfo", token.access_token);
  return {
    provider: "GOOGLE",
    email: profile.email || null,
    displayName: profile.name || profile.email || null,
    externalCalendarId: "primary",
    accessTokenEncrypted: encryptSecret(token.access_token),
    refreshTokenEncrypted: encryptSecret(token.refresh_token || null),
    accessTokenExpiresAt: tokenExpiryFromSeconds(token.expires_in),
    scopes: String(token.scope || "").split(/\s+/).filter(Boolean),
    lastSyncStatus: "PENDING",
  };
}

export async function exchangeMicrosoftCalendarCode(code) {
  const token = await postForm(`https://login.microsoftonline.com/${assertRequired(env.microsoftTenantId, "Missing MICROSOFT_TENANT_ID in backend .env", "MICROSOFT_TENANT_ID_MISSING")}/oauth2/v2.0/token`, {
    code: String(code),
    client_id: assertRequired(env.microsoftClientId, "Missing MICROSOFT_CLIENT_ID in backend .env", "MICROSOFT_CLIENT_ID_MISSING"),
    client_secret: assertRequired(env.microsoftClientSecret, "Missing MICROSOFT_CLIENT_SECRET in backend .env", "MICROSOFT_CLIENT_SECRET_MISSING"),
    redirect_uri: assertAbsoluteUrl(env.microsoftRedirectUri, "MICROSOFT_REDIRECT_URI must be an absolute URL", "MICROSOFT_REDIRECT_URI_INVALID"),
    grant_type: "authorization_code",
    scope: MICROSOFT_AUTH_SCOPES,
  });
  const profile = await fetchJson("https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName,mail", token.access_token);
  return {
    provider: "OUTLOOK",
    email: profile.mail || profile.userPrincipalName || null,
    displayName: profile.displayName || profile.userPrincipalName || null,
    externalCalendarId: "primary",
    accessTokenEncrypted: encryptSecret(token.access_token),
    refreshTokenEncrypted: encryptSecret(token.refresh_token || null),
    accessTokenExpiresAt: tokenExpiryFromSeconds(token.expires_in),
    scopes: String(token.scope || "").split(/\s+/).filter(Boolean),
    lastSyncStatus: "PENDING",
  };
}

async function refreshGoogleIntegration(integration) {
  const refreshToken = decryptSecret(integration.refreshTokenEncrypted);
  if (!refreshToken) throw new AppError("Reconnect Google Calendar to continue syncing.", 400, "CALENDAR_RECONNECT_REQUIRED");
  const token = await postForm("https://oauth2.googleapis.com/token", {
    client_id: assertRequired(env.googleCalendarClientId, "Missing GOOGLE_CALENDAR_CLIENT_ID in backend .env", "GOOGLE_CALENDAR_CLIENT_ID_MISSING"),
    client_secret: assertRequired(env.googleCalendarClientSecret, "Missing GOOGLE_CALENDAR_CLIENT_SECRET in backend .env", "GOOGLE_CALENDAR_CLIENT_SECRET_MISSING"),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const updated = await prisma.calendarIntegration.update({
    where: { id: integration.id },
    data: {
      accessTokenEncrypted: encryptSecret(token.access_token),
      accessTokenExpiresAt: tokenExpiryFromSeconds(token.expires_in),
      refreshTokenEncrypted: encryptSecret(token.refresh_token || refreshToken),
    },
  });
  return { ...integration, ...updated };
}

async function refreshMicrosoftIntegration(integration) {
  const refreshToken = decryptSecret(integration.refreshTokenEncrypted);
  if (!refreshToken) throw new AppError("Reconnect Outlook Calendar to continue syncing.", 400, "CALENDAR_RECONNECT_REQUIRED");
  const token = await postForm(`https://login.microsoftonline.com/${assertRequired(env.microsoftTenantId, "Missing MICROSOFT_TENANT_ID in backend .env", "MICROSOFT_TENANT_ID_MISSING")}/oauth2/v2.0/token`, {
    client_id: assertRequired(env.microsoftClientId, "Missing MICROSOFT_CLIENT_ID in backend .env", "MICROSOFT_CLIENT_ID_MISSING"),
    client_secret: assertRequired(env.microsoftClientSecret, "Missing MICROSOFT_CLIENT_SECRET in backend .env", "MICROSOFT_CLIENT_SECRET_MISSING"),
    refresh_token: refreshToken,
    redirect_uri: assertAbsoluteUrl(env.microsoftRedirectUri, "MICROSOFT_REDIRECT_URI must be an absolute URL", "MICROSOFT_REDIRECT_URI_INVALID"),
    grant_type: "refresh_token",
    scope: MICROSOFT_AUTH_SCOPES,
  });
  const updated = await prisma.calendarIntegration.update({
    where: { id: integration.id },
    data: {
      accessTokenEncrypted: encryptSecret(token.access_token),
      accessTokenExpiresAt: tokenExpiryFromSeconds(token.expires_in),
      refreshTokenEncrypted: encryptSecret(token.refresh_token || refreshToken),
    },
  });
  return { ...integration, ...updated };
}

export async function getValidAccessToken(integration) {
  if (!integration) throw new AppError("Calendar integration not found.", 404, "CALENDAR_INTEGRATION_NOT_FOUND");
  if (!integration.syncEnabled) throw new AppError("Calendar integration is disconnected.", 400, "CALENDAR_INTEGRATION_DISABLED");
  if (integration.accessTokenExpiresAt && new Date(integration.accessTokenExpiresAt).getTime() <= Date.now()) {
    integration = integration.provider === "GOOGLE" ? await refreshGoogleIntegration(integration) : await refreshMicrosoftIntegration(integration);
  }
  const accessToken = decryptSecret(integration.accessTokenEncrypted);
  if (!accessToken) throw new AppError("Missing access token. Reconnect your calendar.", 400, "CALENDAR_RECONNECT_REQUIRED");
  return accessToken;
}

function buildGoogleEventPayload(meeting, attendees) {
  return {
    summary: meeting.title,
    description: [meeting.description, meeting.agenda].filter(Boolean).join("\n\n"),
    location: meeting.location || undefined,
    start: { dateTime: meeting.startAt.toISOString(), timeZone: meeting.timezone || "Africa/Cairo" },
    end: { dateTime: meeting.endAt.toISOString(), timeZone: meeting.timezone || "Africa/Cairo" },
    attendees: attendees.map((a) => ({ email: a.email, displayName: a.displayName || undefined })),
    conferenceData: meeting.mode === "VIRTUAL" ? { createRequest: { requestId: `${meeting.id}-${Date.now()}`, conferenceSolutionKey: { type: "hangoutsMeet" } } } : undefined,
  };
}

function buildMicrosoftEventPayload(meeting, attendees, enableOnlineMeeting = true) {
  return {
    subject: meeting.title,
    body: { contentType: "HTML", content: [meeting.description, meeting.agenda].filter(Boolean).join("<br/><br/>") || meeting.title },
    start: { dateTime: meeting.startAt.toISOString(), timeZone: "UTC" },
    end: { dateTime: meeting.endAt.toISOString(), timeZone: "UTC" },
    location: meeting.location ? { displayName: meeting.location } : undefined,
    attendees: attendees.map((a) => ({ emailAddress: { address: a.email, name: a.displayName || a.email }, type: "required" })),
    isOnlineMeeting: Boolean(enableOnlineMeeting && meeting.mode === "VIRTUAL"),
    onlineMeetingProvider: enableOnlineMeeting && meeting.mode === "VIRTUAL" ? "teamsForBusiness" : undefined,
  };
}

async function getMicrosoftOnlineMeetingCapability(accessToken) {
  try {
    const calendar = await fetchJson("https://graph.microsoft.com/v1.0/me/calendar?$select=allowedOnlineMeetingProviders,defaultOnlineMeetingProvider", accessToken);
    return (calendar.allowedOnlineMeetingProviders || []).includes("teamsForBusiness");
  } catch {
    return false;
  }
}

export async function syncMeetingToProvider(meeting, integration, attendeeList) {
  const accessToken = await getValidAccessToken(integration);
  if (integration.provider === "GOOGLE") {
    const payload = buildGoogleEventPayload(meeting, attendeeList);
    const url = meeting.externalEventId
      ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(meeting.externalCalendarId || "primary")}/events/${encodeURIComponent(meeting.externalEventId)}?conferenceDataVersion=1&sendUpdates=all`
      : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(integration.externalCalendarId || "primary")}/events?conferenceDataVersion=1&sendUpdates=all`;
    const method = meeting.externalEventId ? "PATCH" : "POST";
    const event = await fetchJson(url, accessToken, { method, body: JSON.stringify(payload) });
    return {
      externalCalendarId: integration.externalCalendarId || "primary",
      externalEventId: event.id,
      joinUrl:
        event.hangoutLink ||
        event.conferenceData?.entryPoints?.find((entryPoint) => entryPoint.entryPointType === "video")?.uri ||
        meeting.joinUrl ||
        null,
      externalSyncError: null,
    };
  }

  const supportsTeams = await getMicrosoftOnlineMeetingCapability(accessToken);
  try {
    const payload = buildMicrosoftEventPayload(meeting, attendeeList, supportsTeams);
    const url = meeting.externalEventId ? `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(meeting.externalEventId)}` : "https://graph.microsoft.com/v1.0/me/events";
    const method = meeting.externalEventId ? "PATCH" : "POST";
    const event = await fetchJson(url, accessToken, { method, body: JSON.stringify(payload) });
    return {
      externalCalendarId: integration.externalCalendarId || "primary",
      externalEventId: event.id,
      joinUrl: event.onlineMeeting?.joinUrl || meeting.joinUrl || null,
      externalSyncError: supportsTeams ? null : "Outlook synced, but this account did not expose a Teams provider for online meeting generation.",
    };
  } catch (error) {
    if (!supportsTeams) {
      const fallbackPayload = buildMicrosoftEventPayload(meeting, attendeeList, false);
      const fallbackUrl = meeting.externalEventId ? `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(meeting.externalEventId)}` : "https://graph.microsoft.com/v1.0/me/events";
      const fallbackMethod = meeting.externalEventId ? "PATCH" : "POST";
      const event = await fetchJson(fallbackUrl, accessToken, { method: fallbackMethod, body: JSON.stringify(fallbackPayload) });
      return {
        externalCalendarId: integration.externalCalendarId || "primary",
        externalEventId: event.id,
        joinUrl: meeting.joinUrl || null,
        externalSyncError: "Outlook synced without a native Teams meeting because this account does not support it.",
      };
    }
    throw error;
  }
}

export async function deleteMeetingFromProvider(meeting, integration) {
  if (!meeting.externalEventId) return;
  const accessToken = await getValidAccessToken(integration);
  
  if (integration.provider === "GOOGLE") {
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(meeting.externalCalendarId || integration.externalCalendarId || "primary")}/events/${encodeURIComponent(meeting.externalEventId)}?sendUpdates=all`;
    await fetchJson(url, accessToken, { method: "DELETE" });
    return;
  }

  if (integration.provider === "OUTLOOK") {
    const url = `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(meeting.externalEventId)}`;
    await fetchJson(url, accessToken, { method: "DELETE" });
    return;
  }
}
