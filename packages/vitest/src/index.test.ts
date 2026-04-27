import { describe, test, expect } from "vitest";
import type { DocBlock } from "@ddtds/core";
import { generateTestFile } from "./index";

function block(code: string, meta = "", line = 1, lang = "ts"): DocBlock {
  return { code, lang, meta, line };
}

describe("generateTestFile: header", () => {
  test("always includes vitest import", () => {
    expect(generateTestFile("t.md", [])).toContain("from 'vitest'");
  });

  test("adds @testing-library/react for tsx blocks", () => {
    const out = generateTestFile("t.mdx", [block("<div />", "", 1, "tsx")]);
    expect(out).toContain("from '@testing-library/react'");
    expect(out).toContain("render");
    expect(out).toContain("screen");
    expect(out).toContain("fireEvent");
  });

  test("adds @testing-library/react for jsx blocks", () => {
    const out = generateTestFile("t.mdx", [block("<div />", "", 1, "jsx")]);
    expect(out).toContain("from '@testing-library/react'");
  });

  test("omits @testing-library/react for ts-only blocks", () => {
    const out = generateTestFile("t.md", [block("const x = 1")]);
    expect(out).not.toContain("@testing-library/react");
  });
});

describe("generateTestFile: test names", () => {
  test("uses mdPath:line as the test name", () => {
    const out = generateTestFile("docs/api.md", [block("const x = 1", "", 42)]);
    expect(out).toContain('"docs/api.md:42"');
  });
});

describe("generateTestFile: // hidden stripping", () => {
  test("strips lines starting with // hidden", () => {
    const b = block("// hidden import { x } from './setup'\nexpect(1).toBe(1)");
    const out = generateTestFile("t.md", [b]);
    expect(out).not.toContain("// hidden");
    expect(out).toContain("expect(1).toBe(1)");
  });

  test("// hidden import stays out of the test body for tsx blocks", () => {
    const code =
      "// hidden import { render, screen } from '@testing-library/react'\nrender(<div />)";
    const b = block(code, "", 1, "tsx");
    const out = generateTestFile("t.mdx", [b]);
    const testBody = out.split(/async \(\) => \{/)[1];
    expect(testBody).not.toContain("import {");
    expect(out).toContain("from '@testing-library/react'");
  });
});

describe("generateTestFile: annotations", () => {
  test("should throw wraps block in rejects.toThrow()", () => {
    const b = block('throw new Error("boom")', "should throw");
    const out = generateTestFile("t.md", [b]);
    expect(out).toContain(".rejects.toThrow()");
    expect(out).not.toContain("test.skip");
  });

  test("no run emits test.skip", () => {
    const out = generateTestFile("t.md", [block("const x = 1", "no run")]);
    expect(out).toContain("test.skip(");
  });

  test("compile fail emits test.skip", () => {
    const out = generateTestFile("t.md", [block('const x: number = "nope"', "compile fail")]);
    expect(out).toContain("test.skip(");
  });

  test("should throw still strips // hidden", () => {
    const b = block("// hidden const x = 1\nthrow new Error()", "should throw");
    const out = generateTestFile("t.md", [b]);
    expect(out).not.toContain("// hidden");
    expect(out).toContain(".rejects.toThrow()");
  });
});

describe("generateTestFile: multiple blocks", () => {
  test("generates one test per block", () => {
    const blocks = [block("const a = 1"), block("const b = 2", "", 5)];
    const out = generateTestFile("t.md", blocks);
    expect(out.match(/^test[.(]/gm)).toHaveLength(2);
  });
});
