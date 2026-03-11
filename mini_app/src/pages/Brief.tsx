import { useMemo, useRef, useState } from "react"
import { ImagePlus, RotateCcw, Send, ShieldAlert } from "lucide-react"

import { api, apiBaseUrl, type WebAppAnswer, type WebAppState } from "../lib/api"
import { cx } from "../lib/format"
import { Button, Card } from "../components/ui"

function imgUrl(path: string) {
  return `${apiBaseUrl()}${path}`
}

export function Brief({
  state,
  onState,
  onExit,
  onFinished,
}: {
  state: WebAppState
  onState: (next: WebAppState) => void
  onExit: () => void
  onFinished: () => void
}) {
  const q = state.question
  const [text, setText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const options = useMemo(() => {
    if (!q?.options?.length) return []
    return [...q.options].sort((a, b) => (a.keyboard_row - b.keyboard_row) || (a.keyboard_col - b.keyboard_col) || (a.id - b.id))
  }, [q?.options])

  async function apply(next: WebAppState) {
    onState(next)
    if (!next.active) onFinished()
  }

  async function onBack() {
    setBusy(true)
    setErr(null)
    try {
      const next = await api.back()
      if (!next.active) onExit()
      else await apply(next)
    } catch (e: any) {
      setErr(e?.detail || "Не вдалося повернутись назад")
    } finally {
      setBusy(false)
    }
  }

  async function onRewind(answer: WebAppAnswer) {
    if (!confirm("Повернутись до цього кроку? Відповіді після нього буде видалено.")) return
    setBusy(true)
    setErr(null)
    try {
      const next = await api.rewind(answer.id)
      await apply(next)
    } catch (e: any) {
      setErr(e?.detail || "Не вдалося відкотити")
    } finally {
      setBusy(false)
    }
  }

  async function onPickOption(optionId: number) {
    setBusy(true)
    setErr(null)
    try {
      const next = await api.answerChoice(optionId)
      await apply(next)
    } catch (e: any) {
      setErr(e?.detail || "Не вдалося зберегти відповідь")
    } finally {
      setBusy(false)
    }
  }

  async function onSend() {
    const t = text.trim()
    if (q?.is_required && !t && !file) {
      setErr("Відповідь обовʼязкова")
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const next = await api.answerTextOrPhoto(t, file)
      setText("")
      setFile(null)
      await apply(next)
    } catch (e: any) {
      setErr(e?.detail || "Не вдалося зберегти відповідь")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 pb-6">
      <Card className="mt-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {state.service_title || "Бриф"} • {state.step}/{state.total}
            </div>
            <div className="mt-1 text-base font-bold text-slate-900">{q?.text || "…"}</div>
          </div>
          {q?.is_required ? (
            <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
              <ShieldAlert className="h-3.5 w-3.5" />
              Обовʼязково
            </div>
          ) : null}
        </div>

        {q?.photo ? (
          <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-slate-200">
            <img className="w-full" src={imgUrl(`/api/webapp/questions/${q.id}/photo`)} alt="Фото питання" />
          </div>
        ) : null}
      </Card>

      {err ? (
        <Card className="mt-3 p-4 text-sm text-red-800 ring-red-200">
          {err}
        </Card>
      ) : null}

      <Card className="mt-3 p-4">
        {q?.qtype === "single_choice" ? (
          <div className="grid grid-cols-2 gap-2">
            {options.map((o) => (
              <button
                key={o.id}
                disabled={busy}
                onClick={() => onPickOption(o.id)}
                className={cx(
                  "rounded-xl bg-white px-3 py-3 text-left text-sm font-semibold text-slate-900 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-50",
                )}
              >
                {o.text}
              </button>
            ))}
          </div>
        ) : (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="Ваша відповідь…"
              className="w-full resize-none rounded-xl bg-white px-3 py-3 text-sm text-slate-900 ring-1 ring-slate-200 outline-none placeholder:text-slate-400 focus:ring-emerald-500/30"
            />

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null
                  setFile(f)
                }}
              />
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4" />
                {file ? "Змінити фото" : "Додати фото"}
              </Button>
              {file ? <div className="text-xs text-slate-600">{file.name}</div> : null}
              <div className="flex-1" />
              <Button disabled={busy} onClick={onSend}>
                <Send className="h-4 w-4" />
                Відправити
              </Button>
            </div>
          </>
        )}
      </Card>

      <div className="mt-3 flex gap-2">
        <Button variant="ghost" className="flex-1" disabled={busy} onClick={onBack}>
          <RotateCcw className="h-4 w-4" />
          Назад
        </Button>
        <Button variant="ghost" className="flex-1" disabled={busy} onClick={onExit}>
          Вийти
        </Button>
      </div>

      {state.answers?.length ? (
        <div className="mt-6">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Відповіді</div>
          <Card className="mt-2 overflow-hidden">
            <div className="divide-y divide-slate-200">
              {state.answers.map((a) => (
                <div key={a.id} className="p-4">
                  <div className="text-xs font-bold text-slate-500">{a.question_text}</div>
                  <div className="mt-1 text-sm text-slate-900">{a.value}</div>
                  {a.has_photo ? (
                    <div className="mt-2 overflow-hidden rounded-xl ring-1 ring-slate-200">
                      <img className="w-full" src={imgUrl(`/api/webapp/lead_answers/${a.id}/photo`)} alt="Фото відповіді" />
                    </div>
                  ) : null}
                  <div className="mt-3">
                    <Button variant="ghost" disabled={busy} onClick={() => onRewind(a)}>
                      <RotateCcw className="h-4 w-4" />
                      Повернутись сюди
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
