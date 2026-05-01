import { remark } from "remark";
import { visit } from "unist-util-visit";
import { SUPPORTED_LANGS, ANNOTATIONS, type Annotation, isAnnotation } from "./constants.ts";
import { splitImportsAndBlock } from "./parse.ts";
import { type Logger } from "./logger.ts";

type AnnotationResult =
  | { tag: "ok"; annotation: Annotation }
  | { tag: "none" }
  | { tag: "unknown"; raw: string };

function parseAnnotation(meta: string): AnnotationResult {
  if (!meta) return { tag: "none" };
  if (isAnnotation(meta)) return { tag: "ok", annotation: meta };
  return { tag: "unknown", raw: meta };
}

export class CodeBlock {
  readonly #code: string;
  readonly lang: string;
  readonly #annotation: Annotation | null;
  readonly line: number;

  constructor(code: string, lang: string, annotation: Annotation | null, line: number) {
    this.#code = code;
    this.lang = lang;
    this.#annotation = annotation;
    this.line = line;
  }

  get outputExtension(): "ts" | "tsx" {
    return this.isJsx() ? "tsx" : "ts";
  }

  get code(): string {
    return this.#code;
  }

  isJsx(): boolean {
    return this.lang === "tsx" || this.lang === "jsx";
  }

  isSkipped(): boolean {
    return this.#annotation !== ANNOTATIONS.RUN && this.#annotation !== ANNOTATIONS.FAIL;
  }

  shouldFail(): boolean {
    return this.#annotation === ANNOTATIONS.FAIL;
  }

  splitImports(): { imports: string[]; body: string } {
    return splitImportsAndBlock(this);
  }
}

export function parseCodeFences(source: string, log: Logger): CodeBlock[] {
  const tree = remark().parse(source);
  const blocks: CodeBlock[] = [];

  visit(tree, "code", (node) => {
    const { lang, meta } = node;
    if (!meta || !lang || !SUPPORTED_LANGS.has(lang)) return;

    const result = parseAnnotation(meta);
    if (result.tag === "unknown") {
      log.error(`unknown annotation in code block: "${result.raw}"`);
      return;
    }
    if (result.tag === "none" || result.annotation === ANNOTATIONS.SKIP) return;
    blocks.push(new CodeBlock(node.value, lang, result.annotation, node.position!.start.line));
  });

  return blocks;
}
