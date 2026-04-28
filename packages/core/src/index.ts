import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, relative, sep } from "path";
import { globSync } from "tinyglobby";
import { parseCodeFences } from "./blocks.ts";
import { generateTestFile } from "./codegen.ts";

export { CodeBlock, parseCodeFences, stripHidden } from "./blocks.ts";
export { SUPPORTED_LANGS, ANNOTATIONS } from "./constants.ts";
export { generateTestFile } from "./codegen.ts";

export function findDocs(dir: string): string[] {
  return globSync("**/*.{md,mdx}", { cwd: dir, ignore: ["**/node_modules/**"], absolute: true });
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
    const blocks = parseCodeFences(source);
    if (blocks.length === 0) continue;

    const relPath = relative(searchDir, mdPath);
    const ext = blocks.some((b) => b.outputExtension === "tsx") ? "tsx" : "ts";
    const outName = relPath.split(sep).join("_") + `.test.${ext}`;
    const outPath = join(outputDir, outName);

    resolved.writeFile(outPath, generateTestFile(relPath, blocks));
    total += blocks.length;
    resolved.log(`  ${relPath} -> ${outPath} (${blocks.length} tests)`);
  }

  resolved.log(`\nTotal: ${total} tests`);
  return total;
}
