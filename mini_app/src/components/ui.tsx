import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes } from "react"

import { cx } from "../lib/format"

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }
>(function Button({ className, variant = "primary", ...props }, ref) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 " +
    "disabled:opacity-50 disabled:pointer-events-none"
  const variants: Record<string, string> = {
    primary: "bg-slate-900 text-white hover:bg-slate-800",
    ghost: "bg-white text-slate-900 hover:bg-slate-50 ring-1 ring-slate-200",
    danger: "bg-red-600 text-white hover:bg-red-500 ring-1 ring-red-600/20",
  }
  return <button ref={ref} className={cx(base, variants[variant], className)} {...props} />
})

export function Card(props: HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props
  return <div className={cx("rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm", className)} {...rest} />
}

export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", className)}
      {...props}
    />
  )
}

export function Divider() {
  return <div className="h-px w-full bg-slate-200" />
}
