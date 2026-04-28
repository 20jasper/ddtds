import type { CodeBlock } from "./blocks.ts";
import { stripHidden } from "./blocks.ts";

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
    return `const { default: ${s} } = await import(${src});\n`;
  });
}

function sanitizeBody(code: string): string {
  code = code.replace(/^export\s+default\s+(function|class|async\s+function)\b/gm, "$1");
  code = code.replace(/^export\s+default\s+/gm, "const _default = ");
  code = code.replace(
    /^export\s+(const|let|var|function|class|async\s+function|abstract\s+class)\b/gm,
    "$1",
  );
  code = code.replace(/^export\s+(type|interface)\s+/gm, "$1 ");
  code = code.replace(/^declare\s+(module|namespace|global)\b[\s\S]*?\n\}/gm, "");
  code = code.replace(/^declare\s+[^\n]+\n?/gm, "");
  return code.replace(/^\n+/, "").trimEnd();
}

export function generateTestFile(mdPath: string, blocks: CodeBlock[]): string {
  const headerLines = ["import { test, expect } from 'vitest'"];
  if (blocks.some((b) => b.isJsx())) {
    headerLines.push("import { render, screen, fireEvent } from '@testing-library/react'");
  }

  const header = headerLines.join("\n") + "\n\n";

  const tests = blocks.map((block) => {
    const stripped = stripHidden(block.code);
    const body = sanitizeBody(convertImportsToDynamic(stripped));
    const name = `${mdPath}:${block.line}`;

    if (block.isSkipped()) {
      return `test.skip(${JSON.stringify(name)}, async () => {\n${body}\n})`;
    }

    if (block.shouldThrow()) {
      return `test(${JSON.stringify(name)}, async () => {\nawait expect(async () => {\n${body}\n}).rejects.toThrow()\n})`;
    }

    return `test(${JSON.stringify(name)}, async () => {\n${body}\n})`;
  });

  return header + tests.join("\n\n");
}
