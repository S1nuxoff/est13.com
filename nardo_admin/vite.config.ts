import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const rootEnvDir = path.resolve(here, "..");

export default defineConfig(() => {
  // const env = loadEnv(mode, rootEnvDir, "");
  // API listens on 8000 inside its container/process; host-published port can differ.
  // For local dev without docker, allow overriding via root `.env` (`API_PORT`).
  // const apiPort = env.API_PORT || "8000";

  return {
    plugins: [react(), tailwindcss()],
    // Load env vars from repo root so we can keep a single `.env`.
    envDir: rootEnvDir,
    // In production we serve Admin UI as a standalone app (e.g. admin.<domain>) at `/`.
    base: "/",
    server: {
      host: true,
      proxy: {
        // Local dev convenience: calls to /api go to local backend.
        "/api": `http://localhost:8992`,
      },
    },
  };
});
