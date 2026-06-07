import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'packages/agents/*/src/**/*.test.ts', 'workers/*/src/**/*.test.ts', 'agents/*/web/src/**/*.test.ts'],
  },
});
