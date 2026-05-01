export const SUPPORTED_LANGS = new Set(["ts", "typescript", "tsx", "jsx", "js", "javascript"]);

export const ANNOTATIONS = {
  SKIP: "skip",
  RUN: "run",
  FAIL: "fail",
} as const;

export type Annotation = (typeof ANNOTATIONS)[keyof typeof ANNOTATIONS];

export function isAnnotation(s: unknown): s is Annotation {
  return Object.values(ANNOTATIONS).some((x) => x === s);
}
