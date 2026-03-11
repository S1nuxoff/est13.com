import { useEffect, useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"

import { api, type WebAppState } from "./lib/api"
import { tgInit } from "./lib/telegram"
import { TopBar, HomePills } from "./components/TopBar"
import { Button, Card } from "./components/ui"
import { Home } from "./pages/Home"
import { MyLeads } from "./pages/MyLeads"
import { Brief } from "./pages/Brief"
import { LeadDetails } from "./pages/LeadDetails"

type View = "home" | "my" | "brief" | "lead" | "done"

export default function App() {
  const [view, setView] = useState<View>("home")
  const [webState, setWebState] = useState<WebAppState | null>(null)
  const [leadId, setLeadId] = useState<number | null>(null)
  const [booting, setBooting] = useState(true)
  const [bootErr, setBootErr] = useState<string | null>(null)

  useEffect(() => {
    tgInit()
    let cancelled = false
    setBooting(true)
    setBootErr(null)
    api
      .state()
      .then((st) => {
        if (cancelled) return
        setWebState(st)
        if (st.active) setView("brief")
        else setView("home")
      })
      .catch((e: any) => {
        if (cancelled) return
        setBootErr(e?.detail || "Не вдалося запустити застосунок")
      })
      .finally(() => {
        if (!cancelled) setBooting(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function startService(serviceId: number) {
    setBootErr(null)
    try {
      const st = await api.start(serviceId)
      setWebState(st)
      setView(st.active ? "brief" : "done")
    } catch (e: any) {
      setBootErr(e?.detail || "Не вдалося почати бриф")
    }
  }

  if (booting) {
    return (
      <div className="min-h-screen bg-slate-50">
        <TopBar title="Завантаження" />
        <div className="mx-auto max-w-xl px-4 pb-6">
          <Card className="mt-4 p-4 text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Завантаження…
            </div>
          </Card>
        </div>
      </div>
    )
  }

  if (bootErr) {
    return (
      <div className="min-h-screen bg-slate-50">
        <TopBar title="Помилка" />
        <div className="mx-auto max-w-xl px-4 pb-6">
          <Card className="mt-4 p-4 text-sm text-red-800 ring-red-200">{bootErr}</Card>
          <div className="mt-3">
            <Button
              variant="ghost"
              onClick={() => {
                setBooting(true)
                setBootErr(null)
                api
                  .state()
                  .then((st) => {
                    setWebState(st)
                    if (st.active) setView("brief")
                    else setView("home")
                  })
                  .catch((e: any) => setBootErr(e?.detail || "Не вдалося запустити застосунок"))
                  .finally(() => setBooting(false))
              }}
            >
              Спробувати ще раз
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {view === "home" || view === "my" ? (
        <>
          <TopBar title={view === "home" ? "Послуги" : "Мої заявки"} onBack={null} />
          <HomePills
            active={view === "home" ? "home" : "my"}
            onHome={() => setView("home")}
            onMy={() => setView("my")}
          />
        </>
      ) : view === "brief" ? (
        <TopBar title="Бриф" onBack={() => setView("home")} />
      ) : view === "lead" ? (
        <TopBar title="Заявка" onBack={() => setView("my")} />
      ) : (
        <TopBar title="Готово" onBack={() => setView("home")} />
      )}

      {view === "home" ? (
        <Home
          onMy={() => setView("my")}
          onStart={(id) => startService(id)}
        />
      ) : view === "my" ? (
        <MyLeads
          onBack={() => setView("home")}
          onOpen={(id) => {
            setLeadId(id)
            setView("lead")
          }}
        />
      ) : view === "lead" && leadId ? (
        <LeadDetails leadId={leadId} />
      ) : view === "brief" && webState ? (
        <Brief
          state={webState}
          onState={(next) => setWebState(next)}
          onExit={() => setView("home")}
          onFinished={() => setView("done")}
        />
      ) : view === "done" ? (
        <div className="mx-auto max-w-xl px-4 pb-6">
          <Card className="mt-4 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 ring-1 ring-emerald-200">
              <CheckCircle2 className="h-6 w-6 text-emerald-700" />
            </div>
            <div className="mt-3 text-base font-extrabold text-slate-900">Дякуємо!</div>
            <div className="mt-1 text-sm text-slate-600">Заявку надіслано. Ви можете переглянути її в розділі “Мої заявки”.</div>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setView("home")}>
                До меню
              </Button>
              <Button className="flex-1" onClick={() => setView("my")}>
                Мої заявки
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        <div className="mx-auto max-w-xl px-4 pb-6">
          <Card className="mt-4 p-4 text-sm text-slate-700">Порожній стан</Card>
        </div>
      )}
    </div>
  )
}
