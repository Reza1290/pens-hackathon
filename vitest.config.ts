import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    maxWorkers: 1,
    testTimeout: 30000,
    hookTimeout: 60000,
    env: {
      QA_LIVE_ENABLED: 'false',
      QA_PLANNER_ENABLED: 'false',
      ANALYSIS_EXTRACTION_ENABLED: 'false',
      QA_JEV_ENABLED: 'false',
    },
  },
});
