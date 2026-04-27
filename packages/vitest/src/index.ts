import type { DocBlock } from "@ddtds/core";
import { stripHidden } from "@ddtds/core";

// Matches static import statements
const IMPORT_RE =
  /^import\s+([\s\S]*?)\s+from\s+(['"][^'"]+['"])\s*;?\n?|^import\s+(['"][^'"]+['"])\s*;?\n?/gm;

function convertImportsToDynamic(code: string): string {
  return code.replace(IMPORT_RE, (_, specifiers, from, sideEffect) => {
    if (sideEffect) {
      return `await import(${sideEffect});\n`;
    }
    const src = from.trim();
    const s = specifiers.trim();
    if (s.startsWith("* as ")) {
      const ns = s.slice(5).trim();
      return `const ${ns} = await import(${src});\n`;
    }
    if (s.startsWith("{")) {
      return `const ${s} = await import(${src});\n`;
    }
    // default import
    return `const { default: ${s} } = await import(${src});\n`;
  });
}

function sanitizeBody(code: string): string {
  // Strip `export` from declarations so they're valid inside a function body
  code = code.replace(/^export\s+default\s+(function|class|async\s+function)\b/gm, "$1");
  code = code.replace(/^export\s+default\s+/gm, "const _default = ");
  code = code.replace(
    /^export\s+(const|let|var|function|class|async\s+function|abstract\s+class)\b/gm,
    "$1",
  );
  // Strip type-only exports (export type / export interface)
  code = code.replace(/^export\s+(type|interface)\s+/gm, "$1 ");
  // Strip declare module/namespace/global blocks (type-only, no runtime value)
  code = code.replace(/^declare\s+(module|namespace|global)\b[\s\S]*?\n\}/gm, "");
  // Strip standalone `declare` statements
  code = code.replace(/^declare\s+[^\n]+\n?/gm, "");
  return code.replace(/^\n+/, "").trimEnd();
}

export function generateTestFile(mdPath: string, blocks: DocBlock[]): string {
  const headerLines = ["import { test, expect } from 'vitest'"];
  if (blocks.some((b) => b.lang === "tsx" || b.lang === "jsx")) {
    headerLines.push("import { render, screen, fireEvent } from '@testing-library/react'");
  }

  const processedBlocks: Array<{ block: DocBlock; body: string }> = [];

  for (const block of blocks) {
    const stripped = stripHidden(block.code);
    const withDynamic = convertImportsToDynamic(stripped);
    const body = sanitizeBody(withDynamic);
    processedBlocks.push({ block, body });
  }

  const header = headerLines.join("\n") + "\n\n";

  const tests = processedBlocks.map(({ block, body }) => {
    const name = `${mdPath}:${block.line}`;

    if (block.meta.includes("no run") || block.meta.includes("compile fail")) {
      return `test.skip(${JSON.stringify(name)}, async () => {\n${body}\n})`;
    }

    if (block.meta.includes("should throw")) {
      return `test(${JSON.stringify(name)}, async () => {\nawait expect(async () => {\n${body}\n}).rejects.toThrow()\n})`;
    }

    return `test(${JSON.stringify(name)}, async () => {\n${body}\n})`;
  });

  return header + tests.join("\n\n");
}
