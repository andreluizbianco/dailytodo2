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

const { shouldArchiveCompletedActiveTodo } = require(path.join(
  __dirname,
  "..",
  "utils",
  "todayCompletion.ts",
));

assert.equal(
  shouldArchiveCompletedActiveTodo({
    id: 1,
    text: "Disposable",
    note: "",
    color: "blue",
    isEditing: false,
    noteType: "text",
  }),
  false,
);

assert.equal(
  shouldArchiveCompletedActiveTodo({
    id: 2,
    text: "Repeating",
    note: "",
    color: "blue",
    isEditing: false,
    noteType: "text",
    schedule: {
      mode: "every",
      amount: 1,
      unit: "days",
    },
  }),
  true,
);

console.log("today completion tests passed");
