import { remark } from "remark";
import { visit } from "unist-util-visit";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join, relative, sep } from "path";

export interface DocBlock {
  code: string;
  lang: string;
  meta: string;
  line: number;
}

const SUPPORTED_LANGS = new Set(["ts", "typescript", "tsx", "jsx", "js", "javascript"]);

export function parseBlocks(source: string): DocBlock[] {
  const tree = remark().parse(source);
  const blocks: DocBlock[] = [];

  visit(tree, "code", (node) => {
    if (!SUPPORTED_LANGS.has(node.lang ?? "")) return;
    const meta = node.meta ?? "";
    if (meta.split(" ").includes("skip")) return;

    blocks.push({
      code: node.value,
      lang: node.lang!,
      meta,
      line: node.position!.start.line,
    });
  });

  return blocks;
}

export function outputExtension(blocks: DocBlock[]): "ts" | "tsx" {
  return blocks.some((b) => b.lang === "tsx" || b.lang === "jsx") ? "tsx" : "ts";
}

export function stripHidden(code: string): string {
  return code
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("// hidden"))
    .join("\n");
}

export function findDocs(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findDocs(full));
    } else if (entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) {
      results.push(full);
    }
  }
  return results;
}

export interface GenerateDeps {
  findDocs: (dir: string) => string[];
  readFile: (path: string) => string;
  writeFile: (path: string, content: string) => void;
  ensureDir: (path: string) => void;
  log: (message: string) => void;
}

const defaultGenerateDeps: GenerateDeps = {
  findDocs,
  readFile: (path) => readFileSync(path, "utf8"),
  writeFile: writeFileSync,
  ensureDir: (path) => mkdirSync(path, { recursive: true }),
  log: (message) => console.log(message),
};

export function generate(
  searchDir: string,
  outputDir: string,
  deps?: Partial<GenerateDeps>,
): number {
  const resolved = { ...defaultGenerateDeps, ...deps };
  const docs = resolved.findDocs(searchDir);
  if (docs.length === 0) {
    resolved.log(`No .md or .mdx files found under ${searchDir}`);
    return 0;
  }

  resolved.ensureDir(outputDir);
  let total = 0;

  for (const mdPath of docs) {
    const source = resolved.readFile(mdPath);
    const blocks = parseBlocks(source);
    if (blocks.length === 0) continue;

    const relPath = relative(searchDir, mdPath);
    const ext = outputExtension(blocks);
    const outName = relPath.split(sep).join("_") + `.test.${ext}`;
    const outPath = join(outputDir, outName);

    resolved.writeFile(outPath, generateTestFile(relPath, blocks));
    total += blocks.length;
    resolved.log(`  ${relPath} -> ${outPath} (${blocks.length} tests)`);
  }

  resolved.log(`\nTotal: ${total} tests`);
  return total;
}

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
