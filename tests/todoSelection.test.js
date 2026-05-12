const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = function loadTs(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  module._compile(output, filename);
};

const { getNextSelectedTodoAfterRemoval } = require(path.join(
  __dirname,
  "..",
  "utils",
  "todoSelection.ts",
));

const todos = [
  { id: 1, text: "One" },
  { id: 2, text: "Two" },
  { id: 3, text: "Three" },
];

assert.deepEqual(getNextSelectedTodoAfterRemoval(todos, 2), {
  id: 3,
  text: "Three",
});

assert.deepEqual(getNextSelectedTodoAfterRemoval(todos, 3), {
  id: 2,
  text: "Two",
});

assert.equal(getNextSelectedTodoAfterRemoval([{ id: 1 }], 1), null);
assert.equal(getNextSelectedTodoAfterRemoval(todos, 99), null);

console.log("todo selection tests passed");
