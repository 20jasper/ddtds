import type { Plugin } from "vitest/config";
import { generate } from "@ddtds/core";

export { generate, findDocs, generateTestFile } from "@ddtds/core";
export type { CodeBlock, GenerateDeps } from "@ddtds/core";

export function ddtPlugin(searchDir: string, outputDir: string): Plugin {
  return {
    name: "vite-plugin-ddtds",
    config() {
      generate(searchDir, outputDir);
      return { test: { include: [`${outputDir}/**/*.test.{ts,tsx}`] } };
    },
  };
}
