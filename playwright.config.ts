import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4273"
  },
  webServer: [
    {
      command: "PORT=8180 CORS_ORIGIN=http://127.0.0.1:4273 npm run dev --workspace @chat/backend",
      url: "http://127.0.0.1:8180/api/health",
      reuseExistingServer: true,
      timeout: 120_000
    },
    {
      command: "VITE_API_BASE_URL=http://127.0.0.1:8180/api npm run dev --workspace @chat/frontend -- --host 127.0.0.1 --port 4273",
      url: "http://127.0.0.1:4273",
      reuseExistingServer: true,
      timeout: 120_000
    }
  ]
});