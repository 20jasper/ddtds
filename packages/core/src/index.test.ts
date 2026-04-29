import { describe, test, expect, vi } from "vitest";
import { ANNOTATIONS, CodeBlock, parseCodeFences, generate } from "./index";

describe("parseBlocks", () => {
  test("extracts ts blocks", () => {
    const blocks = parseCodeFences("```ts\nconst x = 1\n```");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!).toMatchObject({ lang: "ts", line: 1 });
  });

  test("extracts typescript blocks", () => {
    expect(parseCodeFences("```typescript\nconst x = 1\n```")).toHaveLength(1);
  });

  test("extracts jsx/tsx blocks", () => {
    const tsx = parseCodeFences("```tsx\n<div />\n```");
    const jsx = parseCodeFences("```jsx\n<div />\n```");
    expect(tsx[0]!).toMatchObject({ lang: "tsx" });
    expect(jsx[0]!).toMatchObject({ lang: "jsx" });
  });

  test("ignores unsupported langs", () => {
    expect(parseCodeFences("```python\nx = 1\n```")).toHaveLength(0);
  });

  test("skips blocks annotated skip", () => {
    expect(parseCodeFences(`\`\`\`ts ${ANNOTATIONS.SKIP}\nconst x = 1\n\`\`\``)).toHaveLength(0);
  });

  test("preserves meta string verbatim", () => {
    const [b] = parseCodeFences(`\`\`\`ts ${ANNOTATIONS.SHOULD_THROW}\nthrow new Error()\n\`\`\``);
    expect(b!.shouldThrow()).toBe(true);
  });
});

const renderBlockFile = (mdPath: string, block: CodeBlock): string => `// ${mdPath}:${block.line}`;

describe("generate", () => {
  test("returns 0 and logs when no docs are found", () => {
    const log = vi.fn<() => void>();
    expect(generate("/docs", "__doctests__", renderBlockFile, { findDocs: () => [], log })).toBe(0);
    expect(log).toHaveBeenCalledWith("No .md or .mdx files found under /docs");
  });

  test("writes one file per block named by line number", () => {
    const writes: Array<{ path: string; content: string }> = [];
    const total = generate("/repo", "__doctests__", renderBlockFile, {
      findDocs: () => ["/repo/guide.md"],
      readFile: () => "```ts\nconst x = 1\n```",
      writeFile: (path, content) => writes.push({ path, content }),
      clearDir: vi.fn<() => void>(),
      log: vi.fn<() => void>(),
    });

    expect(total).toBe(1);
    expect(writes[0]!.path).toBe("__doctests__/guide.md_1.test.ts");
    expect(writes[0]!.content).toContain("// guide.md:1");
  });
});
