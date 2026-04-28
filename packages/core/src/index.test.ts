import { describe, test, expect } from "vitest";
import type { DocBlock } from "./index";
import { parseBlocks, outputExtension, stripHidden, generateTestFile } from "./index";

describe("parseBlocks", () => {
  test("extracts ts blocks", () => {
    const blocks = parseBlocks("```ts\nconst x = 1\n```");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!).toMatchObject({ code: "const x = 1", lang: "ts", meta: "", line: 1 });
  });

  test("extracts typescript blocks", () => {
    expect(parseBlocks("```typescript\nconst x = 1\n```")).toHaveLength(1);
  });

  test("extracts tsx blocks", () => {
    const blocks = parseBlocks("```tsx\n<div />\n```");
    expect(blocks[0]!.lang).toBe("tsx");
  });

  test("extracts jsx blocks", () => {
    const blocks = parseBlocks("```jsx\n<div />\n```");
    expect(blocks[0]!.lang).toBe("jsx");
  });

  test("extracts js blocks", () => {
    expect(parseBlocks("```js\nconst x = 1\n```")).toHaveLength(1);
  });

  test("extracts javascript blocks", () => {
    expect(parseBlocks("```javascript\nconst x = 1\n```")).toHaveLength(1);
  });

  test("ignores unsupported langs", () => {
    expect(parseBlocks("```python\nx = 1\n```")).toHaveLength(0);
  });

  test("skips blocks annotated skip", () => {
    expect(parseBlocks("```ts skip\nconst x = 1\n```")).toHaveLength(0);
    expect(parseBlocks("```tsx skip\n<div />\n```")).toHaveLength(0);
  });

  test("preserves meta string verbatim", () => {
    const [b] = parseBlocks("```ts should throw\nthrow new Error()\n```");
    expect(b!.meta).toBe("should throw");
  });

  test("handles multiple blocks", () => {
    const md = "```ts\nconst a = 1\n```\n\n```tsx\n<p />\n```";
    const blocks = parseBlocks(md);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.lang).toBe("ts");
    expect(blocks[1]!.lang).toBe("tsx");
  });

  test("works on MDX prose (treats it as markdown)", () => {
    const mdx = "# Heading\n\nSome prose with JSX <Component />.\n\n```tsx\n<div />\n```";
    expect(parseBlocks(mdx)).toHaveLength(1);
  });
});

describe("outputExtension", () => {
  const block = (lang: string) => ({ code: "", lang, meta: "", line: 1 });

  test("returns ts for ts-only blocks", () => {
    expect(outputExtension([block("ts"), block("typescript")])).toBe("ts");
  });

  test("returns tsx when any block is tsx", () => {
    expect(outputExtension([block("ts"), block("tsx")])).toBe("tsx");
  });

  test("returns tsx when any block is jsx", () => {
    expect(outputExtension([block("jsx")])).toBe("tsx");
  });

  test("returns ts for empty list", () => {
    expect(outputExtension([])).toBe("ts");
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
