import { defineConfig } from "@playwright/test";
import path from "node:path";

const python = process.env.TEST_PYTHON || path.resolve("../.venv-dev/Scripts/python.exe");
export default defineConfig({
  testDir: "./tests", testIgnore: "core-tier.spec.ts", workers: 1, fullyParallel: false, timeout: 45000,
  use: { baseURL: "http://127.0.0.1:5178", screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: [
    { command: '"' + python + '" -B -m uvicorn backend.tests.fake_provider:app --host 127.0.0.1 --port 8012', cwd: "..", url: "http://127.0.0.1:8012/health", reuseExistingServer: false },
    { command: '"' + python + '" -B -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8011', cwd: "..", url: "http://127.0.0.1:8011/health", reuseExistingServer: false,
      // Research fetches pages from the local fixture, which the SSRF guard would otherwise refuse.
      env: { CHAT_DATA_DIR: "data/browser-tests/run-" + Date.now(), CHAT_ALLOWED_ORIGINS: "http://127.0.0.1:5178", RESEARCH_ALLOW_PRIVATE_NETWORK: "1" } },
    { command: "npm run dev -- --host 127.0.0.1 --port 5178 --strictPort", url: "http://127.0.0.1:5178", reuseExistingServer: false,
      env: { VITE_API_BASE_URL: "/api", API_PROXY_TARGET: "http://127.0.0.1:8011" } },
  ],
});
