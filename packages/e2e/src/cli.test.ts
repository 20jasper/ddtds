import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../");
const tsx = join(ROOT, "node_modules", ".bin", "tsx");
const cli = join(ROOT, "packages", "cli", "src", "index.ts");

function runCli(subcmd: "build" | "test", inputDir: string, outputDir: string) {
  const result = spawnSync(tsx, [cli, subcmd, inputDir, "--output", outputDir], {
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

// ---------------------------------------------------------------------------
// build — file generation
// ---------------------------------------------------------------------------

describe("build: file generation", () => {
  test("generates .ts for a .md file with ts blocks", () => {
    writeFileSync(join(inDir, "api.md"), "```ts\nconst x = 1\n```");
    runCli("build", inDir, outDir);
    expect(readdirSync(outDir)).toContain("api.md.test.ts");
  });

  test("generates .tsx for a .mdx file with tsx blocks", () => {
    writeFileSync(join(inDir, "comp.mdx"), "```tsx\nconst x = 1\n```");
    runCli("build", inDir, outDir);
    expect(readdirSync(outDir)).toContain("comp.mdx.test.tsx");
  });

  test("skips files with no ts/tsx blocks", () => {
    writeFileSync(join(inDir, "prose.md"), "# Just prose\n\nNo code blocks.");
    runCli("build", inDir, outDir);
    expect(readdirSync(outDir)).toHaveLength(0);
  });

  test("discovers docs recursively in subdirectories", () => {
    const sub = join(inDir, "guides");
    mkdirSync(sub);
    writeFileSync(join(sub, "intro.md"), "```ts\nconst x = 1\n```");
    runCli("build", inDir, outDir);
    expect(readdirSync(outDir)).toContain("guides_intro.md.test.ts");
  });

  test("processes multiple files in one run", () => {
    writeFileSync(join(inDir, "a.md"), "```ts\nconst a = 1\n```");
    writeFileSync(join(inDir, "b.md"), "```ts\nconst b = 2\n```");
    runCli("build", inDir, outDir);
    expect(readdirSync(outDir)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// build — header content
// ---------------------------------------------------------------------------

describe("build: header", () => {
  test("ts-only file gets vitest import, no react", () => {
    writeFileSync(join(inDir, "api.md"), "```ts\nconst x = 1\n```");
    runCli("build", inDir, outDir);
    const out = read(outDir, "api.md.test.ts");
    expect(out).toContain("from 'vitest'");
    expect(out).not.toContain("@testing-library/react");
  });

  test("tsx file gets @testing-library/react import", () => {
    writeFileSync(join(inDir, "comp.mdx"), "```tsx\nconst x = 1\n```");
    runCli("build", inDir, outDir);
    const out = read(outDir, "comp.mdx.test.tsx");
    expect(out).toContain("from '@testing-library/react'");
    expect(out).not.toContain("react-dom");
  });
});

// ---------------------------------------------------------------------------
// build — annotations
// ---------------------------------------------------------------------------

describe("build: annotations", () => {
  test("skip excludes the block entirely", () => {
    writeFileSync(join(inDir, "doc.md"), "```ts skip\nconst x = 1\n```");
    runCli("build", inDir, outDir);
    expect(readdirSync(outDir)).toHaveLength(0);
  });

  test("should throw wraps block in rejects.toThrow()", () => {
    writeFileSync(join(inDir, "doc.md"), "```ts should throw\nthrow new Error()\n```");
    runCli("build", inDir, outDir);
    expect(read(outDir, "doc.md.test.ts")).toContain(".rejects.toThrow()");
  });

  test("no run emits test.skip", () => {
    writeFileSync(join(inDir, "doc.md"), "```ts no run\nconst x = 1\n```");
    runCli("build", inDir, outDir);
    expect(read(outDir, "doc.md.test.ts")).toContain("test.skip(");
  });

  test("compile fail emits test.skip", () => {
    writeFileSync(join(inDir, "doc.md"), '```ts compile fail\nconst x: number = "nope"\n```');
    runCli("build", inDir, outDir);
    expect(read(outDir, "doc.md.test.ts")).toContain("test.skip(");
  });
});

// ---------------------------------------------------------------------------
// build — // hidden stripping
// ---------------------------------------------------------------------------

describe("build: // hidden stripping", () => {
  test("strips lines starting with // hidden", () => {
    writeFileSync(join(inDir, "doc.md"), "```ts\n// hidden const setup = 1\nconst x = 1\n```");
    runCli("build", inDir, outDir);
    const out = read(outDir, "doc.md.test.ts");
    expect(out).not.toContain("// hidden");
    expect(out).toContain("const x = 1");
  });

  test("preserves mid-line // hidden occurrences", () => {
    writeFileSync(join(inDir, "doc.md"), "```ts\nconst x = 1 // hidden note\n```");
    runCli("build", inDir, outDir);
    expect(read(outDir, "doc.md.test.ts")).toContain("const x = 1 // hidden note");
  });
});

// ---------------------------------------------------------------------------
// build — test names
// ---------------------------------------------------------------------------

describe("build: test names", () => {
  test("uses filename:line as the test name", () => {
    writeFileSync(join(inDir, "api.md"), "```ts\nconst x = 1\n```");
    runCli("build", inDir, outDir);
    expect(read(outDir, "api.md.test.ts")).toContain('"api.md:1"');
  });

  test("test name is relative to the search dir, not cwd", () => {
    const sub = join(inDir, "docs");
    mkdirSync(sub);
    writeFileSync(join(sub, "guide.md"), "```ts\nconst x = 1\n```");
    runCli("build", sub, outDir);
    expect(read(outDir, "guide.md.test.ts")).toContain('"guide.md:1"');
  });
});

// ---------------------------------------------------------------------------
// test — generates and runs
// Vitest only scans within the project root, so we use a temp dir inside ROOT.
// ---------------------------------------------------------------------------

describe("test: runs generated tests", () => {
  let runOutDir: string;

  beforeEach(() => {
    runOutDir = mkdtempSync(join(ROOT, "__e2e_"));
  });

  afterEach(() => {
    rmSync(runOutDir, { recursive: true, force: true });
  });

  test("exits 0 when all generated tests pass", () => {
    writeFileSync(join(inDir, "doc.md"), "```ts\nexpect(1 + 1).toBe(2)\n```");
    expect(() => runCli("test", inDir, runOutDir)).not.toThrow();
  });

  test("exits non-zero when a generated test fails", () => {
    writeFileSync(join(inDir, "doc.md"), "```ts\nexpect(1 + 1).toBe(999)\n```");
    expect(() => runCli("test", inDir, runOutDir)).toThrow("CLI failed");
  });

  test("exits 0 when no tests are generated", () => {
    writeFileSync(join(inDir, "doc.md"), "# prose only");
    expect(() => runCli("test", inDir, runOutDir)).not.toThrow();
  });
});
