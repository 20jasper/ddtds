import { remark } from "remark";
import { visit } from "unist-util-visit";
import { Node, Project, type SourceFile, SyntaxKind } from "ts-morph";
import { SUPPORTED_LANGS, ANNOTATIONS } from "./constants.ts";

const project = new Project({
  useInMemoryFileSystem: true,
  skipFileDependencyResolution: true,
  compilerOptions: { allowJs: true },
});

export class CodeBlock {
  readonly #code: string;
  readonly lang: string;
  readonly #meta: string;
  readonly line: number;

  constructor(code: string, lang: string, meta: string | null | undefined, line: number) {
    this.#code = code;
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

  splitImports(): { imports: string[]; body: string } {
    const file = project.createSourceFile(this.isJsx() ? "block.tsx" : "block.ts", this.#code, {
      overwrite: true,
    });

    sanitizeExports(file);

    const importDecls = file.getImportDeclarations();
    const imports = importDecls.map((d) => d.getText().trimEnd());
    importDecls.forEach((d) => d.remove());

    return {
      imports,
      body: file
        .getStatements()
        .map((stmt) => stmt.getText().trimEnd())
        .join("\n"),
    };
  }
}

function sanitizeExports(file: SourceFile): void {
  for (const stmt of file.getStatements()) {
    if (
      Node.isVariableStatement(stmt) ||
      Node.isFunctionDeclaration(stmt) ||
      Node.isClassDeclaration(stmt) ||
      Node.isInterfaceDeclaration(stmt) ||
      Node.isTypeAliasDeclaration(stmt) ||
      Node.isEnumDeclaration(stmt) ||
      Node.isModuleDeclaration(stmt)
    ) {
      if (stmt.hasModifier(SyntaxKind.DeclareKeyword)) {
        stmt.remove();
        continue;
      }
      stmt.toggleModifier("default", false);
      stmt.toggleModifier("export", false);
    }
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
