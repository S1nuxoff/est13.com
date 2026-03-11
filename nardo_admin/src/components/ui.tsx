import { LoaderCircle } from "lucide-react";
import type {
  InputHTMLAttributes,
  MouseEventHandler,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { forwardRef } from "react";

export function PageTitle(props: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="text-lg font-semibold tracking-tight">{props.title}</div>
        {props.subtitle ? (
          <div className="text-sm text-zinc-500">{props.subtitle}</div>
        ) : null}
      </div>
      {props.right ? (
        <div className="flex items-center gap-2">{props.right}</div>
      ) : null}
    </div>
  );
}

export function Card(props: { children: ReactNode; className?: string }) {
  return (
    <div
      className={[
        "rounded-3xl bg-white shadow-[0_18px_60px_rgba(15,23,42,0.06)] ring-1 ring-black/5",
        props.className ?? "",
      ].join(" ")}
    >
      {props.children}
    </div>
  );
}

export function CardBody(props: { children: ReactNode; className?: string }) {
  return (
    <div className={["p-5 sm:p-6", props.className].join(" ")}>{props.children}</div>
  );
}

export function Button(props: {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const v = props.variant ?? "primary";
  const size = props.size ?? "md";
  const cls =
    v === "primary"
      ? "bg-gradient-to-r from-zinc-900 to-zinc-800 text-white shadow-sm hover:from-zinc-800 hover:to-zinc-700"
      : v === "secondary"
        ? "bg-white/70 text-zinc-900 ring-1 ring-black/5 hover:bg-white"
        : v === "danger"
          ? "bg-red-600 text-white shadow-sm hover:bg-red-500"
          : "bg-transparent text-zinc-700 hover:bg-white/70 hover:ring-1 hover:ring-black/5";
  const sizeCls =
    size === "sm"
      ? "px-3 py-2 text-xs rounded-xl"
      : size === "lg"
        ? "px-5 py-3 text-base rounded-2xl"
        : "px-4 py-2.5 text-sm rounded-2xl";
  return (
    <button
      type={props.type ?? "button"}
      disabled={props.disabled}
      onClick={props.onClick}
      className={[
        "inline-flex items-center justify-center gap-2 font-medium",
        sizeCls,
        cls,
        props.disabled ? "opacity-50" : "",
        props.className ?? "",
      ].join(" ")}
    >
      {props.children}
    </button>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "h-11 w-full rounded-2xl bg-white px-3.5 text-sm outline-none ring-1 ring-black/10",
        "focus:ring-2 focus:ring-blue-200",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextareaImpl(props, ref) {
  return (
    <textarea
      {...props}
      ref={ref}
      className={[
        "w-full rounded-2xl bg-white px-3.5 py-3 text-sm outline-none ring-1 ring-black/10",
        "focus:ring-2 focus:ring-blue-200",
        props.className ?? "",
      ].join(" ")}
    />
  );
});

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        "h-11 w-full rounded-2xl bg-white px-3.5 text-sm outline-none ring-1 ring-black/10",
        "focus:ring-2 focus:ring-blue-200",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

export function Badge(props: {
  children: ReactNode;
  tone?: "gray" | "green" | "amber" | "red";
  title?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const tone = props.tone ?? "gray";
  const cls =
    tone === "green"
      ? "bg-emerald-100/60 text-emerald-700 ring-1 ring-emerald-200/70"
      : tone === "amber"
        ? "bg-amber-100/60 text-amber-700 ring-1 ring-amber-200/70"
        : tone === "red"
          ? "bg-red-100/60 text-red-700 ring-1 ring-red-200/70"
          : "bg-zinc-100/60 text-zinc-700 ring-1 ring-black/5";
  return (
    <span
      title={props.title}
      aria-label={props.ariaLabel ?? props.title}
      className={[
        "inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs",
        cls,
        props.className ?? "",
      ].join(" ")}
    >
      {props.children}
    </span>
  );
}

export function Spinner(props: { className?: string } = {}) {
  return (
    <LoaderCircle
      className={["h-4 w-4 animate-spin text-zinc-500", props.className ?? ""].join(" ")}
    />
  );
}

export function Divider(
  props: { orientation?: "horizontal" | "vertical"; className?: string } = {},
) {
  const orientation = props.orientation ?? "horizontal";
  return (
    <div
      className={[
        orientation === "vertical" ? "w-px h-full" : "h-px w-full",
        "bg-black/5",
        props.className ?? "",
      ].join(" ")}
    />
  );
}
