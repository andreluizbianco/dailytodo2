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

const { filterArchivedTodos } = require(path.join(
  __dirname,
  "..",
  "utils",
  "archiveSearch.ts",
));

const archivedTodos = [
  { id: 1, text: "Travel", note: "Book train tickets" },
  { id: 2, text: "Groceries", note: "[ ] Milk\n[x] Coffee" },
  { id: 3, text: "Work", note: "- Draft memo\n- Send update" },
];

assert.deepEqual(
  filterArchivedTodos(archivedTodos, { titleQuery: "trav", bodyQuery: "" }),
  [archivedTodos[0]],
);

assert.deepEqual(
  filterArchivedTodos(archivedTodos, { titleQuery: "", bodyQuery: "coffee" }),
  [archivedTodos[1]],
);

assert.deepEqual(
  filterArchivedTodos(archivedTodos, {
    titleQuery: "work",
    bodyQuery: "memo",
  }),
  [archivedTodos[2]],
);

assert.deepEqual(
  filterArchivedTodos(archivedTodos, {
    titleQuery: "work",
    bodyQuery: "coffee",
  }),
  [],
);

console.log("archive search tests passed");
