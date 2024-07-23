import { defineConfig } from "vitest/config";
import { config } from "dotenv";

export default defineConfig({
  root: ".",
  esbuild: {
    tsconfigRaw: "{}",
  },
  test: {
    clearMocks: true,
    globals: true,
    env: {
      ...config({ path: "./.env" }).parsed,
    },
  },
});
