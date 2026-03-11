import type { LucideIcon } from "lucide-react"
import { BadgeCheck, Ban, CircleDashed, Clock, Hammer, Package, Pause, Search, Send, ShieldAlert, XCircle } from "lucide-react"

export type StatusMeta = { label: string; icon: LucideIcon; tone: "slate" | "emerald" | "amber" | "red" | "sky" | "violet" }

export const leadStatusMeta: Record<string, StatusMeta> = {
  filling: { label: "Заповнює", icon: CircleDashed, tone: "slate" },
  abandoned: { label: "Скасовано", icon: Ban, tone: "red" },
  awaiting_review: { label: "Очікує перевірки", icon: Clock, tone: "amber" },
  in_review: { label: "На перевірці", icon: Search, tone: "sky" },
  confirmed: { label: "Підтверджено", icon: BadgeCheck, tone: "emerald" },
  in_work: { label: "В роботі", icon: Hammer, tone: "violet" },
  paused: { label: "Пауза", icon: Pause, tone: "amber" },
  done: { label: "Завершено", icon: Package, tone: "emerald" },
  delivered: { label: "Передано клієнту", icon: Send, tone: "sky" },
  client_not_confirmed: { label: "Клієнт не підтвердив", icon: ShieldAlert, tone: "amber" },
  rejected: { label: "Відхилено", icon: XCircle, tone: "red" },
  lost: { label: "Втрачено", icon: XCircle, tone: "red" },
  studio_cancelled: { label: "Скасовано (студія)", icon: Ban, tone: "red" },
  closed: { label: "Закрито", icon: BadgeCheck, tone: "slate" },
}

export function toneClasses(tone: StatusMeta["tone"]) {
  switch (tone) {
    case "emerald":
      return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
    case "amber":
      return "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
    case "red":
      return "bg-red-50 text-red-800 ring-1 ring-red-200"
    case "sky":
      return "bg-sky-50 text-sky-800 ring-1 ring-sky-200"
    case "violet":
      return "bg-violet-50 text-violet-800 ring-1 ring-violet-200"
    default:
      return "bg-slate-100 text-slate-800 ring-1 ring-slate-200"
  }
}
