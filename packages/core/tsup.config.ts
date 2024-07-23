import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  target: ["node16", "deno1.43", "edge20", "es2015", "esnext"],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
});
