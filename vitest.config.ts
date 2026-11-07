import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'graphreact': path.resolve(__dirname, 'packages/graphreact/src/core/index.ts'),
      '@complyflow/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
      '@complyflow/sdk': path.resolve(__dirname, 'packages/sdk/src/index.ts'),
      '@complyflow/ingestion': path.resolve(__dirname, 'packages/ingestion/src/index.ts'),
      '@complyflow/graph-builder': path.resolve(__dirname, 'packages/graph-builder/src/index.ts'),
      '@complyflow/policy-engine': path.resolve(__dirname, 'packages/policy-engine/src/index.ts'),
      '@complyflow/api': path.resolve(__dirname, 'packages/api/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/src/**/*.test.ts'],
  },
});
