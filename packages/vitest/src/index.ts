import type { Plugin } from "vitest/config";
import { findDocs, generate as generateCore, type GenerateDeps } from "@ddtds/core";
import { generateBlockFile } from "./codegen.ts";

export { findDocs, generateBlockFile };
export type { CodeBlock, GenerateDeps } from "@ddtds/core";

export function generate(
  searchDir: string,
  outputDir: string,
  deps?: Partial<GenerateDeps>,
): number {
  return generateCore(searchDir, outputDir, generateBlockFile, deps);
}

export function ddtPlugin(searchDir: string, outputDir: string): Plugin {
  return {
    name: "vite-plugin-ddtds",
    config() {
      generate(searchDir, outputDir);
      return { test: { include: [`${outputDir}/**/*.test.{ts,tsx}`] } };
    },
  };
}
