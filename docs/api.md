# API Examples

Code blocks tagged `ts` or `typescript` are extracted and run as vitest tests.
Add `skip` after the lang tag to exclude a block.

## Arrays

Mapping over an array doubles each element:

```ts
const result = [1, 2, 3].map((x) => x * 2);
expect(result).toEqual([2, 4, 6]);
```

Filtering keeps only items that pass the predicate:

```ts
const evens = [1, 2, 3, 4, 5].filter((x) => x % 2 === 0);
expect(evens).toEqual([2, 4]);
```

`reduce` accumulates values:

```ts
const sum = [1, 2, 3, 4].reduce((acc, x) => acc + x, 0);
expect(sum).toBe(10);
```

## Strings

Template literals interpolate values:

```ts
const name = "world";
expect(`hello ${name}`).toBe("hello world");
```

`String.prototype.split` turns a string into tokens:

```ts
const parts = "a,b,c".split(",");
expect(parts).toEqual(["a", "b", "c"]);
```

## Objects

Spread merges objects without mutating the originals:

```ts
const base = { a: 1, b: 2 };
const extended = { ...base, c: 3 };
expect(extended).toEqual({ a: 1, b: 2, c: 3 });
expect(base).toEqual({ a: 1, b: 2 });
```

## Async

`Promise.all` resolves when every promise settles:

```ts
const results = await Promise.all([Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)]);
expect(results).toEqual([1, 2, 3]);
```

## Skipped example

This block is intentionally broken but tagged `skip` so it won't run:

```ts skip
expect(1).toBe(999);
```
