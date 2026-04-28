import { describe, test, expect, vi } from "vitest";
import { CodeBlock, parseCodeFences, stripHidden, generateBlockFile, generate } from "./index";

describe("parseBlocks", () => {
  test("extracts ts blocks", () => {
    const blocks = parseCodeFences("```ts\nconst x = 1\n```");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!).toMatchObject({ code: "const x = 1", lang: "ts", line: 1 });
  });

  test("extracts typescript blocks", () => {
    expect(parseCodeFences("```typescript\nconst x = 1\n```")).toHaveLength(1);
  });

  test("extracts tsx blocks", () => {
    const blocks = parseCodeFences("```tsx\n<div />\n```");
    expect(blocks[0]!.lang).toBe("tsx");
  });

  test("extracts jsx blocks", () => {
    const blocks = parseCodeFences("```jsx\n<div />\n```");
    expect(blocks[0]!.lang).toBe("jsx");
  });

  test("extracts js blocks", () => {
    expect(parseCodeFences("```js\nconst x = 1\n```")).toHaveLength(1);
  });

  test("extracts javascript blocks", () => {
    expect(parseCodeFences("```javascript\nconst x = 1\n```")).toHaveLength(1);
  });

  test("ignores unsupported langs", () => {
    expect(parseCodeFences("```python\nx = 1\n```")).toHaveLength(0);
  });

  test("skips blocks annotated skip", () => {
    expect(parseCodeFences("```ts skip\nconst x = 1\n```")).toHaveLength(0);
    expect(parseCodeFences("```tsx skip\n<div />\n```")).toHaveLength(0);
  });

  test("preserves meta string verbatim", () => {
    const [b] = parseCodeFences("```ts should throw\nthrow new Error()\n```");
    expect(b!.shouldThrow()).toBe(true);
  });

  test("handles multiple blocks", () => {
    const md = "```ts\nconst a = 1\n```\n\n```tsx\n<p />\n```";
    const blocks = parseCodeFences(md);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.lang).toBe("ts");
    expect(blocks[1]!.lang).toBe("tsx");
  });

  test("works on MDX prose (treats it as markdown)", () => {
    const mdx = "# Heading\n\nSome prose with JSX <Component />.\n\n```tsx\n<div />\n```";
    expect(parseCodeFences(mdx)).toHaveLength(1);
  });
});

describe("CodeBlock.outputExtension", () => {
  test("returns ts for ts block", () => {
    expect(new CodeBlock("", "ts", "", 1).outputExtension).toBe("ts");
  });

  test("returns tsx for tsx block", () => {
    expect(new CodeBlock("", "tsx", "", 1).outputExtension).toBe("tsx");
  });

  test("returns tsx for jsx block", () => {
    expect(new CodeBlock("", "jsx", "", 1).outputExtension).toBe("tsx");
  });
});

describe("stripHidden", () => {
  test("removes lines starting with // hidden", () => {
    const out = stripHidden("// hidden setup\nconst x = 1");
    expect(out).toBe("const x = 1");
  });

  test("removes lines with leading whitespace before // hidden", () => {
    const out = stripHidden("  // hidden const y = 2\nconst x = 1");
    expect(out).not.toContain("// hidden");
    expect(out).toContain("const x = 1");
  });

  test("keeps mid-line occurrences of // hidden", () => {
    const out = stripHidden("const x = 1 // hidden note");
    expect(out).toBe("const x = 1 // hidden note");
  });

  test("keeps non-hidden lines intact", () => {
    expect(stripHidden("const x = 1\nconst y = 2")).toBe("const x = 1\nconst y = 2");
  });
});

function block(code: string, meta = "", line = 1, lang = "ts"): CodeBlock {
  return new CodeBlock(code, lang, meta, line);
}

describe("generateBlockFile: header", () => {
  test("always includes vitest import", () => {
    expect(generateBlockFile("t.md", block(""))).toContain("from 'vitest'");
  });
});

describe("generateBlockFile: test names", () => {
  test("uses mdPath:line as the test name", () => {
    const out = generateBlockFile("docs/api.md", block("const x = 1", "", 42));
    expect(out).toContain('"docs/api.md:42"');
  });
});

describe("generateBlockFile: imports", () => {
  test("hoists static imports to file level", () => {
    const b = block("import { foo } from './foo'\nexpect(foo).toBe(1)");
    const out = generateBlockFile("t.md", b);
    const [header, body] = out.split(/test\(/);
    expect(header).toContain("import { foo } from './foo'");
    expect(body).not.toContain("import {");
  });

  test("// hidden import is hoisted as a real import", () => {
    const b = block("// hidden import { x } from './setup'\nexpect(x).toBe(1)");
    const out = generateBlockFile("t.md", b);
    expect(out).not.toContain("// hidden");
    expect(out).toContain("import { x } from './setup'");
    const [, body] = out.split(/test\(/);
    expect(body).not.toContain("import {");
  });

  test("// hidden non-import lines are stripped", () => {
    const b = block("// hidden const x = 1\nexpect(1).toBe(1)");
    const out = generateBlockFile("t.md", b);
    expect(out).not.toContain("// hidden");
    expect(out).not.toContain("const x = 1");
  });
});

describe("generateBlockFile: annotations", () => {
  test("should throw wraps block in rejects.toThrow()", () => {
    const b = block('throw new Error("boom")', "should throw");
    const out = generateBlockFile("t.md", b);
    expect(out).toContain(".rejects.toThrow()");
    expect(out).not.toContain("test.skip");
  });

  test("no run emits test.skip", () => {
    const out = generateBlockFile("t.md", block("const x = 1", "no run"));
    expect(out).toContain("test.skip(");
  });

  test("compile fail emits test.skip", () => {
    const out = generateBlockFile("t.md", block('const x: number = "nope"', "compile fail"));
    expect(out).toContain("test.skip(");
  });

  test("should throw still strips // hidden non-imports", () => {
    const b = block("// hidden const x = 1\nthrow new Error()", "should throw");
    const out = generateBlockFile("t.md", b);
    expect(out).not.toContain("// hidden");
    expect(out).toContain(".rejects.toThrow()");
  });
});

describe("generate", () => {
  test("returns 0 and logs when no docs are found", () => {
    const log = vi.fn();
    expect(generate("/docs", "__doctests__", { findDocs: () => [], log })).toBe(0);
    expect(log).toHaveBeenCalledWith("No .md or .mdx files found under /docs");
  });

  test("writes one file per block named by line number", () => {
    const writes: Array<{ path: string; content: string }> = [];
    const total = generate("/repo", "__doctests__", {
      findDocs: () => ["/repo/guide.md"],
      readFile: () => "```ts\nconst x = 1\n```",
      writeFile: (path, content) => writes.push({ path, content }),
      clearDir: vi.fn(),
      log: vi.fn(),
    });

    expect(total).toBe(1);
    expect(writes[0]!.path).toBe("__doctests__/guide.md_1.test.ts");
    expect(writes[0]!.content).toContain('"guide.md:1"');
  });
});
