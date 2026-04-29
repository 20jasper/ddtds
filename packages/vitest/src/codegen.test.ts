import { describe, expect, test } from "vitest";
import { ANNOTATIONS, CodeBlock } from "@ddtds/core";
import { generateBlockFile } from "./codegen";

function block(code: string, meta = "", line = 1, lang = "ts"): CodeBlock {
  return new CodeBlock(code, lang, meta, line);
}

function assertTestRun(x: string) {
  expect(x).toContain("test");
  expect(x).not.toContain("skip");
  expect(x).not.toContain("reject");
}

function assertTestSkip(x: string) {
  expect(x).toContain("test");
  expect(x).toContain("skip");
  expect(x).not.toContain("reject");
}

function assertTestReject(x: string) {
  expect(x).toContain("test");
  expect(x).not.toContain("skip");
  expect(x).toContain("reject");
}

describe("generateBlockFile: basic", () => {
  test("emits body directly into the generated test", () => {
    const output = generateBlockFile(
      "example.md",
      block("const hi = '10';\nexpect(hi).toBe('10');"),
    );

    assertTestRun(output);
    expect(output).toContain("expect(hi).toBe('10');");

    expect(output).toMatchInlineSnapshot(`
      "import { test, expect } from 'vitest'
      test("example.md:1", async () => {
        const hi = '10';
        expect(hi).toBe('10');
      });"
    `);
  });
});

describe("generateBlockFile: imports", () => {
  test("hoists multiline imports", () => {
    const code = "import {\n  foo,\n  bar,\n  baz,\n} from './utils'\nfoo()";
    const out = generateBlockFile("t.md", block(code));

    assertTestRun(out);
    expect(out).toMatchInlineSnapshot(`
      "import { test, expect } from 'vitest'
      import {
        foo,
        bar,
        baz,
      } from './utils'
      test("t.md:1", async () => {
        foo()
      });"
    `);
  });
});

describe("generateBlockFile: annotations", () => {
  test("should throw wraps in rejects.toThrow", () => {
    const out = generateBlockFile(
      "t.md",
      block('throw new Error("boom")', ANNOTATIONS.SHOULD_THROW),
    );

    assertTestReject(out);
    expect(out).toContain(".rejects.toThrow();");
    expect(out).toMatchInlineSnapshot(`
      "import { test, expect } from 'vitest'
      test("t.md:1", async () => {
        await expect(async () => {
        throw new Error("boom")
        }).rejects.toThrow();
      });"
    `);
  });

  test("skip annotations emit test.skip", () => {
    const noRun = generateBlockFile("t.md", block("const x = 1", ANNOTATIONS.NO_RUN));

    assertTestSkip(noRun);
    expect(noRun).not.toContain("const x = 1");
    expect(noRun).toMatchInlineSnapshot(`
      "import { test, expect } from 'vitest'
      test.skip("t.md:1", async () => {
      });"
    `);

    const compileFail = generateBlockFile("t.md", block("const x = 1", ANNOTATIONS.COMPILE_FAIL));

    assertTestSkip(compileFail);
    expect(compileFail).not.toContain("const x = 1");
    expect(compileFail).toMatchInlineSnapshot(`
      "import { test, expect } from 'vitest'
      test.skip("t.md:1", async () => {
      });"
    `);
  });
});
