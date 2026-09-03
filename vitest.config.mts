import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // `server-only`'s real export throws outside an RSC; our server modules are pure under test.
      "server-only": r("./test/stubs/server-only.ts"),
      "@": r("./src"),
    },
  },
});
