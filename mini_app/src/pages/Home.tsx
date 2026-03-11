import { useEffect, useMemo, useState } from "react"
import { ChevronRight, BriefcaseBusiness } from "lucide-react"

import { api, type WebAppService } from "../lib/api"
import { tgUserName } from "../lib/telegram"
import { Card, Button } from "../components/ui"

export function Home({
  onStart,
  onMy,
}: {
  onStart: (serviceId: number) => void
  onMy: () => void
}) {
  const [services, setServices] = useState<WebAppService[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [starting, setStarting] = useState<number | null>(null)

  const name = useMemo(() => tgUserName(), [])

  useEffect(() => {
    let cancelled = false
    setErr(null)
    api
      .services()
      .then((s) => {
        if (!cancelled) setServices(s)
      })
      .catch((e: any) => {
        if (!cancelled) setErr(e?.detail || "Не вдалося завантажити послуги")
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-xl px-4 pb-6">
      <div className="mt-5">
        <div className="text-xl font-extrabold text-slate-900">
          {name ? `Вітаємо, ${name}` : "Вітаємо"}
        </div>
        <div className="mt-1 text-sm text-slate-600">
          Оберіть послугу та заповніть короткий бриф. Це займе кілька хвилин.
        </div>
      </div>

      <div className="mt-4">
        <Button variant="ghost" className="w-full justify-between" onClick={onMy}>
          <span className="inline-flex items-center gap-2">
            <BriefcaseBusiness className="h-4 w-4 text-slate-700" />
            Мої заявки
          </span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </Button>
      </div>

      {err ? (
        <Card className="mt-4 p-4 text-sm text-red-800 ring-red-200">
          {err}
        </Card>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3">
        {(services || Array.from({ length: 6 })).map((s: any, idx: number) => {
          const item = s as WebAppService | undefined
          return (
            <button
              key={item?.id ?? `sk-${idx}`}
              onClick={() => {
                if (!item) return
                setStarting(item.id)
                onStart(item.id)
              }}
              disabled={!item || starting === item?.id}
              className="group relative overflow-hidden rounded-2xl bg-white p-4 text-left ring-1 ring-slate-200 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Послуга</div>
                  <div className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">
                    {item ? item.title : "Завантаження…"}
                  </div>
                </div>
                <div className="mt-0.5 rounded-xl bg-slate-900 p-2">
                  <BriefcaseBusiness className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-500">Відкрити</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
