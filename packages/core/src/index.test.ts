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

function block(code: string, meta = "", line = 1, lang = "ts"): CodeBlock {
  return new CodeBlock(code, lang, meta, line);
}

describe("CodeBlock.splitImports", () => {
  test("hoists static imports to file level", () => {
    const b = block("import { foo } from './foo'\nexpect(foo).toBe(1)");
    const { imports, body } = b.splitImports();
    expect(imports).toEqual(["import { foo } from './foo'"]);
    expect(body).not.toContain("import {");
  });

  test("strips export modifiers from runtime declarations", () => {
    const b = block("export const base = 2;\nexport function addOne(x: number) { return x + 1; }");
    const { body } = b.splitImports();
    expect(body).toContain("const base = 2;");
    expect(body).toContain("function addOne");
    expect(body).not.toContain("export");
  });

  test("strips export default from named declarations", () => {
    const b = block("export default class Greeter {}\nconst g = new Greeter();");
    const { body } = b.splitImports();
    expect(body).toContain("class Greeter {}");
    expect(body).toContain("const g = new Greeter();");
    expect(body).not.toContain("export default");
  });

  test("rewrites export default expressions", () => {
    const b = block("export default 1;");
    const { body } = b.splitImports();
    expect(body).toMatchInlineSnapshot(`"const ______default_that_does_not_conflict = 1;"`);
  });
});

describe("generate", () => {
  test("writes one file per block named by line number", () => {
    const writes: Array<{ path: string; content: string }> = [];
    const total = generate("/repo", "__doctests__", renderBlockFile, {
      findDocs: () => ["/repo/guide.md"],
      readFile: () => "```ts\nconst x = 1\n```",
      writeFile: (path, content) => writes.push({ path, content }),
      clearDir: vi.fn<() => void>(),
    });

    expect(total).toBe(1);
    expect(writes[0]!.path).toBe("__doctests__/guide.md_1.test.ts");
    expect(writes[0]!.content).toContain("// guide.md:1");
  });
});

function renderBlockFile(mdPath: string, codeBlock: CodeBlock): string {
  return `// ${mdPath}:${codeBlock.line}`;
}
