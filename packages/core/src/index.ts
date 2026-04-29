import { readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join, relative, sep } from "path";
import { globSync } from "tinyglobby";
import { parseCodeFences, type CodeBlock } from "./blocks.ts";

export { CodeBlock, parseCodeFences } from "./blocks.ts";
export { SUPPORTED_LANGS, ANNOTATIONS } from "./constants.ts";

export function findDocs(dir: string): string[] {
  return globSync("**/*.{md,mdx}", { cwd: dir, ignore: ["**/node_modules/**"], absolute: true });
}

export interface GenerateDeps {
  findDocs: (dir: string) => string[];
  readFile: (path: string) => string;
  writeFile: (path: string, content: string) => void;
  clearDir: (path: string) => void;
  log: (message: string) => void;
}

const defaultGenerateDeps: GenerateDeps = {
  findDocs,
  readFile: (path) => readFileSync(path, "utf8"),
  writeFile: writeFileSync,
  clearDir: (path) => {
    rmSync(path, { recursive: true, force: true });
    mkdirSync(path, { recursive: true });
  },
  log: (message) => console.log(message),
};

export function generate(
  searchDir: string,
  outputDir: string,
  renderBlockFile: (mdPath: string, block: CodeBlock) => string,
  deps?: Partial<GenerateDeps>,
): number {
  const resolved = { ...defaultGenerateDeps, ...deps };
  const docs = resolved.findDocs(searchDir);
  if (docs.length === 0) {
    resolved.log(`No .md or .mdx files found under ${searchDir}`);
    return 0;
  }

  resolved.clearDir(outputDir);
  let total = 0;

  for (const mdPath of docs) {
    const source = resolved.readFile(mdPath);
    const blocks = parseCodeFences(source);
    if (blocks.length === 0) continue;

    const relPath = relative(searchDir, mdPath);
    const baseName = relPath.split(sep).join("_");

    for (const block of blocks) {
      const outName = `${baseName}_${block.line}.test.${block.outputExtension}`;
      const outPath = join(outputDir, outName);
      resolved.writeFile(outPath, renderBlockFile(relPath, block));
      resolved.log(`  ${relPath}:${block.line} -> ${outPath}`);
      total++;
    }
  }

  resolved.log(`\nTotal: ${total} tests`);
  return total;
}
