import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // `test/integration/**` needs a real Postgres — run it with `npm run test:integration`.
    exclude: [...configDefaults.exclude, "test/integration/**"],
  },
  resolve: {
    alias: {
      // `server-only`'s real export throws outside an RSC; our server modules are pure under test.
      "server-only": r("./test/stubs/server-only.ts"),
      "@": r("./src"),
    },
  },
});
