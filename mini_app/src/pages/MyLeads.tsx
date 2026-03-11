import { useEffect, useState } from "react"
import { ChevronRight, Inbox } from "lucide-react"

import { api, type MyLeadItem } from "../lib/api"
import { fmtDate } from "../lib/format"
import { leadStatusMeta, toneClasses } from "../lib/status"
import { Badge, Card, Button } from "../components/ui"

export function MyLeads({
  onOpen,
  onBack,
}: {
  onOpen: (leadId: number) => void
  onBack: () => void
}) {
  const [items, setItems] = useState<MyLeadItem[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setErr(null)
    api
      .myLeads()
      .then((x) => {
        if (!cancelled) setItems(x)
      })
      .catch((e: any) => {
        if (!cancelled) setErr(e?.detail || "Не вдалося завантажити заявки")
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (err) {
    return (
      <div className="mx-auto max-w-xl px-4 pb-6">
        <Card className="mt-4 p-4 text-sm text-red-800 ring-red-200">{err}</Card>
        <div className="mt-3">
          <Button variant="ghost" onClick={onBack}>
            Назад
          </Button>
        </div>
      </div>
    )
  }

  if (items && items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 pb-6">
        <Card className="mt-4 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200">
            <Inbox className="h-6 w-6 text-slate-700" />
          </div>
          <div className="mt-3 text-base font-bold text-slate-900">Поки що немає заявок</div>
          <div className="mt-1 text-sm text-slate-600">Оберіть послугу в меню, щоб створити заявку.</div>
          <div className="mt-4">
            <Button variant="ghost" onClick={onBack}>
              Назад до меню
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl px-4 pb-6">
      <div className="mt-4 space-y-2">
        {(items || Array.from({ length: 6 })).map((it: any, idx: number) => {
          const item = it as MyLeadItem | undefined
          const meta = item ? leadStatusMeta[item.status] : null
          const Icon = meta?.icon
          return (
            <button
              key={item?.id ?? `sk-${idx}`}
              onClick={() => item && onOpen(item.id)}
              disabled={!item}
              className="w-full rounded-2xl bg-white p-4 text-left ring-1 ring-slate-200 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Заявка #{item ? item.id : "…"}
                  </div>
                  <div className="mt-1 truncate text-sm font-semibold text-slate-900">
                    {item ? item.service_title || "Послуга" : "Завантаження…"}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    {item ? (item.submitted_at ? `Надіслано: ${fmtDate(item.submitted_at)}` : `Створено: ${fmtDate(item.started_at)}`) : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {meta ? (
                    <Badge className={toneClasses(meta.tone)}>
                      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                      {meta.label}
                    </Badge>
                  ) : null}
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
