import { expect, type APIRequestContext } from "@playwright/test";
import { API_BASE_URL } from "./constants";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  token?: string;
  data?: unknown;
  multipart?: any;
  headers?: Record<string, string>;
};

export type ApiResult<T = unknown> = {
  status: number;
  ok: boolean;
  body: any;
  data: T;
};

function apiUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiRequest<T = unknown>(
  request: APIRequestContext,
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const response = await request.fetch(apiUrl(path), {
    method: options.method ?? "GET",
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers ?? {}),
    },
    data: options.data,
    multipart: options.multipart,
    failOnStatusCode: false,
  });

  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return {
    status: response.status(),
    ok: response.ok(),
    body,
    data: body && typeof body === "object" && "data" in body ? body.data : body,
  };
}

export async function expectApiOk<T = unknown>(
  request: APIRequestContext,
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const result = await apiRequest<T>(request, path, options);
  expect(result.ok, `${options.method ?? "GET"} ${path}: ${JSON.stringify(result.body)}`).toBeTruthy();
  return result;
}

export async function expectApiStatus(
  request: APIRequestContext,
  path: string,
  expectedStatus: number | number[],
  options: RequestOptions = {},
) {
  const result = await apiRequest(request, path, options);
  const expected = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  expect(expected, `${options.method ?? "GET"} ${path}: ${JSON.stringify(result.body)}`).toContain(result.status);
  return result;
}

export async function expectUnauthorizedWithoutToken(request: APIRequestContext, path: string) {
  const result = await apiRequest(request, path);
  expect([401, 403], `Expected ${path} to require auth, got ${result.status}`).toContain(result.status);
  expect(JSON.stringify(result.body)).not.toMatch(/passwordHash|emailVerificationCodeHash|twoFactorSecret/i);
  return result;
}
