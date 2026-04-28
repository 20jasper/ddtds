import { remark } from "remark";
import { visit } from "unist-util-visit";
import { SUPPORTED_LANGS, ANNOTATIONS } from "./constants.ts";

export class CodeBlock {
  readonly code: string;
  readonly lang: string;
  readonly #meta: string;
  readonly line: number;

  constructor(code: string, lang: string, meta: string | null | undefined, line: number) {
    this.code = code;
    this.lang = lang;
    this.#meta = meta ?? "";
    this.line = line;
  }

  get outputExtension(): "ts" | "tsx" {
    return this.isJsx() ? "tsx" : "ts";
  }

  isJsx(): boolean {
    return this.lang === "tsx" || this.lang === "jsx";
  }

  isSkipped(): boolean {
    return this.#meta.includes(ANNOTATIONS.NO_RUN) || this.#meta.includes(ANNOTATIONS.COMPILE_FAIL);
  }

  shouldThrow(): boolean {
    return this.#meta.includes(ANNOTATIONS.SHOULD_THROW);
  }
}

export function parseCodeFences(source: string): CodeBlock[] {
  const tree = remark().parse(source);
  const blocks: CodeBlock[] = [];

  visit(tree, "code", (node) => {
    const { lang, meta } = node;
    if (!lang || !SUPPORTED_LANGS.has(lang)) return;
    if ((meta ?? "").split(" ").includes(ANNOTATIONS.SKIP)) return;

    blocks.push(new CodeBlock(node.value, lang, meta, node.position!.start.line));
  });

  return blocks;
}

export function stripHidden(code: string): string {
  return code
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("// hidden"))
    .join("\n");
}
