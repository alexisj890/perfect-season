import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Lets tests use the same "@/lib/..." imports as the app (from tsconfig.json).
    tsconfigPaths: true,
  },
  test: {
    // Game logic is plain TypeScript, so tests run in Node. UI tests will
    // switch to a browser-like environment ("jsdom") when we build the UI.
    environment: "node",
  },
});
