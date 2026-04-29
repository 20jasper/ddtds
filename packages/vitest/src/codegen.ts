import type { CodeBlock } from "@ddtds/core";

function indent(code: string): string {
  return code
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function renderTest(kind: "test" | "test.skip", name: string, body: string): string {
  if (body.length === 0) {
    return `${kind}(${name}, async () => {\n});`;
  }

  return `${kind}(${name}, async () => {\n${indent(body)}\n});`;
}

export function generateBlockFile(mdPath: string, block: CodeBlock): string {
  const { imports, body } = block.splitImports();
  const name = JSON.stringify(`${mdPath}:${block.line}`);

  const headerLines = ["import { test, expect } from 'vitest'", ...imports];
  const header = `${headerLines.join("\n")}\n`;

  if (block.isSkipped()) {
    return `${header}${renderTest("test.skip", name, "")}`;
  }

  if (block.shouldThrow()) {
    return `${header}${renderTest(
      "test",
      name,
      ["await expect(async () => {", body, "}).rejects.toThrow();"].join("\n"),
    )}`;
  }

  return `${header}${renderTest("test", name, body)}`;
}
