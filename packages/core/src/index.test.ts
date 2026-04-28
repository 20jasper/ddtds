import { describe, test, expect } from "vitest";
import { parseBlocks, outputExtension, stripHidden } from "./index";

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
