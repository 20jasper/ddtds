import type { CodeBlock } from "./blocks.ts";

// Matches static import statements (including multiline specifiers)
const IMPORT_RE =
  /^import\s+([\s\S]*?)\s+from\s+(['"][^'"]+['"])\s*;?\n?|^import\s+(['"][^'"]+['"])\s*;?\n?/gm;

function splitCode(code: string): { imports: string[]; body: string } {
  const hiddenImports: string[] = [];

  const withoutHidden = code
    .split("\n")
    .filter((line) => {
      const t = line.trimStart();
      if (t.startsWith("// hidden import ")) {
        hiddenImports.push(t.slice("// hidden ".length).trimEnd());
        return false;
      }
      return !t.startsWith("// hidden");
    })
    .join("\n");

  const visibleImports: string[] = [];
  const body = withoutHidden.replace(IMPORT_RE, (match) => {
    visibleImports.push(match.trimEnd());
    return "";
  });

  return {
    imports: [...hiddenImports, ...visibleImports],
    body: body.replace(/^\n+/, "").trimEnd(),
  };
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

export function generateBlockFile(mdPath: string, block: CodeBlock): string {
  const { imports, body } = splitCode(block.code);
  const name = JSON.stringify(`${mdPath}:${block.line}`);
  const cleanBody = sanitizeBody(body);

  const headerLines = ["import { test, expect } from 'vitest'", ...imports];
  const header = headerLines.join("\n") + "\n\n";

  if (block.isSkipped()) {
    return header + `test.skip(${name}, async () => {\n${cleanBody}\n})`;
  }
  if (block.shouldThrow()) {
    return (
      header +
      `test(${name}, async () => {\nawait expect(async () => {\n${cleanBody}\n}).rejects.toThrow()\n})`
    );
  }
  return header + `test(${name}, async () => {\n${cleanBody}\n})`;
}
