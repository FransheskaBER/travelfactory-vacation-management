import { defineConfig } from "vitest/config";

// Minimal on purpose (Phase 5 brief): no coverage, no watch setup. Tests
// import vitest APIs explicitly, so no globals flag either.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
