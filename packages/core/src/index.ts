import { remark } from "remark";
import { visit } from "unist-util-visit";

export interface DocBlock {
  code: string;
  lang: string;
  meta: string;
  line: number;
}

const SUPPORTED_LANGS = new Set(["ts", "typescript", "tsx", "jsx"]);

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
