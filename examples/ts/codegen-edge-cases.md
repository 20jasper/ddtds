# Codegen Import/Export Edge Cases

These snippets are aimed at the import/export transformations used when generating doctests.

## Import Hoisting

Named imports from Node builtins should still work after import extraction and hoisting.

```ts
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(new URL("file:///tmp/example.ts")));
expect(join(dir, "child")).toContain("child");
```

## Exported Runtime Declarations

Export modifiers on runtime declarations should be sanitized without changing behavior.

```ts
export const base = 2;
export function addOne(x: number): number {
  return x + 1;
}
export class Counter {
  value = 0;

  inc() {
    this.value += 1;
  }
}

const c = new Counter();
c.inc();
expect(addOne(base)).toBe(3);
expect(c.value).toBe(1);
```

## Export Default Class

`export default class` should be rewritten without leaving invalid syntax.

```ts
export default class Greeter {
  constructor(private readonly name: string) {}

  greet() {
    return `hello ${this.name}`;
  }
}

const g = new Greeter("world");
expect(g.greet()).toBe("hello world");
```

## Declare Stripping

`declare` statements should be removed from executable output.

```ts
declare const neverDefined: number;

const safe = 1;
expect(safe).toBe(1);
```

## Exported Type-Only Declarations

Type-only declarations should survive type-checking and not affect runtime assertions.

```ts
export interface User {
  id: string;
}

export type UserMap = Record<string, User>;

const users: UserMap = {
  a: { id: "a" },
};

expect(users.a?.id).toBe("a");
```
