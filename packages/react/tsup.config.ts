import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm", "iife"],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  globalName: "Scoopika",
});
