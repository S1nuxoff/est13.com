type ApiError = {
  status: number
  detail: string
}

function baseUrl() {
  const env = (import.meta as any).env as Record<string, string | undefined>
  return (env.VITE_ADMIN_API_URL || "").replace(/\/+$/, "")
}

export function apiBaseUrl() {
  return baseUrl()
}

function initData() {
  return (window as any).Telegram?.WebApp?.initData || ""
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const url = `${baseUrl()}${path}`
  const headers = new Headers(opts.headers || {})
  const init = initData()
  if (init) headers.set("X-Tg-Init-Data", init)
  let res: Response
  try {
    res = await fetch(url, {
      ...opts,
      headers,
      // Mini App auth is header-based (initData). Cookies are not required.
      credentials: "omit",
    })
  } catch {
    throw {
      status: 0,
      detail: `Помилка мережі або CORS. Перевірте VITE_ADMIN_API_URL: ${baseUrl() || "(порожньо)"}`,
    } satisfies ApiError
  }
  const ct = res.headers.get("content-type") || ""
  const isJson = ct.includes("application/json")
  if (!res.ok) {
    const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => "")
    const detail =
      (body && typeof body === "object" && "detail" in body && String((body as any).detail)) ||
      (typeof body === "string" && body) ||
      res.statusText ||
      "Request failed"
    const err: ApiError = { status: res.status, detail }
    throw err
  }
  if (!isJson) return (await res.text()) as unknown as T
  return (await res.json()) as T
}

export type WebAppService = { id: number; title: string }

export type WebAppOption = { id: number; text: string; keyboard_row: number; keyboard_col: number }

export type WebAppQuestion = {
  id: number
  text: string
  qtype: string
  is_required: boolean
  photo: boolean
  options: WebAppOption[]
}

export type WebAppAnswer = {
  id: number
  question_id: number
  question_text: string
  value: string
  has_photo: boolean
}

export type WebAppState = {
  active: boolean
  lead_id?: number | null
  service_id?: number | null
  service_title?: string | null
  step?: number | null
  total?: number | null
  question?: WebAppQuestion | null
  answers: WebAppAnswer[]
}

export type MyLeadItem = {
  id: number
  service_id: number
  service_title?: string | null
  status: string
  started_at?: string | null
  submitted_at?: string | null
  updated_at?: string | null
}

export type MyLeadDetails = MyLeadItem & {
  answers: WebAppAnswer[]
  events: { id: number; to_status: string | null; created_at: string | null }[]
}

export const api = {
  services: () => request<WebAppService[]>("/api/webapp/services"),
  state: () => request<WebAppState>("/api/webapp/state"),
  start: (service_id: number) =>
    request<WebAppState>("/api/webapp/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service_id }),
    }),
  back: () => request<WebAppState>("/api/webapp/back", { method: "POST" }),
  rewind: (answer_id: number) =>
    request<WebAppState>("/api/webapp/rewind", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer_id }),
    }),
  answerChoice: (option_id: number) => {
    const fd = new FormData()
    fd.set("option_id", String(option_id))
    return request<WebAppState>("/api/webapp/answer", { method: "POST", body: fd })
  },
  answerTextOrPhoto: (text: string, file?: File | null) => {
    const fd = new FormData()
    if (text) fd.set("text", text)
    if (file) fd.set("file", file)
    return request<WebAppState>("/api/webapp/answer", { method: "POST", body: fd })
  },
  myLeads: (limit = 50) => request<MyLeadItem[]>(`/api/webapp/my/leads?limit=${encodeURIComponent(String(limit))}`),
  myLead: (lead_id: number) => request<MyLeadDetails>(`/api/webapp/my/leads/${lead_id}`),
}
