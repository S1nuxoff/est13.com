import { Bot, Headset } from "lucide-react";

import type { UserItem } from "../api/types";

export function RightPanel(props: { loading: boolean; users: UserItem[] }) {
  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] ring-1 ring-black/10">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold tracking-tight">Чати</div>
          <div className="text-xs text-zinc-500">{props.loading ? "оновлення…" : " "}</div>
        </div>
        <div className="mt-3 space-y-2">
          {props.users.length ? (
            props.users.slice(0, 8).map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  window.location.hash = `chats?userId=${u.id}`;
                }}
                className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 text-left ring-1 ring-black/10 hover:bg-zinc-50"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {u.first_name || u.last_name
                      ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim()
                      : u.username
                        ? `@${u.username}`
                        : `tg ${u.tg_id}`}
                  </div>
                  <div className="truncate text-xs text-zinc-500">
                    {u.active_service_title ? `${u.active_service_title} • ` : ""}
                    {u.active_question_text
                      ? u.active_question_text.replace(/\\s+/g, " ").trim()
                      : `tg: ${u.tg_id}`}
                  </div>
                </div>
                {u.support_enabled ? (
                  <div
                    title="Підтримка увімкнена"
                    aria-label="Підтримка увімкнена"
                    className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100/60 text-emerald-700 ring-1 ring-emerald-200/70"
                  >
                    <Headset className="h-4 w-4" />
                  </div>
                ) : (
                  <div
                    title="Звичайний режим"
                    aria-label="Звичайний режим"
                    className="grid h-8 w-8 place-items-center rounded-full bg-zinc-100/60 text-zinc-700 ring-1 ring-black/10"
                  >
                    <Bot className="h-4 w-4" />
                  </div>
                )}
              </button>
            ))
          ) : (
            <div className="text-sm text-zinc-600">Немає користувачів</div>
          )}
        </div>
      </div>
    </div>
  );
}

