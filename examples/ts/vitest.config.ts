import { defineConfig } from "vitest/config";
import { ddtPlugin } from "@ddtds/vitest";

export default defineConfig({
  plugins: [ddtPlugin(".", "__doctests__")],
  test: { environment: "node" },
});
