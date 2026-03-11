const TOKEN_KEY = "est13_admin_token";
const API_BASE_KEY = "est13_api_base";
const SOUND_ENABLED_KEY = "est13_sound_enabled";

function defaultApiBase(): string {
  const env = (import.meta as any).env as Record<string, string | undefined>;
  const fromEnv = (env.VITE_ADMIN_API_URL || "").trim();
  if (fromEnv) return fromEnv;

  if (typeof window === "undefined") return "";
  const host = window.location.hostname || "";
  if (host.startsWith("admin.")) {
    return `${window.location.protocol}//api.${host.slice("admin.".length)}`;
  }
  return "";
}

function isLocalhostHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
}

export function getAdminToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function setAdminToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getApiBase(): string {
  const stored = localStorage.getItem(API_BASE_KEY);
  const fallback = defaultApiBase();

  // If user already saved a value, use it.
  if (stored !== null && stored.trim() !== "") return stored;

  // If value is missing (or blank) in production-like domains, use fallback.
  // This avoids accidental POSTs to the static Admin UI container.
  if (stored === null) return fallback;
  if (fallback && typeof window !== "undefined" && !isLocalhostHost(window.location.hostname)) {
    return fallback;
  }

  // Local dev: empty means "use /api (Vite proxy)".
  return stored ?? "";
}

export function setApiBase(base: string): void {
  localStorage.setItem(API_BASE_KEY, base);
}

export function getNotificationSoundEnabled(): boolean {
  const v = localStorage.getItem(SOUND_ENABLED_KEY);
  if (v === null) return true;
  return v !== "0";
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  localStorage.setItem(SOUND_ENABLED_KEY, enabled ? "1" : "0");
}
