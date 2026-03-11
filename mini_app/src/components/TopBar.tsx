import { ArrowLeft, LayoutGrid, ListChecks } from "lucide-react"
import type { ReactNode } from "react"

import { cx } from "../lib/format"
import { Button } from "./ui"
import logo from "../assets/est13logo.svg"

export function TopBar({
  title,
  onBack,
  right,
}: {
  title: string
  onBack?: (() => void) | null
  right?: ReactNode
}) {
  return (
    <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
        {onBack ? (
          <Button variant="ghost" className="h-10 w-10 px-0" onClick={onBack} aria-label="Назад">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        ) : (
          <div className="h-10 w-10" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Est13" className="h-5 w-auto text-slate-900" />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-slate-900">{title}</div>
              <div className="text-xs text-slate-500">Est13</div>
            </div>
          </div>
        </div>
        <div className={cx("flex items-center gap-2", right ? "" : "opacity-0")}>{right}</div>
      </div>
    </div>
  )
}

export function HomePills({
  active,
  onHome,
  onMy,
}: {
  active: "home" | "my"
  onHome: () => void
  onMy: () => void
}) {
  return (
    <div className="mx-auto flex max-w-xl gap-2 px-4 pb-3 pt-2">
      <button
        className={cx(
          "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ring-1 transition",
          active === "home"
            ? "bg-slate-900 text-white ring-slate-900"
            : "bg-white text-slate-900 ring-slate-200 hover:bg-slate-50",
        )}
        onClick={onHome}
      >
        <LayoutGrid className="h-4 w-4" />
        Послуги
      </button>
      <button
        className={cx(
          "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ring-1 transition",
          active === "my"
            ? "bg-slate-900 text-white ring-slate-900"
            : "bg-white text-slate-900 ring-slate-200 hover:bg-slate-50",
        )}
        onClick={onMy}
      >
        <ListChecks className="h-4 w-4" />
        Мої заявки
      </button>
    </div>
  )
}
