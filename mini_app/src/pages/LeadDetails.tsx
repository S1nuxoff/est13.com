import { useEffect, useMemo, useState } from "react"
import { Image, ListChecks } from "lucide-react"

import { api, apiBaseUrl, type MyLeadDetails } from "../lib/api"
import { fmtDate } from "../lib/format"
import { leadStatusMeta, toneClasses } from "../lib/status"
import { Badge, Card } from "../components/ui"

function imgUrl(path: string) {
  return `${apiBaseUrl()}${path}`
}

export function LeadDetails({ leadId }: { leadId: number }) {
  const [data, setData] = useState<MyLeadDetails | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setErr(null)
    api
      .myLead(leadId)
      .then((x) => {
        if (!cancelled) setData(x)
      })
      .catch((e: any) => {
        if (!cancelled) setErr(e?.detail || "Не вдалося завантажити заявку")
      })
    return () => {
      cancelled = true
    }
  }, [leadId])

  const meta = useMemo(() => (data ? leadStatusMeta[data.status] : null), [data])
  const Icon = meta?.icon

  if (err) {
    return (
      <div className="mx-auto max-w-xl px-4 pb-6">
        <Card className="mt-4 p-4 text-sm text-red-800 ring-red-200">{err}</Card>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-xl px-4 pb-6">
        <Card className="mt-4 p-4 text-sm text-slate-700">Завантаження…</Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl px-4 pb-6">
      <Card className="mt-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Заявка #{data.id}</div>
            <div className="mt-1 truncate text-sm font-semibold text-slate-900">{data.service_title || "Послуга"}</div>
            <div className="mt-1 text-xs text-slate-600">
              {data.submitted_at ? `Надіслано: ${fmtDate(data.submitted_at)}` : `Створено: ${fmtDate(data.started_at)}`}
            </div>
          </div>
          {meta ? (
            <Badge className={toneClasses(meta.tone)}>
              {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
              {meta.label}
            </Badge>
          ) : null}
        </div>
      </Card>

      {data.events?.length ? (
        <div className="mt-6">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Етапи</div>
          <Card className="mt-2 p-4">
            <div className="space-y-3">
              {data.events.map((e) => {
                const m = e.to_status ? leadStatusMeta[e.to_status] : null
                const I = m?.icon
                return (
                  <div key={e.id} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-200">
                      {I ? <I className="h-4 w-4 text-slate-700" /> : <ListChecks className="h-4 w-4 text-slate-700" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900">{m?.label || e.to_status || "Оновлення"}</div>
                      <div className="text-xs text-slate-600">{fmtDate(e.created_at)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      ) : null}

      <div className="mt-6">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Відповіді</div>
        <Card className="mt-2 overflow-hidden">
          <div className="divide-y divide-slate-200">
            {data.answers.map((a) => (
              <div key={a.id} className="p-4">
                <div className="text-xs font-bold text-slate-500">{a.question_text}</div>
                <div className="mt-1 text-sm text-slate-900">{a.value}</div>
                {a.has_photo ? (
                  <div className="mt-2 overflow-hidden rounded-xl ring-1 ring-slate-200">
                    <img className="w-full" src={imgUrl(`/api/webapp/lead_answers/${a.id}/photo`)} alt="Фото" />
                  </div>
                ) : null}
              </div>
            ))}
            {!data.answers.length ? (
              <div className="p-6 text-center text-sm text-slate-600">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200">
                  <Image className="h-6 w-6 text-slate-700" />
                </div>
                <div className="mt-3">Поки що немає відповідей</div>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  )
}
