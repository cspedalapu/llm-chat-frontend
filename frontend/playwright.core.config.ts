import { defineConfig } from "@playwright/test";
import path from "node:path";

// Runs the UI against examples/minimal_backend, which implements only the core tier
// of docs/API-CONTRACT.md. Proves the shell works on a backend with no optional
// capabilities: `npx playwright test -c playwright.core.config.ts`.
const python = process.env.TEST_PYTHON || path.resolve("../.venv-dev/Scripts/python.exe");
export default defineConfig({
  testDir: "./tests", testMatch: "core-tier.spec.ts", workers: 1, timeout: 45000,
  use: { baseURL: "http://127.0.0.1:5179", screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: [
    { command: '"' + python + '" -B -m uvicorn app:app --app-dir examples/minimal_backend --host 127.0.0.1 --port 8013', cwd: "..", url: "http://127.0.0.1:8013/health", reuseExistingServer: false },
    { command: "npm run dev -- --host 127.0.0.1 --port 5179 --strictPort", url: "http://127.0.0.1:5179", reuseExistingServer: false,
      env: { VITE_API_BASE_URL: "/api", API_PROXY_TARGET: "http://127.0.0.1:8013" } },
  ],
});
