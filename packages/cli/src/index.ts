#!/usr/bin/env tsx
import { cli, command } from "cleye";
import { parseBlocks, outputExtension } from "@ddtds/core";
import { generateTestFile } from "@ddtds/vitest";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join, relative, sep, dirname } from "path";
import { spawnSync } from "child_process";

function findDocs(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findDocs(full));
    } else if (entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) {
      results.push(full);
    }
  }
  return results;
}

function generate(searchDir: string, outputDir: string): number {
  const docs = findDocs(searchDir);
  if (docs.length === 0) {
    console.log(`No .md or .mdx files found under ${searchDir}`);
    return 0;
  }

  mkdirSync(outputDir, { recursive: true });
  let total = 0;

  for (const mdPath of docs) {
    const source = readFileSync(mdPath, "utf8");
    const blocks = parseBlocks(source);
    if (blocks.length === 0) continue;

    const relPath = relative(searchDir, mdPath);
    const ext = outputExtension(blocks);
    const outName = relPath.split(sep).join("_") + `.test.${ext}`;
    const outPath = join(outputDir, outName);

    writeFileSync(outPath, generateTestFile(relPath, blocks));
    total += blocks.length;
    console.log(`  ${relPath} → ${outPath} (${blocks.length} tests)`);
  }

  console.log(`\nTotal: ${total} tests`);
  return total;
}

function findVitest(): string | null {
  let dir = process.cwd();
  while (true) {
    const candidate = join(dir, "node_modules", ".bin", "vitest");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const sharedFlags = {
  output: {
    type: String,
    default: "__doctests__",
    description: "Directory for generated test files",
  },
} as const;

const testFlags = {
  ...sharedFlags,
  config: {
    type: String,
    description: "Path to an existing vitest/vite config file",
  },
} as const;

const buildCmd = command(
  {
    name: "build",
    parameters: ["[dir]"],
    flags: sharedFlags,
  },
  (argv) => {
    const searchDir = argv._.dir ?? process.cwd();
    generate(searchDir, argv.flags.output);
  },
);

const testCmd = command(
  {
    name: "test",
    parameters: ["[dir]"],
    flags: testFlags,
  },
  (argv) => {
    const searchDir = argv._.dir ?? process.cwd();
    const outputDir = argv.flags.output;
    const total = generate(searchDir, outputDir);
    if (total === 0) process.exit(0);

    const vitest = findVitest();
    if (!vitest) {
      console.error("vitest not found — add it as a dev dependency");
      process.exit(1);
    }

    const vitestArgs = ["run", outputDir];
    if (argv.flags.config) {
      vitestArgs.push("--config", argv.flags.config);
    }

    const { status } = spawnSync(vitest, vitestArgs, { stdio: "inherit" });
    process.exit(status ?? 1);
  },
);

cli({
  name: "ddt",
  commands: [buildCmd, testCmd],
});
