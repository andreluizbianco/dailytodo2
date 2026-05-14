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

const { getArchiveGridRows } = require(path.join(
  __dirname,
  "..",
  "utils",
  "archiveLayout.ts",
));

const notes = [
  { id: 1, text: "First" },
  { id: 2, text: "Second" },
  { id: 3, text: "Third" },
  { id: 4, text: "Fourth" },
  { id: 5, text: "Fifth" },
];

assert.deepEqual(getArchiveGridRows(notes), [
  [{ id: 1, text: "First" }, { id: 2, text: "Second" }],
  [{ id: 3, text: "Third" }, { id: 4, text: "Fourth" }],
  [{ id: 5, text: "Fifth" }, null],
]);

assert.deepEqual(getArchiveGridRows([]), []);

console.log("archive layout tests passed");
