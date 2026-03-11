import { X } from "lucide-react";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Toast = { id: string; title: string; message?: string; tone?: "info" | "error" | "success" };
type ToastContextValue = { push: (t: Omit<Toast, "id">) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider(props: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    const toast: Toast = { id, ...t };
    setToasts((prev) => [toast, ...prev].slice(0, 5));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 3500);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {props.children}
      <div className="fixed right-4 top-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              "w-[360px] rounded-xl border bg-white p-3 shadow-sm",
              t.tone === "error"
                ? "border-red-200"
                : t.tone === "success"
                  ? "border-emerald-200"
                  : "border-zinc-200",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{t.title}</div>
                {t.message ? <div className="mt-0.5 text-sm text-zinc-600">{t.message}</div> : null}
              </div>
              <button
                className="rounded-md p-1 text-zinc-500 hover:bg-zinc-50"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("ToastProvider is missing");
  return ctx;
}
