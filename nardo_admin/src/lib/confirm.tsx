import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";

import { Button } from "../components/ui";

type ConfirmTone = "primary" | "danger";

export type ConfirmOptions = {
  title?: string;
  message: string;
  details?: string[];
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
};

type ConfirmState = {
  open: boolean;
  opts: ConfirmOptions | null;
  resolve: ((v: boolean) => void) | null;
};

const ConfirmContext = createContext<{
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
} | null>(null);

export function ConfirmProvider(props: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    opts: null,
    resolve: null,
  });

  const close = useCallback((result: boolean) => {
    setState((prev) => {
      prev.resolve?.(result);
      return { open: false, opts: null, resolve: null };
    });
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, opts, resolve });
    });
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  const opts = state.opts;
  const tone: ConfirmTone = opts?.tone ?? "primary";
  const title = opts?.title ?? "Підтвердіть дію";
  const message = opts?.message ?? "";
  const details = (opts?.details ?? []).filter(Boolean);
  const confirmText = opts?.confirmText ?? "Підтвердити";
  const cancelText = opts?.cancelText ?? "Скасувати";

  return (
    <ConfirmContext.Provider value={value}>
      {props.children}
      {state.open ? (
        <div className="fixed inset-0 z-[100]">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => close(false)}
          />
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="w-full max-w-[520px] rounded-[28px] bg-white shadow-[0_40px_120px_rgba(0,0,0,0.35)] ring-1 ring-black/10 overflow-hidden">
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div
                    className={[
                      "grid h-11 w-11 shrink-0 place-items-center rounded-2xl ring-1",
                      tone === "danger"
                        ? "bg-red-50 text-red-700 ring-red-100"
                        : "bg-zinc-50 text-zinc-700 ring-black/5",
                    ].join(" ")}
                  >
                    {tone === "danger" ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : (
                      <HelpCircle className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-semibold tracking-tight text-zinc-900">
                      {title}
                    </div>
                    <div className="mt-1 text-sm text-zinc-600 whitespace-pre-line">
                      {message}
                    </div>
                  </div>
                </div>

                {details.length ? (
                  <div className="mt-4 rounded-2xl bg-zinc-50 p-4 ring-1 ring-black/5">
                    <div className="space-y-1">
                      {details.map((d, idx) => (
                        <div key={idx} className="text-xs text-zinc-700">
                          {d}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="secondary"
                    className="rounded-2xl"
                    onClick={() => close(false)}
                  >
                    {cancelText}
                  </Button>
                  <Button
                    variant={tone === "danger" ? "danger" : "primary"}
                    className="rounded-2xl"
                    onClick={() => close(true)}
                  >
                    {confirmText}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx.confirm;
}

