import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../");
const tsx = join(ROOT, "node_modules", ".bin", "tsx");
const cli = join(ROOT, "packages", "cli", "src", "index.ts");

function runCli(inputDir: string, outputDir: string) {
  const result = spawnSync(tsx, [cli, "build", inputDir, "--output", outputDir], {
    encoding: "utf8",
    cwd: ROOT,
  });
  if (result.status !== 0) throw new Error(`CLI failed:\n${result.stderr}\n${result.stdout}`);
  return result.stdout;
}

function tmpDir() {
  return mkdtempSync(join(tmpdir(), "ddtds-e2e-"));
}

function read(outDir: string, name: string) {
  return readFileSync(join(outDir, name), "utf8");
}

let inDir: string;
let outDir: string;

beforeEach(() => {
  inDir = tmpDir();
  outDir = tmpDir();
});

afterEach(() => {
  rmSync(inDir, { recursive: true, force: true });
  rmSync(outDir, { recursive: true, force: true });
});

describe("cli smoke", () => {
  test("build generates test output for nested docs", () => {
    const sub = join(inDir, "docs");
    mkdirSync(sub);
    writeFileSync(join(sub, "guide.md"), "```ts\nconst x = 1\n```");

    runCli(inDir, outDir);

    expect(readdirSync(outDir)).toContain("docs_guide.md_1.test.ts");
    expect(read(outDir, "docs_guide.md_1.test.ts")).toContain('"docs/guide.md:1"');
  });
});
