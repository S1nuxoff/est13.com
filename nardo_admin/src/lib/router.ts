import { useEffect, useMemo, useState } from "react";

function normalizeRoute(raw: string | null | undefined): string {
  const r = (raw ?? "").trim().toLowerCase();
  if (!r) return "dashboard";
  return r;
}

function parseHash(hash: string) {
  const cleaned = hash.replace(/^#/, "");
  const [path, search = ""] = cleaned.split("?", 2);
  const route = normalizeRoute(path);
  const params = new URLSearchParams(search);
  return { route, params };
}

export function useHashRoute() {
  const [state, setState] = useState(() => parseHash(window.location.hash));

  useEffect(() => {
    const handler = () => setState(parseHash(window.location.hash));
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const navigate = useMemo(
    () => (next: string, opts?: { params?: Record<string, string | number | null | undefined> }) => {
      const route = normalizeRoute(next);
      const params = new URLSearchParams();
      const incoming = opts?.params ?? {};
      for (const [k, v] of Object.entries(incoming)) {
        if (v === null || v === undefined || String(v).trim() === "") continue;
        params.set(k, String(v));
      }
      const q = params.toString();
      window.location.hash = q ? `${route}?${q}` : route;
    },
    [],
  );

  return { route: state.route, params: state.params, navigate };
}
