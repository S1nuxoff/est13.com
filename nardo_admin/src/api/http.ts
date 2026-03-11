import { getAdminToken, getApiBase } from "../lib/storage";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

function joinUrl(base: string, path: string): string {
  const b = base.trim();
  if (!b) return path;
  return b.replace(/\/+$/, "") + path;
}

export async function apiRequestBlob(path: string): Promise<Blob> {
  const apiBase = getApiBase();
  const url = joinUrl(apiBase, path);
  const token = getAdminToken();

  const headers: Record<string, string> = {};
  if (token) headers["X-Admin-Token"] = token;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    const payload = text ? safeJson(text) : null;
    throw new ApiError((payload as any)?.detail ?? `HTTP ${res.status}`, res.status, payload);
  }
  return await res.blob();
}

export async function apiRequest<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
): Promise<T> {
  const apiBase = getApiBase();
  const url = joinUrl(apiBase, path);
  const token = getAdminToken();

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers["X-Admin-Token"] = token;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  const payload = text ? safeJson(text) : null;
  if (!res.ok) {
    throw new ApiError((payload as any)?.detail ?? `HTTP ${res.status}`, res.status, payload);
  }
  return payload as T;
}

export async function apiRequestForm<T>(
  method: Exclude<HttpMethod, "GET">,
  path: string,
  form: FormData,
): Promise<T> {
  const apiBase = getApiBase();
  const url = joinUrl(apiBase, path);
  const token = getAdminToken();

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers["X-Admin-Token"] = token;

  const res = await fetch(url, { method, headers, body: form });
  const text = await res.text();
  const payload = text ? safeJson(text) : null;
  if (!res.ok) {
    throw new ApiError((payload as any)?.detail ?? `HTTP ${res.status}`, res.status, payload);
  }
  return payload as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
