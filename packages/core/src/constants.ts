export const SUPPORTED_LANGS = new Set(["ts", "typescript", "tsx", "jsx", "js", "javascript"]);

export const ANNOTATIONS = {
  SKIP: "skip",
  NO_RUN: "no-run",
  COMPILE_FAIL: "compile-fail",
  SHOULD_THROW: "should-throw",
} as const;
