import { defineConfig,devices } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e',workers:1,fullyParallel:false,timeout:45000,
  use:{baseURL:`http://127.0.0.1:${process.env.WEB_PORT||5173}`,trace:'retain-on-failure'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome'],channel:process.env.PLAYWRIGHT_CHANNEL}}],
  webServer:{command:'npm run dev',url:`http://127.0.0.1:${process.env.WEB_PORT||5173}`,reuseExistingServer:!process.env.CI,timeout:60000},
});
