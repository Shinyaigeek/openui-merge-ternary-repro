import { mergeStatements, parse } from "@openuidev/lang-core";

// Component schema for parse(): Stack(children), Title(text)
const schema = new Map([
  ["Stack", { params: [{ name: "children", required: true }] }],
  ["Title", { params: [{ name: "text", required: true }] }],
]);

// A program whose `a` statement is a multi-line ternary.
// This layout is explicitly supported by the parser: both split() and the
// streaming scanner detect `?` / `:` continuation lines.
const existing = [
  "root = Stack([a, b])",
  "a = $ok",
  '  ? Title("Yes")',
  '  : Title("No")',
  'b = Title("Footer")',
].join("\n");

// An incremental-editing patch that touches only the unrelated `b` statement.
const patch = 'b = Title("Updated")';

console.log("── existing program ──────────────────────────────");
console.log(existing);

// Baseline: parse() accepts the multi-line ternary and keeps both branches.
const parsed = JSON.stringify(parse(existing, schema));
const parseKeepsBranches = parsed.includes("Yes") && parsed.includes("No");
console.log("\nparse() keeps both ternary branches:", parseKeepsBranches ? "yes ✅" : "NO ❌");

// Bug: mergeStatements() splits the same source on raw newlines, chops the
// ternary after `a = $ok`, and silently drops both branch lines.
const merged = mergeStatements(existing, patch);
console.log("\n── mergeStatements(existing, 'b = Title(\"Updated\")') ──");
console.log(merged);

const mergeKeepsBranches = merged.includes('? Title("Yes")') && merged.includes(': Title("No")');
console.log("\nmerge keeps both ternary branches:", mergeKeepsBranches ? "yes ✅" : "NO ❌");

if (parseKeepsBranches && !mergeKeepsBranches) {
  console.log(
    "\nBUG REPRODUCED: parse() accepts this program, but mergeStatements()",
  );
  console.log(
    "collapsed `a` to just `$ok` — both ternary branches were silently lost.",
  );
  process.exit(1);
}
console.log("\nBug not reproduced (fixed?).");
