import { describe, test, expect, vi } from "vitest";
import { generate } from "@ddtds/vitest";

describe("generate", () => {
  test("returns 0 and logs when no docs are found", () => {
    const log = vi.fn<() => void>();
    const total = generate("/docs", "__doctests__", {
      findDocs: () => [],
      log,
    });

    expect(total).toBe(0);
    expect(log).toHaveBeenCalledWith("No .md or .mdx files found under /docs");
  });

  test("generates test files for supported code blocks", () => {
    const writes: Array<{ path: string; content: string }> = [];
    const total = generate("/repo", "__doctests__", {
      findDocs: () => ["/repo/guide.md", "/repo/empty.md"],
      readFile: (path) => {
        if (path.endsWith("guide.md")) return "```ts\nconst x = 1\n```";
        return "# prose only";
      },
      writeFile: (path, content) => writes.push({ path, content }),
      clearDir: vi.fn<() => void>(),
      log: vi.fn<() => void>(),
    });

    expect(total).toBe(1);
    expect(writes).toHaveLength(1);
    expect(writes[0]!.path).toBe("__doctests__/guide.md_1.test.ts");
    expect(writes[0]!.content).toContain('"guide.md:1"');
  });
});
