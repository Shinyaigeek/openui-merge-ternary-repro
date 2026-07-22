# OpenUI `mergeStatements()` destroys multi-line ternary statements that `parse()` accepts

Minimal Node-only reproduction against the published package:

- `@openuidev/lang-core@0.2.9`

## What happens

The OpenUI Lang parser explicitly supports multi-line ternaries — both
`split()` and the streaming scanner detect `?` / `:` continuation lines. But
`mergeStatements()` (the public API for [incremental editing](https://www.openui.com/docs/openui-lang/incremental-editing))
re-splits the *existing* program with a character-level splitter that breaks on
every depth-0 newline, with no ternary tracking.

Given this existing program:

```
root = Stack([a, b])
a = $ok
  ? Title("Yes")
  : Title("No")
b = Title("Footer")
```

and a patch that touches only the unrelated `b` statement:

```
b = Title("Updated")
```

`mergeStatements(existing, patch)` returns:

```
root = Stack([a, b])
a = $ok
b = Title("Updated")
```

- **Expected:** the `a` statement is preserved intact (`parse()` sees it as a
  full ternary, so `merge` should too).
- **Actual:** the ternary is chopped at the first newline; the `? Title("Yes")`
  and `: Title("No")` fragments fail the statement-shape check and are
  **silently dropped**. `a` collapses to `$ok` and both branches are lost.

## Run it

```sh
npm install
npm run repro   # exits 1 while the bug reproduces
```

Output:

```
parse() keeps both ternary branches: yes ✅
merge keeps both ternary branches: NO ❌
BUG REPRODUCED: ...
```

## Root cause

`packages/lang-core/src/parser/merge.ts` — `splitStatementSource()` tracks only
bracket depth and string state, and splits on any depth-0 newline:

```ts
else if (c === "\n" && depth <= 0) { /* statement boundary */ }
```

By contrast, the token-level `split()` in `statements.ts` (used by `parse()`)
tracks `ternaryDepth` and peeks ahead for `?` / `:` continuation lines before
treating a newline as a statement boundary. The two disagree, so any program
that streams/parses fine gets corrupted the moment it goes through
`mergeStatements` — even when the patch doesn't touch the ternary statement.

The dropped-fragment path is `parseStatements()`: each chopped line goes
through `split(tokenize(raw))`, and a line starting with `?` or `:` doesn't
match the `Ident = expression` shape, so it yields no statement and is
discarded without an error.

## Suggested fix

Give `splitStatementSource()` the same ternary-continuation handling as
`split()` / the streaming scanner: before treating a depth-0 newline as a
boundary, peek at the next non-whitespace character and keep collecting when it
is `?`, or `:` while inside a ternary.
